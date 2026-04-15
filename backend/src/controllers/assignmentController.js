const db = require('../config/db');
const { uploadFile, readFileContent } = require('../utils/uploadUtil');
const { calculateSimilarity, getSimilarityLabel } = require('../utils/plagiarism');

function normalizeLanguage(lang) {
    if (!lang) return null;
    const v = String(lang).trim().toLowerCase();
    if (!v) return null;
    const map = {
        js: 'javascript',
        javascript: 'javascript',
        ts: 'typescript',
        typescript: 'typescript',
        py: 'python',
        python: 'python',
        java: 'java',
        c: 'c',
        cpp: 'cpp',
        'c++': 'cpp',
        csharp: 'csharp',
        'c#': 'csharp',
        go: 'go',
        rust: 'rust',
        php: 'php',
        ruby: 'ruby',
        sql: 'sql',
        html: 'html',
        css: 'css',
        bash: 'bash',
        sh: 'bash',
    };
    return map[v] || v.slice(0, 30);
}

async function ensureSubmissionCodeColumnsExist() {
    const res = await db.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'submissions'
           AND column_name IN ('code_text', 'code_language')`
    );
    const cols = new Set(res.rows.map(r => r.column_name));
    return {
        code_text: cols.has('code_text'),
        code_language: cols.has('code_language'),
    };
}

// Professor: Create a new assignment
exports.createAssignment = async (req, res) => {
    const { subject_id, title, description, deadline, max_marks } = req.body;

    try {
        const result = await db.query(
            'INSERT INTO assignments (subject_id, title, description, deadline) VALUES ($1, $2, $3, $4) RETURNING id',
            [subject_id, title, description, deadline]
        );
        res.status(201).json({ message: 'Assignment created', assignment_id: result.rows[0].id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Professor: Get all assignments for a subject
exports.getSubjectAssignments = async (req, res) => {
    const { subjectId } = req.params;

    try {
        const result = await db.query(
            `SELECT a.*, 
                    (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id = a.id) as submission_count,
                    (SELECT COUNT(DISTINCT e.student_id) FROM enrollments e WHERE e.subject_id = a.subject_id) as enrolled_count
             FROM assignments a 
             WHERE a.subject_id = $1 
             ORDER BY a.deadline DESC`,
            [subjectId]
        );
        res.status(200).json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Student: Get assignments for enrolled subject (with own submission status)
exports.getStudentAssignments = async (req, res) => {
    const { subjectId } = req.params;
    const student_id = req.user.role_id;

    try {
        const result = await db.query(
            `SELECT a.*,
                    s.id as submission_id,
                    s.file_url,
                    s.submitted_at,
                    s.is_late,
                    s.similarity_score,
                    s.matched_with
             FROM assignments a
             LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_id = $1
             WHERE a.subject_id = $2
             ORDER BY a.deadline DESC`,
            [student_id, subjectId]
        );
        res.status(200).json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Student: Submit an assignment with plagiarism detection
exports.submitAssignment = async (req, res) => {
    const { assignment_id } = req.body;
    const student_id = req.user.role_id;
    const file = req.file;

    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    try {
        // Check assignment exists
        const assignRes = await db.query('SELECT * FROM assignments WHERE id = $1', [assignment_id]);
        if (assignRes.rows.length === 0) return res.status(404).json({ error: 'Assignment not found' });

        // Check for duplicate submission
        const existingSub = await db.query(
            'SELECT id FROM submissions WHERE assignment_id = $1 AND student_id = $2',
            [assignment_id, student_id]
        );
        if (existingSub.rows.length > 0) {
            return res.status(400).json({ error: 'You have already submitted this assignment' });
        }

        const is_late = new Date() > new Date(assignRes.rows[0].deadline);

        // Upload file
        const uploadResult = await uploadFile(file.buffer, file.originalname, file.mimetype);

        // Plagiarism Detection Pipeline
        let highestSimilarity = 0;
        let matchedWithId = null;
        const fileContent = file.buffer.toString('utf-8');
        const isCode = isCodeFile(file.originalname);

        if (isCode && fileContent.trim().length > 0) {
            // Get all previous submissions for this assignment
            const previousSubmissions = await db.query(
                'SELECT id, student_id, file_url FROM submissions WHERE assignment_id = $1',
                [assignment_id]
            );

            for (const sub of previousSubmissions.rows) {
                const prevContent = await readFileContent(sub.file_url);
                if (prevContent) {
                    const similarity = calculateSimilarity(fileContent, prevContent);
                    if (similarity > highestSimilarity) {
                        highestSimilarity = similarity;
                        matchedWithId = sub.student_id;
                    }
                }
            }
        }

        // Round similarity to 4 decimal places
        highestSimilarity = Math.round(highestSimilarity * 10000) / 10000;

        // Store submission
        const subResult = await db.query(
            `INSERT INTO submissions (assignment_id, student_id, file_url, submitted_at, is_late, similarity_score, matched_with)
             VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5, $6) RETURNING id`,
            [assignment_id, student_id, uploadResult.file_url, is_late, highestSimilarity, matchedWithId]
        );

        const similarityInfo = getSimilarityLabel(highestSimilarity);

        res.status(200).json({
            message: 'Assignment submitted successfully',
            submission_id: subResult.rows[0].id,
            file_url: uploadResult.file_url,
            is_late,
            similarity_score: highestSimilarity,
            similarity_label: similarityInfo.label,
            similarity_level: similarityInfo.level,
            matched_with: matchedWithId
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Student: Submit pasted code (no file upload) with plagiarism detection
exports.submitAssignmentCode = async (req, res) => {
    const { assignment_id, code_text, code_language } = req.body;
    const student_id = req.user.role_id;

    const code = typeof code_text === 'string' ? code_text : '';
    const lang = normalizeLanguage(code_language);

    if (!assignment_id) return res.status(400).json({ error: 'assignment_id is required' });
    if (!code || code.trim().length === 0) return res.status(400).json({ error: 'Please paste your code before submitting' });

    try {
        const cols = await ensureSubmissionCodeColumnsExist();
        if (!cols.code_text || !cols.code_language) {
            return res.status(500).json({
                error: 'Database not migrated for code submissions yet. Please add submissions.code_text and submissions.code_language columns.'
            });
        }

        // Check assignment exists
        const assignRes = await db.query('SELECT * FROM assignments WHERE id = $1', [assignment_id]);
        if (assignRes.rows.length === 0) return res.status(404).json({ error: 'Assignment not found' });

        // Check for duplicate submission
        const existingSub = await db.query(
            'SELECT id FROM submissions WHERE assignment_id = $1 AND student_id = $2',
            [assignment_id, student_id]
        );
        if (existingSub.rows.length > 0) {
            return res.status(400).json({ error: 'You have already submitted this assignment' });
        }

        const is_late = new Date() > new Date(assignRes.rows[0].deadline);

        // Plagiarism Detection Pipeline (compare against previous stored code or uploaded file contents)
        let highestSimilarity = 0;
        let matchedWithId = null;

        const previousSubmissions = await db.query(
            'SELECT id, student_id, file_url, code_text FROM submissions WHERE assignment_id = $1',
            [assignment_id]
        );

        for (const sub of previousSubmissions.rows) {
            let prevContent = null;
            if (sub.code_text && String(sub.code_text).trim().length > 0) {
                prevContent = sub.code_text;
            } else if (sub.file_url) {
                prevContent = await readFileContent(sub.file_url);
            }
            if (prevContent) {
                const similarity = calculateSimilarity(code, prevContent);
                if (similarity > highestSimilarity) {
                    highestSimilarity = similarity;
                    matchedWithId = sub.student_id;
                }
            }
        }

        // Round similarity to 4 decimal places
        highestSimilarity = Math.round(highestSimilarity * 10000) / 10000;

        // Store submission (file_url null)
        const subResult = await db.query(
            `INSERT INTO submissions (assignment_id, student_id, file_url, code_language, code_text, submitted_at, is_late, similarity_score, matched_with)
             VALUES ($1, $2, NULL, $3, $4, CURRENT_TIMESTAMP, $5, $6, $7) RETURNING id`,
            [assignment_id, student_id, lang, code, is_late, highestSimilarity, matchedWithId]
        );

        const similarityInfo = getSimilarityLabel(highestSimilarity);

        res.status(200).json({
            message: 'Assignment submitted successfully',
            submission_id: subResult.rows[0].id,
            is_late,
            similarity_score: highestSimilarity,
            similarity_label: similarityInfo.label,
            similarity_level: similarityInfo.level,
            matched_with: matchedWithId
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Professor: Get submissions for an assignment
exports.getSubmissions = async (req, res) => {
    const { id } = req.params; // assignment_id
    try {
        if (!id) return res.status(400).json({ error: 'assignment_id is required' });
        const result = await db.query(
            `SELECT sub.*, st.roll_no, u.name as student_name
             FROM submissions sub
             JOIN students st ON sub.student_id = st.id
             JOIN users u ON st.user_id = u.id
             WHERE sub.assignment_id = $1
             ORDER BY sub.similarity_score DESC`,
            [id]
        );
        res.status(200).json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Professor/Student: Get a single submission (includes code_text)
exports.getSubmissionDetail = async (req, res) => {
    const { submissionId } = req.params;
    try {
        const cols = await ensureSubmissionCodeColumnsExist();
        if (!cols.code_text || !cols.code_language) {
            return res.status(500).json({
                error: 'Database not migrated for code submissions yet. Please add submissions.code_text and submissions.code_language columns.'
            });
        }

        const result = await db.query(
            `SELECT sub.*, st.roll_no, u.name as student_name
             FROM submissions sub
             JOIN students st ON sub.student_id = st.id
             JOIN users u ON st.user_id = u.id
             WHERE sub.id = $1`,
            [submissionId]
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Submission not found' });

        const sub = result.rows[0];

        // Student can only access own submission
        if (req.user.role === 'student' && sub.student_id !== req.user.role_id) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        res.status(200).json(sub);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Professor: Get plagiarism report for an assignment
exports.getPlagiarismReport = async (req, res) => {
    const { id } = req.params; // assignment_id
    try {
        const submissions = await db.query(
            `SELECT sub.id, sub.student_id, sub.file_url, sub.code_language, sub.similarity_score, sub.matched_with,
                    sub.is_late, sub.submitted_at,
                    st.roll_no, u.name as student_name
             FROM submissions sub
             JOIN students st ON sub.student_id = st.id
             JOIN users u ON st.user_id = u.id
             WHERE sub.assignment_id = $1
             ORDER BY sub.similarity_score DESC`,
            [id]
        );

        const subs = submissions.rows;
        const totalSubs = subs.length;
        const flaggedCount = subs.filter(s => s.similarity_score >= 0.5).length;
        const highRiskCount = subs.filter(s => s.similarity_score >= 0.8).length;
        const lateCount = subs.filter(s => s.is_late).length;
        const avgSimilarity = totalSubs > 0
            ? subs.reduce((sum, s) => sum + (s.similarity_score || 0), 0) / totalSubs
            : 0;

        // Build similarity pairs for matched submissions
        const pairs = [];
        for (const sub of subs) {
            if (sub.matched_with && sub.similarity_score > 0.3) {
                const matchedStudent = subs.find(s => s.student_id === sub.matched_with);
                if (matchedStudent) {
                    pairs.push({
                        student1: { name: sub.student_name, roll_no: sub.roll_no, id: sub.student_id },
                        student2: { name: matchedStudent.student_name, roll_no: matchedStudent.roll_no, id: matchedStudent.student_id },
                        similarity: sub.similarity_score
                    });
                }
            }
        }

        // Remove duplicate pairs
        const uniquePairs = [];
        const pairKeys = new Set();
        for (const p of pairs) {
            const key = [p.student1.id, p.student2.id].sort().join('-');
            if (!pairKeys.has(key)) {
                pairKeys.add(key);
                uniquePairs.push(p);
            }
        }

        res.status(200).json({
            submissions: subs,
            stats: {
                total: totalSubs,
                flagged: flaggedCount,
                high_risk: highRiskCount,
                late: lateCount,
                avg_similarity: Math.round(avgSimilarity * 1000) / 1000
            },
            pairs: uniquePairs.sort((a, b) => b.similarity - a.similarity)
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Professor: Delete an assignment
exports.deleteAssignment = async (req, res) => {
    const { id } = req.params;
    try {
        // Delete submissions first, then assignment
        await db.query('DELETE FROM submissions WHERE assignment_id = $1', [id]);
        await db.query('DELETE FROM assignments WHERE id = $1', [id]);
        res.status(200).json({ message: 'Assignment deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};
