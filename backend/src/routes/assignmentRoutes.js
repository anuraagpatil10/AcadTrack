const express = require('express');
const router = express.Router();
const assignmentController = require('../controllers/assignmentController');
const authMiddleware = require('../middlewares/auth');
const upload = require('../middlewares/upload');

// Professor routes
router.post('/create', authMiddleware(['professor']), assignmentController.createAssignment);
router.get('/subject/:subjectId', authMiddleware(['professor', 'student']), assignmentController.getSubjectAssignments);
router.get('/:id/submissions', authMiddleware(['professor']), assignmentController.getSubmissions);
router.get('/:id/plagiarism', authMiddleware(['professor']), assignmentController.getPlagiarismReport);
router.delete('/:id', authMiddleware(['professor']), assignmentController.deleteAssignment);

// Student routes
router.get('/student/:subjectId', authMiddleware(['student']), assignmentController.getStudentAssignments);
router.post('/submit', authMiddleware(['student']), upload.single('file'), assignmentController.submitAssignment);
router.post('/submit-code', authMiddleware(['student']), assignmentController.submitAssignmentCode);

// Submission details (code view)
router.get('/submission/:submissionId', authMiddleware(['professor', 'student']), assignmentController.getSubmissionDetail);

module.exports = router;
