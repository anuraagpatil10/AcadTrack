const db = require('../config/db');

exports.createQuiz = async (req, res) => {
    const { subject_id, title, duration, start_time, end_time, questions } = req.body;
    // questions is an array of objects: { question, option_a, option_b, option_c, option_d, correct_answer }

    try {
        await db.query('BEGIN');
        const quizRes = await db.query(
            'INSERT INTO quizzes (subject_id, title, duration, start_time, end_time) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [subject_id, title, duration, start_time, end_time]
        );
        const quiz_id = quizRes.rows[0].id;

        for (const q of questions) {
            await db.query(
                `INSERT INTO questions (quiz_id, question, option_a, option_b, option_c, option_d, correct_answer)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [quiz_id, q.question, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_answer]
            );
        }
        await db.query('COMMIT');

        res.status(201).json({ message: 'Quiz created successfully', quiz_id });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getQuiz = async (req, res) => {
    const { id } = req.params;
    try {
        const quizRes = await db.query('SELECT * FROM quizzes WHERE id = $1', [id]);
        if (quizRes.rows.length === 0) return res.status(404).json({ error: 'Quiz not found' });

        const quiz = quizRes.rows[0];

        let questionsRes;
        if (req.user.role === 'student') {
            // Check if student already submitted this quiz
            const subCheck = await db.query(
                'SELECT id, score FROM quiz_submissions WHERE student_id = $1 AND quiz_id = $2',
                [req.user.role_id, id]
            );
            if (subCheck.rows.length > 0) {
                return res.status(200).json({
                    ...quiz,
                    already_submitted: true,
                    score: subCheck.rows[0].score,
                    questions: []
                });
            }

            // Check if quiz is within active time window
            const now = new Date();
            const startTime = new Date(quiz.start_time);
            const endTime = new Date(quiz.end_time);
            if (now < startTime) {
                return res.status(200).json({
                    ...quiz,
                    not_started: true,
                    questions: []
                });
            }
            if (now > endTime) {
                return res.status(200).json({
                    ...quiz,
                    expired: true,
                    questions: []
                });
            }

            // omit correct_answer for students
            questionsRes = await db.query(
                'SELECT id, question, option_a, option_b, option_c, option_d FROM questions WHERE quiz_id = $1 ORDER BY id',
                [id]
            );

            // Get current violation count
            const viRes = await db.query(
                'SELECT COUNT(*) FROM quiz_violations WHERE student_id = $1 AND quiz_id = $2',
                [req.user.role_id, id]
            );

            return res.status(200).json({
                ...quiz,
                questions: questionsRes.rows,
                violations_count: parseInt(viRes.rows[0].count, 10)
            });
        } else {
            questionsRes = await db.query('SELECT * FROM questions WHERE quiz_id = $1 ORDER BY id', [id]);
        }

        res.status(200).json({ ...quiz, questions: questionsRes.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.submitQuiz = async (req, res) => {
    const { quiz_id, answers } = req.body; // answers: { question_id: 'A', ... }
    const student_id = req.user.role_id;

    try {
        // Check for duplicate submission
        const dupCheck = await db.query(
            'SELECT id FROM quiz_submissions WHERE student_id = $1 AND quiz_id = $2',
            [student_id, quiz_id]
        );
        if (dupCheck.rows.length > 0) {
            return res.status(400).json({ error: 'You have already submitted this quiz' });
        }

        // Validate quiz is within time window
        const quizRes = await db.query('SELECT * FROM quizzes WHERE id = $1', [quiz_id]);
        if (quizRes.rows.length === 0) return res.status(404).json({ error: 'Quiz not found' });

        const quiz = quizRes.rows[0];
        const now = new Date();
        const endTime = new Date(quiz.end_time);
        // Allow a 2-minute grace period after end time for submissions in progress
        const graceEnd = new Date(endTime.getTime() + 2 * 60 * 1000);
        if (now > graceEnd) {
            return res.status(400).json({ error: 'Quiz time has expired' });
        }

        // Evaluate score
        const questionsRes = await db.query('SELECT id, correct_answer FROM questions WHERE quiz_id = $1', [quiz_id]);
        const correctAnswersMap = {};
        questionsRes.rows.forEach(q => { correctAnswersMap[q.id] = q.correct_answer; });

        let score = 0;
        const totalQuestions = questionsRes.rows.length;
        for (const qId in answers) {
            if (answers[qId] === correctAnswersMap[Number(qId)]) {
                score++;
            }
        }

        await db.query('BEGIN');
        const submissionRes = await db.query(
            'INSERT INTO quiz_submissions (student_id, quiz_id, score, submitted_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP) RETURNING id',
            [student_id, quiz_id, score]
        );
        const submission_id = submissionRes.rows[0].id;

        for (const qId in answers) {
            await db.query(
                'INSERT INTO quiz_answers (submission_id, question_id, selected_option) VALUES ($1, $2, $3)',
                [submission_id, qId, answers[qId]]
            );
        }
        await db.query('COMMIT');

        // Get violation count for this student+quiz
        const viRes = await db.query(
            'SELECT COUNT(*) FROM quiz_violations WHERE student_id = $1 AND quiz_id = $2',
            [student_id, quiz_id]
        );

        res.status(200).json({
            message: 'Quiz submitted successfully',
            score,
            total: totalQuestions,
            violations: parseInt(viRes.rows[0].count, 10)
        });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.recordViolation = async (req, res) => {
    const { quiz_id, type } = req.body;
    const student_id = req.user.role_id;

    try {
        // Check if student already submitted — don't record violations after submission
        const subCheck = await db.query(
            'SELECT id FROM quiz_submissions WHERE student_id = $1 AND quiz_id = $2',
            [student_id, quiz_id]
        );
        if (subCheck.rows.length > 0) {
            return res.status(400).json({ error: 'Quiz already submitted' });
        }

        await db.query(
            'INSERT INTO quiz_violations (student_id, quiz_id, type) VALUES ($1, $2, $3)',
            [student_id, quiz_id, type]
        );
        
        // Count violations
        const viRes = await db.query(
            'SELECT COUNT(*) FROM quiz_violations WHERE student_id = $1 AND quiz_id = $2',
            [student_id, quiz_id]
        );
        const count = parseInt(viRes.rows[0].count, 10);
        
        let autoSubmit = false;
        if (count >= 3) {
            autoSubmit = true;
        }

        res.status(200).json({ message: 'Violation recorded', violations_count: count, auto_submit: autoSubmit });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getSubjectQuizzes = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.query(
            `SELECT q.*, 
                (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) AS question_count,
                (SELECT COUNT(*) FROM quiz_submissions WHERE quiz_id = q.id) AS submission_count
             FROM quizzes q WHERE q.subject_id = $1 ORDER BY q.start_time DESC`,
            [id]
        );

        // If student, also include their submission status for each quiz
        if (req.user.role === 'student') {
            const quizzes = [];
            for (const quiz of result.rows) {
                const subCheck = await db.query(
                    'SELECT id, score FROM quiz_submissions WHERE student_id = $1 AND quiz_id = $2',
                    [req.user.role_id, quiz.id]
                );
                quizzes.push({
                    ...quiz,
                    submitted: subCheck.rows.length > 0,
                    my_score: subCheck.rows.length > 0 ? subCheck.rows[0].score : null
                });
            }
            return res.status(200).json(quizzes);
        }

        res.status(200).json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Professor: Get all student results for a quiz
exports.getQuizResults = async (req, res) => {
    const { id } = req.params;
    try {
        const results = await db.query(
            `SELECT qs.id AS submission_id, qs.student_id, qs.score, qs.submitted_at,
                    u.name AS student_name, s.roll_no,
                    (SELECT COUNT(*) FROM quiz_violations qv WHERE qv.student_id = qs.student_id AND qv.quiz_id = qs.quiz_id) AS violation_count,
                    (SELECT COUNT(*) FROM questions WHERE quiz_id = qs.quiz_id) AS total_questions
             FROM quiz_submissions qs
             JOIN students s ON s.id = qs.student_id
             JOIN users u ON u.id = s.user_id
             WHERE qs.quiz_id = $1
             ORDER BY qs.score DESC, qs.submitted_at ASC`,
            [id]
        );

        // Get quiz info
        const quizRes = await db.query('SELECT * FROM quizzes WHERE id = $1', [id]);

        res.status(200).json({
            quiz: quizRes.rows[0] || null,
            results: results.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Professor: Get violation logs for a quiz
exports.getQuizViolations = async (req, res) => {
    const { id } = req.params;
    try {
        const violations = await db.query(
            `SELECT qv.id, qv.student_id, qv.type, qv.timestamp,
                    u.name AS student_name, s.roll_no
             FROM quiz_violations qv
             JOIN students s ON s.id = qv.student_id
             JOIN users u ON u.id = s.user_id
             WHERE qv.quiz_id = $1
             ORDER BY qv.timestamp DESC`,
            [id]
        );

        res.status(200).json(violations.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Student: View their own quiz result with answers
exports.getStudentQuizResult = async (req, res) => {
    const { id } = req.params;
    const student_id = req.user.role_id;

    try {
        // Get submission
        const subRes = await db.query(
            'SELECT * FROM quiz_submissions WHERE student_id = $1 AND quiz_id = $2',
            [student_id, id]
        );
        if (subRes.rows.length === 0) {
            return res.status(404).json({ error: 'No submission found' });
        }
        const submission = subRes.rows[0];

        // Get quiz info
        const quizRes = await db.query('SELECT * FROM quizzes WHERE id = $1', [id]);

        // Get questions with correct answers and student's answers
        const questionsRes = await db.query(
            `SELECT q.id, q.question, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_answer,
                    qa.selected_option
             FROM questions q
             LEFT JOIN quiz_answers qa ON qa.question_id = q.id AND qa.submission_id = $1
             WHERE q.quiz_id = $2
             ORDER BY q.id`,
            [submission.id, id]
        );

        // Get violation count
        const viRes = await db.query(
            'SELECT COUNT(*) FROM quiz_violations WHERE student_id = $1 AND quiz_id = $2',
            [student_id, id]
        );

        res.status(200).json({
            quiz: quizRes.rows[0],
            submission,
            questions: questionsRes.rows,
            total: questionsRes.rows.length,
            violations: parseInt(viRes.rows[0].count, 10)
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Professor: Quiz analytics (average score, pass rate, question-wise accuracy)
exports.getQuizAnalytics = async (req, res) => {
    const { id } = req.params;
    try {
        // Overall stats
        const statsRes = await db.query(
            `SELECT COUNT(*) AS total_submissions,
                    COALESCE(AVG(score), 0) AS avg_score,
                    COALESCE(MAX(score), 0) AS max_score,
                    COALESCE(MIN(score), 0) AS min_score
             FROM quiz_submissions WHERE quiz_id = $1`,
            [id]
        );

        // Total questions count
        const qCountRes = await db.query('SELECT COUNT(*) FROM questions WHERE quiz_id = $1', [id]);
        const totalQuestions = parseInt(qCountRes.rows[0].count, 10);

        // Question-wise accuracy
        const questionStats = await db.query(
            `SELECT q.id, q.question,
                    COUNT(qa.id) AS total_attempts,
                    SUM(CASE WHEN qa.selected_option = q.correct_answer THEN 1 ELSE 0 END) AS correct_count
             FROM questions q
             LEFT JOIN quiz_answers qa ON qa.question_id = q.id
             WHERE q.quiz_id = $1
             GROUP BY q.id, q.question
             ORDER BY q.id`,
            [id]
        );

        // Total violations for this quiz
        const violationsRes = await db.query(
            `SELECT COUNT(*) AS total_violations,
                    COUNT(DISTINCT student_id) AS students_with_violations
             FROM quiz_violations WHERE quiz_id = $1`,
            [id]
        );

        // Score distribution (0, 1, 2, ... up to totalQuestions)
        const distributionRes = await db.query(
            `SELECT score, COUNT(*) AS count
             FROM quiz_submissions WHERE quiz_id = $1
             GROUP BY score ORDER BY score`,
            [id]
        );

        const stats = statsRes.rows[0];
        const passThreshold = Math.ceil(totalQuestions * 0.4); // 40% pass

        // Count students who passed
        const passRes = await db.query(
            'SELECT COUNT(*) FROM quiz_submissions WHERE quiz_id = $1 AND score >= $2',
            [id, passThreshold]
        );

        res.status(200).json({
            total_submissions: parseInt(stats.total_submissions, 10),
            total_questions: totalQuestions,
            avg_score: parseFloat(stats.avg_score).toFixed(2),
            max_score: parseInt(stats.max_score, 10),
            min_score: parseInt(stats.min_score, 10),
            pass_threshold: passThreshold,
            pass_count: parseInt(passRes.rows[0].count, 10),
            question_stats: questionStats.rows,
            violations: violationsRes.rows[0],
            score_distribution: distributionRes.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};
