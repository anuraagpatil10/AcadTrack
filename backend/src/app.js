const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

// Load routes
app.use('/auth', require('./routes/authRoutes'));
app.use('/attendance', require('./routes/attendanceRoutes'));
app.use('/quiz', require('./routes/quizRoutes'));
app.use('/marks', require('./routes/marksRoutes'));
app.use('/assignment', require('./routes/assignmentRoutes'));
app.use('/course', require('./routes/courseRoutes'));
app.use('/schedule', require('./routes/scheduleRoutes'));

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

module.exports = app;
