/**
 * Database Migration Runner (PostgreSQL / Supabase)
 * Creates tables using pg
 *
 * Usage: node src/scripts/migrate.js
 */

const { Pool } = require('pg');
require('dotenv').config();

async function migrate() {
    console.log('🚀 Starting PostgreSQL migration...\n');

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || ''}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'jdih_sumedang'}`,
        ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
    });

    try {
        const client = await pool.connect();
        console.log('✅ Connected to PostgreSQL');

        // Create users table
        console.log('\n📋 Creating tables...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(20) NOT NULL DEFAULT 'pengguna' CHECK (role IN ('admin', 'pengguna')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('   ✅ users table ready');

        // Insert default admin (ignore if exists)
        await client.query(`
            INSERT INTO users (name, email, password, role) VALUES
            ('Administrator', 'admin@jdih-sumedang.go.id', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin')
            ON CONFLICT (email) DO NOTHING
        `);
        console.log('   ✅ Default admin user ready');

        // Create books table
        await client.query(`
            CREATE TABLE IF NOT EXISTS books (
                id SERIAL PRIMARY KEY,
                uuid VARCHAR(100) UNIQUE,
                title TEXT NOT NULL,
                slug VARCHAR(500),
                author VARCHAR(500),
                publisher VARCHAR(255),
                publish_place VARCHAR(100),
                year INT,
                isbn VARCHAR(100),
                subject VARCHAR(500),
                field_type VARCHAR(255),
                physical_description VARCHAR(255),
                registration_number VARCHAR(100),
                registration_call VARCHAR(255),
                language VARCHAR(50) DEFAULT 'Indonesia',
                location VARCHAR(255),
                file_url TEXT,
                cover VARCHAR(255),
                downloaded INT DEFAULT 0,
                view_count INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('   ✅ books table ready');

        // Create indexes
        await client.query('CREATE INDEX IF NOT EXISTS idx_books_field_type ON books(field_type)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_books_year ON books(year)');
        console.log('   ✅ Indexes created');

        // Show summary
        const tables = await client.query(`
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' ORDER BY table_name
        `);
        console.log('\n📊 Tables:');
        tables.rows.forEach((t) => console.log(`   📁 ${t.table_name}`));

        client.release();
        console.log('\n✅ Migration complete!');
        console.log('   Next: run `npm run scrape` to fetch books from JDIH API');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        if (error.code === 'ECONNREFUSED') {
            console.error('\n💡 Make sure PostgreSQL is running or set DATABASE_URL in .env');
        }
        process.exit(1);
    } finally {
        await pool.end();
    }
}

migrate();
