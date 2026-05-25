require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const queries = [
  `ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`,
  `ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('student', 'professor', 'admin'))`,
  `CREATE TABLE IF NOT EXISTS admins (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      department VARCHAR(50) DEFAULT 'ALL'
  )`,
  `CREATE TABLE IF NOT EXISTS semesters (
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
  )`,
  `ALTER TABLE semesters ADD COLUMN IF NOT EXISTS name VARCHAR(120)`,
  `ALTER TABLE semesters ADD COLUMN IF NOT EXISTS department VARCHAR(50)`,
  `ALTER TABLE semesters ADD COLUMN IF NOT EXISTS semester_no INT`,
  `ALTER TABLE semesters ADD COLUMN IF NOT EXISTS total_credits INT`,
  `ALTER TABLE semesters ADD COLUMN IF NOT EXISTS registration_open BOOLEAN DEFAULT FALSE`,
  `ALTER TABLE semesters ADD COLUMN IF NOT EXISTS gradesheet_released BOOLEAN DEFAULT FALSE`,
  `ALTER TABLE semesters ADD COLUMN IF NOT EXISTS created_by INT REFERENCES admins(id)`,
  `ALTER TABLE semesters ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
  `UPDATE semesters SET
      name = COALESCE(name, CONCAT('Semester ', id)),
      department = COALESCE(department, 'GENERAL'),
      semester_no = COALESCE(semester_no, id),
      total_credits = COALESCE(total_credits, 0),
      registration_open = COALESCE(registration_open, FALSE),
      gradesheet_released = COALESCE(gradesheet_released, FALSE)
   `,
  `ALTER TABLE subjects ADD COLUMN IF NOT EXISTS semester_id INT REFERENCES semesters(id) ON DELETE CASCADE`,
  `ALTER TABLE subjects ADD COLUMN IF NOT EXISTS credits INT DEFAULT 4`,
  `ALTER TABLE subjects ADD COLUMN IF NOT EXISTS course_type VARCHAR(20) DEFAULT 'compulsory'`,
  `ALTER TABLE subjects ADD COLUMN IF NOT EXISTS elective_group VARCHAR(50)`,
  `ALTER TABLE subjects ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE`,
  `ALTER TABLE subjects DROP CONSTRAINT IF EXISTS subjects_course_type_check`,
  `ALTER TABLE subjects ADD CONSTRAINT subjects_course_type_check CHECK (course_type IN ('compulsory', 'elective'))`,
  `CREATE TABLE IF NOT EXISTS semester_registrations (
      id SERIAL PRIMARY KEY,
      semester_id INT REFERENCES semesters(id) ON DELETE CASCADE,
      student_id INT REFERENCES students(id) ON DELETE CASCADE,
      total_credits INT NOT NULL DEFAULT 0,
      status VARCHAR(20) DEFAULT 'registered' CHECK (status IN ('registered', 'cancelled')),
      registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(semester_id, student_id)
  )`,
  `ALTER TABLE semester_registrations ADD COLUMN IF NOT EXISTS total_credits INT DEFAULT 0`,
  `ALTER TABLE semester_registrations ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'registered'`,
  `ALTER TABLE semester_registrations ADD COLUMN IF NOT EXISTS registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
  `ALTER TABLE semester_registrations DROP CONSTRAINT IF EXISTS semester_registrations_status_check`,
  `ALTER TABLE semester_registrations ADD CONSTRAINT semester_registrations_status_check CHECK (status IN ('registered', 'cancelled'))`,
  `UPDATE semester_registrations
      SET total_credits = COALESCE(total_credits, 0),
          status = COALESCE(status, 'registered'),
          registered_at = COALESCE(registered_at, CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS semester_registration_courses (
      id SERIAL PRIMARY KEY,
      registration_id INT REFERENCES semester_registrations(id) ON DELETE CASCADE,
      subject_id INT REFERENCES subjects(id) ON DELETE CASCADE,
      UNIQUE(registration_id, subject_id)
  )`,
  `CREATE TABLE IF NOT EXISTS semester_grade_sheets (
      id SERIAL PRIMARY KEY,
      semester_id INT REFERENCES semesters(id) ON DELETE CASCADE,
      student_id INT REFERENCES students(id) ON DELETE CASCADE,
      total_credits INT NOT NULL,
      total_grade_points NUMERIC(8,2) NOT NULL,
      spi NUMERIC(5,2) NOT NULL,
      released_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(semester_id, student_id)
  )`,
  `ALTER TABLE semester_grade_sheets ADD COLUMN IF NOT EXISTS student_id INT REFERENCES students(id) ON DELETE CASCADE`,
  `ALTER TABLE semester_grade_sheets ADD COLUMN IF NOT EXISTS total_credits INT DEFAULT 0`,
  `ALTER TABLE semester_grade_sheets ADD COLUMN IF NOT EXISTS total_grade_points NUMERIC(8,2) DEFAULT 0`,
  `ALTER TABLE semester_grade_sheets ADD COLUMN IF NOT EXISTS spi NUMERIC(5,2) DEFAULT 0`,
  `ALTER TABLE semester_grade_sheets ADD COLUMN IF NOT EXISTS released_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
  `ALTER TABLE semester_grade_sheets DROP CONSTRAINT IF EXISTS semester_grade_sheets_semester_id_key`,
  `ALTER TABLE semester_grade_sheets DROP CONSTRAINT IF EXISTS semester_grade_sheets_semester_id_student_id_key`,
  `ALTER TABLE semester_grade_sheets ADD CONSTRAINT semester_grade_sheets_semester_id_student_id_key UNIQUE (semester_id, student_id)`,
  `UPDATE semester_grade_sheets
      SET total_credits = COALESCE(total_credits, 0),
          total_grade_points = COALESCE(total_grade_points, 0),
          spi = COALESCE(spi, 0),
          released_at = COALESCE(released_at, CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS semester_grade_sheet_courses (
      id SERIAL PRIMARY KEY,
      grade_sheet_id INT REFERENCES semester_grade_sheets(id) ON DELETE CASCADE,
      subject_id INT REFERENCES subjects(id) ON DELETE CASCADE,
      credits INT NOT NULL,
      grade_code VARCHAR(2) NOT NULL,
      grade_point_value INT NOT NULL,
      course_grade_points NUMERIC(8,2) NOT NULL,
      UNIQUE(grade_sheet_id, subject_id)
  )`,
  `ALTER TABLE semester_grade_sheet_courses ADD COLUMN IF NOT EXISTS credits INT DEFAULT 0`,
  `ALTER TABLE semester_grade_sheet_courses ADD COLUMN IF NOT EXISTS grade_code VARCHAR(2)`,
  `ALTER TABLE semester_grade_sheet_courses ADD COLUMN IF NOT EXISTS grade_point_value INT DEFAULT 0`,
  `ALTER TABLE semester_grade_sheet_courses ADD COLUMN IF NOT EXISTS course_grade_points NUMERIC(8,2) DEFAULT 0`,
  `UPDATE semester_grade_sheet_courses
      SET credits = COALESCE(credits, 0),
          grade_point_value = COALESCE(grade_point_value, 0),
          course_grade_points = COALESCE(course_grade_points, 0)`,
];

(async () => {
  try {
    for (const query of queries) {
      await pool.query(query);
    }
    console.log('Admin semester system migration completed successfully.');
  } catch (error) {
    console.error('Admin semester system migration failed:', error);
  } finally {
    await pool.end();
  }
})();
