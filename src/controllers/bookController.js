const { pool } = require('../config/database');

// Get all books with pagination & search
const getAllBooks = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const offset = (page - 1) * limit;
        const search = req.query.search || '';
        const fieldType = req.query.field_type || '';
        const year = req.query.year || '';
        const libraryId = req.query.library_id || '';
        const sort = req.query.sort || 'newest';

        let whereClause = 'WHERE 1=1';
        let orderByClause = 'ORDER BY id DESC'; // default newest

        if (sort === 'az') {
            orderByClause = 'ORDER BY title ASC';
        } else if (sort === 'za') {
            orderByClause = 'ORDER BY title DESC';
        } else if (sort === 'newest') {
            orderByClause = 'ORDER BY year DESC NULLS LAST, id DESC';
        }

        const params = [];
        let paramIndex = 1;

        if (search) {
            whereClause += ` AND (title ILIKE $${paramIndex} OR author ILIKE $${paramIndex + 1} OR subject ILIKE $${paramIndex + 2} OR publisher ILIKE $${paramIndex + 3})`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
            paramIndex += 4;
        }

        if (fieldType) {
            whereClause += ` AND field_type = $${paramIndex}`;
            params.push(fieldType);
            paramIndex++;
        }

        if (year) {
            whereClause += ` AND year = $${paramIndex}`;
            params.push(parseInt(year));
            paramIndex++;
        }

        if (libraryId) {
            whereClause += ` AND library_id = $${paramIndex}`;
            params.push(parseInt(libraryId));
            paramIndex++;
        }

        // Determine base query to aggregate stock
        // If libraryId is set, we filter books that have copies in that library
        let queryBase = `
            SELECT b.*, COALESCE(SUM(bc.stock_available), 0) as total_stock
            FROM books b
            LEFT JOIN book_copies bc ON b.id = bc.book_id
        `;

        // If libraryId is provided, we still left join all copies, but we only want books that are available in that specific library.
        // Or simpler: filter books based on book_copies library_id
        if (libraryId) {
            queryBase = `
                SELECT b.*, COALESCE(bc_lib.stock_available, 0) as total_stock
                FROM books b
                INNER JOIN book_copies bc_lib ON b.id = bc_lib.book_id AND bc_lib.library_id = $${paramIndex - 1}
            `;
        } else {
            queryBase += ` ${whereClause.replace('WHERE 1=1 AND', 'WHERE')}
                            GROUP BY b.id `;
        }

        if (libraryId) {
            queryBase += ` ${whereClause.replace(`AND library_id = $${paramIndex - 1}`, '').replace('WHERE 1=1 AND', 'WHERE')} `;
        }

        let countQuery = '';
        if (libraryId) {
            countQuery = `
                SELECT COUNT(DISTINCT b.id) as total FROM books b
                INNER JOIN book_copies bc_lib ON b.id = bc_lib.book_id AND bc_lib.library_id = $${paramIndex - 1}
                ${whereClause.replace(`AND library_id = $${paramIndex - 1}`, '').replace('WHERE 1=1 AND', 'WHERE 1=1 AND ')}
            `;
        } else {
            countQuery = `SELECT COUNT(*) as total FROM books ${whereClause.replace('WHERE 1=1 AND', 'WHERE')}`;
        }

        // Get total count
        const countResult = await pool.query(countQuery, params.slice(0, libraryId ? paramIndex - 1 : paramIndex));
        const total = parseInt(countResult.rows[0].total);
        const totalPages = Math.ceil(total / limit);

        // Get paginated data
        const dataResult = await pool.query(
            `${queryBase} ${orderByClause} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            [...params, limit, offset]
        );

        res.json({
            success: true,
            data: dataResult.rows,
            meta: {
                current_page: page,
                per_page: limit,
                total: total,
                last_page: totalPages,
                from: total > 0 ? offset + 1 : 0,
                to: Math.min(offset + limit, total),
            },
            message: 'Books fetched successfully',
        });
    } catch (error) {
        console.error('Error fetching books:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch books',
            error: error.message,
        });
    }
};

// Get a single book by ID
const getBookById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM books WHERE id = $1', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Book not found',
            });
        }

        const book = result.rows[0];

        // Fetch available copies
        const copiesResult = await pool.query(`
            SELECT bc.id as copy_id, bc.stock_available, l.id as library_id, l.name as library_name, l.address as library_address
            FROM book_copies bc
            JOIN libraries l ON bc.library_id = l.id
            WHERE bc.book_id = $1
        `, [id]);

        book.copies = copiesResult.rows;

        // Calculate total global stock
        book.total_stock = copiesResult.rows.reduce((sum, copy) => sum + parseInt(copy.stock_available), 0);

        res.json({
            success: true,
            data: book,
            message: 'Book fetched successfully',
        });
    } catch (error) {
        console.error('Error fetching book:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch book',
            error: error.message,
        });
    }
};

// Create a new master book
const createBook = async (req, res) => {
    try {
        const {
            title, author, publisher, publish_place, year, isbn,
            subject, field_type, physical_description, language, location,
            file_url, cover, library_id: targetLibraryId, library_ids, initial_stock
        } = req.body;

        const result = await pool.query(
            `INSERT INTO books 
             (title, author, publisher, publish_place, year, isbn, subject, 
              field_type, physical_description, language, location, file_url, cover) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
             RETURNING *`,
            [title, author, publisher, publish_place, year || null, isbn, subject,
                field_type, physical_description, language || 'Indonesia', location, file_url, cover]
        );

        const newBook = result.rows[0];

        // Auto-create book_copy for the admin's library
        const userRole = req.user.role;
        const userLibraryId = req.user.library_id;
        const stock = parseInt(initial_stock) || 1;

        if (userRole === 'admin' && userLibraryId) {
            // Admin perpustakaan: auto-assign to their own library
            await pool.query(
                'INSERT INTO book_copies (book_id, library_id, stock_available) VALUES ($1, $2, $3) ON CONFLICT (book_id, library_id) DO UPDATE SET stock_available = EXCLUDED.stock_available',
                [newBook.id, userLibraryId, stock]
            );
        } else if (userRole === 'super_admin') {
            // Super admin: assign to specified libraries (array) or a single library
            const targetIds = Array.isArray(library_ids) && library_ids.length > 0
                ? library_ids
                : (targetLibraryId ? [targetLibraryId] : []);

            for (const libId of targetIds) {
                await pool.query(
                    'INSERT INTO book_copies (book_id, library_id, stock_available) VALUES ($1, $2, $3) ON CONFLICT (book_id, library_id) DO UPDATE SET stock_available = EXCLUDED.stock_available',
                    [newBook.id, parseInt(libId), stock]
                );
            }
        }

        res.status(201).json({
            success: true,
            data: newBook,
            message: 'Book created successfully',
        });
    } catch (error) {
        console.error('Error creating book:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create book',
            error: error.message,
        });
    }
};

// Update a master book
const updateBook = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            title, author, publisher, publish_place, year, isbn,
            subject, field_type, physical_description, language, location,
            file_url, cover
        } = req.body;

        const result = await pool.query(
            `UPDATE books SET 
             title = $1, author = $2, publisher = $3, publish_place = $4, year = $5, isbn = $6,
             subject = $7, field_type = $8, physical_description = $9, language = $10, 
             location = $11, file_url = $12, cover = $13, updated_at = CURRENT_TIMESTAMP
             WHERE id = $14
             RETURNING *`,
            [title, author, publisher, publish_place, year, isbn, subject,
                field_type, physical_description, language, location, file_url, cover, id]
        );

        res.json({
            success: true,
            data: result.rows[0],
            message: 'Book updated successfully',
        });
    } catch (error) {
        console.error('Error updating book:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update book',
            error: error.message,
        });
    }
};

// Delete a book
const deleteBook = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM books WHERE id = $1 RETURNING id', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Book not found',
            });
        }

        res.json({
            success: true,
            message: 'Book deleted successfully',
        });
    } catch (error) {
        console.error('Error deleting book:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete book',
            error: error.message,
        });
    }
};

// Get all unique field_types for filter dropdown
const getFieldTypes = async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT DISTINCT field_type FROM books WHERE field_type IS NOT NULL ORDER BY field_type'
        );
        res.json({
            success: true,
            data: result.rows.map((r) => r.field_type),
        });
    } catch (error) {
        console.error('Error fetching field types:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch field types',
            error: error.message,
        });
    }
};

// Get stats for dashboard
const getStats = async (req, res) => {
    try {
        const libraryId = req.query.library_id || (req.user && req.user.role === 'admin' ? req.user.library_id : null);

        let whereClauseBook = '';
        let whereClauseUser = '';
        let param = [];

        // If an admin requests stats, optionally filter by their library
        if (libraryId) {
            whereClauseBook = 'INNER JOIN book_copies bc ON bc.book_id = books.id AND bc.library_id = $1';
            // users table also needs filtering by library_id
            whereClauseUser = 'WHERE library_id = $1 OR role = \'super_admin\'';
            param.push(libraryId);
        }

        const totalBooks = await pool.query(`SELECT COUNT(DISTINCT books.id) as count FROM books ${whereClauseBook}`, param);
        const totalUsers = await pool.query(`SELECT COUNT(*) as count FROM users ${whereClauseUser}`, param);
        const fieldTypes = await pool.query(`SELECT COUNT(DISTINCT field_type) as count FROM books ${whereClauseBook}`, param);
        const years = await pool.query(`SELECT MIN(year) as min_year, MAX(year) as max_year FROM books ${whereClauseBook} WHERE year IS NOT NULL`, param);

        res.json({
            success: true,
            data: {
                total_books: parseInt(totalBooks.rows[0].count),
                total_users: parseInt(totalUsers.rows[0].count),
                total_categories: parseInt(fieldTypes.rows[0].count),
                year_range: years.rows[0],
            },
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch stats',
            error: error.message,
        });
    }
};

// ML-based content recommendation (content-based filtering)
// Scores books by: same field_type (+3), shared subject keywords (+2), shared title words (+1)
const getRecommendations = async (req, res) => {
    try {
        const { id } = req.params;

        // Fetch the source book
        const sourceResult = await pool.query('SELECT * FROM books WHERE id = $1', [id]);
        if (sourceResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Book not found' });
        }

        const source = sourceResult.rows[0];

        // Tokenize helper - extract meaningful keywords
        const tokenize = (text) => {
            if (!text) return [];
            return text.toLowerCase()
                .replace(/[^a-z0-9\s]/g, ' ')
                .split(/\s+/)
                .filter(w => w.length > 2)  // skip tiny words
                .filter(w => !['dan', 'yang', 'dari', 'untuk', 'dengan', 'pada', 'dalam', 'ini', 'itu', 'atau', 'the', 'and'].includes(w));
        };

        const sourceFieldType = (source.field_type || '').toLowerCase().trim();
        const sourceSubjectTokens = tokenize(source.subject);
        const sourceTitleTokens = tokenize(source.title);

        // Fetch all other books
        const allBooksResult = await pool.query(
            'SELECT id, title, author, publisher, year, field_type, subject, cover FROM books WHERE id != $1',
            [id]
        );

        // Score each book
        const scored = allBooksResult.rows.map((book) => {
            let score = 0;

            // 1. Same field_type → high weight
            const bookFieldType = (book.field_type || '').toLowerCase().trim();
            if (sourceFieldType && bookFieldType && sourceFieldType === bookFieldType) {
                score += 3;
            }

            // 2. Overlapping subject keywords → medium weight
            const bookSubjectTokens = tokenize(book.subject);
            const subjectOverlap = sourceSubjectTokens.filter(t => bookSubjectTokens.includes(t));
            score += subjectOverlap.length * 2;

            // 3. Similar title words → low weight
            const bookTitleTokens = tokenize(book.title);
            const titleOverlap = sourceTitleTokens.filter(t => bookTitleTokens.includes(t));
            score += titleOverlap.length * 1;

            return { ...book, score };
        });

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 8;
        const offset = (page - 1) * limit;

        // Sort by score descending
        scored.sort((a, b) => b.score - a.score);

        // Filter out books with 0 score, then apply pagination
        const validRecommendations = scored.filter(b => b.score > 0);
        const total = validRecommendations.length;
        const recommendations = validRecommendations.slice(offset, offset + limit);

        res.json({
            success: true,
            data: recommendations,
            meta: {
                current_page: page,
                per_page: limit,
                total: total,
                last_page: Math.ceil(total / limit),
                has_more: offset + limit < total
            },
            message: 'Recommendations fetched successfully',
        });
    } catch (error) {
        console.error('Error fetching recommendations:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch recommendations',
            error: error.message,
        });
    }
};

// Add or Update stock for a specific library copy
const updateBookCopy = async (req, res) => {
    try {
        const { book_id } = req.params;
        const { stock_available, library_id } = req.body;

        const targetLibraryId = req.user.role === 'admin' ? req.user.library_id : library_id;

        if (!targetLibraryId) {
            return res.status(400).json({ success: false, message: 'library_id is required' });
        }

        const result = await pool.query(`
            INSERT INTO book_copies (book_id, library_id, stock_available)
            VALUES ($1, $2, $3)
            ON CONFLICT (book_id, library_id)
            DO UPDATE SET stock_available = EXCLUDED.stock_available, updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `, [book_id, targetLibraryId, stock_available]);

        res.json({
            success: true,
            data: result.rows[0],
            message: 'Book copy stock updated successfully'
        });
    } catch (error) {
        console.error('Error updating book copy:', error);
        res.status(500).json({ success: false, message: 'Failed to update book copy stock' });
    }
};

module.exports = {
    getAllBooks,
    getBookById,
    createBook,
    updateBook,
    deleteBook,
    getFieldTypes,
    getStats,
    getRecommendations,
    updateBookCopy
};
