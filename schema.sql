-- Schema.sql
-- Run this script in your PostgreSQL database to create the tables.

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(100) UNIQUE,
    password TEXT,
    role VARCHAR(20) CHECK (role IN ('student', 'professor')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE students (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    roll_no VARCHAR(50),
    department VARCHAR(50),
    semester INT
);

CREATE TABLE professors (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    department VARCHAR(50)
);

CREATE TABLE subjects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    code VARCHAR(20),
    professor_id INT REFERENCES professors(id)
);

CREATE TABLE enrollments (
    id SERIAL PRIMARY KEY,
    student_id INT REFERENCES students(id),
    subject_id INT REFERENCES subjects(id),
    UNIQUE(student_id, subject_id)
);

CREATE TABLE attendance_sessions (
    id SERIAL PRIMARY KEY,
    student_id INT REFERENCES students(id),
    subject_id INT REFERENCES subjects(id),
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    is_valid BOOLEAN
);

CREATE TABLE lecture_sessions (
    id SERIAL PRIMARY KEY,
    professor_id INT REFERENCES professors(id),
    subject_id INT REFERENCES subjects(id),
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE professor_location_pings (
    id SERIAL PRIMARY KEY,
    lecture_session_id INT REFERENCES lecture_sessions(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE student_location_pings (
    id SERIAL PRIMARY KEY,
    attendance_session_id INT REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE class_schedules (
    id SERIAL PRIMARY KEY,
    subject_id INT REFERENCES subjects(id) ON DELETE CASCADE,
    day_of_week INT CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE class_instances (
    id SERIAL PRIMARY KEY,
    subject_id INT REFERENCES subjects(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status VARCHAR(20) CHECK (status IN ('scheduled','cancelled','extra')) DEFAULT 'scheduled',
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(subject_id, date, start_time)
);

CREATE TABLE attendance_records (
    id SERIAL PRIMARY KEY,
    student_id INT REFERENCES students(id),
    subject_id INT REFERENCES subjects(id),
    date DATE,
    status VARCHAR(10) CHECK (status IN ('present', 'absent'))
);

CREATE TABLE quizzes (
    id SERIAL PRIMARY KEY,
    subject_id INT REFERENCES subjects(id),
    title VARCHAR(100),
    duration INT,
    start_time TIMESTAMP,
    end_time TIMESTAMP
);

CREATE TABLE questions (
    id SERIAL PRIMARY KEY,
    quiz_id INT REFERENCES quizzes(id),
    question TEXT,
    option_a TEXT,
    option_b TEXT,
    option_c TEXT,
    option_d TEXT,
    correct_answer CHAR(1)
);

CREATE TABLE quiz_submissions (
    id SERIAL PRIMARY KEY,
    student_id INT REFERENCES students(id),
    quiz_id INT REFERENCES quizzes(id),
    score INT,
    submitted_at TIMESTAMP
);

CREATE TABLE quiz_answers (
    id SERIAL PRIMARY KEY,
    submission_id INT REFERENCES quiz_submissions(id),
    question_id INT REFERENCES questions(id),
    selected_option CHAR(1)
);

CREATE TABLE quiz_violations (
    id SERIAL PRIMARY KEY,
    student_id INT REFERENCES students(id),
    quiz_id INT REFERENCES quizzes(id),
    type VARCHAR(50),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE exams (
    id SERIAL PRIMARY KEY,
    subject_id INT REFERENCES subjects(id),
    exam_type VARCHAR(20) CHECK (exam_type IN ('midsem', 'endsem', 'quiz', 'assignment', 'practical')),
    max_marks INT
);

CREATE TABLE marks (
    id SERIAL PRIMARY KEY,
    student_id INT REFERENCES students(id),
    exam_id INT REFERENCES exams(id),
    marks_obtained INT
);

CREATE TABLE assignments (
    id SERIAL PRIMARY KEY,
    subject_id INT REFERENCES subjects(id),
    title VARCHAR(100),
    description TEXT,
    deadline TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE submissions (
    id SERIAL PRIMARY KEY,
    assignment_id INT REFERENCES assignments(id),
    student_id INT REFERENCES students(id),
    file_url TEXT,
    code_language VARCHAR(30),
    code_text TEXT,
    submitted_at TIMESTAMP,
    is_late BOOLEAN,
    similarity_score FLOAT,
    matched_with INT
);
