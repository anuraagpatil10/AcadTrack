const bcrypt = require('bcrypt');
const db = require('../config/db');
const {
    DEFAULT_GRADE_RANGES,
    buildDefaultComponents,
    buildCombinedScores,
    buildCombinedAnalytics,
    GRADE_POINT_MAP,
    normalizeRanges,
    roundTo,
} = require('../utils/grading');

async function getAdminSemester(semesterId) {
    const result = await db.query(
        `SELECT sem.*,
                COALESCE(sem.name, sem.academic_year) AS display_name,
                COALESCE(sem.semester_no, sem.semester_number) AS normalized_semester_no,
                COALESCE(sem.registration_open, sem.registration_status = 'open') AS normalized_registration_open
         FROM semesters sem
         WHERE sem.id = $1`,
        [semesterId]
    );
    return result.rows[0] || null;
}

async function getStoredGradingSchema(subjectId) {
    const schemaRes = await db.query(
        `SELECT id, subject_id, is_released, released_at, created_by, created_at, updated_at
         FROM grading_schemas
         WHERE subject_id = $1`,
        [subjectId]
    );

    if (!schemaRes.rows.length) return null;

    const schema = schemaRes.rows[0];
    const [componentsRes, rangesRes] = await Promise.all([
        db.query(
            `SELECT exam_type, weight_percentage, display_order
             FROM grading_schema_components
             WHERE schema_id = $1
             ORDER BY display_order, id`,
            [schema.id]
        ),
        db.query(
            `SELECT grade_code, min_score, max_score, display_order
             FROM grading_schema_ranges
             WHERE schema_id = $1
             ORDER BY display_order, id`,
            [schema.id]
        ),
    ]);

    return {
        ...schema,
        components: componentsRes.rows.map((row) => ({
            exam_type: row.exam_type,
            weight_percentage: Number(row.weight_percentage),
            display_order: row.display_order,
        })),
        ranges: rangesRes.rows.map((row) => ({
            grade_code: row.grade_code,
            min_score: Number(row.min_score),
            max_score: Number(row.max_score),
            display_order: row.display_order,
        })),
    };
}

async function getSubjectExams(subjectId) {
    const result = await db.query(
        'SELECT id, subject_id, exam_type, max_marks FROM exams WHERE subject_id = $1 ORDER BY exam_type',
        [subjectId]
    );
    return result.rows.map((row) => ({ ...row, max_marks: Number(row.max_marks) }));
}

async function getSubjectMarksRows(subjectId) {
    const result = await db.query(
        `SELECT m.student_id, m.marks_obtained, e.exam_type, e.max_marks
         FROM marks m
         JOIN exams e ON m.exam_id = e.id
         WHERE e.subject_id = $1`,
        [subjectId]
    );
    return result.rows.map((row) => ({
        ...row,
        student_id: Number(row.student_id),
        marks_obtained: Number(row.marks_obtained),
        max_marks: Number(row.max_marks),
    }));
}

async function getSemesterCourses(semesterId) {
    const result = await db.query(
        `SELECT s.*, u.name AS professor_name
         FROM subjects s
         LEFT JOIN professors p ON s.professor_id = p.id
         LEFT JOIN users u ON p.user_id = u.id
         WHERE s.semester_id = $1
         ORDER BY s.course_type, s.code, s.name`,
        [semesterId]
    );
    return result.rows;
}

exports.createUser = async (req, res) => {
    const { name, email, password, role, roll_no, department, semester } = req.body;

    if (!['student', 'professor', 'admin'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const client = await db.getClient();

        try {
            await client.query('BEGIN');
            const userResult = await client.query(
                'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, role',
                [name, email, hashedPassword, role]
            );

            const userId = userResult.rows[0].id;

            if (role === 'student') {
                await client.query(
                    'INSERT INTO students (user_id, roll_no, department, semester) VALUES ($1, $2, $3, $4)',
                    [userId, roll_no, department, semester]
                );
            } else if (role === 'professor') {
                await client.query(
                    'INSERT INTO professors (user_id, department) VALUES ($1, $2)',
                    [userId, department]
                );
            } else {
                await client.query(
                    'INSERT INTO admins (user_id, department) VALUES ($1, $2)',
                    [userId, department || 'ALL']
                );
            }

            await client.query('COMMIT');
            return res.status(201).json({ message: 'User created successfully' });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ error: 'Email already exists' });
        }
        console.error('Admin Create User Error:', err);
        res.status(500).json({ error: 'Failed to create user' });
    }
};

