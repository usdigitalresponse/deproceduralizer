-- Migration: Add trigram indexes for fast glossary search
-- This enables fast ILIKE '%search%' queries on definitions

-- Enable pg_trgm extension for fast LIKE/ILIKE queries
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add trigram index on term for fast substring search in flat view
-- This makes queries like "WHERE term ILIKE '%health%'" use index scans instead of seq scans
CREATE INDEX IF NOT EXISTS idx_definitions_term_trgm
  ON definitions USING GIN (term gin_trgm_ops);

-- Add trigram index on normalized_term for aggregated view search
CREATE INDEX IF NOT EXISTS idx_definitions_normalized_term_trgm
  ON definitions USING GIN (normalized_term gin_trgm_ops);
