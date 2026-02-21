require('dotenv').config({ path: __dirname + '/../../.env' });
const { Pool } = require('pg');

async function up() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
        await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT');
        console.log('✅ Added avatar column to users table');
    } catch (err) {
        console.error('Failed', err);
    } finally {
        await pool.end();
    }
}
up();
