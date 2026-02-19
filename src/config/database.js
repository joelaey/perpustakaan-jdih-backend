const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || ''}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'jdih_sumedang'}`,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

// Test database connection
const testConnection = async () => {
    try {
        const client = await pool.connect();
        console.log('✅ Database connected successfully (PostgreSQL)');
        client.release();
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
    }
};

module.exports = { pool, testConnection };
