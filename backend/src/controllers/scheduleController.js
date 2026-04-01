const db = require('../config/db');

// Helper to get local date string (YYYY-MM-DD) without UTC shift
const localDateStr = (d) => {
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// GET /schedule/:subjectId — get recurring schedules for a subject
exports.getSchedules = async (req, res) => {
    try {
        const { subjectId } = req.params;
        const result = await db.query(
            'SELECT * FROM class_schedules WHERE subject_id = $1 ORDER BY day_of_week, start_time',
            [subjectId]
        );
        res.status(200).json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch schedules' });
    }
};

// POST /schedule/:subjectId — add a recurring schedule slot
exports.addSchedule = async (req, res) => {
    try {
        const { subjectId } = req.params;
        const { day_of_week, start_time, end_time } = req.body;

        // Verify ownership
        const check = await db.query('SELECT id FROM subjects WHERE id = $1 AND professor_id = $2', [subjectId, req.user.role_id]);
        if (check.rows.length === 0) return res.status(403).json({ error: 'Not your course' });

        const result = await db.query(
            'INSERT INTO class_schedules (subject_id, day_of_week, start_time, end_time) VALUES ($1, $2, $3, $4) RETURNING *',
            [subjectId, day_of_week, start_time, end_time]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to add schedule' });
    }
};

// DELETE /schedule/slot/:id — remove a recurring schedule slot
exports.deleteSchedule = async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('DELETE FROM class_schedules WHERE id = $1', [id]);
        res.status(200).json({ message: 'Schedule removed' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete schedule' });
    }
};

// POST /schedule/:subjectId/cancel — cancel a specific class on a date
exports.cancelClass = async (req, res) => {
    try {
        const { subjectId } = req.params;
        const { date, start_time, end_time, note } = req.body;

        const check = await db.query('SELECT id FROM subjects WHERE id = $1 AND professor_id = $2', [subjectId, req.user.role_id]);
        if (check.rows.length === 0) return res.status(403).json({ error: 'Not your course' });

        const result = await db.query(
            `INSERT INTO class_instances (subject_id, date, start_time, end_time, status, note)
             VALUES ($1, $2, $3, $4, 'cancelled', $5)
             ON CONFLICT (subject_id, date, start_time) DO UPDATE SET status = 'cancelled', note = $5
             RETURNING *`,
            [subjectId, date, start_time, end_time, note || null]
        );
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to cancel class' });
    }
};

// POST /schedule/:subjectId/extra — schedule an extra class
exports.scheduleExtra = async (req, res) => {
    try {
        const { subjectId } = req.params;
        const { date, start_time, end_time, note } = req.body;

        const check = await db.query('SELECT id FROM subjects WHERE id = $1 AND professor_id = $2', [subjectId, req.user.role_id]);
        if (check.rows.length === 0) return res.status(403).json({ error: 'Not your course' });

        const result = await db.query(
            `INSERT INTO class_instances (subject_id, date, start_time, end_time, status, note)
             VALUES ($1, $2, $3, $4, 'extra', $5)
             RETURNING *`,
            [subjectId, date, start_time, end_time, note || null]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ error: 'A class already exists at this time' });
        console.error(err);
        res.status(500).json({ error: 'Failed to schedule extra class' });
    }
};

// DELETE /schedule/instance/:id — remove a class instance (undo cancel / remove extra)
exports.deleteInstance = async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('DELETE FROM class_instances WHERE id = $1', [id]);
        res.status(200).json({ message: 'Instance removed' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete instance' });
    }
};

// GET /schedule/:subjectId/classes?from=&to= — get effective classes for a date range
exports.getClasses = async (req, res) => {
    try {
        const { subjectId } = req.params;
        const { from, to } = req.query;

        // Get recurring schedules
        const schedules = await db.query(
            'SELECT * FROM class_schedules WHERE subject_id = $1',
            [subjectId]
        );

        // Get instances (cancellations + extras) in range
        const instances = await db.query(
            'SELECT * FROM class_instances WHERE subject_id = $1 AND date BETWEEN $2 AND $3 ORDER BY date, start_time',
            [subjectId, from, to]
        );

        // Build effective class list
        const startDate = new Date(from);
        const endDate = new Date(to);
        const classes = [];
        const instanceMap = {};

        // Index instances by date+time
        instances.rows.forEach(inst => {
            const key = `${localDateStr(new Date(inst.date))}_${inst.start_time}`;
            instanceMap[key] = inst;
        });

        // Generate scheduled classes from recurring schedules
        const current = new Date(startDate);
        while (current <= endDate) {
            const dateStr = localDateStr(current);
            const dayOfWeek = current.getDay();

            schedules.rows.filter(s => s.day_of_week === dayOfWeek).forEach(s => {
                const key = `${dateStr}_${s.start_time}`;
                const instance = instanceMap[key];

                if (instance && instance.status === 'cancelled') {
                    classes.push({
                        date: dateStr,
                        start_time: s.start_time,
                        end_time: s.end_time,
                        status: 'cancelled',
                        note: instance.note,
                        instance_id: instance.id,
                        schedule_id: s.id
                    });
                    delete instanceMap[key]; // consumed
                } else {
                    classes.push({
                        date: dateStr,
                        start_time: s.start_time,
                        end_time: s.end_time,
                        status: 'scheduled',
                        schedule_id: s.id
                    });
                }
            });

            current.setDate(current.getDate() + 1);
        }

        // Add remaining extra instances not matched
        instances.rows.filter(inst => inst.status === 'extra').forEach(inst => {
            classes.push({
                date: localDateStr(new Date(inst.date)),
                start_time: inst.start_time,
                end_time: inst.end_time,
                status: 'extra',
                note: inst.note,
                instance_id: inst.id
            });
        });

        // Sort by date then time
        classes.sort((a, b) => `${a.date}_${a.start_time}`.localeCompare(`${b.date}_${b.start_time}`));

        res.status(200).json(classes);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to get classes' });
    }
};

// GET /schedule/:subjectId/today — check if there's an active class right now
exports.getTodayClasses = async (req, res) => {
    try {
        const { subjectId } = req.params;
        const today = new Date();
        const dateStr = localDateStr(today);
        const dayOfWeek = today.getDay();

        // Get recurring schedules for today's day
        const schedules = await db.query(
            'SELECT * FROM class_schedules WHERE subject_id = $1 AND day_of_week = $2',
            [subjectId, dayOfWeek]
        );

        // Get any instances for today (cancellations / extras)
        const instances = await db.query(
            'SELECT * FROM class_instances WHERE subject_id = $1 AND date = $2',
            [subjectId, dateStr]
        );

        const cancelledTimes = new Set();
        const extraClasses = [];

        instances.rows.forEach(inst => {
            if (inst.status === 'cancelled') cancelledTimes.add(inst.start_time);
            if (inst.status === 'extra') extraClasses.push(inst);
        });

        const todayClasses = [];

        // Add scheduled (non-cancelled) classes
        schedules.rows.forEach(s => {
            if (!cancelledTimes.has(s.start_time)) {
                todayClasses.push({
                    start_time: s.start_time,
                    end_time: s.end_time,
                    status: 'scheduled'
                });
            }
        });

        // Add extra classes
        extraClasses.forEach(e => {
            todayClasses.push({
                start_time: e.start_time,
                end_time: e.end_time,
                status: 'extra',
                note: e.note
            });
        });

        todayClasses.sort((a, b) => a.start_time.localeCompare(b.start_time));

        res.status(200).json({ date: dateStr, classes: todayClasses });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to check today classes' });
    }
};
