-- Create cross_references table for internal regulation citations
-- Phase 3 of the cross-reference extraction pipeline

CREATE TABLE IF NOT EXISTS cross_references (
    id BIGSERIAL PRIMARY KEY,
    source_document_id BIGINT NOT NULL REFERENCES regulatory_documents(id) ON DELETE CASCADE,

    -- Reference identification
    ref_type VARCHAR(50) NOT NULL,           -- 'nycrr', 'njac', 'ny_short_form', 'same_section'
    raw_text TEXT NOT NULL,                  -- Original matched text
    normalized_citation TEXT NOT NULL,       -- Cleaned citation for lookup

    -- Position in source document
    start_offset INTEGER,
    end_offset INTEGER,
    context_before TEXT,                     -- ~50 chars before match
    context_after TEXT,                      -- ~50 chars after match

    -- Parsed components (JSONB for flexibility)
    components JSONB,                        -- {title, section, scope, etc.}

    -- Resolution
    target_document_id BIGINT REFERENCES regulatory_documents(id) ON DELETE SET NULL,
    is_resolved BOOLEAN DEFAULT FALSE,
    resolution_notes TEXT,                   -- For unresolved: why it failed

    -- Metadata
    state VARCHAR(2) NOT NULL CHECK (state IN ('NY', 'NJ')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Unique constraint: one entry per unique raw_text per source doc
    UNIQUE(source_document_id, raw_text)
);

-- Indexes for common queries
CREATE INDEX idx_crossrefs_source_doc ON cross_references(source_document_id);
CREATE INDEX idx_crossrefs_target_doc ON cross_references(target_document_id);
CREATE INDEX idx_crossrefs_state ON cross_references(state);
CREATE INDEX idx_crossrefs_ref_type ON cross_references(ref_type);
CREATE INDEX idx_crossrefs_unresolved ON cross_references(state, is_resolved) WHERE is_resolved = FALSE;

-- Add cross_reference_count to regulatory_documents for denormalized stats
ALTER TABLE regulatory_documents
ADD COLUMN IF NOT EXISTS cross_reference_count INTEGER DEFAULT 0;

-- Comment for documentation
COMMENT ON TABLE cross_references IS 'Internal cross-references between regulatory documents. Stores citations like "18 NYCRR 505.14" or "section 624.8 of this Part" found in regulation text.';
COMMENT ON COLUMN cross_references.ref_type IS 'Type of reference: nycrr (full-form NY), njac (full-form NJ), ny_short_form (context-dependent NY), same_section (internal)';
COMMENT ON COLUMN cross_references.resolution_notes IS 'For unresolved references: explains why resolution failed (e.g., "Target section not found in database")';
