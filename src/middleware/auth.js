const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in environment variables');
}

// ===============================
// AUTHENTICATE TOKEN MIDDLEWARE
// ===============================
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Akses ditolak. Token tidak ditemukan.',
            });
        }

        // Verify JWT
        const decoded = jwt.verify(token, JWT_SECRET);

        // Menggunakan uid dari payload (atau id sebagai fallback jika masih ada token lama)
        const uid = decoded.uid || decoded.id;

        if (!uid) {
            return res.status(401).json({
                success: false,
                message: 'Token tidak valid (payload tidak sesuai).',
            });
        }

        // Ambil user terbaru dari database untuk memastikan role dan status up-to-date
        const result = await pool.query(
            'SELECT id, role FROM users WHERE id = $1',
            [uid]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Sesi tidak valid: pengguna tidak ditemukan atau sudah dihapus.',
            });
        }

        // Attach fresh user data ke request
        req.user = {
            id: result.rows[0].id,
            role: result.rows[0].role
        };

        next();
    } catch (err) {
        console.error('Auth middleware error:', err);
        return res.status(403).json({
            success: false,
            message: 'Token tidak valid atau sudah kedaluwarsa.',
        });
    }
};

// ===============================
// AUTHORIZE ROLE MIDDLEWARE
// ===============================
const authorizeRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Akses ditolak. Anda tidak memiliki izin untuk resource ini.',
            });
        }
        next();
    };
};

module.exports = { authenticateToken, authorizeRole };