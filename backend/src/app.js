const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

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
