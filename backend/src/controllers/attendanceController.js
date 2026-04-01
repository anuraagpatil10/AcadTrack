const db = require('../config/db');

// Start a new session in `attendance_sessions`
exports.startSession = async (req, res) => {
    const { subject_id, latitude, longitude } = req.body;
    const student_id = req.user.role_id;

    // Placeholder logic: Verify location
    // In a real system, diff against a known class coordinate

    try {
        const result = await db.query(
            'INSERT INTO attendance_sessions (student_id, subject_id, start_time, is_valid) VALUES ($1, $2, CURRENT_TIMESTAMP, $3) RETURNING id',
            [student_id, subject_id, true]
        );
        res.status(200).json({ session_id: result.rows[0].id, message: 'Session started' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Ping to keep session active
exports.pingSession = async (req, res) => {
    const { session_id, latitude, longitude } = req.body;
    // Just a heartbeat. We can log pings, but updating end_time suffices.
    try {
        await db.query(
            'UPDATE attendance_sessions SET end_time = CURRENT_TIMESTAMP WHERE id = $1',
            [session_id]
        );
        res.status(200).json({ message: 'Ping recorded' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Complete session & calculate total duration
exports.completeSession = async (req, res) => {
    const { session_id } = req.body;
    const student_id = req.user.role_id;

    try {
        const result = await db.query(
            'SELECT subject_id, start_time, end_time FROM attendance_sessions WHERE id = $1',
            [session_id]
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Session not found' });

        const session = result.rows[0];
        const durationMins = (new Date(session.end_time) - new Date(session.start_time)) / 1000 / 60;

        // Look up today's scheduled lecture duration for this subject
        const today = new Date();
        const dayOfWeek = today.getDay();
        const dateStr = `${today.getFullYear()}-${(today.getMonth()+1).toString().padStart(2,'0')}-${today.getDate().toString().padStart(2,'0')}`;

        // Check for extra class today
        const extraResult = await db.query(
            `SELECT start_time, end_time FROM class_instances WHERE subject_id = $1 AND date = $2 AND status = 'extra'`,
            [session.subject_id, dateStr]
        );

        // Check recurring schedule for today's day
        const scheduleResult = await db.query(
            `SELECT start_time, end_time FROM class_schedules WHERE subject_id = $1 AND day_of_week = $2`,
            [session.subject_id, dayOfWeek]
        );

        // Combine all possible class slots for today
        const allSlots = [...extraResult.rows, ...scheduleResult.rows];

        // Calculate lecture duration in minutes from the first matching slot
        let thresholdMinutes = 30; // fallback: 30 min if no schedule found
        if (allSlots.length > 0) {
            const slot = allSlots[0];
            const [sh, sm] = slot.start_time.split(':').map(Number);
            const [eh, em] = slot.end_time.split(':').map(Number);
            const lectureDuration = (eh * 60 + em) - (sh * 60 + sm);
            thresholdMinutes = lectureDuration * 0.5; // 50% of lecture duration
        }

        let status = 'absent';
        if (durationMins >= thresholdMinutes) {
            status = 'present';
        }

        // Insert into attendance_records
        await db.query(
            'INSERT INTO attendance_records (student_id, subject_id, date, status) VALUES ($1, $2, CURRENT_DATE, $3)',
            [student_id, session.subject_id, status]
        );

        res.status(200).json({ message: `Attendance marked ${status}`, durationMins: Math.round(durationMins), thresholdMinutes: Math.round(thresholdMinutes) });
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
