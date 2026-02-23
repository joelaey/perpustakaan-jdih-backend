const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');

// GET all users (admin only)
const getAllUsers = async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, name, email, role, avatar, created_at FROM users ORDER BY created_at DESC'
        );
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ success: false, message: 'Failed to get users' });
    }
};

// CREATE user (admin only)
const createUser = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
        }

        const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ success: false, message: 'Email already registered' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const userRole = ['admin', 'pengguna'].includes(role) ? role : 'pengguna';

        const result = await pool.query(
            'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, avatar, created_at',
            [name, email, hashedPassword, userRole]
        );

        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ success: false, message: 'Failed to create user' });
    }
};

// UPDATE user (admin only)
const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, role, password } = req.body;

        // Build dynamic update
        const fields = [];
        const values = [];
        let idx = 1;

        if (name) { fields.push(`name = $${idx++}`); values.push(name); }
        if (email) { fields.push(`email = $${idx++}`); values.push(email); }
        if (role && ['admin', 'pengguna'].includes(role)) { fields.push(`role = $${idx++}`); values.push(role); }
        if (req.body.avatar !== undefined) { fields.push(`avatar = $${idx++}`); values.push(req.body.avatar); }
        if (password) {
            const salt = await bcrypt.genSalt(10);
            const hashed = await bcrypt.hash(password, salt);
            fields.push(`password = $${idx++}`);
            values.push(hashed);
        }

        if (fields.length === 0) {
            return res.status(400).json({ success: false, message: 'No fields to update' });
        }

        fields.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(id);

        const result = await pool.query(
            `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, name, email, role, avatar, created_at`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ success: false, message: 'Failed to update user' });
    }
};

// DELETE user (admin only)
const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        // Prevent self-deletion
        if (parseInt(id) === req.user.id) {
            return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
        }

        const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete user' });
    }
};

// UPDATE profile (authenticated user updates own profile)
const updateProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, email, phone_number } = req.body;

        const fields = [];
        const values = [];
        let idx = 1;

        if (name) { fields.push(`name = $${idx++}`); values.push(name); }
        if (email) { fields.push(`email = $${idx++}`); values.push(email); }
        if (phone_number !== undefined) { fields.push(`phone_number = $${idx++}`); values.push(phone_number); }
        if (req.body.avatar !== undefined) { fields.push(`avatar = $${idx++}`); values.push(req.body.avatar); }

        if (fields.length === 0) {
            return res.status(400).json({ success: false, message: 'No fields to update' });
        }

        fields.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(userId);

        const result = await pool.query(
            `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, name, email, role, avatar, phone_number`,
            values
        );

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ success: false, message: 'Gagal memperbarui profil pengguna' });
    }
};

// CHANGE password (authenticated user)
const changePassword = async (req, res) => {
    try {
        const userId = req.user.id;
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: 'Current and new password are required' });
        }

        const user = await pool.query('SELECT password FROM users WHERE id = $1', [userId]);
        if (user.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.rows[0].password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Current password is incorrect' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashed = await bcrypt.hash(newPassword, salt);
        await pool.query('UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [hashed, userId]);

        res.json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ success: false, message: 'Failed to change password' });
    }
};

module.exports = { getAllUsers, createUser, updateUser, deleteUser, updateProfile, changePassword };
