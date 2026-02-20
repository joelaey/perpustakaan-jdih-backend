const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.post('/', messageController.sendMessage);
router.get('/conversations', messageController.getConversations);
router.get('/unread', messageController.getUnreadCount);
router.get('/admins', messageController.getAdmins);
router.get('/:partnerId', messageController.getMessages);

module.exports = router;
