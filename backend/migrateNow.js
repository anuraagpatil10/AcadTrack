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
