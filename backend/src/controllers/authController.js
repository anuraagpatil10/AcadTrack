const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

exports.register = async (req, res) => {
    const { name, email, password, role, roll_no, department, semester } = req.body;

    try {
        if (!['student', 'professor', 'admin'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await db.query(
            'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, role',
            [name, email, hashedPassword, role]
        );
        
        const userId = result.rows[0].id;

        if (role === 'student') {
            await db.query(
                'INSERT INTO students (user_id, roll_no, department, semester) VALUES ($1, $2, $3, $4)',
                [userId, roll_no, department, semester]
            );
        } else if (role === 'professor') {
            await db.query(
                'INSERT INTO professors (user_id, department) VALUES ($1, $2)',
                [userId, department]
            );
        } else if (role === 'admin') {
            await db.query(
                'INSERT INTO admins (user_id, department) VALUES ($1, $2)',
                [userId, department || 'ALL']
            );
        }

        res.status(201).json({ message: 'User registered successfully' });
    } catch (err) {
        if (err.code === '23505') { // unique violation
            return res.status(400).json({ error: 'Email already exists' });
        }
        console.error("Register Error:", err);
        res.status(500).json({ error: err.message || 'Server error' });
    }
};

exports.login = async (req, res) => {
    const email = req.body?.email?.trim();
    const password = req.body?.password;

    try {
        console.log('[login] attempt', { email });
        if (!email || !password) {
            console.log('[login] missing_fields', { emailPresent: Boolean(email), passwordPresent: Boolean(password) });
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const result = await db.query(
            'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
            [email]
        );
        if (result.rows.length === 0) {
            console.log('[login] user_not_found', { email });
            return res.status(404).json({ error: 'User not found' });
        }

        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            console.log('[login] invalid_password', { email, user_id: user.id, role: user.role });
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        let id = user.id;
        let details = null;

        if (user.role === 'student') {
            const studentRes = await db.query('SELECT id FROM students WHERE user_id = $1', [user.id]);
            if (studentRes.rows.length === 0) {
                console.log('[login] missing_student_profile', { email, user_id: user.id });
                return res.status(500).json({ error: 'Student profile is missing for this account' });
            }
            id = studentRes.rows[0]?.id;
            details = { student_id: id };
        } else if (user.role === 'professor') {
            const profRes = await db.query('SELECT id FROM professors WHERE user_id = $1', [user.id]);
            if (profRes.rows.length === 0) {
                console.log('[login] missing_professor_profile', { email, user_id: user.id });
                return res.status(500).json({ error: 'Professor profile is missing for this account' });
            }
            id = profRes.rows[0]?.id;
            details = { professor_id: id };
        } else if (user.role === 'admin') {
            const adminRes = await db.query('SELECT id FROM admins WHERE user_id = $1', [user.id]);
            if (adminRes.rows.length === 0) {
                console.log('[login] missing_admin_profile', { email, user_id: user.id });
                return res.status(500).json({ error: 'Admin profile is missing for this account' });
            }
            id = adminRes.rows[0]?.id;
            details = { admin_id: id };
        }

        const token = jwt.sign(
            { user_id: user.id, role: user.role, role_id: id },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        console.log('[login] success', { email, user_id: user.id, role: user.role, role_id: id });

        res.status(200).json({ token, user: { id: user.id, role_id: id, name: user.name, role: user.role } });
    } catch (err) {
        console.error('[login] server_error', { email, message: err.message });
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};
