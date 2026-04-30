const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function seedDummyData() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || ''}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'jdih_sumedang'}`,
        ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
    });

    const client = await pool.connect();

    try {
        console.log('🌱 Starting dummy data seeding...\n');

        // ===== 1. Create/Ensure 3 Libraries =====
        console.log('📚 Creating libraries...');

        // Check which libraries already exist
        const existingLibs = await client.query('SELECT id, name FROM libraries');
        console.log(`   Found ${existingLibs.rows.length} existing library(ies)`);

        const librariesToCreate = [
            { name: 'Perpustakaan JDIH Pusat', address: 'Jl. Prabu Gajah Agung No.1, Sumedang', contact: '022-1234567' },
            { name: 'Perpustakaan JDIH Cabang Tanjungsari', address: 'Jl. Raya Tanjungsari No.45, Tanjungsari, Sumedang', contact: '022-7654321' },
            { name: 'Perpustakaan JDIH Cabang Jatinangor', address: 'Jl. Raya Jatinangor No.88, Jatinangor, Sumedang', contact: '022-9876543' },
        ];

        const libraryIds = [];
        for (const lib of librariesToCreate) {
            const existing = existingLibs.rows.find(r => r.name === lib.name);
            if (existing) {
                libraryIds.push(existing.id);
                console.log(`   ✅ Library "${lib.name}" already exists (id=${existing.id})`);
            } else {
                const result = await client.query(
                    'INSERT INTO libraries (name, address, contact) VALUES ($1, $2, $3) RETURNING id',
                    [lib.name, lib.address, lib.contact]
                );
                libraryIds.push(result.rows[0].id);
                console.log(`   ✅ Created library "${lib.name}" (id=${result.rows[0].id})`);
            }
        }

        // ===== 2. Create Admin users for each library =====
        console.log('\n👤 Creating admin users...');
        const hashedPassword = await bcrypt.hash('admin123', 10);

        const adminsToCreate = [
            { name: 'Admin Pusat', email: 'admin.pusat@jdih.sumedang.go.id', phone: '081200000001', library_index: 0 },
            { name: 'Admin Tanjungsari', email: 'admin.tanjungsari@jdih.sumedang.go.id', phone: '081200000002', library_index: 1 },
            { name: 'Admin Jatinangor', email: 'admin.jatinangor@jdih.sumedang.go.id', phone: '081200000003', library_index: 2 },
        ];

        const adminIds = [];
        for (const admin of adminsToCreate) {
            const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [admin.email]);
            if (existingUser.rows.length > 0) {
                // Update library_id and role just in case
                await client.query(
                    'UPDATE users SET role = $1, library_id = $2, phone_number = $3 WHERE id = $4',
                    ['admin', libraryIds[admin.library_index], admin.phone, existingUser.rows[0].id]
                );
                adminIds.push(existingUser.rows[0].id);
                console.log(`   ✅ Admin "${admin.name}" already exists (id=${existingUser.rows[0].id}), updated library_id`);
            } else {
                const result = await client.query(
                    'INSERT INTO users (name, email, password, role, library_id, phone_number) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
                    [admin.name, admin.email, hashedPassword, 'admin', libraryIds[admin.library_index], admin.phone]
                );
                adminIds.push(result.rows[0].id);
                console.log(`   ✅ Created admin "${admin.name}" (id=${result.rows[0].id}) → library "${librariesToCreate[admin.library_index].name}"`);
            }
        }

        // ===== 3. Create Super Admin if not exists =====
        console.log('\n🔑 Ensuring super admin...');
        const superAdminCheck = await client.query("SELECT id FROM users WHERE role = 'super_admin' LIMIT 1");
        if (superAdminCheck.rows.length > 0) {
            console.log(`   ✅ Super admin already exists (id=${superAdminCheck.rows[0].id})`);
        } else {
            const result = await client.query(
                'INSERT INTO users (name, email, password, role, phone_number) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                ['Super Admin', 'superadmin@jdih.sumedang.go.id', hashedPassword, 'super_admin', '081200000000']
            );
            console.log(`   ✅ Created super admin (id=${result.rows[0].id})`);
        }

        // ===== 4. Get existing books to distribute =====
        console.log('\n📖 Distributing books to libraries...');
        const allBooks = await client.query('SELECT id, title FROM books ORDER BY id ASC');
        console.log(`   Found ${allBooks.rows.length} books in master catalog`);

        if (allBooks.rows.length === 0) {
            console.log('   ⚠️  No books found. Creating sample books...');
            const sampleBooks = [
                { title: 'Hukum Tata Negara Indonesia', author: 'Prof. Dr. Jimly Asshiddiqie', field_type: 'Hukum Tatanegara', subject: 'Hukum konstitusi dan ketatanegaraan Indonesia', year: 2024 },
                { title: 'Pengantar Ilmu Hukum', author: 'Prof. Dr. Peter Mahmud Marzuki', field_type: 'Hukum Umum', subject: 'Dasar-dasar ilmu hukum dan teori hukum', year: 2023 },
                { title: 'Hukum Administrasi Negara', author: 'Dr. Ridwan HR', field_type: 'Hukum Administrasi Negara', subject: 'Administrasi negara dan hukum pemerintahan', year: 2024 },
                { title: 'Hukum Pidana Indonesia', author: 'Prof. Dr. Moeljatno', field_type: 'Hukum Pidana', subject: 'Hukum pidana dan penegakan hukum', year: 2023 },
                { title: 'Hukum Perdata Indonesia', author: 'Prof. Subekti', field_type: 'Hukum Perdata', subject: 'Hukum perdata dan perjanjian', year: 2022 },
                { title: 'Hukum Lingkungan Indonesia', author: 'Dr. Suparto Wijoyo', field_type: 'Hukum Lingkungan', subject: 'Perlindungan lingkungan hidup', year: 2024 },
                { title: 'Hukum Internasional', author: 'Prof. Dr. Mochtar Kusumaatmadja', field_type: 'Hukum Internasional', subject: 'Hubungan internasional dan hukum antarnegara', year: 2023 },
                { title: 'Hukum Agraria di Indonesia', author: 'Prof. Boedi Harsono', field_type: 'Hukum Agraria', subject: 'Pertanahan dan hak atas tanah', year: 2022 },
            ];

            for (const b of sampleBooks) {
                const res = await client.query(
                    'INSERT INTO books (title, author, field_type, subject, year, language) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
                    [b.title, b.author, b.field_type, b.subject, b.year, 'Indonesia']
                );
                allBooks.rows.push({ id: res.rows[0].id, title: b.title });
                console.log(`   ✅ Created book: "${b.title}" (id=${res.rows[0].id})`);
            }
        }

        // ===== 5. Distribute book copies across libraries =====
        console.log('\n📦 Assigning stock (book_copies) to libraries...');

        for (let i = 0; i < allBooks.rows.length; i++) {
            const book = allBooks.rows[i];

            // Library 1 (Pusat): gets all books
            await upsertCopy(client, book.id, libraryIds[0], Math.floor(Math.random() * 5) + 1);

            // Library 2 (Tanjungsari): gets ~70% of books
            if (i % 10 < 7) {
                await upsertCopy(client, book.id, libraryIds[1], Math.floor(Math.random() * 3) + 1);
            }

            // Library 3 (Jatinangor): gets ~50% of books
            if (i % 2 === 0) {
                await upsertCopy(client, book.id, libraryIds[2], Math.floor(Math.random() * 3) + 1);
            }
        }

        console.log('   ✅ Book copies distributed!\n');

        // ===== Summary =====
        const libCounts = await client.query(`
            SELECT l.name, COUNT(bc.id) as book_count, COALESCE(SUM(bc.stock_available), 0) as total_stock
            FROM libraries l
            LEFT JOIN book_copies bc ON l.id = bc.library_id
            GROUP BY l.id, l.name
            ORDER BY l.id
        `);

        console.log('📊 Summary:');
        console.log('┌──────────────────────────────────────────┬───────┬───────┐');
        console.log('│ Perpustakaan                             │ Judul │ Stok  │');
        console.log('├──────────────────────────────────────────┼───────┼───────┤');
        for (const row of libCounts.rows) {
            const name = row.name.padEnd(40);
            const count = String(row.book_count).padStart(5);
            const stock = String(row.total_stock).padStart(5);
            console.log(`│ ${name} │${count} │${stock} │`);
        }
        console.log('└──────────────────────────────────────────┴───────┴───────┘');

        console.log('\n🔑 Login credentials (password for all: admin123):');
        console.log('   Super Admin : superadmin@jdih.sumedang.go.id');
        console.log('   Admin Pusat : admin.pusat@jdih.sumedang.go.id');
        console.log('   Admin Tanjungsari: admin.tanjungsari@jdih.sumedang.go.id');
        console.log('   Admin Jatinangor : admin.jatinangor@jdih.sumedang.go.id');
        console.log('\n🎉 Seeding complete!');

    } catch (error) {
        console.error('❌ Seeding error:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

async function upsertCopy(client, bookId, libraryId, stock) {
    await client.query(`
        INSERT INTO book_copies (book_id, library_id, stock_available)
        VALUES ($1, $2, $3)
        ON CONFLICT (book_id, library_id) 
        DO UPDATE SET stock_available = EXCLUDED.stock_available
    `, [bookId, libraryId, stock]);
}

seedDummyData();
