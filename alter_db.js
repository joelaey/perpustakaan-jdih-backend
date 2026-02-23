const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function run() {
    try {
        console.log('Connecting to database...', process.env.DATABASE_URL);
        await pool.query('ALTER TABLE borrowings ADD COLUMN IF NOT EXISTS pickup_due_date TIMESTAMP;');
        console.log('Successfully added pickup_due_date column.');
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

run();
