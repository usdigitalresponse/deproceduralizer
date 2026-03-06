-- Migration: Add guidance document support to JenAI pipeline
-- Allows jenai_analyses and jenai_issues to reference either a regulatory_document
-- or a guidance_document (exactly one must be set).

-- ============================================================================
-- 1. jenai_analyses: Add guidance_document_id, make document_id nullable
-- ============================================================================
ALTER TABLE jenai_analyses
    ADD COLUMN guidance_document_id bigint REFERENCES guidance_documents(id) ON DELETE CASCADE;

ALTER TABLE jenai_analyses
    ALTER COLUMN document_id DROP NOT NULL;

-- CHECK: exactly one source must be set
ALTER TABLE jenai_analyses
    ADD CONSTRAINT jenai_analyses_one_source_check CHECK (
        (document_id IS NOT NULL AND guidance_document_id IS NULL)
        OR (document_id IS NULL AND guidance_document_id IS NOT NULL)
    );

-- Replace single UNIQUE on document_id with partial unique indexes
ALTER TABLE jenai_analyses DROP CONSTRAINT IF EXISTS jenai_analyses_document_id_unique;
ALTER TABLE jenai_analyses DROP CONSTRAINT IF EXISTS jenai_analyses_document_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS jenai_analyses_document_id_unique
    ON jenai_analyses (document_id) WHERE document_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS jenai_analyses_guidance_document_id_unique
    ON jenai_analyses (guidance_document_id) WHERE guidance_document_id IS NOT NULL;

-- ============================================================================
-- 2. jenai_issues: Add guidance_document_id, make document_id nullable
-- ============================================================================
ALTER TABLE jenai_issues
    ADD COLUMN guidance_document_id bigint REFERENCES guidance_documents(id) ON DELETE CASCADE;

ALTER TABLE jenai_issues
    ALTER COLUMN document_id DROP NOT NULL;

-- CHECK: exactly one source must be set
ALTER TABLE jenai_issues
    ADD CONSTRAINT jenai_issues_one_source_check CHECK (
        (document_id IS NOT NULL AND guidance_document_id IS NULL)
        OR (document_id IS NULL AND guidance_document_id IS NOT NULL)
    );
