const { pool } = require('../config/database');

// Request to borrow a book (user)
const requestBorrow = async (req, res) => {
    try {
        const userId = req.user.id;
        const { book_id, library_id, notes } = req.body;

        if (!book_id || !library_id) {
            return res.status(400).json({ success: false, message: 'Book ID and Library ID are required' });
        }

        // Check if book exists
        const book = await pool.query('SELECT id, title FROM books WHERE id = $1', [book_id]);
        if (book.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Book not found' });
        }

        // Check stock in book_copies
        const copyCheck = await pool.query('SELECT stock_available FROM book_copies WHERE book_id = $1 AND library_id = $2', [book_id, library_id]);
        if (copyCheck.rows.length === 0 || copyCheck.rows[0].stock_available <= 0) {
            return res.status(400).json({ success: false, message: 'Stock buku di perpustakaan ini sedang kosong' });
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
            'INSERT INTO borrowings (user_id, book_id, library_id, notes) VALUES ($1, $2, $3, $4) RETURNING *',
            [userId, book_id, library_id, notes || null]
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
        const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';
        const isSuperAdmin = req.user.role === 'super_admin';
        const { status, library_id, page = 1, limit = 20 } = req.query;
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
        } else if (req.user.role === 'admin') {
            conditions.push(`b.library_id = $${idx++}`);
            values.push(req.user.library_id);
        } else if (isSuperAdmin && library_id) {
            conditions.push(`b.library_id = $${idx++}`);
            values.push(library_id);
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
        let countQuery = `
            SELECT COUNT(*) 
            FROM borrowings b
            JOIN books bk ON b.book_id = bk.id
        `;
        const countValues = [];
        let countIdx = 1;
        const countConditions = [];
        if (!isAdmin) {
            countConditions.push(`b.user_id = $${countIdx++}`);
            countValues.push(req.user.id);
        } else if (req.user.role === 'admin') {
            countConditions.push(`b.library_id = $${countIdx++}`);
            countValues.push(req.user.library_id);
        } else if (isSuperAdmin && library_id) {
            countConditions.push(`b.library_id = $${countIdx++}`);
            countValues.push(library_id);
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

// Get single borrowing by ID
const getBorrowingById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `SELECT b.*, u.name as user_name, u.email as user_email, 
                    bk.title as book_title, bk.author as book_author, 
                    bk.cover as book_cover
             FROM borrowings b
             JOIN users u ON b.user_id = u.id
             JOIN books bk ON b.book_id = bk.id
             WHERE b.id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Borrowing not found' });
        }

        // Apply access control: user can only view their own
        if (req.user.role === 'pengguna' && result.rows[0].user_id !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }

        // Admin can only view if the book belongs to their library
        if (req.user.role === 'admin' && result.rows[0].library_id !== req.user.library_id) {
            return res.status(403).json({ success: false, message: 'Forbidden (Library mismatch)' });
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Get borrowing by ID error:', error);
        res.status(500).json({ success: false, message: 'Gagal mengambil detail peminjaman' });
    }
};

// Update borrowing status (admin only)
const updateBorrowingStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, admin_notes } = req.body;

        // Check if row belongs to admin's library
        if (req.user.role === 'admin') {
            const checkQuery = `SELECT library_id, book_id FROM borrowings WHERE id = $1`;
            const check = await pool.query(checkQuery, [id]);
            if (check.rows.length === 0 || check.rows[0].library_id !== req.user.library_id) {
                return res.status(403).json({ success: false, message: 'Akses ditolak (Bukan perpustakaan Anda)' });
            }
        }

        const validStatuses = ['approved', 'rejected', 'borrowed', 'returned'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        // Fetch borrowing record to get book_id and library_id for stock operations
        const borrowingRecord = await pool.query('SELECT book_id, library_id, status as current_status FROM borrowings WHERE id = $1', [id]);
        if (borrowingRecord.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Borrowing not found' });
        }
        const { book_id, library_id: bLibraryId, current_status } = borrowingRecord.rows[0];

        const updates = [`status = $1`, `updated_at = CURRENT_TIMESTAMP`];
        const values = [status];
        let idx = 2;

        if (admin_notes) {
            updates.push(`admin_notes = $${idx++}`);
            values.push(admin_notes);
        }

        if (status === 'approved') {
            updates.push(`approved_date = CURRENT_TIMESTAMP`);
        } else if (status === 'borrowed') {
            updates.push(`borrow_date = CURRENT_TIMESTAMP`);
            if (req.body.due_date) {
                updates.push(`due_date = $${idx++}`);
                values.push(req.body.due_date);
            } else {
                updates.push(`due_date = CURRENT_TIMESTAMP + INTERVAL '14 days'`);
            }
            // Decrease stock in book_copies
            await pool.query(
                'UPDATE book_copies SET stock_available = GREATEST(stock_available - 1, 0) WHERE book_id = $1 AND library_id = $2',
                [book_id, bLibraryId]
            );
        } else if (status === 'returned') {
            updates.push(`return_date = CURRENT_TIMESTAMP`);
            // Increase stock in book_copies
            await pool.query(
                'UPDATE book_copies SET stock_available = stock_available + 1 WHERE book_id = $1 AND library_id = $2',
                [book_id, bLibraryId]
            );
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
        let query = `
            SELECT
                COUNT(*) FILTER (WHERE b.status = 'pending') AS pending,
                COUNT(*) FILTER (WHERE b.status = 'approved') AS approved,
                COUNT(*) FILTER (WHERE b.status = 'borrowed') AS borrowed,
                COUNT(*) FILTER (WHERE b.status = 'returned') AS returned,
                COUNT(*) FILTER (WHERE b.status = 'rejected') AS rejected,
                COUNT(*) AS total
            FROM borrowings b
            JOIN books bk ON b.book_id = bk.id
        `;
        let values = [];
        let conditions = [];

        if (req.user.role === 'admin') {
            conditions.push(`b.library_id = $1`);
            values.push(req.user.library_id);
        } else if (req.user.role === 'super_admin' && req.query.library_id) {
            conditions.push(`b.library_id = $1`);
            values.push(req.query.library_id);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        const stats = await pool.query(query, values);
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

// Upload proof (pickup or return)
const uploadProof = async (req, res) => {
    try {
        const { id } = req.params;
        const { type, proofData } = req.body; // type: 'pickup' or 'return'
        const userId = req.user.id;
        const isAdmin = req.user.role === 'admin';

        if (!['pickup', 'return'].includes(type) || !proofData) {
            return res.status(400).json({ success: false, message: 'Invalid proof type or missing data' });
        }

        // Verify ownership if not super_admin
        const check = await pool.query('SELECT user_id, status, library_id FROM borrowings WHERE id = $1', [id]);
        if (check.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Peminjaman tidak ditemukan' });
        }

        if (req.user.role === 'pengguna' && check.rows[0].user_id !== userId) {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }

        if (req.user.role === 'admin' && check.rows[0].library_id !== req.user.library_id) {
            return res.status(403).json({ success: false, message: 'Forbidden (Library mismatch)' });
        }

        const column = type === 'pickup' ? 'pickup_proof' : 'return_proof';
        const result = await pool.query(
            `UPDATE borrowings SET ${column} = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
            [proofData, id]
        );

        res.json({ success: true, message: 'Bukti foto berhasil diunggah', data: result.rows[0] });
    } catch (error) {
        console.error('Upload proof error:', error);
        res.status(500).json({ success: false, message: 'Gagal mengunggah bukti' });
    }
};

module.exports = { requestBorrow, getBorrowings, getBorrowingById, updateBorrowingStatus, getBorrowingStats, cancelBorrowing, uploadProof };
