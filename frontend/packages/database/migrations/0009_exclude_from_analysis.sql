-- Migration: Add analysis exclusion fields to regulatory_documents
-- Allows marking documents as excluded from red flag, definition, and compliance analysis

ALTER TABLE regulatory_documents
ADD COLUMN IF NOT EXISTS exclude_from_analysis BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS excluded_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS excluded_by VARCHAR(255),
ADD COLUMN IF NOT EXISTS excluded_reason TEXT;

-- Index for filtering excluded documents in batch processing
CREATE INDEX IF NOT EXISTS idx_documents_exclude_from_analysis
ON regulatory_documents(exclude_from_analysis)
WHERE exclude_from_analysis = TRUE;
