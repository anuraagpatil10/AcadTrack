require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.query('SELECT * FROM users', (err, res) => {
  if (err) console.error("DB Error:", err.message);
  else console.log("DB connected! Users count:", res.rowCount);
  pool.end();
});
