const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Profile routes (any authenticated user)
router.put('/profile', userController.updateProfile);
router.put('/change-password', userController.changePassword);

// Admin-only user management routes
router.get('/', authorizeRole('admin'), userController.getAllUsers);
router.post('/', authorizeRole('admin'), userController.createUser);
router.put('/:id', authorizeRole('admin'), userController.updateUser);
router.delete('/:id', authorizeRole('admin'), userController.deleteUser);

module.exports = router;
