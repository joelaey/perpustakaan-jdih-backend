const { pool } = require('../config/database');

// Request to borrow a book (user)
const requestBorrow = async (req, res) => {
    try {
        const userId = req.user.id;
        const { book_id, notes } = req.body;

        if (!book_id) {
            return res.status(400).json({ success: false, message: 'Book ID is required' });
        }

        // Check if book exists
        const book = await pool.query('SELECT id, title FROM books WHERE id = $1', [book_id]);
        if (book.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Book not found' });
        }

        // Check if user already has an active borrowing for this book
        const existing = await pool.query(
            "SELECT id FROM borrowings WHERE user_id = $1 AND book_id = $2 AND status IN ('pending', 'approved', 'borrowed')",
            [userId, book_id]
        );
        if (existing.rows.length > 0) {
            return res.status(409).json({ success: false, message: 'Anda sudah memiliki peminjaman aktif untuk buku ini' });
        }

        const result = await pool.query(
            'INSERT INTO borrowings (user_id, book_id, notes) VALUES ($1, $2, $3) RETURNING *',
            [userId, book_id, notes || null]
        );

        res.status(201).json({ success: true, message: 'Permintaan peminjaman berhasil dikirim', data: result.rows[0] });
    } catch (error) {
        console.error('Request borrow error:', error);
        res.status(500).json({ success: false, message: 'Gagal mengajukan peminjaman' });
    }
};

// Get all borrowings (admin) or user's own borrowings
const getBorrowings = async (req, res) => {
    try {
        const isAdmin = req.user.role === 'admin';
        const { status, page = 1, limit = 20 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let query = `
            SELECT b.*, u.name AS user_name, u.email AS user_email,
                   bk.title AS book_title, bk.author AS book_author, bk.cover AS book_cover
            FROM borrowings b
            JOIN users u ON b.user_id = u.id
            JOIN books bk ON b.book_id = bk.id
        `;
        const conditions = [];
        const values = [];
        let idx = 1;

        if (!isAdmin) {
            conditions.push(`b.user_id = $${idx++}`);
            values.push(req.user.id);
        }

        if (status) {
            conditions.push(`b.status = $${idx++}`);
            values.push(status);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ` ORDER BY b.created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
        values.push(parseInt(limit), offset);

        const result = await pool.query(query, values);

        // Count total
        let countQuery = 'SELECT COUNT(*) FROM borrowings b';
        const countValues = [];
        let countIdx = 1;
        const countConditions = [];
        if (!isAdmin) {
            countConditions.push(`b.user_id = $${countIdx++}`);
            countValues.push(req.user.id);
        }
        if (status) {
            countConditions.push(`b.status = $${countIdx++}`);
            countValues.push(status);
        }
        if (countConditions.length > 0) {
            countQuery += ' WHERE ' + countConditions.join(' AND ');
        }
        const countResult = await pool.query(countQuery, countValues);
        const total = parseInt(countResult.rows[0].count);

        res.json({
            success: true,
            data: result.rows,
            meta: {
                total,
                current_page: parseInt(page),
                per_page: parseInt(limit),
                last_page: Math.ceil(total / parseInt(limit)),
            },
        });
    } catch (error) {
        console.error('Get borrowings error:', error);
        res.status(500).json({ success: false, message: 'Gagal memuat data peminjaman' });
    }
};

// Update borrowing status (admin only)
const updateBorrowingStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, admin_notes } = req.body;

        const validStatuses = ['approved', 'rejected', 'borrowed', 'returned'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        const updates = [`status = $1`, `updated_at = CURRENT_TIMESTAMP`];
        const values = [status];
        let idx = 2;

        if (admin_notes) {
            updates.push(`admin_notes = $${idx++}`);
            values.push(admin_notes);
        }

        if (status === 'approved') {
            updates.push(`approved_date = CURRENT_TIMESTAMP`);
            // Set due date to 14 days from now
            updates.push(`due_date = CURRENT_TIMESTAMP + INTERVAL '14 days'`);
        } else if (status === 'borrowed') {
            updates.push(`borrow_date = CURRENT_TIMESTAMP`);
        } else if (status === 'returned') {
            updates.push(`return_date = CURRENT_TIMESTAMP`);
        }

        values.push(id);
        const result = await pool.query(
            `UPDATE borrowings SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Borrowing not found' });
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Update borrowing error:', error);
        res.status(500).json({ success: false, message: 'Gagal memperbarui status peminjaman' });
    }
};

// Get borrowing stats (admin)
const getBorrowingStats = async (req, res) => {
    try {
        const stats = await pool.query(`
            SELECT
                COUNT(*) FILTER (WHERE status = 'pending') AS pending,
                COUNT(*) FILTER (WHERE status = 'approved') AS approved,
                COUNT(*) FILTER (WHERE status = 'borrowed') AS borrowed,
                COUNT(*) FILTER (WHERE status = 'returned') AS returned,
                COUNT(*) FILTER (WHERE status = 'rejected') AS rejected,
                COUNT(*) AS total
            FROM borrowings
        `);
        res.json({ success: true, data: stats.rows[0] });
    } catch (error) {
        console.error('Borrowing stats error:', error);
        res.status(500).json({ success: false, message: 'Gagal memuat statistik' });
    }
};

// Cancel borrowing (user - only pending)
const cancelBorrowing = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const result = await pool.query(
            "DELETE FROM borrowings WHERE id = $1 AND user_id = $2 AND status = 'pending' RETURNING id",
            [id, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Peminjaman tidak ditemukan atau tidak dapat dibatalkan' });
        }

        res.json({ success: true, message: 'Peminjaman berhasil dibatalkan' });
    } catch (error) {
        console.error('Cancel borrowing error:', error);
        res.status(500).json({ success: false, message: 'Gagal membatalkan peminjaman' });
    }
};

module.exports = { requestBorrow, getBorrowings, updateBorrowingStatus, getBorrowingStats, cancelBorrowing };
