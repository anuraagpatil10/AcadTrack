const db = require('../config/db');

// --- Helper Functions ---
function haversineDistance(lat1, lon1, lat2, lon2) {
    const toRad = (value) => (value * Math.PI) / 180;
    const R = 6371e3; // Earth radius in meters
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in meters
}

// --- Professor Endpoints ---
exports.startLectureSession = async (req, res) => {
    const { subject_id, latitude, longitude } = req.body;
    const professor_id = req.user.role_id;
    try {
        let lecture_session_id;

        // Check if there is already an active session for today
        const activeRes = await db.query(
            `SELECT id FROM lecture_sessions 
             WHERE subject_id = $1 AND professor_id = $2 
             AND DATE(start_time) = CURRENT_DATE 
             AND end_time IS NULL
             ORDER BY start_time DESC LIMIT 1`,
            [subject_id, professor_id]
        );

        if (activeRes.rows.length > 0) {
            lecture_session_id = activeRes.rows[0].id;
        } else {
            // Create new lecture session
            const sessionRes = await db.query(
                'INSERT INTO lecture_sessions (subject_id, professor_id) VALUES ($1, $2) RETURNING id',
                [subject_id, professor_id]
            );
            lecture_session_id = sessionRes.rows[0].id;
        }
        
        await db.query(
            'INSERT INTO professor_location_pings (lecture_session_id, latitude, longitude) VALUES ($1, $2, $3)',
            [lecture_session_id, latitude, longitude]
        );

        res.status(200).json({ lecture_session_id, message: 'Lecture session started' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.pingLectureSession = async (req, res) => {
    const { lecture_session_id, latitude, longitude } = req.body;
    try {
        await db.query(
            'INSERT INTO professor_location_pings (lecture_session_id, latitude, longitude) VALUES ($1, $2, $3)',
            [lecture_session_id, latitude, longitude]
        );
        res.status(200).json({ message: 'Professor ping recorded' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.completeLectureSession = async (req, res) => {
    const { lecture_session_id } = req.body;
    try {
        await db.query(
            'UPDATE lecture_sessions SET end_time = CURRENT_TIMESTAMP, is_active = FALSE WHERE id = $1',
            [lecture_session_id]
        );
        res.status(200).json({ message: 'Lecture session completed' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

// --- Student Endpoints ---
exports.startSession = async (req, res) => {
    const { subject_id, latitude, longitude } = req.body;
    const student_id = req.user.role_id;

    try {
        const result = await db.query(
            'INSERT INTO attendance_sessions (student_id, subject_id, start_time, is_valid) VALUES ($1, $2, CURRENT_TIMESTAMP, $3) RETURNING id',
            [student_id, subject_id, true]
        );
        const session_id = result.rows[0].id;

        if (latitude && longitude) {
            await db.query(
                'INSERT INTO student_location_pings (attendance_session_id, latitude, longitude) VALUES ($1, $2, $3)',
                [session_id, latitude, longitude]
            );
        }

        res.status(200).json({ session_id, message: 'Session started' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.pingSession = async (req, res) => {
    const { session_id, latitude, longitude } = req.body;
    try {
        await db.query(
            'INSERT INTO student_location_pings (attendance_session_id, latitude, longitude) VALUES ($1, $2, $3)',
            [session_id, latitude, longitude]
        );
        res.status(200).json({ message: 'Ping recorded' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Complete session & calculate total duration based on valid ping intervals
exports.completeSession = async (req, res) => {
    const { session_id } = req.body;
    const student_id = req.user.role_id;

    try {
        await db.query(
            'UPDATE attendance_sessions SET end_time = CURRENT_TIMESTAMP WHERE id = $1',
            [session_id]
        );

        const result = await db.query(
            'SELECT subject_id, start_time, end_time FROM attendance_sessions WHERE id = $1',
            [session_id]
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Session not found' });

        const session = result.rows[0];
        
        // 1. Get Scheduled Total Duration
        const today = new Date();
        const dayOfWeek = today.getDay();
        const dateStr = `${today.getFullYear()}-${(today.getMonth()+1).toString().padStart(2,'0')}-${today.getDate().toString().padStart(2,'0')}`;

        const extraResult = await db.query(
            `SELECT start_time, end_time FROM class_instances WHERE subject_id = $1 AND date = $2 AND status = 'extra'`,
            [session.subject_id, dateStr]
        );

        const scheduleResult = await db.query(
            `SELECT start_time, end_time FROM class_schedules WHERE subject_id = $1 AND day_of_week = $2`,
            [session.subject_id, dayOfWeek]
        );

        const allSlots = [...extraResult.rows, ...scheduleResult.rows];

        // Total duration is scheduled class duration
        let totalDurationMins = 60; // Fallback: 60 min if no schedule found
        if (allSlots.length > 0) {
            const slot = allSlots[0];
            const [sh, sm] = slot.start_time.split(':').map(Number);
            const [eh, em] = slot.end_time.split(':').map(Number);
            totalDurationMins = (eh * 60 + em) - (sh * 60 + sm);
        }

        let status = 'absent';
        let validTimeSecs = 0;
        let percentagePresence = 0;

        // 2. Fetch active lecture session to get professor pings
        const lectureRes = await db.query(
             `SELECT id FROM lecture_sessions WHERE subject_id = $1 AND DATE(start_time) = CURRENT_DATE ORDER BY start_time DESC LIMIT 1`,
             [session.subject_id]
        );

        if (lectureRes.rows.length > 0) {
             const lecture_session_id = lectureRes.rows[0].id;
             const profPingsRes = await db.query(
                 'SELECT latitude, longitude, timestamp FROM professor_location_pings WHERE lecture_session_id = $1 ORDER BY timestamp ASC',
                 [lecture_session_id]
             );
             const studentPingsRes = await db.query(
                 'SELECT latitude, longitude, timestamp FROM student_location_pings WHERE attendance_session_id = $1 ORDER BY timestamp ASC',
                 [session_id]
             );

             const profPings = profPingsRes.rows;
             const studentPings = studentPingsRes.rows;

             if (profPings.length > 0 && studentPings.length > 0) {
                 let previousTime = new Date(studentPings[0].timestamp);

                 for (let i = 1; i < studentPings.length; i++) {
                     const sp = studentPings[i];
                     const currentTime = new Date(sp.timestamp);
                     const intervalSecs = (currentTime - previousTime) / 1000;

                     // Match with the closest professor location timestamp
                     const closestProf = profPings.reduce((prev, curr) => {
                         const prevDiff = Math.abs(new Date(prev.timestamp) - previousTime);
                         const currDiff = Math.abs(new Date(curr.timestamp) - previousTime);
                         return currDiff < prevDiff ? curr : prev;
                     });

                     const distance = haversineDistance(
                         sp.latitude, sp.longitude,
                         closestProf.latitude, closestProf.longitude
                     );

                     // Accumulate valid interval if within 30 meters
                     if (distance <= 30) {
                         validTimeSecs += intervalSecs;
                     }

                     previousTime = currentTime;
                 }
             }
        }

        const validTimeMins = validTimeSecs / 60;
        percentagePresence = validTimeMins / totalDurationMins;

        if (percentagePresence >= 0.5) {
            status = 'present';
        }

        // Insert into attendance_records
        await db.query(
            'INSERT INTO attendance_records (student_id, subject_id, date, status) VALUES ($1, $2, CURRENT_DATE, $3)',
            [student_id, session.subject_id, status]
        );

        res.status(200).json({ 
            total_duration: Math.round(totalDurationMins), 
            valid_time: Number(validTimeMins.toFixed(2)), 
            percentage_presence: Number(percentagePresence.toFixed(2)),
            status,
            message: `Attendance marked ${status}`
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getStudentAttendance = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.query(
            'SELECT a.*, s.name as subject_name FROM attendance_records a JOIN subjects s ON a.subject_id = s.id WHERE a.student_id = $1 ORDER BY a.date DESC',
            [id]
        );
        res.status(200).json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getSubjectAttendance = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.query(
            'SELECT a.*, st.roll_no, u.name as student_name FROM attendance_records a JOIN students st ON a.student_id = st.id JOIN users u ON st.user_id = u.id WHERE a.subject_id = $1 ORDER BY a.date DESC',
            [id]
        );
        res.status(200).json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

// GET /attendance/student/:studentId/subject/:subjectId — attendance for specific student+subject
exports.getStudentSubjectAttendance = async (req, res) => {
    const { studentId, subjectId } = req.params;
    try {
        const result = await db.query(
            `SELECT date, status FROM attendance_records
             WHERE student_id = $1 AND subject_id = $2
             ORDER BY date ASC`,
            [studentId, subjectId]
        );

        const records = result.rows;
        const total = records.length;
        const present = records.filter(r => r.status === 'present').length;
        const percentage = total > 0 ? ((present / total) * 100).toFixed(1) : 0;

        res.status(200).json({
            records,
            stats: { total, present, absent: total - present, percentage: parseFloat(percentage) }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

// POST /attendance/finalize — mark absent for enrolled students who didn't attend
exports.finalizeAttendance = async (req, res) => {
    const { subject_id, date } = req.body;

    try {
        // Get all enrolled students for this subject
        const enrolled = await db.query(
            'SELECT student_id FROM enrollments WHERE subject_id = $1',
            [subject_id]
        );

        if (enrolled.rows.length === 0) {
            return res.status(200).json({ message: 'No enrolled students', marked: 0 });
        }

        // Get students who already have attendance for this date+subject
        const existing = await db.query(
            'SELECT student_id FROM attendance_records WHERE subject_id = $1 AND date = $2',
            [subject_id, date]
        );
        const existingSet = new Set(existing.rows.map(r => r.student_id));

        // Find students without a record
        const absentStudents = enrolled.rows.filter(e => !existingSet.has(e.student_id));

        if (absentStudents.length === 0) {
            return res.status(200).json({ message: 'All students already have records', marked: 0 });
        }

        // Bulk insert absent records
        const values = absentStudents.map((s, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`).join(', ');
        const params = absentStudents.flatMap(s => [s.student_id, subject_id, date, 'absent']);

        await db.query(
            `INSERT INTO attendance_records (student_id, subject_id, date, status) VALUES ${values} ON CONFLICT DO NOTHING`,
            params
        );

        res.status(200).json({ message: `Marked ${absentStudents.length} student(s) as absent`, marked: absentStudents.length });
    } catch (err) {
        console.error('Finalize Attendance Error:', err);
        res.status(500).json({ error: 'Failed to finalize attendance' });
    }
};
