const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

// POST /api/auth/register - Register new user (pengguna)
router.post('/register', authController.register);

// POST /api/auth/login - Login (admin or pengguna)
router.post('/login', authController.login);

// GET /api/auth/profile - Get current user profile (protected)
router.get('/profile', authenticateToken, authController.getProfile);

module.exports = router;
