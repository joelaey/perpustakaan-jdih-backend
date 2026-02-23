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
                message: 'Access token required',
            });
        }

        // Verify JWT
        const decoded = jwt.verify(token, JWT_SECRET);

        // Ambil user terbaru dari database
        const result = await pool.query(
            'SELECT id, role FROM users WHERE id = $1',
            [decoded.id]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid token',
            });
        }

        // Attach fresh user data ke request
        req.user = result.rows[0]; // { id, role }

        next();
    } catch (err) {
        return res.status(403).json({
            success: false,
            message: 'Invalid or expired token',
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
                message: 'Insufficient permissions',
            });
        }
        next();
    };
};

module.exports = { authenticateToken, authorizeRole };