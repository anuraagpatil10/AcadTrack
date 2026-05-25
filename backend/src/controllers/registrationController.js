const db = require('../config/db');

async function getStudentProfile(userId) {
    const result = await db.query(
        `SELECT s.*, u.name, u.email
         FROM students s
         JOIN users u ON s.user_id = u.id
         WHERE s.user_id = $1`,
        [userId]
    );
    return result.rows[0] || null;
}

exports.getCurrentRegistration = async (req, res) => {
    try {
        const student = await getStudentProfile(req.user.user_id);
        if (!student) {
            return res.status(404).json({ error: 'Student profile not found' });
        }

        const semestersRes = await db.query(
            `SELECT *,
                    COALESCE(name, academic_year) AS display_name,
                    COALESCE(semester_no, semester_number) AS normalized_semester_no,
                    COALESCE(registration_open, registration_status = 'open') AS normalized_registration_open
             FROM semesters
             WHERE department = $1
               AND COALESCE(semester_no, semester_number) = $2
             ORDER BY created_at DESC`,
            [student.department, student.semester]
        );

        const semesters = [];
        for (const semester of semestersRes.rows) {
            const [coursesRes, registrationRes] = await Promise.all([
                db.query(
                    `SELECT s.id, s.name, s.code, s.credits, s.course_type, s.elective_group,
                            u.name AS professor_name
                     FROM subjects s
                     LEFT JOIN professors p ON s.professor_id = p.id
                     LEFT JOIN users u ON p.user_id = u.id
                     WHERE s.semester_id = $1 AND s.is_active = TRUE
                     ORDER BY s.course_type, s.elective_group NULLS FIRST, s.code, s.name`,
                    [semester.id]
                ),
                db.query(
                    `SELECT reg.id, reg.total_credits,
                            ARRAY_REMOVE(ARRAY_AGG(src.subject_id), NULL) AS selected_subject_ids
                     FROM semester_registrations reg
                     LEFT JOIN semester_registration_courses src ON src.registration_id = reg.id
                     WHERE reg.semester_id = $1 AND reg.student_id = $2 AND reg.status = 'registered'
                     GROUP BY reg.id`,
                    [semester.id, student.id]
                ),
            ]);

            semesters.push({
                ...semester,
                courses: coursesRes.rows,
                registration: registrationRes.rows[0] || null,
            });
        }

        const gradeSheetsRes = await db.query(
            `SELECT sheet.id, sheet.semester_id, sheet.total_credits, sheet.total_grade_points, sheet.spi, sheet.released_at,
                    COALESCE(sem.name, sem.academic_year) AS semester_name,
                    sem.department,
                    COALESCE(sem.semester_no, sem.semester_number) AS semester_no
             FROM semester_grade_sheets sheet
             JOIN semesters sem ON sheet.semester_id = sem.id
             WHERE sheet.student_id = $1
               AND sem.gradesheet_released = TRUE
             ORDER BY COALESCE(sem.semester_no, sem.semester_number), COALESCE(sem.name, sem.academic_year)`,
            [student.id]
        );

        const gradeSheets = [];
        for (const sheet of gradeSheetsRes.rows) {
            const coursesRes = await db.query(
                `SELECT gsc.*, sub.name AS subject_name, sub.code
                 FROM semester_grade_sheet_courses gsc
                 JOIN subjects sub ON gsc.subject_id = sub.id
                 WHERE gsc.grade_sheet_id = $1
                 ORDER BY sub.code, sub.name`,
                [sheet.id]
            );
            gradeSheets.push({
                ...sheet,
                courses: coursesRes.rows,
            });
        }

        res.status(200).json({
            student: {
                id: student.id,
                name: student.name,
                email: student.email,
                roll_no: student.roll_no,
                department: student.department,
                semester: student.semester,
            },
            semesters,
            grade_sheets: gradeSheets,
        });
    } catch (err) {
        console.error('Get Current Registration Error:', err);
        res.status(500).json({ error: 'Failed to fetch registration details' });
    }
};

