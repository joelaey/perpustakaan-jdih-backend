-- Create books table for JDIH Sumedang (PostgreSQL / Supabase)
CREATE TABLE IF NOT EXISTS books (
    id SERIAL PRIMARY KEY,
    uuid VARCHAR(100) UNIQUE,
    title TEXT NOT NULL,
    slug VARCHAR(500),
    author VARCHAR(500),
    publisher VARCHAR(255),
    publish_place VARCHAR(100),
    year INT,
    isbn VARCHAR(100),
    subject VARCHAR(500),
    field_type VARCHAR(255),
    physical_description VARCHAR(255),
    registration_number VARCHAR(100),
    registration_call VARCHAR(255),
    language VARCHAR(50) DEFAULT 'Indonesia',
    location VARCHAR(255),
    file_url TEXT,
    cover VARCHAR(255),
    downloaded INT DEFAULT 0,
    view_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for search performance
CREATE INDEX IF NOT EXISTS idx_books_field_type ON books(field_type);
CREATE INDEX IF NOT EXISTS idx_books_year ON books(year);
CREATE INDEX IF NOT EXISTS idx_books_subject ON books(subject);
