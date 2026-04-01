const express = require('express');
const router = express.Router();
const courseController = require('../controllers/courseController');
const authMiddleware = require('../middlewares/auth');

router.get('/my-courses', authMiddleware(['professor']), courseController.getCourses);
router.get('/my-enrolled-courses', authMiddleware(['student']), courseController.getStudentCourses);
router.post('/create', authMiddleware(['professor']), courseController.createCourse);
router.get('/students', authMiddleware(['professor']), courseController.getAllStudents);
router.get('/:subjectId/enrolled', authMiddleware(['professor']), courseController.getEnrolledStudents);
router.post('/:subjectId/enroll', authMiddleware(['professor']), courseController.enrollStudents);
router.delete('/:subjectId/unenroll', authMiddleware(['professor']), courseController.unenrollStudent);

module.exports = router;
