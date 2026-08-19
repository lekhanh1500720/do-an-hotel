require('dotenv').config();
const mysql = require('mysql2');

// Create a connection pool (configurable through .env)
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'hotel_management',
  connectionLimit: 10,
  waitForConnections: true,
  queueLimit: 0,
  charset: 'utf8mb4',
  dateStrings: true,
});

// Promisified pool for async/await usage
const db = pool.promise();

// Quick connectivity check
async function testConnection() {
  const conn = await db.getConnection();
  try {
    await conn.ping();
  } finally {
    conn.release();
  }
}

module.exports = { db, pool, testConnection };