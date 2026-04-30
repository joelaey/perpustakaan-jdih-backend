const express = require('express');
const router = express.Router();
const borrowingController = require('../controllers/borrowingController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

router.use(authenticateToken);

// User & Admin routes
router.post('/', borrowingController.requestBorrow);
router.get('/', borrowingController.getBorrowings);
router.get('/stats', authorizeRole('admin', 'super_admin'), borrowingController.getBorrowingStats);
router.get('/:id', borrowingController.getBorrowingById);
router.delete('/:id', borrowingController.cancelBorrowing);

// Both Users and Admins can upload proofs
router.post('/:id/proof', borrowingController.uploadProof);

// Admin routes
router.put('/:id/status', authorizeRole('admin', 'super_admin'), borrowingController.updateBorrowingStatus);

module.exports = router;
