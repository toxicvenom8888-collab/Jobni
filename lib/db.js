const mysql = require('mysql2/promise');
const config = require('./config');

let pool;

async function getPool() {
  if (!pool) {
    const sslConfig = config.db.ssl ? { rejectUnauthorized: false } : undefined;
    pool = mysql.createPool({
      host: config.db.host,
      user: config.db.user,
      password: config.db.pass,
      database: config.db.name,
      port: config.db.port,
      ssl: sslConfig,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
    try {
      const c = await pool.getConnection();
      await c.ping();
      c.release();
      console.log('DB connected OK');
    } catch (err) {
      console.error('DB connect error:', err.message);
      await pool.end();
      pool = null;
    }
  }
  return pool;
}

async function query(sql, params) {
  const p = await getPool();
  if (!p) throw new Error('No database connection available');
  const [rows] = await p.execute(sql, params);
  return rows;
}

async function querySingle(sql, params) {
  const rows = await query(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

module.exports = { getPool, query, querySingle };
