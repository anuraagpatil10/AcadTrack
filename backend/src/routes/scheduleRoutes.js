const express = require('express');
const router = express.Router();
const scheduleController = require('../controllers/scheduleController');
const authMiddleware = require('../middlewares/auth');

// Static routes first
router.delete('/slot/:id', authMiddleware(['professor']), scheduleController.deleteSchedule);
router.delete('/instance/:id', authMiddleware(['professor']), scheduleController.deleteInstance);

// Parameterized routes
router.get('/:subjectId', authMiddleware(['professor', 'student']), scheduleController.getSchedules);
router.post('/:subjectId', authMiddleware(['professor']), scheduleController.addSchedule);
router.post('/:subjectId/cancel', authMiddleware(['professor']), scheduleController.cancelClass);
router.post('/:subjectId/extra', authMiddleware(['professor']), scheduleController.scheduleExtra);
router.get('/:subjectId/classes', authMiddleware(['professor', 'student']), scheduleController.getClasses);
router.get('/:subjectId/today', authMiddleware(['student']), scheduleController.getTodayClasses);

module.exports = router;
