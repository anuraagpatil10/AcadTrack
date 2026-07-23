-- Schema.sql
-- Run this script in your PostgreSQL database to create the tables.

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(100) UNIQUE,
    password TEXT,
    role VARCHAR(20) CHECK (role IN ('student', 'professor', 'admin')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
<<<<<<< HEAD

CREATE TABLE students (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    roll_no VARCHAR(50),
    department VARCHAR(50),
    semester INT
);

=======

CREATE TABLE students (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    roll_no VARCHAR(50),
    department VARCHAR(50),
    semester INT,
    profile_image_url TEXT,
    face_embeddings JSONB DEFAULT '[]'::jsonb,
    embedding_model VARCHAR(50) DEFAULT 'Facenet512'
);

>>>>>>> 67614c88fb8d16a57a5d0aede3726c1707c6caf3
CREATE TABLE professors (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    department VARCHAR(50)
);

CREATE TABLE admins (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    department VARCHAR(50) DEFAULT 'ALL'
);

CREATE TABLE semesters (
    id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    department VARCHAR(50) NOT NULL,
    semester_no INT NOT NULL,
    total_credits INT NOT NULL CHECK (total_credits > 0),
    registration_open BOOLEAN DEFAULT FALSE,
    gradesheet_released BOOLEAN DEFAULT FALSE,
    created_by INT REFERENCES admins(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(department, semester_no, name)
);

CREATE TABLE subjects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    code VARCHAR(20),
    professor_id INT REFERENCES professors(id),
    semester_id INT REFERENCES semesters(id) ON DELETE CASCADE,
    credits INT DEFAULT 4 CHECK (credits > 0),
    course_type VARCHAR(20) DEFAULT 'compulsory' CHECK (course_type IN ('compulsory', 'elective')),
    elective_group VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE enrollments (
    id SERIAL PRIMARY KEY,
    student_id INT REFERENCES students(id),
    subject_id INT REFERENCES subjects(id),
    UNIQUE(student_id, subject_id)
);

CREATE TABLE semester_registrations (
    id SERIAL PRIMARY KEY,
    semester_id INT REFERENCES semesters(id) ON DELETE CASCADE,
    student_id INT REFERENCES students(id) ON DELETE CASCADE,
    total_credits INT NOT NULL DEFAULT 0,
    status VARCHAR(20) DEFAULT 'registered' CHECK (status IN ('registered', 'cancelled')),
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(semester_id, student_id)
);

CREATE TABLE semester_registration_courses (
    id SERIAL PRIMARY KEY,
    registration_id INT REFERENCES semester_registrations(id) ON DELETE CASCADE,
    subject_id INT REFERENCES subjects(id) ON DELETE CASCADE,
    UNIQUE(registration_id, subject_id)
);
<<<<<<< HEAD

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

=======

CREATE TABLE attendance_sessions (
    id SERIAL PRIMARY KEY,
    student_id INT REFERENCES students(id),
    subject_id INT REFERENCES subjects(id),
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    is_valid BOOLEAN,
    verification_status VARCHAR(20) DEFAULT 'pending',
    face_match_score FLOAT,
    verification_timestamp TIMESTAMP,
    accumulated_valid_time INT DEFAULT 0,
    biometric_state VARCHAR(20)
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

>>>>>>> 67614c88fb8d16a57a5d0aede3726c1707c6caf3
CREATE TABLE marks (
    id SERIAL PRIMARY KEY,
    student_id INT REFERENCES students(id),
    exam_id INT REFERENCES exams(id),
    marks_obtained INT
);

CREATE TABLE grading_schemas (
    id SERIAL PRIMARY KEY,
    subject_id INT UNIQUE REFERENCES subjects(id) ON DELETE CASCADE,
    is_released BOOLEAN DEFAULT FALSE,
    released_at TIMESTAMP,
    created_by INT REFERENCES professors(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE grading_schema_components (
    id SERIAL PRIMARY KEY,
    schema_id INT REFERENCES grading_schemas(id) ON DELETE CASCADE,
    exam_type VARCHAR(20) CHECK (exam_type IN ('midsem', 'endsem', 'quiz', 'assignment', 'practical')),
    weight_percentage NUMERIC(5,2) NOT NULL CHECK (weight_percentage >= 0 AND weight_percentage <= 100),
    display_order INT DEFAULT 0,
    UNIQUE(schema_id, exam_type)
);

CREATE TABLE grading_schema_ranges (
    id SERIAL PRIMARY KEY,
    schema_id INT REFERENCES grading_schemas(id) ON DELETE CASCADE,
    grade_code VARCHAR(2) CHECK (grade_code IN ('AA', 'AB', 'BB', 'BC', 'CC', 'CD', 'DD', 'DE', 'F')),
    min_score NUMERIC(5,2) NOT NULL CHECK (min_score >= 0 AND min_score <= 100),
    max_score NUMERIC(5,2) NOT NULL CHECK (max_score >= 0 AND max_score <= 100),
    display_order INT DEFAULT 0,
    UNIQUE(schema_id, grade_code)
);

CREATE TABLE semester_grade_sheets (
    id SERIAL PRIMARY KEY,
    semester_id INT REFERENCES semesters(id) ON DELETE CASCADE,
    student_id INT REFERENCES students(id) ON DELETE CASCADE,
    total_credits INT NOT NULL,
    total_grade_points NUMERIC(8,2) NOT NULL,
    spi NUMERIC(5,2) NOT NULL,
    released_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(semester_id, student_id)
);

CREATE TABLE semester_grade_sheet_courses (
    id SERIAL PRIMARY KEY,
    grade_sheet_id INT REFERENCES semester_grade_sheets(id) ON DELETE CASCADE,
    subject_id INT REFERENCES subjects(id) ON DELETE CASCADE,
    credits INT NOT NULL,
    grade_code VARCHAR(2) NOT NULL,
    grade_point_value INT NOT NULL,
    course_grade_points NUMERIC(8,2) NOT NULL,
    UNIQUE(grade_sheet_id, subject_id)
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
