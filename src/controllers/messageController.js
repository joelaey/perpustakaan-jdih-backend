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
        const senderRole = req.user.role;
        const { receiver_id, message } = req.body;

        if (!message) {
            return res.status(400).json({ success: false, message: 'Message is required' });
        }

        let actualReceiverId = receiver_id;

        // If user is not admin, they send to any admin (pick the first one)
        if (senderRole !== 'admin') {
            if (!receiver_id) {
                const adminResult = await pool.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
                if (adminResult.rows.length === 0) {
                    return res.status(404).json({ success: false, message: 'No admin available' });
                }
                actualReceiverId = adminResult.rows[0].id;
            }
        }

        if (!actualReceiverId) {
            return res.status(400).json({ success: false, message: 'Receiver is required' });
        }

        const result = await pool.query(
            'INSERT INTO messages (sender_id, receiver_id, message) VALUES ($1, $2, $3) RETURNING *',
            [senderId, actualReceiverId, message]
        );

        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ success: false, message: 'Gagal mengirim pesan' });
    }
};

// Get conversations list
// For ADMIN: show all unique non-admin users who have message threads
// For USER: show just their own thread (grouped as one conversation with "Admin")
const getConversations = async (req, res) => {
    try {
        const userId = req.user.id;
        const isAdmin = req.user.role === 'admin';

        if (isAdmin) {
            // Admin sees ALL user conversations (grouped by user)
            const result = await pool.query(`
                SELECT DISTINCT ON (user_id)
                    user_id AS partner_id,
                    u.name AS partner_name,
                    u.email AS partner_email,
                    u.role AS partner_role,
                    sub.last_message,
                    sub.last_message_time,
                    sub.unread_count
                FROM (
                    SELECT
                        CASE
                            WHEN s.role != 'admin' THEN m.sender_id
                            ELSE m.receiver_id
                        END AS user_id,
                        m.message AS last_message,
                        m.created_at AS last_message_time,
                        ROW_NUMBER() OVER (
                            PARTITION BY CASE WHEN s.role != 'admin' THEN m.sender_id ELSE m.receiver_id END
                            ORDER BY m.created_at DESC
                        ) AS rn,
                        (SELECT COUNT(*) FROM messages m2
                         JOIN users s2 ON m2.sender_id = s2.id
                         WHERE s2.role != 'admin'
                         AND m2.is_read = FALSE
                         AND CASE WHEN s.role != 'admin' THEN m.sender_id ELSE m.receiver_id END = 
                             CASE WHEN s2.role != 'admin' THEN m2.sender_id ELSE m2.receiver_id END
                        ) AS unread_count
                    FROM messages m
                    JOIN users s ON m.sender_id = s.id
                    JOIN users r ON m.receiver_id = r.id
                    WHERE s.role != 'admin' OR r.role != 'admin'
                ) sub
                JOIN users u ON sub.user_id = u.id
                WHERE sub.rn = 1 AND u.role != 'admin'
                ORDER BY user_id, sub.last_message_time DESC
            `);

            const sorted = result.rows.sort((a, b) =>
                new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime()
            );

            return res.json({ success: true, data: sorted });
        } else {
            // User sees a single conversation thread with "Admin Team"
            const result = await pool.query(`
                SELECT
                    m.message AS last_message,
                    m.created_at AS last_message_time,
                    (SELECT COUNT(*) FROM messages m2
                     JOIN users s2 ON m2.sender_id = s2.id
                     WHERE m2.receiver_id = $1 AND s2.role = 'admin' AND m2.is_read = FALSE
                    ) AS unread_count
                FROM messages m
                WHERE m.sender_id = $1 OR m.receiver_id = $1
                ORDER BY m.created_at DESC
                LIMIT 1
            `, [userId]);

            if (result.rows.length === 0) {
                return res.json({ success: true, data: [] });
            }

            // Get the first admin as the "partner" for display purposes
            const adminResult = await pool.query("SELECT id, name, email, role FROM users WHERE role = 'admin' LIMIT 1");
            const admin = adminResult.rows[0];

            return res.json({
                success: true,
                data: [{
                    partner_id: admin?.id || 0,
                    partner_name: 'Admin Perpustakaan',
                    partner_email: admin?.email || '',
                    partner_role: 'admin',
                    last_message: result.rows[0].last_message,
                    last_message_time: result.rows[0].last_message_time,
                    unread_count: parseInt(result.rows[0].unread_count) || 0,
                }],
            });
        }
    } catch (error) {
        console.error('Get conversations error:', error);
        res.status(500).json({ success: false, message: 'Gagal memuat percakapan' });
    }
};

