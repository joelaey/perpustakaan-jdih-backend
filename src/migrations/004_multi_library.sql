-- Migration: Multi-Library Support

-- 1. Create libraries table
CREATE TABLE IF NOT EXISTS libraries (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    contact VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Insert Default Library (Perpustakaan JDIH Sumedang)
INSERT INTO libraries (id, name, address, contact) 
VALUES (1, 'Perpustakaan Pusat JDIH Sumedang', 'Jl. Prabu Gajah Agung No.9, Situ, Kec. Sumedang Utara', '08123456789')
ON CONFLICT (id) DO NOTHING;

-- Reset sequence for libraries if inserting id 1 manually
SELECT setval('libraries_id_seq', (SELECT MAX(id) FROM libraries));

-- 3. Modify Users Table
-- Add library_id column
ALTER TABLE users ADD COLUMN IF NOT EXISTS library_id INTEGER REFERENCES libraries(id);

-- Drop the old constraint and add the new one supporting super_admin
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('super_admin', 'admin', 'pengguna'));

-- Update existing super admin (by assumption, id 1 or role 'admin' will become super_admin initially)
UPDATE users SET role = 'super_admin' WHERE id = 1 AND role = 'admin';

-- By default, existing regular admins might be connected to library 1
UPDATE users SET library_id = 1 WHERE role = 'admin' AND library_id IS NULL;

-- 4. Modify Books Table
ALTER TABLE books ADD COLUMN IF NOT EXISTS library_id INTEGER REFERENCES libraries(id) ON DELETE SET NULL;
-- Assign all existing books to the default library
UPDATE books SET library_id = 1 WHERE library_id IS NULL;
