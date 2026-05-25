require('dotenv').config();
const bcrypt = require('bcrypt');
const db = require('./src/config/db');

async function migrate() {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        // 1. Update users role constraint to include 'admin'
        await client.query(`
            ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
        `);
        await client.query(`
            ALTER TABLE users ADD CONSTRAINT users_role_check 
            CHECK (role IN ('student', 'professor', 'admin'));
        `);
        console.log('✅ Updated users role constraint');

        // 2. Create admins table
        await client.query(`
            CREATE TABLE IF NOT EXISTS admins (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id) ON DELETE CASCADE,
                department VARCHAR(50)
            );
        `);
        console.log('✅ Created admins table');

        // 3. Create semesters table
        await client.query(`
            CREATE TABLE IF NOT EXISTS semesters (
                id SERIAL PRIMARY KEY,
                semester_number INT NOT NULL,
                department VARCHAR(50) NOT NULL,
                academic_year VARCHAR(20) NOT NULL,
                total_credits INT NOT NULL,
                registration_status VARCHAR(20) DEFAULT 'closed' 
                    CHECK (registration_status IN ('open', 'closed', 'completed')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(semester_number, department, academic_year)
            );
        `);
        console.log('✅ Created semesters table');

        // 4. Create semester_courses table
        await client.query(`
            CREATE TABLE IF NOT EXISTS semester_courses (
                id SERIAL PRIMARY KEY,
                semester_id INT REFERENCES semesters(id) ON DELETE CASCADE,
                subject_id INT REFERENCES subjects(id) ON DELETE CASCADE,
                credit INT NOT NULL CHECK (credit > 0),
                course_type VARCHAR(20) NOT NULL CHECK (course_type IN ('compulsory', 'elective')),
                professor_id INT REFERENCES professors(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(semester_id, subject_id)
            );
        `);
        console.log('✅ Created semester_courses table');

        // 5. Create semester_registrations table
        await client.query(`
            CREATE TABLE IF NOT EXISTS semester_registrations (
                id SERIAL PRIMARY KEY,
                student_id INT REFERENCES students(id) ON DELETE CASCADE,
                semester_id INT REFERENCES semesters(id) ON DELETE CASCADE,
                status VARCHAR(20) DEFAULT 'registered' 
                    CHECK (status IN ('registered', 'completed')),
                registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(student_id, semester_id)
            );
        `);
        console.log('✅ Created semester_registrations table');

        // 6. Create student_elective_choices table
        await client.query(`
            CREATE TABLE IF NOT EXISTS student_elective_choices (
                id SERIAL PRIMARY KEY,
                student_id INT REFERENCES students(id) ON DELETE CASCADE,
                semester_course_id INT REFERENCES semester_courses(id) ON DELETE CASCADE,
                semester_registration_id INT REFERENCES semester_registrations(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(student_id, semester_course_id)
            );
        `);
        console.log('✅ Created student_elective_choices table');

        // 7. Create semester_grade_sheets table
        await client.query(`
            CREATE TABLE IF NOT EXISTS semester_grade_sheets (
                id SERIAL PRIMARY KEY,
                semester_id INT REFERENCES semesters(id) ON DELETE CASCADE UNIQUE,
                is_released BOOLEAN DEFAULT FALSE,
                released_at TIMESTAMP,
                released_by INT REFERENCES admins(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Created semester_grade_sheets table');

        // 8. Create student_semester_grades table
        await client.query(`
            CREATE TABLE IF NOT EXISTS student_semester_grades (
                id SERIAL PRIMARY KEY,
                student_id INT REFERENCES students(id) ON DELETE CASCADE,
                semester_id INT REFERENCES semesters(id) ON DELETE CASCADE,
                total_grade_points NUMERIC(10,2),
                total_credits INT,
                spi NUMERIC(5,2),
                computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(student_id, semester_id)
            );
        `);
        console.log('✅ Created student_semester_grades table');

        // 9. Seed admin account
        const adminEmail = 'admin@iiitv.ac.in';
        const adminPassword = 'admin1234';

        const existing = await client.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
        if (existing.rows.length === 0) {
            const hashedPassword = await bcrypt.hash(adminPassword, 10);
            const userRes = await client.query(
                'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id',
                ['Admin', adminEmail, hashedPassword, 'admin']
            );
            await client.query(
                'INSERT INTO admins (user_id, department) VALUES ($1, $2)',
                [userRes.rows[0].id, 'ALL']
            );
            console.log('✅ Seeded admin account: admin@iiitv.ac.in / admin1234');
        } else {
            console.log('ℹ️  Admin account already exists');
        }

        await client.query('COMMIT');
        console.log('\n🎉 Migration completed successfully!');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', err.message);
        console.error(err);
    } finally {
        client.release();
        process.exit(0);
    }
}

migrate();
