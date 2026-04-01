const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const authMiddleware = require('../middlewares/auth');

router.post('/start', authMiddleware(['student']), attendanceController.startSession);
router.post('/ping', authMiddleware(['student']), attendanceController.pingSession);
router.post('/complete', authMiddleware(['student']), attendanceController.completeSession);
router.get('/student/:id', authMiddleware(['student', 'professor']), attendanceController.getStudentAttendance);
router.get('/student/:studentId/subject/:subjectId', authMiddleware(['student', 'professor']), attendanceController.getStudentSubjectAttendance);
router.post('/finalize', authMiddleware(['professor']), attendanceController.finalizeAttendance);
router.get('/subject/:id', authMiddleware(['professor']), attendanceController.getSubjectAttendance);

module.exports = router;
