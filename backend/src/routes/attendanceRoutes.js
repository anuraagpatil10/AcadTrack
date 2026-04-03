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

// Professor lecture session routes
router.post('/professor/start', authMiddleware(['professor']), attendanceController.startLectureSession);
router.post('/professor/ping', authMiddleware(['professor']), attendanceController.pingLectureSession);
router.post('/professor/complete', authMiddleware(['professor']), attendanceController.completeLectureSession);

module.exports = router;
