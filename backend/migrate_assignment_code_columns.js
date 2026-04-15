require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const q = `
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS code_language VARCHAR(30);
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS code_text TEXT;
`;

(async () => {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set. Add it to backend/.env');
    }
    console.log('Running migration: add code_language + code_text to submissions...');
    await pool.query(q);
    console.log('✅ Migration successful.');
  } catch (e) {
    console.error('❌ Migration failed:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end().catch(() => {});
  }
})();

