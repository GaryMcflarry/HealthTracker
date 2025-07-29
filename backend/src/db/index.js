const { drizzle } = require('drizzle-orm/mysql2');
const mysql = require('mysql2/promise');

// Database connection configuration
const connection = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'health_tracker',
  port: process.env.DB_PORT || 3306
});

// Create drizzle instance
const db = drizzle(connection);

module.exports = { db };