exports.listProfessors = async (req, res) => {
    try {
        const result = await db.query(
            `SELECT p.id, u.name, u.email, p.department
             FROM professors p
             JOIN users u ON p.user_id = u.id
             ORDER BY u.name`
        );
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('List Professors Error:', err);
        res.status(500).json({ error: 'Failed to fetch professors' });
    }
};

exports.createSemester = async (req, res) => {
    const { name, department, semester_no, total_credits } = req.body;

    try {
        const result = await db.query(
            `INSERT INTO semesters (
                name,
                department,
                semester_no,
                semester_number,
                academic_year,
                total_credits,
                registration_open,
                registration_status,
                gradesheet_released,
                created_by
             )
             VALUES ($1, $2, $3, $3, $1, $4, FALSE, 'closed', FALSE, $5)
             RETURNING *,
                       COALESCE(name, academic_year) AS display_name,
                       COALESCE(semester_no, semester_number) AS normalized_semester_no,
                       COALESCE(registration_open, registration_status = 'open') AS normalized_registration_open`,
            [name, department, semester_no, total_credits, req.user.role_id]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Create Semester Error:', err);
        res.status(500).json({ error: 'Failed to create semester' });
    }
};

exports.listSemesters = async (req, res) => {
    try {
        const result = await db.query(
            `SELECT sem.*,
                    COALESCE(sem.name, sem.academic_year) AS display_name,
                    COALESCE(sem.semester_no, sem.semester_number) AS normalized_semester_no,
                    COALESCE(sem.registration_open, sem.registration_status = 'open') AS normalized_registration_open,
                    COUNT(DISTINCT sub.id) AS course_count,
                    COUNT(DISTINCT CASE WHEN gs.is_released THEN sub.id END) AS released_course_count,
                    COUNT(DISTINCT reg.student_id) AS registered_student_count
             FROM semesters sem
             LEFT JOIN subjects sub ON sub.semester_id = sem.id
             LEFT JOIN grading_schemas gs ON gs.subject_id = sub.id
             LEFT JOIN semester_registrations reg ON reg.semester_id = sem.id AND reg.status = 'registered'
             GROUP BY sem.id
             ORDER BY COALESCE(sem.semester_no, sem.semester_number), sem.department, COALESCE(sem.name, sem.academic_year)`
        );
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('List Semesters Error:', err);
        res.status(500).json({ error: 'Failed to fetch semesters' });
    }
};

exports.getSemesterDetails = async (req, res) => {
    const { semesterId } = req.params;

    try {
        const semester = await getAdminSemester(semesterId);
        if (!semester) {
            return res.status(404).json({ error: 'Semester not found' });
        }

        const [courses, registrations, gradeSheets] = await Promise.all([
            getSemesterCourses(semesterId),
            db.query(
                `SELECT reg.id, reg.student_id, reg.total_credits, reg.registered_at, u.name AS student_name, st.roll_no
                 FROM semester_registrations reg
                 JOIN students st ON reg.student_id = st.id
                 JOIN users u ON st.user_id = u.id
                 WHERE reg.semester_id = $1 AND reg.status = 'registered'
                 ORDER BY st.roll_no, u.name`,
                [semesterId]
            ),
            db.query(
                `SELECT sheet.*, u.name AS student_name, st.roll_no
                 FROM semester_grade_sheets sheet
                 JOIN students st ON sheet.student_id = st.id
                 JOIN users u ON st.user_id = u.id
                 WHERE sheet.semester_id = $1
                 ORDER BY st.roll_no, u.name`,
                [semesterId]
            ),
        ]);

        res.status(200).json({
            semester,
            courses,
            registrations: registrations.rows,
            grade_sheets: gradeSheets.rows,
        });
    } catch (err) {
        console.error('Get Semester Details Error:', err);
        res.status(500).json({ error: 'Failed to fetch semester details' });
    }
};

exports.toggleSemesterRegistration = async (req, res) => {
    const { semesterId } = req.params;
    const { registration_open } = req.body;

    try {
        const semester = await getAdminSemester(semesterId);
        if (!semester) {
            return res.status(404).json({ error: 'Semester not found' });
        }

        const result = await db.query(
            `UPDATE semesters
             SET registration_open = $1,
                 registration_status = CASE WHEN $1 THEN 'open' ELSE 'closed' END
             WHERE id = $2
             RETURNING *,
                       COALESCE(name, academic_year) AS display_name,
                       COALESCE(semester_no, semester_number) AS normalized_semester_no,
                       COALESCE(registration_open, registration_status = 'open') AS normalized_registration_open`,
            [registration_open, semesterId]
        );
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error('Toggle Semester Registration Error:', err);
        res.status(500).json({ error: 'Failed to update registration status' });
    }
};

exports.createSemesterCourse = async (req, res) => {
    const { semester_id, name, code, professor_id, credits, course_type, elective_group } = req.body;

    try {
        const semester = await getAdminSemester(semester_id);
        if (!semester) {
            return res.status(404).json({ error: 'Semester not found' });
        }

        const professorRes = await db.query('SELECT id FROM professors WHERE id = $1', [professor_id]);
        if (!professorRes.rows.length) {
            return res.status(404).json({ error: 'Professor not found' });
        }

        if (course_type === 'elective' && !elective_group) {
            return res.status(400).json({ error: 'Elective courses require an elective group' });
        }

        const duplicate = await db.query(
            'SELECT id FROM subjects WHERE semester_id = $1 AND code = $2',
            [semester_id, code]
        );
        if (duplicate.rows.length) {
            return res.status(400).json({ error: 'A course with this code already exists in the semester' });
        }

        if (course_type === 'elective') {
            const mismatch = await db.query(
                `SELECT DISTINCT credits
                 FROM subjects
                 WHERE semester_id = $1 AND course_type = 'elective' AND elective_group = $2`,
                [semester_id, elective_group]
            );

            if (mismatch.rows.length && Number(mismatch.rows[0].credits) !== Number(credits)) {
                return res.status(400).json({ error: 'All electives in the same elective group must have the same credits' });
            }
        }

        const result = await db.query(
            `INSERT INTO subjects (name, code, professor_id, semester_id, credits, course_type, elective_group)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [name, code, professor_id, semester_id, credits, course_type, elective_group || null]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Create Semester Course Error:', err);
        res.status(500).json({ error: 'Failed to create semester course' });
    }
};

exports.releaseSemesterGradeSheets = async (req, res) => {
    const { semesterId } = req.params;

    try {
        const semester = await getAdminSemester(semesterId);
        if (!semester) {
            return res.status(404).json({ error: 'Semester not found' });
        }

        const courses = await getSemesterCourses(semesterId);
        if (!courses.length) {
            return res.status(400).json({ error: 'No courses found for this semester' });
        }

        const unreleased = await db.query(
            `SELECT s.id, s.name, s.code
             FROM subjects s
             LEFT JOIN grading_schemas gs ON gs.subject_id = s.id
             WHERE s.semester_id = $1
               AND COALESCE(gs.is_released, FALSE) = FALSE`,
            [semesterId]
        );
        if (unreleased.rows.length) {
            return res.status(400).json({
                error: 'All course grades must be released before the semester grade sheet can be released',
                pending_courses: unreleased.rows,
            });
        }

        const registrationsRes = await db.query(
            `SELECT reg.id, reg.student_id, reg.total_credits, u.name AS student_name, st.roll_no
             FROM semester_registrations reg
             JOIN students st ON reg.student_id = st.id
             JOIN users u ON st.user_id = u.id
             WHERE reg.semester_id = $1 AND reg.status = 'registered'`,
            [semesterId]
        );
        const registrations = registrationsRes.rows;
        if (!registrations.length) {
            return res.status(400).json({ error: 'No student registrations found for this semester' });
        }

        const courseGradeMaps = new Map();
        for (const course of courses) {
            const [schema, exams, marksRows, studentsRes] = await Promise.all([
                getStoredGradingSchema(course.id),
                getSubjectExams(course.id),
                getSubjectMarksRows(course.id),
                db.query(
                    `SELECT DISTINCT st.id AS student_id, st.roll_no, u.name AS student_name
                     FROM semester_registration_courses src
                     JOIN semester_registrations reg ON src.registration_id = reg.id
                     JOIN students st ON reg.student_id = st.id
                     JOIN users u ON st.user_id = u.id
                     WHERE src.subject_id = $1 AND reg.status = 'registered'`,
                    [course.id]
                ),
            ]);

            const effectiveSchema = schema
                ? { ...schema, ranges: normalizeRanges(schema.ranges) }
                : {
                    components: buildDefaultComponents(exams),
                    ranges: normalizeRanges(DEFAULT_GRADE_RANGES),
                };

            const combinedScores = buildCombinedScores({
                students: studentsRes.rows,
                exams,
                marksRows,
                schema: effectiveSchema,
            });

            courseGradeMaps.set(
                course.id,
                new Map(combinedScores.map((entry) => [entry.student_id, entry]))
            );
        }

        const client = await db.getClient();
        try {
            await client.query('BEGIN');
            await client.query('DELETE FROM semester_grade_sheet_courses WHERE grade_sheet_id IN (SELECT id FROM semester_grade_sheets WHERE semester_id = $1)', [semesterId]);
            await client.query('DELETE FROM semester_grade_sheets WHERE semester_id = $1', [semesterId]);

            const releasedSheets = [];

            for (const registration of registrations) {
                const selectedCoursesRes = await client.query(
                    `SELECT s.id, s.name, s.code, s.credits
                     FROM semester_registration_courses src
                     JOIN subjects s ON src.subject_id = s.id
                     WHERE src.registration_id = $1
                     ORDER BY s.code, s.name`,
                    [registration.id]
                );
                const selectedCourses = selectedCoursesRes.rows;

                let totalGradePoints = 0;
                let totalCredits = 0;
                const courseEntries = [];

                for (const course of selectedCourses) {
                    const gradeEntry = courseGradeMaps.get(course.id)?.get(registration.student_id);
                    if (!gradeEntry?.grade_code) {
                        throw new Error(`Missing released grade for student ${registration.student_id} in course ${course.code}`);
                    }

                    const gradePointValue = GRADE_POINT_MAP[gradeEntry.grade_code] ?? 0;
                    const courseGradePoints = Number(course.credits) * gradePointValue;

                    totalCredits += Number(course.credits);
                    totalGradePoints += courseGradePoints;
                    courseEntries.push({
                        subject_id: course.id,
                        credits: Number(course.credits),
                        grade_code: gradeEntry.grade_code,
                        grade_point_value: gradePointValue,
                        course_grade_points: roundTo(courseGradePoints),
                    });
                }

                const spi = totalCredits > 0 ? roundTo(totalGradePoints / totalCredits) : 0;
                const insertSheet = await client.query(
                    `INSERT INTO semester_grade_sheets (semester_id, student_id, total_credits, total_grade_points, spi)
                     VALUES ($1, $2, $3, $4, $5)
                     RETURNING *`,
                    [semesterId, registration.student_id, totalCredits, roundTo(totalGradePoints), spi]
                );
                const gradeSheet = insertSheet.rows[0];

                for (const entry of courseEntries) {
                    await client.query(
                        `INSERT INTO semester_grade_sheet_courses (grade_sheet_id, subject_id, credits, grade_code, grade_point_value, course_grade_points)
                         VALUES ($1, $2, $3, $4, $5, $6)`,
                        [gradeSheet.id, entry.subject_id, entry.credits, entry.grade_code, entry.grade_point_value, entry.course_grade_points]
                    );
                }

                releasedSheets.push({
                    ...gradeSheet,
                    student_name: registration.student_name,
                    roll_no: registration.roll_no,
                    courses: courseEntries,
                });
            }

            await client.query(
                'UPDATE semesters SET gradesheet_released = TRUE WHERE id = $1',
                [semesterId]
            );
            await client.query('COMMIT');

            const analytics = buildCombinedAnalytics(releasedSheets.map((sheet) => ({
                student_id: sheet.student_id,
                student_name: sheet.student_name,
                roll_no: sheet.roll_no,
                final_percentage: Number(sheet.spi) * 10,
                grade_code: null,
                missing_components: 0,
            })));

            return res.status(200).json({
                message: 'Semester grade sheets released successfully',
                grade_sheets: releasedSheets,
                spi_analytics: analytics,
            });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('Release Semester Grade Sheets Error:', err);
        res.status(500).json({ error: err.message || 'Failed to release semester grade sheets' });
    }
};
