const db = require('../config/db');
const {
    GRADE_SCALE,
    DEFAULT_GRADE_RANGES,
    roundTo,
    calculateMedian,
    calculateStdDev,
    buildDefaultComponents,
    normalizeRanges,
    assignGrade,
} = require('../utils/grading');

const LEGACY_GRADE_BANDS = [
    { min: 90, letter: 'A+', point: 10 },
    { min: 80, letter: 'A', point: 9 },
    { min: 70, letter: 'B+', point: 8 },
    { min: 60, letter: 'B', point: 7 },
    { min: 50, letter: 'C', point: 6 },
    { min: 40, letter: 'D', point: 5 },
    { min: 0, letter: 'F', point: 0 },
];

function getLegacyGrade(percentage) {
    const band = LEGACY_GRADE_BANDS.find((item) => percentage >= item.min) || LEGACY_GRADE_BANDS.at(-1);
    return { letter: band.letter, point: band.point };
}

async function ensureProfessorOwnsSubject(subjectId, professorId) {
    const result = await db.query(
        'SELECT id, name, code, semester_id FROM subjects WHERE id = $1 AND professor_id = $2',
        [subjectId, professorId]
    );

    return result.rows[0] || null;
}

async function getSubjectExams(subjectId) {
    const result = await db.query(
        'SELECT id, exam_type, max_marks FROM exams WHERE subject_id = $1 ORDER BY exam_type',
        [subjectId]
    );

    return result.rows;
}

