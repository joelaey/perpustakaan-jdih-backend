const express = require('express');
const router = express.Router();
const borrowingController = require('../controllers/borrowingController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

router.use(authenticateToken);

// User routes
router.post('/', borrowingController.requestBorrow);
router.get('/', borrowingController.getBorrowings);
router.delete('/:id', borrowingController.cancelBorrowing);

// Admin routes
router.get('/stats', authorizeRole('admin'), borrowingController.getBorrowingStats);
router.put('/:id/status', authorizeRole('admin'), borrowingController.updateBorrowingStatus);

module.exports = router;
