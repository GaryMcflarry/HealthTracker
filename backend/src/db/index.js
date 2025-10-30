const { drizzle } = require('drizzle-orm/mysql2');
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'fitnessdb',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true
});

async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('Database connected successfully');
    console.log(`Connected to: ${process.env.DB_NAME || 'health_tracker'}`);
    connection.release();
    return true;
  } catch (error) {
    console.error('Database connection failed:', error.message);
    return false;
  }
}

testConnection();

const db = drizzle(pool);

module.exports = { 
  db, 
  pool,
  testConnection 
};