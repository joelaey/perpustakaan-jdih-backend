-- Migration: Add column for pickup and return proofs
ALTER TABLE borrowings 
ADD COLUMN IF NOT EXISTS pickup_proof TEXT,
ADD COLUMN IF NOT EXISTS return_proof TEXT;
