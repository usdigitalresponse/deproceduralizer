-- Migration: Add analysis exclusion fields to guidance_documents
-- Mirrors regulatory_documents pattern from 0009c_exclude_from_analysis.sql
-- Allows marking guidance documents as excluded from JenAI, compliance, and fines analysis

ALTER TABLE guidance_documents
ADD COLUMN IF NOT EXISTS exclude_from_analysis BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS excluded_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS excluded_by VARCHAR(255),
ADD COLUMN IF NOT EXISTS excluded_reason TEXT;

-- Index for filtering excluded documents in batch processing
CREATE INDEX IF NOT EXISTS idx_guidance_exclude_from_analysis
ON guidance_documents(exclude_from_analysis)
WHERE exclude_from_analysis = TRUE;