// Get messages for a thread
// For ADMIN: partnerId = the user's ID. Show all messages where user is sender/receiver
// For USER: show all their own messages (with any admin)
const getMessages = async (req, res) => {
    try {
        const userId = req.user.id;
        const isAdmin = req.user.role === 'admin';
        const { partnerId } = req.params;

        let query, values;

        if (isAdmin) {
            // Admin viewing a user's thread: all messages to/from that user
            // Mark messages FROM this user as read
            await pool.query(
                `UPDATE messages SET is_read = TRUE
                 WHERE sender_id = $1 AND is_read = FALSE
                 AND receiver_id IN (SELECT id FROM users WHERE role = 'admin')`,
                [partnerId]
            );

            query = `
                SELECT m.*,
                       s.name AS sender_name, s.role AS sender_role,
                       r.name AS receiver_name, r.role AS receiver_role
                FROM messages m
                JOIN users s ON m.sender_id = s.id
                JOIN users r ON m.receiver_id = r.id
                WHERE (m.sender_id = $1 AND r.role = 'admin')
                   OR (m.receiver_id = $1 AND s.role = 'admin')
                ORDER BY m.created_at ASC
            `;
            values = [partnerId];
        } else {
            // User viewing their own thread
            // Mark messages FROM admin as read
            await pool.query(
                `UPDATE messages SET is_read = TRUE
                 WHERE receiver_id = $1 AND is_read = FALSE
                 AND sender_id IN (SELECT id FROM users WHERE role = 'admin')`,
                [userId]
            );

            query = `
                SELECT m.*,
                       s.name AS sender_name, s.role AS sender_role,
                       r.name AS receiver_name, r.role AS receiver_role
                FROM messages m
                JOIN users s ON m.sender_id = s.id
                JOIN users r ON m.receiver_id = r.id
                WHERE m.sender_id = $1 OR m.receiver_id = $1
                ORDER BY m.created_at ASC
            `;
            values = [userId];
        }

        const result = await pool.query(query, values);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ success: false, message: 'Gagal memuat pesan' });
    }
};

// Get unread count
const getUnreadCount = async (req, res) => {
    try {
        const userId = req.user.id;
        const isAdmin = req.user.role === 'admin';

        let result;
        if (isAdmin) {
            // Admin: count unread messages from non-admin users to any admin
            result = await pool.query(`
                SELECT COUNT(*) FROM messages m
                JOIN users s ON m.sender_id = s.id
                WHERE s.role != 'admin' AND m.is_read = FALSE
                AND m.receiver_id IN (SELECT id FROM users WHERE role = 'admin')
            `);
        } else {
            // User: count unread messages from admin
            result = await pool.query(
                `SELECT COUNT(*) FROM messages
                 WHERE receiver_id = $1 AND is_read = FALSE
                 AND sender_id IN (SELECT id FROM users WHERE role = 'admin')`,
                [userId]
            );
        }
        res.json({ success: true, count: parseInt(result.rows[0].count) });
    } catch (error) {
        console.error('Unread count error:', error);
        res.status(500).json({ success: false, message: 'Failed to get unread count' });
    }
};

// Get all admins (for users to start a chat)
const getAdmins = async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT id, name, email FROM users WHERE role = 'admin'"
        );
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Get admins error:', error);
        res.status(500).json({ success: false, message: 'Failed' });
    }
};

module.exports = { sendMessage, getConversations, getMessages, getUnreadCount, getAdmins };
