const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in environment variables');
}
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

        // Generate token hanya dengan uid agar data profil (nama, email) yang diubah tetap valid
        const token = jwt.sign(
            { uid: newId },
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
                    phone_number: phone_number || null,
                    library_id: null
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
        const identifier = req.body.identifier || req.body.email;
        const password = req.body.password;

        if (!identifier || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email atau Nomor Telepon dan password wajib diisi',
            });
        }

        // Find user by email or phone_number
        const result = await pool.query(
            `SELECT u.*, l.name as library_name 
             FROM users u 
             LEFT JOIN libraries l ON u.library_id = l.id 
             WHERE u.email = $1 OR u.phone_number = $1`,
            [identifier]
        );
        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Email / Nomor Telepon tidak terdaftar atau salah',
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

        // Generate token hanya dengan uid agar data profil yang diubah tetap valid
        const token = jwt.sign(
            { uid: user.id },
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
                    library_id: user.library_id,
                    library_name: user.library_name || null
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
            'SELECT id, name, email, role, avatar, phone_number, library_id, created_at FROM users WHERE id = $1',
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
