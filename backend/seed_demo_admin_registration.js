require('dotenv').config();
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const { DEFAULT_GRADE_RANGES, GRADE_POINT_MAP, assignGrade, roundTo } = require('./src/utils/grading');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const DEMO_PASSWORD = 'Demo@123';
const DEMO_SEMESTER_NAME = 'CSE Demo Semester 3';
const DEMO_DEPARTMENT = 'CSE';
const DEMO_SEMESTER_NO = 3;
const DEMO_TOTAL_CREDITS = 20;

const USERS = {
  admin: { name: 'Demo Admin', email: 'admin.demo@acadtrack.local', role: 'admin', department: 'ALL' },
  professors: [
    { name: 'Prof Operating Systems', email: 'prof.os@acadtrack.local', role: 'professor', department: DEMO_DEPARTMENT },
    { name: 'Prof Databases', email: 'prof.db@acadtrack.local', role: 'professor', department: DEMO_DEPARTMENT },
    { name: 'Prof Algorithms', email: 'prof.algo@acadtrack.local', role: 'professor', department: DEMO_DEPARTMENT },
    { name: 'Prof Mathematics', email: 'prof.math@acadtrack.local', role: 'professor', department: DEMO_DEPARTMENT },
    { name: 'Prof Electives', email: 'prof.elective@acadtrack.local', role: 'professor', department: DEMO_DEPARTMENT },
  ],
  students: [
    { name: 'Aarav Singh', email: 'student.aarav@acadtrack.local', role: 'student', roll_no: '2026CSE301', department: DEMO_DEPARTMENT, semester: DEMO_SEMESTER_NO },
    { name: 'Isha Verma', email: 'student.isha@acadtrack.local', role: 'student', roll_no: '2026CSE302', department: DEMO_DEPARTMENT, semester: DEMO_SEMESTER_NO },
    { name: 'Rohan Das', email: 'student.rohan@acadtrack.local', role: 'student', roll_no: '2026CSE303', department: DEMO_DEPARTMENT, semester: DEMO_SEMESTER_NO },
  ],
};

const COURSE_BLUEPRINTS = [
  { code: 'CS301', name: 'Operating Systems', credits: 4, course_type: 'compulsory', professorEmail: 'prof.os@acadtrack.local' },
  { code: 'CS302', name: 'Database Management Systems', credits: 4, course_type: 'compulsory', professorEmail: 'prof.db@acadtrack.local' },
  { code: 'CS303', name: 'Design and Analysis of Algorithms', credits: 4, course_type: 'compulsory', professorEmail: 'prof.algo@acadtrack.local' },
  { code: 'MA301', name: 'Discrete Mathematics', credits: 4, course_type: 'compulsory', professorEmail: 'prof.math@acadtrack.local' },
  { code: 'EL301', name: 'Artificial Intelligence Fundamentals', credits: 4, course_type: 'elective', elective_group: 'OPEN-ELECTIVE', professorEmail: 'prof.elective@acadtrack.local' },
  { code: 'EL302', name: 'Cloud Computing Foundations', credits: 4, course_type: 'elective', elective_group: 'OPEN-ELECTIVE', professorEmail: 'prof.elective@acadtrack.local' },
];

const REGISTRATIONS = {
  'student.aarav@acadtrack.local': ['CS301', 'CS302', 'CS303', 'MA301', 'EL301'],
  'student.isha@acadtrack.local': ['CS301', 'CS302', 'CS303', 'MA301', 'EL302'],
  'student.rohan@acadtrack.local': ['CS301', 'CS302', 'CS303', 'MA301', 'EL301'],
};

