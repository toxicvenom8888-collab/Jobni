const mysql = require('mysql2/promise');
const config = require('./config');

let pool;

async function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: config.db.host,
      user: config.db.user,
      password: config.db.pass,
      database: config.db.name,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }
  return pool;
}

async function query(sql, params) {
  const p = await getPool();
  const [rows] = await p.execute(sql, params);
  return rows;
}

async function querySingle(sql, params) {
  const rows = await query(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

module.exports = { getPool, query, querySingle };
