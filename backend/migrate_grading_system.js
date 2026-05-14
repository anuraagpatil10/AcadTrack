require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const query = `
CREATE TABLE IF NOT EXISTS grading_schemas (
    id SERIAL PRIMARY KEY,
    subject_id INT UNIQUE REFERENCES subjects(id) ON DELETE CASCADE,
    is_released BOOLEAN DEFAULT FALSE,
    released_at TIMESTAMP,
    created_by INT REFERENCES professors(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS grading_schema_components (
    id SERIAL PRIMARY KEY,
    schema_id INT REFERENCES grading_schemas(id) ON DELETE CASCADE,
    exam_type VARCHAR(20) CHECK (exam_type IN ('midsem', 'endsem', 'quiz', 'assignment', 'practical')),
    weight_percentage NUMERIC(5,2) NOT NULL CHECK (weight_percentage >= 0 AND weight_percentage <= 100),
    display_order INT DEFAULT 0,
    UNIQUE(schema_id, exam_type)
);

CREATE TABLE IF NOT EXISTS grading_schema_ranges (
    id SERIAL PRIMARY KEY,
    schema_id INT REFERENCES grading_schemas(id) ON DELETE CASCADE,
    grade_code VARCHAR(2) CHECK (grade_code IN ('AA', 'AB', 'BB', 'BC', 'CC', 'CD', 'DD', 'DE', 'F')),
    min_score NUMERIC(5,2) NOT NULL CHECK (min_score >= 0 AND min_score <= 100),
    max_score NUMERIC(5,2) NOT NULL CHECK (max_score >= 0 AND max_score <= 100),
    display_order INT DEFAULT 0,
    UNIQUE(schema_id, grade_code)
);
`;

(async () => {
    try {
        console.log('Creating grading system tables...');
        await pool.query(query);
        console.log('Grading system migration completed successfully.');
    } catch (error) {
        console.error('Grading system migration failed:', error);
    } finally {
        await pool.end();
    }
})();
