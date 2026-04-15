const express = require('express');
const router = express.Router();
const marksController = require('../controllers/marksController');
const authMiddleware = require('../middlewares/auth');

router.post('/upload', authMiddleware(['professor']), marksController.uploadMarks);
router.get('/student/:id', authMiddleware(['student', 'professor']), marksController.getStudentMarks);
router.get('/subject/:id', authMiddleware(['professor']), marksController.getSubjectMarks);
router.get('/student-report/:subjectId', authMiddleware(['student']), marksController.getStudentSubjectReport);

module.exports = router;
