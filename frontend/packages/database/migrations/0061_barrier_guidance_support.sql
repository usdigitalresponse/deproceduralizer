-- Migration: Add guidance document support to Barrier pipeline
-- Allows barrier_analyses and barrier_issues to reference either a regulatory_document
-- or a guidance_document (exactly one must be set).

-- ============================================================================
-- 1. barrier_analyses: Add guidance_document_id, make document_id nullable
-- ============================================================================
ALTER TABLE barrier_analyses
    ADD COLUMN guidance_document_id bigint REFERENCES guidance_documents(id) ON DELETE CASCADE;

ALTER TABLE barrier_analyses
    ALTER COLUMN document_id DROP NOT NULL;

-- CHECK: exactly one source must be set
ALTER TABLE barrier_analyses
    ADD CONSTRAINT barrier_analyses_one_source_check CHECK (
        (document_id IS NOT NULL AND guidance_document_id IS NULL)
        OR (document_id IS NULL AND guidance_document_id IS NOT NULL)
    );

-- Replace single UNIQUE on document_id with partial unique indexes
ALTER TABLE barrier_analyses DROP CONSTRAINT IF EXISTS barrier_analyses_document_id_unique;
ALTER TABLE barrier_analyses DROP CONSTRAINT IF EXISTS barrier_analyses_document_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS barrier_analyses_document_id_unique
    ON barrier_analyses (document_id) WHERE document_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS barrier_analyses_guidance_document_id_unique
    ON barrier_analyses (guidance_document_id) WHERE guidance_document_id IS NOT NULL;

-- ============================================================================
-- 2. barrier_issues: Add guidance_document_id, make document_id nullable
-- ============================================================================
ALTER TABLE barrier_issues
    ADD COLUMN guidance_document_id bigint REFERENCES guidance_documents(id) ON DELETE CASCADE;

ALTER TABLE barrier_issues
    ALTER COLUMN document_id DROP NOT NULL;

-- CHECK: exactly one source must be set
ALTER TABLE barrier_issues
    ADD CONSTRAINT barrier_issues_one_source_check CHECK (
        (document_id IS NOT NULL AND guidance_document_id IS NULL)
        OR (document_id IS NULL AND guidance_document_id IS NOT NULL)
    );
