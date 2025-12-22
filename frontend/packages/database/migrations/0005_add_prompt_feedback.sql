-- Migration: Add prompt_feedback table for collecting feedback on LLM prompts
-- Run with: psql $DATABASE_URL -f migrations/0005_add_prompt_feedback.sql

-- Create feedback_type enum if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'feedback_type') THEN
        CREATE TYPE feedback_type AS ENUM ('suggestion', 'bug', 'question', 'other');
    END IF;
END
$$;

-- Create prompt_feedback table if it doesn't exist
CREATE TABLE IF NOT EXISTS prompt_feedback (
    id BIGSERIAL PRIMARY KEY,
    prompt_name VARCHAR(100) NOT NULL,
    feedback_type feedback_type NOT NULL,
    content TEXT NOT NULL,
    highlighted_text TEXT,
    author_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_prompt_feedback_prompt_name ON prompt_feedback(prompt_name);
CREATE INDEX IF NOT EXISTS idx_prompt_feedback_created_at ON prompt_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prompt_feedback_feedback_type ON prompt_feedback(feedback_type);
