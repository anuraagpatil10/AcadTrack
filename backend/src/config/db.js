const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  // Connection resilience settings for remote Render.com DB
  connectionTimeoutMillis: 10000,   // 10s to establish connection
  idleTimeoutMillis: 30000,         // 30s idle before closing
  max: 10,                          // max pool size
  allowExitOnIdle: false,
});

// Log connection errors but don't crash the process
pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err.message);
});

// Test connection on startup
pool.query('SELECT NOW()')
  .then(() => console.log('✅ Database connected successfully'))
  .catch(err => console.error('❌ Database connection failed:', err.message));

module.exports = {
  query: (text, params) => pool.query(text, params),
};
