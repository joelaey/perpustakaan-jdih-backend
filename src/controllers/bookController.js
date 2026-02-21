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

        // Get total count
        const countResult = await pool.query(
            `SELECT COUNT(*) as total FROM books ${whereClause}`,
            params
        );
        const total = parseInt(countResult.rows[0].total);
        const totalPages = Math.ceil(total / limit);

        // Get paginated data
        const dataResult = await pool.query(
            `SELECT * FROM books ${whereClause} ${orderByClause} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
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

        res.json({
            success: true,
            data: result.rows[0],
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

// Create a new book
const createBook = async (req, res) => {
    try {
        const {
            title, author, publisher, publish_place, year, isbn,
            subject, field_type, physical_description, language, location,
            file_url, cover
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

        res.status(201).json({
            success: true,
            data: result.rows[0],
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

// Update a book
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

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Book not found',
            });
        }

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
        const totalBooks = await pool.query('SELECT COUNT(*) as count FROM books');
        const totalUsers = await pool.query('SELECT COUNT(*) as count FROM users');
        const fieldTypes = await pool.query('SELECT COUNT(DISTINCT field_type) as count FROM books');
        const years = await pool.query('SELECT MIN(year) as min_year, MAX(year) as max_year FROM books WHERE year IS NOT NULL');

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

        // Sort by score descending, take top 8
        scored.sort((a, b) => b.score - a.score);
        const recommendations = scored.filter(b => b.score > 0).slice(0, 8);

        res.json({
            success: true,
            data: recommendations,
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

module.exports = {
    getAllBooks,
    getBookById,
    createBook,
    updateBook,
    deleteBook,
    getFieldTypes,
    getStats,
    getRecommendations,
};
