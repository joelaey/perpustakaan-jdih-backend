const express = require('express');
const router = express.Router();
const bookController = require('../controllers/bookController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// Public routes
// GET /api/books - Get all books (paginated, searchable)
router.get('/', bookController.getAllBooks);

// GET /api/books/field-types - Get all unique field types for filters
router.get('/field-types', bookController.getFieldTypes);

// GET /api/books/stats - Get dashboard stats
router.get('/stats', bookController.getStats);

// GET /api/books/:id/recommendations - Get ML-based recommendations for a book
router.get('/:id/recommendations', bookController.getRecommendations);

// GET /api/books/:id - Get a single book by ID
router.get('/:id', bookController.getBookById);

// Protected routes (admin only)
// POST /api/books - Create a new book
router.post('/', authenticateToken, authorizeRole('admin', 'super_admin'), bookController.createBook);

// PUT /api/books/:id - Update a book
router.put('/:id', authenticateToken, authorizeRole('admin', 'super_admin'), bookController.updateBook);

// DELETE /api/books/:id - Delete a book
router.delete('/:id', authenticateToken, authorizeRole('admin', 'super_admin'), bookController.deleteBook);

// POST /api/books/:book_id/copy - Update/Add stock at a specific library
router.post('/:book_id/copy', authenticateToken, authorizeRole('admin', 'super_admin'), bookController.updateBookCopy);

module.exports = router;