exports.submitRegistration = async (req, res) => {
    const { semester_id, selected_subject_ids = [] } = req.body;

    try {
        const student = await getStudentProfile(req.user.user_id);
        if (!student) {
            return res.status(404).json({ error: 'Student profile not found' });
        }

        const semesterRes = await db.query(
            `SELECT *,
                    COALESCE(semester_no, semester_number) AS normalized_semester_no,
                    COALESCE(registration_open, registration_status = 'open') AS normalized_registration_open
             FROM semesters
             WHERE id = $1`,
            [semester_id]
        );
        if (!semesterRes.rows.length) {
            return res.status(404).json({ error: 'Semester not found' });
        }
        const semester = semesterRes.rows[0];

        if (!semester.normalized_registration_open) {
            return res.status(400).json({ error: 'Registration is closed for this semester' });
        }

        if (semester.department !== student.department || Number(semester.normalized_semester_no) !== Number(student.semester)) {
            return res.status(403).json({ error: 'This semester is not available for the student profile' });
        }

        const coursesRes = await db.query(
            `SELECT id, credits, course_type, elective_group
             FROM subjects
             WHERE semester_id = $1 AND is_active = TRUE`,
            [semester_id]
        );
        const courses = coursesRes.rows;
        const courseMap = new Map(courses.map((course) => [course.id, course]));

        const selectedIds = [...new Set(selected_subject_ids.map(Number))];
        const invalidSelection = selectedIds.find((id) => !courseMap.has(id));
        if (invalidSelection) {
            return res.status(400).json({ error: 'One or more selected courses do not belong to this semester' });
        }

        const compulsoryIds = courses.filter((course) => course.course_type === 'compulsory').map((course) => course.id);
        const missingCompulsory = compulsoryIds.filter((id) => !selectedIds.includes(id));
        if (missingCompulsory.length) {
            return res.status(400).json({ error: 'All compulsory courses must be selected' });
        }

        const electiveGroups = new Map();
        courses.filter((course) => course.course_type === 'elective').forEach((course) => {
            if (!electiveGroups.has(course.elective_group)) {
                electiveGroups.set(course.elective_group, []);
            }
            electiveGroups.get(course.elective_group).push(course);
        });

        for (const [group, groupCourses] of electiveGroups.entries()) {
            const chosen = selectedIds.filter((id) => groupCourses.some((course) => course.id === id));
            if (chosen.length > 1) {
                return res.status(400).json({ error: `Only one course can be selected from elective group ${group}` });
            }
        }

        const totalCredits = selectedIds.reduce((sum, id) => sum + Number(courseMap.get(id).credits), 0);
        if (totalCredits !== Number(semester.total_credits)) {
            return res.status(400).json({ error: `Selected course credits (${totalCredits}) must match semester total credits (${semester.total_credits})` });
        }

        const client = await db.getClient();
        try {
            await client.query('BEGIN');
            let registrationId;
            const existingRes = await client.query(
                `SELECT id
                 FROM semester_registrations
                 WHERE semester_id = $1 AND student_id = $2`,
                [semester_id, student.id]
            );

            if (existingRes.rows.length) {
                registrationId = existingRes.rows[0].id;
                await client.query(
                    `UPDATE semester_registrations
                     SET total_credits = $1, status = 'registered', registered_at = CURRENT_TIMESTAMP
                     WHERE id = $2`,
                    [totalCredits, registrationId]
                );
                await client.query('DELETE FROM semester_registration_courses WHERE registration_id = $1', [registrationId]);
            } else {
                const insertRes = await client.query(
                    `INSERT INTO semester_registrations (semester_id, student_id, total_credits)
                     VALUES ($1, $2, $3)
                     RETURNING id`,
                    [semester_id, student.id, totalCredits]
                );
                registrationId = insertRes.rows[0].id;
            }

            for (const subjectId of selectedIds) {
                await client.query(
                    `INSERT INTO semester_registration_courses (registration_id, subject_id)
                     VALUES ($1, $2)`,
                    [registrationId, subjectId]
                );
            }

            await client.query(
                `DELETE FROM enrollments
                 WHERE student_id = $1
                   AND subject_id IN (SELECT id FROM subjects WHERE semester_id = $2)`,
                [student.id, semester_id]
            );

            for (const subjectId of selectedIds) {
                await client.query(
                    `INSERT INTO enrollments (student_id, subject_id)
                     VALUES ($1, $2)
                     ON CONFLICT DO NOTHING`,
                    [student.id, subjectId]
                );
            }

            await client.query(
                'UPDATE semesters SET gradesheet_released = FALSE WHERE id = $1',
                [semester_id]
            );

            await client.query('COMMIT');
            res.status(200).json({ message: 'Semester registration submitted successfully' });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('Submit Registration Error:', err);
        res.status(500).json({ error: err.message || 'Failed to submit registration' });
    }
};