async function getStoredGradingSchema(subjectId) {
    const schemaRes = await db.query(
        `SELECT id, subject_id, is_released, released_at, created_by, created_at, updated_at
         FROM grading_schemas
         WHERE subject_id = $1`,
        [subjectId]
    );

    if (!schemaRes.rows.length) {
        return null;
    }

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

function buildEffectiveSchema(exams, storedSchema) {
    if (storedSchema) {
        return {
            ...storedSchema,
            components: storedSchema.components.map((component) => ({
                ...component,
                weight_percentage: Number(component.weight_percentage),
            })),
            ranges: normalizeRanges(storedSchema.ranges),
        };
    }

    return {
        id: null,
        subject_id: Number(exams[0]?.subject_id) || null,
        is_released: false,
        released_at: null,
        created_at: null,
        updated_at: null,
        components: buildDefaultComponents(exams),
        ranges: normalizeRanges(DEFAULT_GRADE_RANGES),
    };
}

async function getSubjectMarksRows(subjectId) {
    const result = await db.query(
        `SELECT m.student_id, m.marks_obtained, e.exam_type, e.max_marks, e.id AS exam_id,
                st.roll_no, u.name AS student_name
         FROM marks m
         JOIN exams e ON m.exam_id = e.id
         JOIN students st ON m.student_id = st.id
         JOIN users u ON st.user_id = u.id
         WHERE e.subject_id = $1
         ORDER BY e.exam_type, m.marks_obtained DESC`,
        [subjectId]
    );

    return result.rows.map((row) => ({
        ...row,
        marks_obtained: Number(row.marks_obtained),
        max_marks: Number(row.max_marks),
    }));
}

async function getEnrolledStudents(subjectId) {
    const result = await db.query(
        `SELECT s.id AS student_id, s.roll_no, s.department, s.semester, u.name AS student_name, u.email
         FROM enrollments e
         JOIN students s ON e.student_id = s.id
         JOIN users u ON s.user_id = u.id
         WHERE e.subject_id = $1
         ORDER BY s.roll_no, u.name`,
        [subjectId]
    );

    return result.rows;
}

function buildExamAnalytics(marksData) {
    const analytics = {};

    marksData.forEach((mark) => {
        if (!analytics[mark.exam_type]) {
            analytics[mark.exam_type] = {
                total: 0,
                count: 0,
                max: -Infinity,
                min: Infinity,
                max_marks: mark.max_marks,
                scores: [],
                pass_count: 0,
                fail_count: 0,
                top_performers: [],
                exam_id: mark.exam_id,
            };
        }

        const bucket = analytics[mark.exam_type];
        bucket.total += mark.marks_obtained;
        bucket.count += 1;
        bucket.scores.push(mark.marks_obtained);
        bucket.max = Math.max(bucket.max, mark.marks_obtained);
        bucket.min = Math.min(bucket.min, mark.marks_obtained);

        const pct = bucket.max_marks > 0 ? (mark.marks_obtained / bucket.max_marks) * 100 : 0;
        if (pct >= 40) bucket.pass_count += 1;
        else bucket.fail_count += 1;
    });

    for (const examType of Object.keys(analytics)) {
        const stats = analytics[examType];
        const sortedScores = [...stats.scores].sort((a, b) => a - b);
        const gradeDistribution = { 'A+': 0, 'A': 0, 'B+': 0, 'B': 0, 'C': 0, 'D': 0, 'F': 0 };

        stats.avg = roundTo(stats.total / stats.count);
        stats.pass_rate = stats.count ? Math.round((stats.pass_count / stats.count) * 100) : 0;
        stats.median = calculateMedian(sortedScores);

        const topStudents = marksData
            .filter((mark) => mark.exam_type === examType)
            .sort((a, b) => b.marks_obtained - a.marks_obtained)
            .slice(0, 5);

        stats.top_performers = topStudents.map((student) => ({
            student_name: student.student_name,
            roll_no: student.roll_no,
            marks_obtained: student.marks_obtained,
            percentage: stats.max_marks > 0 ? Math.round((student.marks_obtained / stats.max_marks) * 100) : 0,
        }));

        stats.scores.forEach((score) => {
            const pct = stats.max_marks > 0 ? (score / stats.max_marks) * 100 : 0;
            const grade = getLegacyGrade(pct);
            gradeDistribution[grade.letter] += 1;
        });

        stats.grade_distribution = gradeDistribution;

        const bucketSize = Math.max(1, Math.ceil(stats.max_marks / 10));
        const buckets = [];

        for (let start = 0; start < stats.max_marks; start += bucketSize) {
            const end = Math.min(start + bucketSize, stats.max_marks);
            const count = stats.scores.filter((score) => score >= start && score < end + (end === stats.max_marks ? 1 : 0)).length;
            buckets.push({ range: `${start}-${end}`, count });
        }

        stats.score_distribution = buckets;
        delete stats.scores;
    }

    return analytics;
}

function buildCombinedGrading({ students, exams, marksRows, schema }) {
    const normalizedSchema = {
        ...schema,
        components: [...(schema.components || [])].sort((a, b) => a.display_order - b.display_order),
        ranges: normalizeRanges(schema.ranges || []),
    };

    const selectedComponents = normalizedSchema.components.filter((component) => Number(component.weight_percentage) > 0);
    const examByType = new Map(exams.map((exam) => [exam.exam_type, exam]));
    const marksByStudent = new Map();

    marksRows.forEach((row) => {
        if (!marksByStudent.has(row.student_id)) {
            marksByStudent.set(row.student_id, new Map());
        }

        marksByStudent.get(row.student_id).set(row.exam_type, row);
    });

    const totalWeight = selectedComponents.reduce((sum, component) => sum + Number(component.weight_percentage), 0);

    const combinedScores = students.map((student) => {
        const studentMarks = marksByStudent.get(student.student_id) || new Map();
        let weightedScore = 0;
        let rawTotal = 0;
        let rawMax = 0;
        let missingComponents = 0;

        const componentBreakdown = selectedComponents.map((component) => {
            const exam = examByType.get(component.exam_type);
            const markEntry = studentMarks.get(component.exam_type);
            const maxMarks = Number(exam?.max_marks || 0);
            const marksObtained = Number(markEntry?.marks_obtained || 0);
            const percentage = maxMarks > 0 ? roundTo((marksObtained / maxMarks) * 100) : 0;
            const contribution = totalWeight > 0
                ? roundTo(percentage * (Number(component.weight_percentage) / totalWeight))
                : 0;

            if (!markEntry) {
                missingComponents += 1;
            }

            rawTotal += marksObtained;
            rawMax += maxMarks;
            weightedScore += contribution;

            return {
                exam_type: component.exam_type,
                weight_percentage: Number(component.weight_percentage),
                max_marks: maxMarks,
                marks_obtained: marksObtained,
                percentage,
                contribution,
                missing: !markEntry,
            };
        });

        const finalPercentage = roundTo(weightedScore);
        const grade_code = assignGrade(finalPercentage, normalizedSchema.ranges);

        return {
            student_id: student.student_id,
            student_name: student.student_name,
            roll_no: student.roll_no,
            email: student.email,
            semester: student.semester,
            department: student.department,
            total_marks_obtained: rawTotal,
            total_max_marks: rawMax,
            final_percentage: finalPercentage,
            grade_code,
            missing_components: missingComponents,
            component_breakdown: componentBreakdown,
        };
    });

    const rankedScores = [...combinedScores].sort((a, b) => {
        if (b.final_percentage !== a.final_percentage) {
            return b.final_percentage - a.final_percentage;
        }

        return (a.roll_no || '').localeCompare(b.roll_no || '');
    });

    rankedScores.forEach((student, index) => {
        student.rank = index + 1;
    });

    const scores = rankedScores.map((student) => student.final_percentage);
    const gradeDistribution = Object.fromEntries(GRADE_SCALE.map((grade) => [grade, 0]));

    rankedScores.forEach((student) => {
        if (student.grade_code && gradeDistribution[student.grade_code] !== undefined) {
            gradeDistribution[student.grade_code] += 1;
        }
    });

    const histogram = Array.from({ length: 10 }, (_, index) => {
        const start = index * 10;
        const end = index === 9 ? 100 : (index + 1) * 10;
        const count = scores.filter((score) => (
            index === 9 ? score >= start && score <= end : score >= start && score < end
        )).length;

        return { range: `${start}-${end}`, count };
    });

    const releaseReady = selectedComponents.length > 0
        && normalizedSchema.ranges.length === GRADE_SCALE.length
        && totalWeight > 0;

    return {
        schema: normalizedSchema,
        release_ready: releaseReady,
        combined_scores: rankedScores,
        analytics: {
            count: rankedScores.length,
            average: scores.length ? roundTo(scores.reduce((sum, value) => sum + value, 0) / scores.length) : 0,
            median: calculateMedian(scores),
            max: scores.length ? roundTo(Math.max(...scores)) : 0,
            min: scores.length ? roundTo(Math.min(...scores)) : 0,
            std_dev: calculateStdDev(scores),
            missing_any_component: rankedScores.filter((student) => student.missing_components > 0).length,
            grade_distribution: gradeDistribution,
            score_distribution: histogram,
        },
    };
}

async function getGradingDashboard(subjectId) {
    const [exams, marksRows, enrolledStudents, storedSchema] = await Promise.all([
        getSubjectExams(subjectId),
        getSubjectMarksRows(subjectId),
        getEnrolledStudents(subjectId),
        getStoredGradingSchema(subjectId),
    ]);

    const schema = buildEffectiveSchema(exams, storedSchema);
    const grading = buildCombinedGrading({
        students: enrolledStudents,
        exams,
        marksRows,
        schema,
    });

    return { exams, marksRows, grading };
}

function validateSchemaPayload(body, availableExamTypes) {
    const components = Array.isArray(body.components) ? body.components : [];
    const ranges = Array.isArray(body.ranges) ? body.ranges : [];

    if (!components.length) {
        return 'Select at least one marks component for the grading schema';
    }

    const selectedTypes = new Set();
    let totalWeight = 0;

    for (const component of components) {
        if (!availableExamTypes.has(component.exam_type)) {
            return `Marks component "${component.exam_type}" is not available for this course`;
        }

        if (selectedTypes.has(component.exam_type)) {
            return `Duplicate marks component "${component.exam_type}" in grading schema`;
        }

        selectedTypes.add(component.exam_type);
        totalWeight += Number(component.weight_percentage);
    }

    if (Math.abs(totalWeight - 100) > 0.01) {
        return 'Component weights must add up to exactly 100';
    }

    if (ranges.length !== GRADE_SCALE.length) {
        return `Exactly ${GRADE_SCALE.length} grade ranges are required`;
    }

    const gradeCodes = new Set();
    for (const range of ranges) {
        const min = Number(range.min_score);
        const max = Number(range.max_score);

        if (!GRADE_SCALE.includes(range.grade_code)) {
            return `Unsupported grade code "${range.grade_code}"`;
        }

        if (gradeCodes.has(range.grade_code)) {
            return `Duplicate grade code "${range.grade_code}"`;
        }

        if (Number.isNaN(min) || Number.isNaN(max) || min < 0 || max > 100 || min > max) {
            return `Invalid range configured for grade "${range.grade_code}"`;
        }

        gradeCodes.add(range.grade_code);
    }

    return null;
}

exports.uploadMarks = async (req, res) => {
    const { subject_id, exam_type, max_marks, marks } = req.body;

    if (!subject_id || !exam_type || !max_marks || !Array.isArray(marks)) {
        return res.status(400).json({ error: 'subject_id, exam_type, max_marks and marks are required' });
    }

    try {
        const subject = await ensureProfessorOwnsSubject(subject_id, req.user.role_id);
        if (!subject) {
            return res.status(403).json({ error: 'You do not own this course' });
        }

        const client = await db.getClient();

        try {
            await client.query('BEGIN');

            const existingExam = await client.query(
                'SELECT id FROM exams WHERE subject_id = $1 AND exam_type = $2',
                [subject_id, exam_type]
            );

            let exam_id;
            if (existingExam.rows.length > 0) {
                exam_id = existingExam.rows[0].id;
                await client.query('UPDATE exams SET max_marks = $1 WHERE id = $2', [max_marks, exam_id]);
                await client.query('DELETE FROM marks WHERE exam_id = $1', [exam_id]);
            } else {
                const examRes = await client.query(
                    'INSERT INTO exams (subject_id, exam_type, max_marks) VALUES ($1, $2, $3) RETURNING id',
                    [subject_id, exam_type, max_marks]
                );
                exam_id = examRes.rows[0].id;
            }

            for (const item of marks) {
                if (item.marks_obtained !== undefined && item.marks_obtained !== null && item.marks_obtained !== '') {
                    await client.query(
                        'INSERT INTO marks (student_id, exam_id, marks_obtained) VALUES ($1, $2, $3)',
                        [item.student_id, exam_id, item.marks_obtained]
                    );
                }
            }

            // Any mark change invalidates an already released final grade sheet.
            await client.query(
                `UPDATE grading_schemas
                 SET is_released = FALSE, released_at = NULL, updated_at = CURRENT_TIMESTAMP
                 WHERE subject_id = $1`,
                [subject_id]
            );
            if (subject.semester_id) {
                await client.query(
                    'UPDATE semesters SET gradesheet_released = FALSE WHERE id = $1',
                    [subject.semester_id]
                );
            }

            await client.query('COMMIT');

            res.status(201).json({
                message: 'Marks uploaded successfully',
                exam_id,
                grading_release_invalidated: true,
            });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getStudentMarks = async (req, res) => {
    const { id } = req.params;

    try {
        const result = await db.query(
            `SELECT m.marks_obtained, e.exam_type, e.max_marks, e.subject_id, s.name AS subject_name, s.code AS subject_code
             FROM marks m
             JOIN exams e ON m.exam_id = e.id
             JOIN subjects s ON e.subject_id = s.id
             WHERE m.student_id = $1
             ORDER BY s.name, e.exam_type`,
            [id]
        );

        const subjects = {};
        result.rows.forEach((mark) => {
            if (!subjects[mark.subject_id]) {
                subjects[mark.subject_id] = {
                    subject_name: mark.subject_name,
                    subject_code: mark.subject_code,
                    exams: [],
                };
            }

            const percentage = mark.max_marks > 0 ? (mark.marks_obtained / mark.max_marks) * 100 : 0;
            const grade = getLegacyGrade(percentage);
            subjects[mark.subject_id].exams.push({
                ...mark,
                percentage: roundTo(percentage, 1),
                grade: grade.letter,
                grade_point: grade.point,
            });
        });

        let totalWeightedPercentage = 0;
        let totalExams = 0;
        result.rows.forEach((mark) => {
            if (mark.max_marks > 0) {
                totalWeightedPercentage += (mark.marks_obtained / mark.max_marks) * 100;
                totalExams += 1;
            }
        });

        const overallPercentage = totalExams ? roundTo(totalWeightedPercentage / totalExams, 1) : 0;
        const overallGrade = getLegacyGrade(overallPercentage);

        res.status(200).json({
            marks: result.rows,
            subjects,
            overall: {
                percentage: overallPercentage,
                grade: overallGrade.letter,
                grade_point: overallGrade.point,
                total_exams: totalExams,
            },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getSubjectMarks = async (req, res) => {
    const { id } = req.params;

    try {
        const subject = await ensureProfessorOwnsSubject(id, req.user.role_id);
        if (!subject) {
            return res.status(403).json({ error: 'You do not own this course' });
        }

        const { exams, marksRows, grading } = await getGradingDashboard(id);
        const analytics = buildExamAnalytics(marksRows);

        res.status(200).json({
            marks: marksRows,
            analytics,
            exams,
            grading,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.saveGradingSchema = async (req, res) => {
    const { id } = req.params;

    try {
        const subject = await ensureProfessorOwnsSubject(id, req.user.role_id);
        if (!subject) {
            return res.status(403).json({ error: 'You do not own this course' });
        }

        const exams = await getSubjectExams(id);
        const validationError = validateSchemaPayload(req.body, new Set(exams.map((exam) => exam.exam_type)));
        if (validationError) {
            return res.status(400).json({ error: validationError });
        }

        const client = await db.getClient();

        try {
            await client.query('BEGIN');

            let schemaId;
            const existingSchema = await client.query(
                'SELECT id FROM grading_schemas WHERE subject_id = $1',
                [id]
            );

            if (existingSchema.rows.length) {
                schemaId = existingSchema.rows[0].id;
                await client.query(
                    `UPDATE grading_schemas
                     SET is_released = FALSE, released_at = NULL, updated_at = CURRENT_TIMESTAMP
                     WHERE id = $1`,
                    [schemaId]
                );
                await client.query('DELETE FROM grading_schema_components WHERE schema_id = $1', [schemaId]);
                await client.query('DELETE FROM grading_schema_ranges WHERE schema_id = $1', [schemaId]);
            } else {
                const insertSchema = await client.query(
                    `INSERT INTO grading_schemas (subject_id, created_by, is_released)
                     VALUES ($1, $2, FALSE)
                     RETURNING id`,
                    [id, req.user.role_id]
                );
                schemaId = insertSchema.rows[0].id;
            }

            for (const [index, component] of req.body.components.entries()) {
                await client.query(
                    `INSERT INTO grading_schema_components (schema_id, exam_type, weight_percentage, display_order)
                     VALUES ($1, $2, $3, $4)`,
                    [schemaId, component.exam_type, component.weight_percentage, index]
                );
            }

            for (const [index, range] of req.body.ranges.entries()) {
                await client.query(
                    `INSERT INTO grading_schema_ranges (schema_id, grade_code, min_score, max_score, display_order)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [schemaId, range.grade_code, range.min_score, range.max_score, index]
                );
            }

            if (subject.semester_id) {
                await client.query(
                    'UPDATE semesters SET gradesheet_released = FALSE WHERE id = $1',
                    [subject.semester_id]
                );
            }

            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

        const { grading } = await getGradingDashboard(id);
        res.status(200).json({
            message: 'Grading schema saved successfully',
            grading,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.releaseGrades = async (req, res) => {
    const { id } = req.params;

    try {
        const subject = await ensureProfessorOwnsSubject(id, req.user.role_id);
        if (!subject) {
            return res.status(403).json({ error: 'You do not own this course' });
        }

        const storedSchema = await getStoredGradingSchema(id);
        if (!storedSchema) {
            return res.status(400).json({ error: 'Save a grading schema before releasing grades' });
        }

        const { grading } = await getGradingDashboard(id);
        if (!grading.release_ready) {
            return res.status(400).json({ error: 'This grading schema is not ready for release yet' });
        }

        await db.query(
            `UPDATE grading_schemas
             SET is_released = TRUE, released_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE subject_id = $1`,
            [id]
        );

        const refreshed = await getGradingDashboard(id);
        res.status(200).json({
            message: 'Grades released successfully',
            grading: refreshed.grading,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.unreleaseGrades = async (req, res) => {
    const { id } = req.params;

    try {
        const subject = await ensureProfessorOwnsSubject(id, req.user.role_id);
        if (!subject) {
            return res.status(403).json({ error: 'You do not own this course' });
        }

        await db.query(
            `UPDATE grading_schemas
             SET is_released = FALSE, released_at = NULL, updated_at = CURRENT_TIMESTAMP
             WHERE subject_id = $1`,
            [id]
        );
        if (subject.semester_id) {
            await db.query(
                'UPDATE semesters SET gradesheet_released = FALSE WHERE id = $1',
                [subject.semester_id]
            );
        }

        const refreshed = await getGradingDashboard(id);
        res.status(200).json({
            message: 'Grades hidden from students',
            grading: refreshed.grading,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getStudentSubjectReport = async (req, res) => {
    const { subjectId } = req.params;
    const student_id = req.user.role_id;

    try {
        const marksRes = await db.query(
            `SELECT m.marks_obtained, e.exam_type, e.max_marks
             FROM marks m
             JOIN exams e ON m.exam_id = e.id
             WHERE m.student_id = $1 AND e.subject_id = $2
             ORDER BY e.exam_type`,
            [student_id, subjectId]
        );

        const classRes = await db.query(
            `SELECT e.exam_type, e.max_marks,
                    AVG(m.marks_obtained) AS class_avg,
                    MAX(m.marks_obtained) AS class_max,
                    MIN(m.marks_obtained) AS class_min,
                    COUNT(m.id) AS total_students
             FROM marks m
             JOIN exams e ON m.exam_id = e.id
             WHERE e.subject_id = $1
             GROUP BY e.exam_type, e.max_marks, e.id`,
            [subjectId]
        );

        const ranks = {};
        for (const exam of classRes.rows) {
            const rankRes = await db.query(
                `SELECT COUNT(*) + 1 AS rank
                 FROM marks m
                 JOIN exams e ON m.exam_id = e.id
                 WHERE e.subject_id = $1
                   AND e.exam_type = $2
                   AND m.marks_obtained > (
                       SELECT COALESCE(m2.marks_obtained, 0)
                       FROM marks m2
                       JOIN exams e2 ON m2.exam_id = e2.id
                       WHERE m2.student_id = $3 AND e2.subject_id = $1 AND e2.exam_type = $2
                       LIMIT 1
                   )`,
                [subjectId, exam.exam_type, student_id]
            );

            ranks[exam.exam_type] = {
                rank: parseInt(rankRes.rows[0]?.rank || 0, 10),
                total: parseInt(exam.total_students, 10),
            };
        }

        const exams = marksRes.rows.map((mark) => {
            const pct = mark.max_marks > 0 ? (mark.marks_obtained / mark.max_marks) * 100 : 0;
            const grade = getLegacyGrade(pct);
            const classStats = classRes.rows.find((item) => item.exam_type === mark.exam_type);

            return {
                ...mark,
                percentage: roundTo(pct, 1),
                grade: grade.letter,
                grade_point: grade.point,
                class_avg: classStats ? roundTo(Number(classStats.class_avg), 1).toFixed(1) : null,
                class_max: classStats ? parseInt(classStats.class_max, 10) : null,
                class_min: classStats ? parseInt(classStats.class_min, 10) : null,
                rank: ranks[mark.exam_type]?.rank || null,
                total_students: ranks[mark.exam_type]?.total || null,
            };
        });

        const { grading } = await getGradingDashboard(subjectId);
        const finalGrade = grading.combined_scores.find((student) => student.student_id === student_id) || null;

        res.status(200).json({
            exams,
            final_grade: grading.schema.is_released && finalGrade ? {
                released: true,
                released_at: grading.schema.released_at,
                rank: finalGrade.rank,
                final_percentage: finalGrade.final_percentage,
                grade_code: finalGrade.grade_code,
                missing_components: finalGrade.missing_components,
                component_breakdown: finalGrade.component_breakdown,
                class_average: grading.analytics.average,
                class_median: grading.analytics.median,
                total_students: grading.analytics.count,
                grade_distribution: grading.analytics.grade_distribution,
            } : {
                released: false,
                released_at: grading.schema.released_at || null,
            },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};
