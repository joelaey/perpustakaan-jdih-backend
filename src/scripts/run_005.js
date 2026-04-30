const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

async function runMigration() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || ''}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'jdih_sumedang'}`,
        ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
    });

    try {
        const sqlPath = path.join(__dirname, '..', 'migrations', '005_book_copies.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Running 005_book_copies migration...');
        const client = await pool.connect();

        await client.query(sql);

        console.log('✅ Book Copies migration applied successfully!');
        client.release();
    } catch (e) {
        console.error('Migration Error:', e);
    } finally {
        await pool.end();
    }
}

runMigration();
