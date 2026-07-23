<<<<<<< HEAD
require('dotenv').config();
const { Pool } = require('pg');

console.log("Connecting to Database using:", process.env.DATABASE_URL ? "URL found" : "NO URL FOUND");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const q = `
CREATE TABLE IF NOT EXISTS lecture_sessions (
    id SERIAL PRIMARY KEY,
    professor_id INT REFERENCES professors(id),
    subject_id INT REFERENCES subjects(id),
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS professor_location_pings (
    id SERIAL PRIMARY KEY,
    lecture_session_id INT REFERENCES lecture_sessions(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS student_location_pings (
    id SERIAL PRIMARY KEY,
    attendance_session_id INT REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

(async () => {
    try {
        console.log("Executing table creation...");
        await pool.query(q);
        console.log("Migration successful! Added tracking tables if they were missing.");
    } catch (e) {
        console.error("Migration Error: ", e);
    } finally {
        await pool.end();
        console.log("Database connection closed.");
    }
})();
=======
require('dotenv').config();
const db = require('./src/config/db');
async function migrate() {
    try {
        await db.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS profile_image_url TEXT, ADD COLUMN IF NOT EXISTS face_embeddings JSONB DEFAULT '[]'::jsonb, ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(50) DEFAULT 'Facenet512';`);
        await db.query(`ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) DEFAULT 'pending', ADD COLUMN IF NOT EXISTS face_match_score FLOAT, ADD COLUMN IF NOT EXISTS verification_timestamp TIMESTAMP, ADD COLUMN IF NOT EXISTS accumulated_valid_time INT DEFAULT 0, ADD COLUMN IF NOT EXISTS biometric_state VARCHAR(20);`);
        console.log('Migration successful');
    } catch(e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
migrate();
>>>>>>> 67614c88fb8d16a57a5d0aede3726c1707c6caf3
