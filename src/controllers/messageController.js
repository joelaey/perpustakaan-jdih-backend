const { pool } = require('../config/database');

/**
 * Shared Admin Inbox Chat System
 * - Users send messages to "admin team" (receiver_id = any admin, but all admins see it)
 * - All admins see ALL user conversations
 * - Any admin can reply to any user
 * - Thread is grouped by non-admin user's ID
 */

// Send a message
const sendMessage = async (req, res) => {
    try {
        const senderId = req.user.id;
        const { receiver_id, message } = req.body;

        if (!message || !receiver_id) {
            return res.status(400).json({ success: false, message: 'Message and receiver_id are required' });
        }

        const result = await pool.query(
            'INSERT INTO messages (sender_id, receiver_id, message) VALUES ($1, $2, $3) RETURNING *',
            [senderId, receiver_id, message]
        );

        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ success: false, message: 'Gagal mengirim pesan' });
    }
};

// Get conversations list (Admin/Super Admin only sees users they've talked to, Users see admins they've talked to)
const getConversations = async (req, res) => {
    try {
        const userId = req.user.id;

        // Find latest message between currentUser and any partner
        const result = await pool.query(`
            SELECT DISTINCT ON (partner_id)
                CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END AS partner_id,
                u.name AS partner_name,
                u.email AS partner_email,
                u.role AS partner_role,
                l.name AS partner_library_name,
                m.message AS last_message,
                m.created_at AS last_message_time,
                (SELECT COUNT(*) 
                 FROM messages m2 
                 WHERE m2.receiver_id = $1 
                 AND m2.sender_id = CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END 
                 AND m2.is_read = FALSE) AS unread_count
            FROM messages m
            JOIN users u ON (CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END) = u.id
            LEFT JOIN libraries l ON u.library_id = l.id
            WHERE m.sender_id = $1 OR m.receiver_id = $1
            ORDER BY partner_id, m.created_at DESC
        `, [userId]);

        const sorted = result.rows.sort((a, b) =>
            new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime()
        );

        return res.json({ success: true, data: sorted });
    } catch (error) {
        console.error('Get conversations error:', error);
        res.status(500).json({ success: false, message: 'Gagal memuat percakapan' });
    }
};

// Get messages for a thread between currentUser and target partnerId
const getMessages = async (req, res) => {
    try {
        const userId = req.user.id;
        const { partnerId } = req.params;

        // Mark messages FROM partner AS read
        await pool.query(
            `UPDATE messages SET is_read = TRUE
             WHERE sender_id = $1 AND receiver_id = $2 AND is_read = FALSE`,
            [partnerId, userId]
        );

        const query = `
            SELECT m.*,
                   s.name AS sender_name, s.role AS sender_role,
                   r.name AS receiver_name, r.role AS receiver_role
            FROM messages m
            JOIN users s ON m.sender_id = s.id
            JOIN users r ON m.receiver_id = r.id
            WHERE (m.sender_id = $1 AND m.receiver_id = $2)
               OR (m.sender_id = $2 AND m.receiver_id = $1)
            ORDER BY m.created_at ASC
        `;
        const values = [userId, partnerId];

        const result = await pool.query(query, values);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ success: false, message: 'Gagal memuat pesan' });
    }
};

// Get unread count globally for the user
const getUnreadCount = async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await pool.query(
            `SELECT COUNT(*) FROM messages
             WHERE receiver_id = $1 AND is_read = FALSE`,
            [userId]
        );

        res.json({ success: true, count: parseInt(result.rows[0].count) });
    } catch (error) {
        console.error('Unread count error:', error);
        res.status(500).json({ success: false, message: 'Failed to get unread count' });
    }
};

// Get all admins & super_admins (for users to start a chat)
const getAdmins = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT u.id, u.name, u.email, u.role, u.library_id, l.name as library_name 
            FROM users u
            LEFT JOIN libraries l ON u.library_id = l.id
            WHERE u.role IN ('admin', 'super_admin')
        `);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Get admins error:', error);
        res.status(500).json({ success: false, message: 'Failed' });
    }
};

module.exports = { sendMessage, getConversations, getMessages, getUnreadCount, getAdmins };
