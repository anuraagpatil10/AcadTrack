const db = require('../config/db');

// GET /course/my-courses — fetch all courses for the logged-in professor
exports.getCourses = async (req, res) => {
    try {
        const professorId = req.user.role_id;
        const result = await db.query(
            'SELECT id, name, code FROM subjects WHERE professor_id = $1 ORDER BY id DESC',
            [professorId]
        );
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Get Courses Error:', err);
        res.status(500).json({ error: 'Failed to fetch courses' });
    }
};

// POST /course/create — create a new course/subject
exports.createCourse = async (req, res) => {
    try {
        const professorId = req.user.role_id;
        const { name, code } = req.body;

        if (!name || !code) {
            return res.status(400).json({ error: 'Course name and code are required' });
        }

        // Check for duplicate code under this professor
        const existing = await db.query(
            'SELECT id FROM subjects WHERE code = $1 AND professor_id = $2',
            [code, professorId]
        );
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'A course with this code already exists' });
        }

        const result = await db.query(
            'INSERT INTO subjects (name, code, professor_id) VALUES ($1, $2, $3) RETURNING id, name, code',
            [name, code, professorId]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Create Course Error:', err);
        res.status(500).json({ error: 'Failed to create course' });
    }
};

// GET /course/students — get all students with optional filters
exports.getAllStudents = async (req, res) => {
    try {
        const { semester, department, search } = req.query;

        let query = `
            SELECT s.id AS student_id, s.roll_no, s.department, s.semester, u.name, u.email
            FROM students s
            JOIN users u ON s.user_id = u.id
            WHERE 1=1
        `;
        const params = [];

        if (semester) {
            params.push(semester);
            query += ` AND s.semester = $${params.length}`;
        }
        if (department) {
            params.push(department);
            query += ` AND s.department = $${params.length}`;
        }
        if (search) {
            params.push(`%${search}%`);
            query += ` AND (u.name ILIKE $${params.length} OR s.roll_no ILIKE $${params.length})`;
        }

        query += ' ORDER BY s.semester, s.department, s.roll_no';

        const result = await db.query(query, params);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Get All Students Error:', err);
        res.status(500).json({ error: 'Failed to fetch students' });
    }
};

// GET /course/:subjectId/enrolled — get students enrolled in a specific course
exports.getEnrolledStudents = async (req, res) => {
    try {
        const { subjectId } = req.params;
        const result = await db.query(
            `SELECT s.id AS student_id, s.roll_no, s.department, s.semester, u.name, u.email
             FROM enrollments e
             JOIN students s ON e.student_id = s.id
             JOIN users u ON s.user_id = u.id
             WHERE e.subject_id = $1
             ORDER BY s.roll_no`,
            [subjectId]
        );
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Get Enrolled Students Error:', err);
        res.status(500).json({ error: 'Failed to fetch enrolled students' });
    }
};

// POST /course/:subjectId/enroll — bulk enroll students into a course
exports.enrollStudents = async (req, res) => {
    try {
        const { subjectId } = req.params;
        const { studentIds } = req.body;

        if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
            return res.status(400).json({ error: 'No students selected' });
        }

        // Verify this subject belongs to the professor
        const subjectCheck = await db.query(
            'SELECT id FROM subjects WHERE id = $1 AND professor_id = $2',
            [subjectId, req.user.role_id]
        );
        if (subjectCheck.rows.length === 0) {
            return res.status(403).json({ error: 'You do not own this course' });
        }

        // Bulk insert with ON CONFLICT to skip duplicates
        const values = studentIds.map((sid, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(', ');
        const flatParams = studentIds.flatMap(sid => [sid, subjectId]);

        await db.query(
            `INSERT INTO enrollments (student_id, subject_id) VALUES ${values} ON CONFLICT DO NOTHING`,
            flatParams
        );

        res.status(201).json({ message: `${studentIds.length} student(s) enrolled successfully` });
    } catch (err) {
        console.error('Enroll Students Error:', err);
        res.status(500).json({ error: 'Failed to enroll students' });
    }
};

// DELETE /course/:subjectId/unenroll — remove a student from a course
exports.unenrollStudent = async (req, res) => {
    try {
        const { subjectId } = req.params;
        const { studentId } = req.body;

        // Verify ownership
        const subjectCheck = await db.query(
            'SELECT id FROM subjects WHERE id = $1 AND professor_id = $2',
            [subjectId, req.user.role_id]
        );
        if (subjectCheck.rows.length === 0) {
            return res.status(403).json({ error: 'You do not own this course' });
        }

        await db.query(
            'DELETE FROM enrollments WHERE student_id = $1 AND subject_id = $2',
            [studentId, subjectId]
        );

        res.status(200).json({ message: 'Student removed from course' });
    } catch (err) {
        console.error('Unenroll Student Error:', err);
        res.status(500).json({ error: 'Failed to unenroll student' });
    }
};

// GET /course/my-enrolled-courses — fetch courses a student is enrolled in
exports.getStudentCourses = async (req, res) => {
    try {
        const studentId = req.user.role_id;
        const result = await db.query(
            `SELECT s.id, s.name, s.code, u.name AS professor_name
             FROM enrollments e
             JOIN subjects s ON e.subject_id = s.id
             JOIN professors p ON s.professor_id = p.id
             JOIN users u ON p.user_id = u.id
             WHERE e.student_id = $1
             ORDER BY s.name`,
            [studentId]
        );
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Get Student Courses Error:', err);
        res.status(500).json({ error: 'Failed to fetch enrolled courses' });
    }
};
