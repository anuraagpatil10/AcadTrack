require('dotenv').config();
const { Pool } = require('pg');
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

pool.query(q).then(()=> {
    console.log('Migration successful!');
    process.exit(0);
}).catch(e=>{
    console.error(e);
    process.exit(1);
});
