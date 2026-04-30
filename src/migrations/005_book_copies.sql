-- Migration 005: Book Copies & Routing

-- 1. Create book_copies table
CREATE TABLE IF NOT EXISTS book_copies (
    id SERIAL PRIMARY KEY,
    book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    library_id INTEGER NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    stock_available INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(book_id, library_id)
);

-- 2. Migrate existing book-to-library relationships into book_copies
-- Since we previously set every book to have library_id = 1 (in 004), 
-- let's insert a stock of 1 for each book at library 1 as a baseline.
INSERT INTO book_copies (book_id, library_id, stock_available)
SELECT id, library_id, 1 FROM books WHERE library_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 3. Remove library_id from books
ALTER TABLE books DROP COLUMN IF EXISTS library_id;

-- 4. Add library_id to borrowings table (to route the request to a specific library)
ALTER TABLE borrowings ADD COLUMN IF NOT EXISTS library_id INTEGER REFERENCES libraries(id);

-- Assign all existing borrowings to the default library (1)
UPDATE borrowings SET library_id = 1 WHERE library_id IS NULL;

-- Enforce NOT NULL now that existing rows are populated
ALTER TABLE borrowings ALTER COLUMN library_id SET NOT NULL;
