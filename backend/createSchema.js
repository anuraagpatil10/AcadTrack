const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

(async () => {
    try {
        const schema = fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf-8');
        await pool.query(schema);
        fs.writeFileSync('log.txt', "Schema successfully executed! Tables created.");
    } catch(err) {
        fs.writeFileSync('log.txt', "Schema execution error: " + err.message);
    } finally {
        pool.end();
    }
})();
