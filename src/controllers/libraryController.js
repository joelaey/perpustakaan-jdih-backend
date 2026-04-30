const { pool } = require('../config/database');

const getAllLibraries = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM libraries ORDER BY id ASC');
        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching libraries:', error);
        res.status(500).json({ success: false, message: 'Gagal mengambil data perpustakaan' });
    }
};

const getLibraryById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM libraries WHERE id = $1', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Perpustakaan tidak ditemukan' });
        }
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error fetching library:', error);
        res.status(500).json({ success: false, message: 'Gagal mengambil data perpustakaan' });
    }
};

const createLibrary = async (req, res) => {
    try {
        const { name, address, contact } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'Nama perpustakaan wajib diisi' });

        const result = await pool.query(
            'INSERT INTO libraries (name, address, contact) VALUES ($1, $2, $3) RETURNING *',
            [name, address, contact]
        );
        res.status(201).json({ success: true, message: 'Perpustakaan berhasil ditambahkan', data: result.rows[0] });
    } catch (error) {
        console.error('Error creating library:', error);
        res.status(500).json({ success: false, message: 'Gagal menambahkan perpustakaan' });
    }
};

const updateLibrary = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, address, contact } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'Nama perpustakaan wajib diisi' });

        const result = await pool.query(
            'UPDATE libraries SET name = $1, address = $2, contact = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *',
            [name, address, contact, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Perpustakaan tidak ditemukan' });
        }
        res.json({ success: true, message: 'Perpustakaan berhasil diperbarui', data: result.rows[0] });
    } catch (error) {
        console.error('Error updating library:', error);
        res.status(500).json({ success: false, message: 'Gagal memperbarui perpustakaan' });
    }
};

const deleteLibrary = async (req, res) => {
    try {
        const { id } = req.params;

        if (parseInt(id) === 1) {
            return res.status(400).json({ success: false, message: 'Perpustakaan default tidak dapat dihapus' });
        }

        await pool.query('BEGIN');

        // 1. Delete borrowings associated with the library
        await pool.query('DELETE FROM borrowings WHERE library_id = $1', [id]);

        // 2. Delete messages where sender or receiver is an admin from this library
        await pool.query(`
            DELETE FROM messages 
            WHERE sender_id IN (SELECT id FROM users WHERE library_id = $1)
               OR receiver_id IN (SELECT id FROM users WHERE library_id = $1)
        `, [id]);

        // 3. Delete users related to this library (admins)
        await pool.query('DELETE FROM users WHERE library_id = $1', [id]);

        // 4. Delete book_copies related to this library
        await pool.query('DELETE FROM book_copies WHERE library_id = $1', [id]);

        // 5. Delete orphaned books (books that no longer exist in any library)
        // Since we just deleted this library's book_copies, any book that now has 0 remaining copies across all libraries is considered orphaned and should be deleted to prevent ghost books in the system.
        await pool.query(`
            DELETE FROM books 
            WHERE id NOT IN (SELECT DISTINCT book_id FROM book_copies)
        `);

        // 6. Delete the library
        const result = await pool.query('DELETE FROM libraries WHERE id = $1 RETURNING id', [id]);

        if (result.rows.length === 0) {
            await pool.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Perpustakaan tidak ditemukan' });
        }

        await pool.query('COMMIT');
        res.json({ success: true, message: 'Perpustakaan dan semua data terkait berhasil dihapus' });
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Error deleting library:', error);
        res.status(500).json({ success: false, message: 'Gagal menghapus perpustakaan dan data terkait' });
    }
};

module.exports = {
    getAllLibraries,
    getLibraryById,
    createLibrary,
    updateLibrary,
    deleteLibrary
};