const MARKS = {
  CS301: {
    'student.aarav@acadtrack.local': { midsem: 34, endsem: 53 },
    'student.isha@acadtrack.local': { midsem: 30, endsem: 47 },
    'student.rohan@acadtrack.local': { midsem: 27, endsem: 44 },
  },
  CS302: {
    'student.aarav@acadtrack.local': { midsem: 32, endsem: 51 },
    'student.isha@acadtrack.local': { midsem: 29, endsem: 45 },
    'student.rohan@acadtrack.local': { midsem: 24, endsem: 42 },
  },
  CS303: {
    'student.aarav@acadtrack.local': { midsem: 31, endsem: 52 },
    'student.isha@acadtrack.local': { midsem: 28, endsem: 46 },
    'student.rohan@acadtrack.local': { midsem: 25, endsem: 41 },
  },
  MA301: {
    'student.aarav@acadtrack.local': { midsem: 35, endsem: 55 },
    'student.isha@acadtrack.local': { midsem: 27, endsem: 43 },
    'student.rohan@acadtrack.local': { midsem: 22, endsem: 39 },
  },
  EL301: {
    'student.aarav@acadtrack.local': { midsem: 33, endsem: 54 },
    'student.rohan@acadtrack.local': { midsem: 26, endsem: 43 },
  },
  EL302: {
    'student.isha@acadtrack.local': { midsem: 31, endsem: 49 },
  },
};

