-- Migration: Add document_notes table for annotations feature
-- Run with: psql $DATABASE_URL -f migrations/0001_add_document_notes.sql

-- Create note_type enum if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'note_type') THEN
        CREATE TYPE note_type AS ENUM ('anchored', 'document');
    END IF;
END
$$;

-- Create document_notes table if it doesn't exist
CREATE TABLE IF NOT EXISTS document_notes (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT NOT NULL REFERENCES regulatory_documents(id) ON DELETE CASCADE,
    note_type note_type NOT NULL,
    anchor_start_offset INTEGER,
    anchor_end_offset INTEGER,
    anchor_text TEXT,
    content TEXT NOT NULL,
    author_name VARCHAR(255),
    state VARCHAR(2) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index on document_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_document_notes_document_id ON document_notes(document_id);
