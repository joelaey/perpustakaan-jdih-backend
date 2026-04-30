const express = require('express');
const router = express.Router();
const libraryController = require('../controllers/libraryController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// Public or semi-public route (e.g. for users to see available libraries or register dropdown)
router.get('/', libraryController.getAllLibraries);
router.get('/:id', libraryController.getLibraryById);

// Protected routes for super_admin
router.post('/', authenticateToken, authorizeRole('super_admin'), libraryController.createLibrary);
router.put('/:id', authenticateToken, authorizeRole('super_admin'), libraryController.updateLibrary);
router.delete('/:id', authenticateToken, authorizeRole('super_admin'), libraryController.deleteLibrary);

module.exports = router;