async function getColumnNames(client, tableName) {
  const res = await client.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_name = $1`,
    [tableName]
  );
  return new Set(res.rows.map((row) => row.column_name));
}

async function insertDynamicRow(client, tableName, valuesByColumn, returningColumn = 'id') {
  const columns = await getColumnNames(client, tableName);
  const insertColumns = Object.keys(valuesByColumn).filter((column) => columns.has(column));

  if (!insertColumns.length) {
    throw new Error(`No matching columns found while inserting into ${tableName}`);
  }

  const placeholders = insertColumns.map((_, index) => `$${index + 1}`).join(', ');
  const values = insertColumns.map((column) => valuesByColumn[column]);

  const result = await client.query(
    `INSERT INTO ${tableName} (${insertColumns.join(', ')})
     VALUES (${placeholders})
     RETURNING ${returningColumn}`,
    values
  );

  return result.rows[0][returningColumn];
}

async function upsertUser(client, payload, hashedPassword) {
  const userRes = await client.query(
    `INSERT INTO users (name, email, password, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email)
     DO UPDATE SET name = EXCLUDED.name, password = EXCLUDED.password, role = EXCLUDED.role
     RETURNING id, role`,
    [payload.name, payload.email.toLowerCase(), hashedPassword, payload.role]
  );

  return userRes.rows[0];
}

async function upsertAdminProfile(client, userId, department) {
  const existing = await client.query('SELECT id FROM admins WHERE user_id = $1', [userId]);
  if (existing.rows.length) {
    await client.query('UPDATE admins SET department = $1 WHERE user_id = $2', [department, userId]);
    return existing.rows[0].id;
  }

  const inserted = await client.query(
    'INSERT INTO admins (user_id, department) VALUES ($1, $2) RETURNING id',
    [userId, department]
  );
  return inserted.rows[0].id;
}

async function upsertProfessorProfile(client, userId, department) {
  const existing = await client.query('SELECT id FROM professors WHERE user_id = $1', [userId]);
  if (existing.rows.length) {
    await client.query('UPDATE professors SET department = $1 WHERE user_id = $2', [department, userId]);
    return existing.rows[0].id;
  }

  const inserted = await client.query(
    'INSERT INTO professors (user_id, department) VALUES ($1, $2) RETURNING id',
    [userId, department]
  );
  return inserted.rows[0].id;
}

async function upsertStudentProfile(client, userId, student) {
  const existing = await client.query('SELECT id FROM students WHERE user_id = $1', [userId]);
  if (existing.rows.length) {
    await client.query(
      'UPDATE students SET roll_no = $1, department = $2, semester = $3 WHERE user_id = $4',
      [student.roll_no, student.department, student.semester, userId]
    );
    return existing.rows[0].id;
  }

  const inserted = await client.query(
    'INSERT INTO students (user_id, roll_no, department, semester) VALUES ($1, $2, $3, $4) RETURNING id',
    [userId, student.roll_no, student.department, student.semester]
  );
  return inserted.rows[0].id;
}

async function cleanupDemoSemester(client) {
  const semesterRes = await client.query(
    `SELECT id
     FROM semesters
     WHERE department = $1
       AND COALESCE(name, academic_year) = $2
       AND COALESCE(semester_no, semester_number) = $3`,
    [DEMO_DEPARTMENT, DEMO_SEMESTER_NAME, DEMO_SEMESTER_NO]
  );

  if (!semesterRes.rows.length) return;

  const semesterId = semesterRes.rows[0].id;

  await client.query(
    `DELETE FROM semester_grade_sheet_courses
     WHERE grade_sheet_id IN (SELECT id FROM semester_grade_sheets WHERE semester_id = $1)`,
    [semesterId]
  );
  await client.query('DELETE FROM semester_grade_sheets WHERE semester_id = $1', [semesterId]);
  await client.query(
    `DELETE FROM semester_registration_courses
     WHERE registration_id IN (SELECT id FROM semester_registrations WHERE semester_id = $1)`,
    [semesterId]
  );
  await client.query('DELETE FROM semester_registrations WHERE semester_id = $1', [semesterId]);
  await client.query(
    `DELETE FROM enrollments
     WHERE subject_id IN (SELECT id FROM subjects WHERE semester_id = $1)`,
    [semesterId]
  );
  await client.query(
    `DELETE FROM marks
     WHERE exam_id IN (SELECT id FROM exams WHERE subject_id IN (SELECT id FROM subjects WHERE semester_id = $1))`,
    [semesterId]
  );
  await client.query(
    `DELETE FROM exams
     WHERE subject_id IN (SELECT id FROM subjects WHERE semester_id = $1)`,
    [semesterId]
  );
  await client.query(
    `DELETE FROM grading_schema_components
     WHERE schema_id IN (SELECT id FROM grading_schemas WHERE subject_id IN (SELECT id FROM subjects WHERE semester_id = $1))`,
    [semesterId]
  );
  await client.query(
    `DELETE FROM grading_schema_ranges
     WHERE schema_id IN (SELECT id FROM grading_schemas WHERE subject_id IN (SELECT id FROM subjects WHERE semester_id = $1))`,
    [semesterId]
  );
  await client.query(
    `DELETE FROM grading_schemas
     WHERE subject_id IN (SELECT id FROM subjects WHERE semester_id = $1)`,
    [semesterId]
  );
  await client.query('DELETE FROM subjects WHERE semester_id = $1', [semesterId]);
  await client.query('DELETE FROM semesters WHERE id = $1', [semesterId]);
}

async function createSemester(client, adminId) {
  const columns = await getColumnNames(client, 'semesters');
  const data = {
    department: DEMO_DEPARTMENT,
    total_credits: DEMO_TOTAL_CREDITS,
    created_by: adminId,
    created_at: new Date(),
    updated_at: new Date(),
    registration_open: false,
    gradesheet_released: true,
    name: DEMO_SEMESTER_NAME,
    semester_no: DEMO_SEMESTER_NO,
    academic_year: DEMO_SEMESTER_NAME,
    semester_number: DEMO_SEMESTER_NO,
    registration_status: 'closed',
  };

  const preferredOrder = [
    'name',
    'department',
    'semester_no',
    'semester_number',
    'academic_year',
    'total_credits',
    'registration_open',
    'registration_status',
    'gradesheet_released',
    'created_by',
    'created_at',
    'updated_at',
  ];

  const insertColumns = preferredOrder.filter((column) => columns.has(column));
  const placeholders = insertColumns.map((_, index) => `$${index + 1}`).join(', ');
  const values = insertColumns.map((column) => data[column]);

  const result = await client.query(
    `INSERT INTO semesters (${insertColumns.join(', ')})
     VALUES (${placeholders})
     RETURNING id`,
    values
  );

  return result.rows[0].id;
}

async function createCourse(client, semesterId, professorMap, blueprint) {
  const result = await client.query(
    `INSERT INTO subjects (name, code, professor_id, semester_id, credits, course_type, elective_group, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
     RETURNING id`,
    [
      blueprint.name,
      blueprint.code,
      professorMap.get(blueprint.professorEmail),
      semesterId,
      blueprint.credits,
      blueprint.course_type,
      blueprint.elective_group || null,
    ]
  );
  return result.rows[0].id;
}

async function createGradingSchema(client, subjectId, professorId) {
  const schemaRes = await client.query(
    `INSERT INTO grading_schemas (subject_id, is_released, released_at, created_by)
     VALUES ($1, TRUE, CURRENT_TIMESTAMP, $2)
     RETURNING id`,
    [subjectId, professorId]
  );
  const schemaId = schemaRes.rows[0].id;

  await client.query(
    `INSERT INTO grading_schema_components (schema_id, exam_type, weight_percentage, display_order)
     VALUES
       ($1, 'midsem', 40, 0),
       ($1, 'endsem', 60, 1)`,
    [schemaId]
  );

  for (const [index, range] of DEFAULT_GRADE_RANGES.entries()) {
    await client.query(
      `INSERT INTO grading_schema_ranges (schema_id, grade_code, min_score, max_score, display_order)
       VALUES ($1, $2, $3, $4, $5)`,
      [schemaId, range.grade_code, range.min_score, range.max_score, index]
    );
  }
}

async function createSemesterRegistration(client, semesterId, studentId, totalCredits) {
  return insertDynamicRow(client, 'semester_registrations', {
    semester_id: semesterId,
    student_id: studentId,
    total_credits: totalCredits,
    status: 'registered',
    registered_at: new Date(),
  });
}

async function createSemesterGradeSheet(client, semesterId, studentId) {
  return insertDynamicRow(client, 'semester_grade_sheets', {
    semester_id: semesterId,
    student_id: studentId,
    total_credits: 0,
    total_grade_points: 0,
    spi: 0,
    released_at: new Date(),
  });
}

function computeFinalPercentage(markSet) {
  const midsemPct = (Number(markSet.midsem) / 40) * 100;
  const endsemPct = (Number(markSet.endsem) / 60) * 100;
  return roundTo((midsemPct * 0.4) + (endsemPct * 0.6));
}

async function seed() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await cleanupDemoSemester(client);

    const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 10);

    const adminUser = await upsertUser(client, USERS.admin, hashedPassword);
    const adminId = await upsertAdminProfile(client, adminUser.id, USERS.admin.department);

    const professorMap = new Map();
    for (const professor of USERS.professors) {
      const user = await upsertUser(client, professor, hashedPassword);
      const professorId = await upsertProfessorProfile(client, user.id, professor.department);
      professorMap.set(professor.email, professorId);
    }

    const studentMap = new Map();
    for (const student of USERS.students) {
      const user = await upsertUser(client, student, hashedPassword);
      const studentId = await upsertStudentProfile(client, user.id, student);
      studentMap.set(student.email, studentId);
    }

    const semesterId = await createSemester(client, adminId);

    const courseIdByCode = new Map();
    for (const blueprint of COURSE_BLUEPRINTS) {
      const courseId = await createCourse(client, semesterId, professorMap, blueprint);
      courseIdByCode.set(blueprint.code, courseId);
    }

    const registrationIdByStudentEmail = new Map();
    for (const [studentEmail, selectedCodes] of Object.entries(REGISTRATIONS)) {
      const selectedCourseIds = selectedCodes.map((code) => courseIdByCode.get(code));
      const totalCredits = selectedCodes.reduce((sum, code) => {
        const course = COURSE_BLUEPRINTS.find((entry) => entry.code === code);
        return sum + Number(course.credits);
      }, 0);

      const registrationId = await createSemesterRegistration(
        client,
        semesterId,
        studentMap.get(studentEmail),
        totalCredits
      );
      registrationIdByStudentEmail.set(studentEmail, registrationId);

      for (const subjectId of selectedCourseIds) {
        await client.query(
          `INSERT INTO semester_registration_courses (registration_id, subject_id)
           VALUES ($1, $2)`,
          [registrationId, subjectId]
        );
        await client.query(
          `INSERT INTO enrollments (student_id, subject_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [studentMap.get(studentEmail), subjectId]
        );
      }
    }

    for (const blueprint of COURSE_BLUEPRINTS) {
      const subjectId = courseIdByCode.get(blueprint.code);
      const examMidsemRes = await client.query(
        `INSERT INTO exams (subject_id, exam_type, max_marks)
         VALUES ($1, 'midsem', 40)
         RETURNING id`,
        [subjectId]
      );
      const examEndsemRes = await client.query(
        `INSERT INTO exams (subject_id, exam_type, max_marks)
         VALUES ($1, 'endsem', 60)
         RETURNING id`,
        [subjectId]
      );

      for (const [studentEmail, markSet] of Object.entries(MARKS[blueprint.code] || {})) {
        await client.query(
          'INSERT INTO marks (student_id, exam_id, marks_obtained) VALUES ($1, $2, $3)',
          [studentMap.get(studentEmail), examMidsemRes.rows[0].id, markSet.midsem]
        );
        await client.query(
          'INSERT INTO marks (student_id, exam_id, marks_obtained) VALUES ($1, $2, $3)',
          [studentMap.get(studentEmail), examEndsemRes.rows[0].id, markSet.endsem]
        );
      }

      await createGradingSchema(client, subjectId, professorMap.get(blueprint.professorEmail));
    }

    for (const student of USERS.students) {
      const selectedCodes = REGISTRATIONS[student.email];
      let totalGradePoints = 0;
      let totalCredits = 0;

      const sheetId = await createSemesterGradeSheet(
        client,
        semesterId,
        studentMap.get(student.email)
      );

      for (const courseCode of selectedCodes) {
        const blueprint = COURSE_BLUEPRINTS.find((entry) => entry.code === courseCode);
        const marksForStudent = MARKS[courseCode]?.[student.email];
        const finalPercentage = computeFinalPercentage(marksForStudent);
        const gradeCode = assignGrade(finalPercentage, DEFAULT_GRADE_RANGES);
        const gradePointValue = GRADE_POINT_MAP[gradeCode] ?? 0;
        const courseGradePoints = roundTo(Number(blueprint.credits) * gradePointValue);

        totalCredits += Number(blueprint.credits);
        totalGradePoints += courseGradePoints;

        await client.query(
          `INSERT INTO semester_grade_sheet_courses (grade_sheet_id, subject_id, credits, grade_code, grade_point_value, course_grade_points)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [sheetId, courseIdByCode.get(courseCode), blueprint.credits, gradeCode, gradePointValue, courseGradePoints]
        );
      }

      const spi = totalCredits > 0 ? roundTo(totalGradePoints / totalCredits) : 0;
      await client.query(
        `UPDATE semester_grade_sheets
         SET total_credits = $1, total_grade_points = $2, spi = $3
         WHERE id = $4`,
        [totalCredits, roundTo(totalGradePoints), spi, sheetId]
      );
    }

    await client.query(
      `UPDATE semesters
       SET gradesheet_released = TRUE,
           registration_open = FALSE,
           registration_status = 'closed'
       WHERE id = $1`,
      [semesterId]
    );

    await client.query('COMMIT');

    console.log('Demo data seeded successfully.');
    console.log(`Login credentials for all demo users: password = ${DEMO_PASSWORD}`);
    console.log('Admin:', USERS.admin.email);
    console.log('Professors:', USERS.professors.map((prof) => prof.email).join(', '));
    console.log('Students:', USERS.students.map((student) => student.email).join(', '));
    console.log(`Demo semester: ${DEMO_SEMESTER_NAME} (${DEMO_DEPARTMENT} semester ${DEMO_SEMESTER_NO})`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Demo seed failed:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
