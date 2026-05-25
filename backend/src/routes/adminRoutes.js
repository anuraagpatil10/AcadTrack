const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middlewares/auth');

router.post('/users', authMiddleware(['admin']), adminController.createUser);
router.get('/professors', authMiddleware(['admin']), adminController.listProfessors);
router.post('/semesters', authMiddleware(['admin']), adminController.createSemester);
router.get('/semesters', authMiddleware(['admin']), adminController.listSemesters);
router.get('/semesters/:semesterId', authMiddleware(['admin']), adminController.getSemesterDetails);
router.patch('/semesters/:semesterId/registration', authMiddleware(['admin']), adminController.toggleSemesterRegistration);
router.post('/courses', authMiddleware(['admin']), adminController.createSemesterCourse);
router.post('/semesters/:semesterId/release-grade-sheets', authMiddleware(['admin']), adminController.releaseSemesterGradeSheets);

module.exports = router;
