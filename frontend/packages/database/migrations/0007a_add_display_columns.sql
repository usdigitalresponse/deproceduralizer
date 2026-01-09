-- Migration: Add state-agnostic display columns
-- These columns provide clean display values derived from state-specific fields
-- short_title: The "actual title" without citation prefix (e.g., "Basis of classification")
-- level_identifier: The identifier at this hierarchy level (e.g., "22.30" for section)
-- citation: Full formatted citation (e.g., "18 NYCRR 505.14")

-- Add the new columns
ALTER TABLE regulatory_documents ADD COLUMN IF NOT EXISTS short_title TEXT;
ALTER TABLE regulatory_documents ADD COLUMN IF NOT EXISTS level_identifier TEXT;
ALTER TABLE regulatory_documents ADD COLUMN IF NOT EXISTS citation TEXT;

-- Add index on short_title for search/display queries
CREATE INDEX IF NOT EXISTS idx_documents_short_title ON regulatory_documents(short_title);
