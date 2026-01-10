-- Migration: Add bookmarks table for saving analyses and documents
-- Purpose: Allow users to bookmark pipeline analyses and documents for later reference

CREATE TABLE IF NOT EXISTS bookmarks (
    id BIGSERIAL PRIMARY KEY,

    -- Target: either an analysis or a standalone document
    document_id BIGINT NOT NULL REFERENCES regulatory_documents(id) ON DELETE CASCADE,
    analysis_id BIGINT REFERENCES compliance_issue_analyses(id) ON DELETE CASCADE,

    -- Denormalized for easier querying/filtering
    issue_type VARCHAR(50),           -- From analysis, null for document bookmarks
    state VARCHAR(2) NOT NULL,        -- NJ, NY

    -- Metadata
    notes TEXT,                       -- Optional user notes explaining why bookmarked
    created_by VARCHAR(255),          -- Who bookmarked it
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Unique constraint: one bookmark per analysis
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookmarks_unique_analysis
ON bookmarks(analysis_id) WHERE analysis_id IS NOT NULL;

-- Unique constraint: one document bookmark per document (when no analysis)
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookmarks_unique_document
ON bookmarks(document_id) WHERE analysis_id IS NULL;

-- Lookup indexes
CREATE INDEX IF NOT EXISTS idx_bookmarks_document ON bookmarks(document_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_analysis ON bookmarks(analysis_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_state ON bookmarks(state);
CREATE INDEX IF NOT EXISTS idx_bookmarks_created_at ON bookmarks(created_at DESC);

-- Add table comment
COMMENT ON TABLE bookmarks IS 'User bookmarks for pipeline analyses and regulatory documents';
COMMENT ON COLUMN bookmarks.document_id IS 'The regulatory document being bookmarked (always set)';
COMMENT ON COLUMN bookmarks.analysis_id IS 'The specific analysis being bookmarked (null for document-level bookmarks)';
COMMENT ON COLUMN bookmarks.issue_type IS 'Denormalized from analysis for easier filtering';
COMMENT ON COLUMN bookmarks.notes IS 'Optional user notes explaining why this was bookmarked';
COMMENT ON COLUMN bookmarks.created_by IS 'Name of the user who created the bookmark';
