const db = require('../config/db');

// Calculate grade letter from percentage
function getGrade(percentage) {
    if (percentage >= 90) return { letter: 'A+', point: 10 };
    if (percentage >= 80) return { letter: 'A', point: 9 };
    if (percentage >= 70) return { letter: 'B+', point: 8 };
    if (percentage >= 60) return { letter: 'B', point: 7 };
    if (percentage >= 50) return { letter: 'C', point: 6 };
    if (percentage >= 40) return { letter: 'D', point: 5 };
    return { letter: 'F', point: 0 };
}

exports.uploadMarks = async (req, res) => {
    const { subject_id, exam_type, max_marks, marks } = req.body;
    // marks is an array: [{ student_id, marks_obtained }, ...]

    try {
        await db.query('BEGIN');

        // Check if an exam of this type already exists for this subject
        const existingExam = await db.query(
            'SELECT id FROM exams WHERE subject_id = $1 AND exam_type = $2',
            [subject_id, exam_type]
        );

        let exam_id;
        if (existingExam.rows.length > 0) {
            // Update existing exam
            exam_id = existingExam.rows[0].id;
            await db.query('UPDATE exams SET max_marks = $1 WHERE id = $2', [max_marks, exam_id]);
            // Delete old marks for this exam to replace
            await db.query('DELETE FROM marks WHERE exam_id = $1', [exam_id]);
        } else {
            const examRes = await db.query(
                'INSERT INTO exams (subject_id, exam_type, max_marks) VALUES ($1, $2, $3) RETURNING id',
                [subject_id, exam_type, max_marks]
            );
            exam_id = examRes.rows[0].id;
        }

        for (const m of marks) {
            if (m.marks_obtained !== undefined && m.marks_obtained !== null && m.marks_obtained !== '') {
                await db.query(
                    `INSERT INTO marks (student_id, exam_id, marks_obtained) VALUES ($1, $2, $3)`,
                    [m.student_id, exam_id, m.marks_obtained]
                );
            }
        }
        await db.query('COMMIT');

        res.status(201).json({ message: 'Marks uploaded successfully', exam_id });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getStudentMarks = async (req, res) => {
    const { id } = req.params; // student_id
    try {
        const result = await db.query(
            `SELECT m.marks_obtained, e.exam_type, e.max_marks, e.subject_id, s.name as subject_name, s.code as subject_code
             FROM marks m 
             JOIN exams e ON m.exam_id = e.id 
             JOIN subjects s ON e.subject_id = s.id 
             WHERE m.student_id = $1
             ORDER BY s.name, e.exam_type`,
            [id]
        );

        // Group by subject for report card view
        const subjects = {};
        result.rows.forEach(m => {
            if (!subjects[m.subject_id]) {
                subjects[m.subject_id] = {
                    subject_name: m.subject_name,
                    subject_code: m.subject_code,
                    exams: []
                };
            }
            const percentage = m.max_marks > 0 ? (m.marks_obtained / m.max_marks) * 100 : 0;
            const grade = getGrade(percentage);
            subjects[m.subject_id].exams.push({
                ...m,
                percentage: Math.round(percentage * 10) / 10,
                grade: grade.letter,
                grade_point: grade.point
            });
        });

        // Calculate overall stats
        const allMarks = result.rows;
        let totalWeightedPercentage = 0;
        let totalWeight = 0;
        allMarks.forEach(m => {
            if (m.max_marks > 0) {
                totalWeightedPercentage += (m.marks_obtained / m.max_marks) * 100;
                totalWeight++;
            }
        });
        const overallPercentage = totalWeight > 0 ? Math.round((totalWeightedPercentage / totalWeight) * 10) / 10 : 0;
        const overallGrade = getGrade(overallPercentage);

        res.status(200).json({
            marks: result.rows,
            subjects,
            overall: {
                percentage: overallPercentage,
                grade: overallGrade.letter,
                grade_point: overallGrade.point,
                total_exams: totalWeight
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getSubjectMarks = async (req, res) => {
    const { id } = req.params; // subject_id
    try {
        const result = await db.query(
            `SELECT m.student_id, m.marks_obtained, e.exam_type, e.max_marks, e.id as exam_id,
                    st.roll_no, u.name as student_name
             FROM marks m
             JOIN exams e ON m.exam_id = e.id
             JOIN students st ON m.student_id = st.id
             JOIN users u ON st.user_id = u.id
             WHERE e.subject_id = $1
             ORDER BY e.exam_type, m.marks_obtained DESC`,
            [id]
        );

        // Calculate analytics per exam_type
        const marks_data = result.rows;
        const analytics = {};

        marks_data.forEach(m => {
            if (!analytics[m.exam_type]) {
                analytics[m.exam_type] = {
                    total: 0, count: 0, max: -Infinity, min: Infinity,
                    max_marks: m.max_marks, scores: [], pass_count: 0, fail_count: 0,
                    top_performers: [], exam_id: m.exam_id
                };
            }
            const a = analytics[m.exam_type];
            a.total += m.marks_obtained;
            a.count += 1;
            a.scores.push(m.marks_obtained);
            if (m.marks_obtained > a.max) a.max = m.marks_obtained;
            if (m.marks_obtained < a.min) a.min = m.marks_obtained;

            const pct = a.max_marks > 0 ? (m.marks_obtained / a.max_marks) * 100 : 0;
            if (pct >= 40) a.pass_count++; else a.fail_count++;
        });

        for (const type in analytics) {
            const a = analytics[type];
            a.avg = a.total / a.count;
            a.pass_rate = Math.round((a.pass_count / a.count) * 100);
            // Median
            const sorted = [...a.scores].sort((x, y) => x - y);
            a.median = sorted.length % 2 === 0
                ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
                : sorted[Math.floor(sorted.length / 2)];

            // Top 3 performers
            const topStudents = marks_data
                .filter(m => m.exam_type === type)
                .sort((x, y) => y.marks_obtained - x.marks_obtained)
                .slice(0, 5);
            a.top_performers = topStudents.map(s => ({
                student_name: s.student_name,
                roll_no: s.roll_no,
                marks_obtained: s.marks_obtained,
                percentage: Math.round((s.marks_obtained / a.max_marks) * 100)
            }));

            // Grade distribution
            const grades = { 'A+': 0, 'A': 0, 'B+': 0, 'B': 0, 'C': 0, 'D': 0, 'F': 0 };
            a.scores.forEach(score => {
                const pct = a.max_marks > 0 ? (score / a.max_marks) * 100 : 0;
                const g = getGrade(pct);
                grades[g.letter]++;
            });
            a.grade_distribution = grades;

            // Score ranges for histogram (0-10, 10-20, ... up to max_marks)
            const bucketSize = Math.ceil(a.max_marks / 10);
            const buckets = [];
            for (let i = 0; i < a.max_marks; i += bucketSize) {
                const rangeEnd = Math.min(i + bucketSize, a.max_marks);
                const count = a.scores.filter(s => s >= i && s < rangeEnd + (rangeEnd === a.max_marks ? 1 : 0)).length;
                buckets.push({ range: `${i}-${rangeEnd}`, count });
            }
            a.score_distribution = buckets;

            // Clean up
            delete a.scores;
        }

        // Also get exams list for this subject
        const examsRes = await db.query(
            'SELECT id, exam_type, max_marks FROM exams WHERE subject_id = $1 ORDER BY exam_type',
            [id]
        );

        res.status(200).json({ marks: marks_data, analytics, exams: examsRes.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Student: Get personal report card for a specific subject
exports.getStudentSubjectReport = async (req, res) => {
    const { subjectId } = req.params;
    const student_id = req.user.role_id;

    try {
        // Get student's marks for this subject
        const marksRes = await db.query(
            `SELECT m.marks_obtained, e.exam_type, e.max_marks
             FROM marks m
             JOIN exams e ON m.exam_id = e.id
             WHERE m.student_id = $1 AND e.subject_id = $2
             ORDER BY e.exam_type`,
            [student_id, subjectId]
        );

        // Get class stats for comparison
        const classRes = await db.query(
            `SELECT e.exam_type, e.max_marks,
                    AVG(m.marks_obtained) as class_avg,
                    MAX(m.marks_obtained) as class_max,
                    MIN(m.marks_obtained) as class_min,
                    COUNT(m.id) as total_students
             FROM marks m
             JOIN exams e ON m.exam_id = e.id
             WHERE e.subject_id = $1
             GROUP BY e.exam_type, e.max_marks, e.id`,
            [subjectId]
        );

        // Get student's rank per exam
        const ranks = {};
        for (const exam of classRes.rows) {
            const rankRes = await db.query(
                `SELECT COUNT(*) + 1 as rank FROM marks m
                 JOIN exams e ON m.exam_id = e.id
                 WHERE e.subject_id = $1 AND e.exam_type = $2
                   AND m.marks_obtained > (
                       SELECT COALESCE(m2.marks_obtained, 0) FROM marks m2
                       JOIN exams e2 ON m2.exam_id = e2.id
                       WHERE m2.student_id = $3 AND e2.subject_id = $1 AND e2.exam_type = $2
                       LIMIT 1
                   )`,
                [subjectId, exam.exam_type, student_id]
            );
            ranks[exam.exam_type] = {
                rank: parseInt(rankRes.rows[0]?.rank || 0),
                total: parseInt(exam.total_students)
            };
        }

        const exams = marksRes.rows.map(m => {
            const pct = m.max_marks > 0 ? (m.marks_obtained / m.max_marks) * 100 : 0;
            const grade = getGrade(pct);
            const classStats = classRes.rows.find(c => c.exam_type === m.exam_type);
            return {
                ...m,
                percentage: Math.round(pct * 10) / 10,
                grade: grade.letter,
                grade_point: grade.point,
                class_avg: classStats ? parseFloat(classStats.class_avg).toFixed(1) : null,
                class_max: classStats ? parseInt(classStats.class_max) : null,
                class_min: classStats ? parseInt(classStats.class_min) : null,
                rank: ranks[m.exam_type]?.rank || null,
                total_students: ranks[m.exam_type]?.total || null
            };
        });

        res.status(200).json({ exams });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};
