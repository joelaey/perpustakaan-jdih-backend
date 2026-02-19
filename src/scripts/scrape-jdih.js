/**
 * Scraper untuk JDIH Sumedang API (PostgreSQL / Supabase)
 * Mengambil semua data monografi dari halaman 1 s/d terakhir
 * Hanya menyimpan yang type === "Buku Hukum"
 *
 * Usage: node src/scripts/scrape-jdih.js
 */

const { Pool } = require('pg');
require('dotenv').config();

const API_BASE = 'https://jdih.sumedangkab.go.id/api/monografi';
const DELAY_MS = 500;
const COVER_BASE = 'https://jdih.sumedangkab.go.id/monografi/cover/';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || ''}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'jdih_sumedang'}`,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanText(text) {
    if (!text) return null;
    return text.replace(/\r\n/g, ' ').replace(/\r/g, ' ').trim();
}

async function fetchPage(page) {
    const url = `${API_BASE}?page=${page}`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} for page ${page}`);
    }
    return response.json();
}

async function insertBook(book) {
    const sql = `
        INSERT INTO books 
        (uuid, title, slug, author, publisher, publish_place, year, isbn, 
         subject, field_type, physical_description, registration_number, 
         registration_call, language, location, file_url, cover, downloaded, view_count)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        ON CONFLICT (uuid) DO NOTHING
    `;

    const coverUrl = book.cover ? `${COVER_BASE}${book.cover}` : null;

    const values = [
        book.uuid,
        cleanText(book.title),
        book.slug,
        cleanText(book.teu_badan),
        cleanText(book.publisher),
        cleanText(book.publish_place),
        book.year || null,
        cleanText(book.isbn_issn),
        cleanText(book.subject),
        cleanText(book.field_type),
        cleanText(book.physical_description),
        cleanText(book.registration_number),
        cleanText(book.registration_call),
        book.language || 'Indonesia',
        cleanText(book.location),
        book.file || null,
        coverUrl,
        book.downloaded || 0,
        book.view || 0,
    ];

    const result = await pool.query(sql, values);
    return result.rowCount > 0;
}

async function runScraper() {
    console.log('🚀 Starting JDIH Sumedang scraper (PostgreSQL)...\n');

    // Test connection
    try {
        const client = await pool.connect();
        console.log('✅ Connected to PostgreSQL');
        client.release();
    } catch (err) {
        console.error('❌ Cannot connect to database:', err.message);
        process.exit(1);
    }

    // Fetch first page to get total pages
    console.log('📡 Fetching page 1 to get pagination info...');
    const firstPage = await fetchPage(1);
    const totalPages = firstPage.meta.last_page;
    const totalRecords = firstPage.meta.total;

    console.log(`📊 Total pages: ${totalPages}`);
    console.log(`📊 Total records: ${totalRecords}`);
    console.log(`📊 Per page: ${firstPage.meta.per_page}`);
    console.log(`🔍 Filtering: type === "Buku Hukum" only\n`);

    let totalInserted = 0;
    let totalFiltered = 0;
    let totalDuplicates = 0;
    let totalErrors = 0;

    for (let page = 1; page <= totalPages; page++) {
        try {
            const data = page === 1 ? firstPage : await fetchPage(page);
            const items = data.data;

            const bukuHukum = items.filter((item) => item.type === 'Buku Hukum');
            const filtered = items.length - bukuHukum.length;
            totalFiltered += filtered;

            let pageInserted = 0;
            let pageDuplicates = 0;

            for (const book of bukuHukum) {
                const inserted = await insertBook(book);
                if (inserted) {
                    pageInserted++;
                    totalInserted++;
                } else {
                    pageDuplicates++;
                    totalDuplicates++;
                }
            }

            const status = filtered > 0
                ? `✅ Page ${String(page).padStart(2, '0')}/${totalPages}: ${bukuHukum.length} buku hukum, ${pageInserted} inserted, ${pageDuplicates} dup (${filtered} non-buku skipped)`
                : `✅ Page ${String(page).padStart(2, '0')}/${totalPages}: ${bukuHukum.length} buku hukum, ${pageInserted} inserted, ${pageDuplicates} dup`;

            console.log(status);

            if (page < totalPages) {
                await sleep(DELAY_MS);
            }
        } catch (error) {
            console.error(`❌ Page ${page} error: ${error.message}`);
            totalErrors++;
            await sleep(1000);
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📋 SCRAPING COMPLETE');
    console.log('='.repeat(60));
    console.log(`✅ Total inserted:  ${totalInserted}`);
    console.log(`⏭️  Total duplicates: ${totalDuplicates}`);
    console.log(`🔍 Total filtered:  ${totalFiltered} (non-Buku Hukum)`);
    console.log(`❌ Total errors:    ${totalErrors}`);

    const countResult = await pool.query('SELECT COUNT(*) as count FROM books');
    console.log(`\n📚 Total books in database: ${countResult.rows[0].count}`);

    const samples = await pool.query('SELECT title, author, field_type, year FROM books LIMIT 5');
    console.log('\n📖 Sample books:');
    samples.rows.forEach((book, i) => {
        console.log(`   ${i + 1}. ${book.title} (${book.year || 'N/A'}) — ${book.field_type || 'N/A'}`);
    });

    console.log('\n✅ Done!');
    await pool.end();
    process.exit(0);
}

runScraper().catch((err) => {
    console.error('💥 Fatal error:', err);
    process.exit(1);
});
