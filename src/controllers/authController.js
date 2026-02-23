const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { JWT_SECRET } = require('../middleware/auth');

// Register
const register = async (req, res) => {
    try {
        const { name, email, password, role, phone_number } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Nama, email, dan password wajib diisi',
            });
        }

        // Check if user already exists
        const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Email sudah terdaftar',
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Only allow 'pengguna' role from public registration
        const userRole = 'pengguna';

        const result = await pool.query(
            'INSERT INTO users (name, email, password, role, phone_number) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [name, email, hashedPassword, userRole, phone_number || null]
        );

        const newId = result.rows[0].id;

        // Generate token
        const token = jwt.sign(
            { id: newId, name, email, role: userRole },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            success: true,
            message: 'Registrasi berhasil',
            data: {
                token,
                user: {
                    id: newId,
                    name,
                    email,
                    role: userRole,
                    avatar: null,
                    phone_number: phone_number || null
                },
            },
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal melakukan registrasi, silakan coba lagi',
            error: error.message,
        });
    }
};

// Login
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email dan password wajib diisi',
            });
        }

        // Find user
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Email tidak terdaftar atau salah',
            });
        }

        const user = result.rows[0];

        // Compare password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Kata sandi salah',
            });
        }

        // Generate token
        const token = jwt.sign(
            { id: user.id },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            message: 'Login berhasil',
            data: {
                token,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    avatar: user.avatar,
                    phone_number: user.phone_number,
                },
            },
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan pada server saat login',
            error: error.message,
        });
    }
}

// Get current user profile
const getProfile = async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, name, email, role, avatar, phone_number, created_at FROM users WHERE id = $1',
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Pengguna tidak ditemukan',
            });
        }

        res.json({
            success: true,
            data: result.rows[0],
        });
    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal memuat profil pengguna',
            error: error.message,
        });
    }
};

module.exports = { register, login, getProfile };
