const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quizController');
const authMiddleware = require('../middlewares/auth');

router.post('/create', authMiddleware(['professor']), quizController.createQuiz);
router.get('/:id', authMiddleware(['student', 'professor']), quizController.getQuiz);
router.post('/submit', authMiddleware(['student']), quizController.submitQuiz);
router.post('/violation', authMiddleware(['student']), quizController.recordViolation);
router.get('/subject/:id', authMiddleware(['professor', 'student']), quizController.getSubjectQuizzes);
router.get('/:id/results', authMiddleware(['professor']), quizController.getQuizResults);
router.get('/:id/violations', authMiddleware(['professor']), quizController.getQuizViolations);
router.get('/:id/my-result', authMiddleware(['student']), quizController.getStudentQuizResult);
router.get('/:id/analytics', authMiddleware(['professor']), quizController.getQuizAnalytics);

module.exports = router;
