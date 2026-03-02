-- Create guidance_documents table for sub-regulatory guidance (ADMs, LCMs, INFs, GIS, TSBs, etc.)
-- These were previously shoehorned into regulatory_documents with type='guidance'.
-- This dedicated table has columns tailored to guidance document metadata.

CREATE TABLE IF NOT EXISTS guidance_documents (
    id BIGSERIAL PRIMARY KEY,

    -- Identity
    catalog_id TEXT,                    -- ID from nys-documents catalog (e.g. "00370")
    canonical_ref TEXT,                 -- e.g. "23-OCFS-ADM-15-R1"
    title TEXT NOT NULL,

    -- Classification
    agency TEXT NOT NULL,               -- OCFS, OTDA, DOH, etc.
    agency_division TEXT,               -- e.g. "Division of Child Welfare"
    doc_type TEXT,                      -- ADM, LCM, INF, GIS, TSB-M, letter, advisory, etc.
    domain TEXT,                        -- childcare, social_services, tax, etc.

    -- Dates
    date_published DATE,
    date_effective DATE,
    date_revised DATE,
    date_expires DATE,
    year INTEGER,

    -- Content
    content TEXT,
    url TEXT,
    file_format TEXT,                   -- pdf, docx, html, etc.

    -- Status & supersession
    status TEXT DEFAULT 'active',       -- active, superseded, canceled, expired
    supersedes TEXT[],                  -- canonical_refs this doc replaces
    superseded_by TEXT,                 -- canonical_ref that replaced this doc
    revision_of TEXT,                   -- canonical_ref of original (for R1, R2, etc.)

    -- Enrichment from nys-documents
    sender_name TEXT,
    sender_title TEXT,
    distribution_to TEXT[],
    programs TEXT[],                    -- referenced NY programs
    cites_regulations TEXT[],           -- NYCRR citations (e.g. "18 NYCRR 428.6")
    cites_federal TEXT[],               -- federal statute citations
    cites_documents TEXT[],             -- other guidance doc refs

    -- Source tracking
    source_project TEXT,                -- childcare, guidance, statewide_expansion
    text_path TEXT,                     -- path in nys-documents repo

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    search_vector TSVECTOR
);

-- Indexes
CREATE UNIQUE INDEX idx_gd_catalog_id ON guidance_documents(catalog_id) WHERE catalog_id IS NOT NULL;
CREATE INDEX idx_gd_agency ON guidance_documents(agency);
CREATE INDEX idx_gd_doc_type ON guidance_documents(doc_type);
CREATE INDEX idx_gd_canonical_ref ON guidance_documents(canonical_ref) WHERE canonical_ref IS NOT NULL;
CREATE INDEX idx_gd_status ON guidance_documents(status);
CREATE INDEX idx_gd_search ON guidance_documents USING GIN(search_vector);
CREATE INDEX idx_gd_year ON guidance_documents(year);

-- Search vector trigger (same pattern as regulatory_documents)
CREATE OR REPLACE FUNCTION guidance_documents_search_trigger() RETURNS trigger AS $$
BEGIN
    NEW.search_vector := setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
                          setweight(to_tsvector('english', COALESCE(NEW.content, '')), 'C');
    NEW.updated_at := NOW();
    RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trig_gd_search
    BEFORE INSERT OR UPDATE OF title, content ON guidance_documents
    FOR EACH ROW EXECUTE FUNCTION guidance_documents_search_trigger();

-- Add guidance document FK columns to cross_references
-- These are nullable; exactly one of source_document_id/source_guidance_id should be set
ALTER TABLE cross_references
    ADD COLUMN IF NOT EXISTS source_guidance_id BIGINT REFERENCES guidance_documents(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS target_guidance_id BIGINT REFERENCES guidance_documents(id) ON DELETE SET NULL;

-- Make source_document_id nullable (was NOT NULL) since guidance refs use source_guidance_id instead
ALTER TABLE cross_references
    ALTER COLUMN source_document_id DROP NOT NULL;

-- Check constraint: exactly one source must be set
ALTER TABLE cross_references
    ADD CONSTRAINT chk_crossref_source CHECK (
        (source_document_id IS NOT NULL)::int + (source_guidance_id IS NOT NULL)::int = 1
    );

-- Check constraint: at most one target set (both can be NULL for unresolved)
ALTER TABLE cross_references
    ADD CONSTRAINT chk_crossref_target CHECK (
        (target_document_id IS NOT NULL)::int + (target_guidance_id IS NOT NULL)::int <= 1
    );

CREATE INDEX idx_crossrefs_source_guidance ON cross_references(source_guidance_id) WHERE source_guidance_id IS NOT NULL;
CREATE INDEX idx_crossrefs_target_guidance ON cross_references(target_guidance_id) WHERE target_guidance_id IS NOT NULL;

COMMENT ON TABLE guidance_documents IS 'Sub-regulatory guidance documents (ADMs, LCMs, INFs, GIS, TSBs, etc.) from NY state agencies. Imported from the nys-documents catalog.';
COMMENT ON COLUMN guidance_documents.catalog_id IS 'ID from the nys-documents enriched_catalog.json (e.g. "00370")';
COMMENT ON COLUMN guidance_documents.canonical_ref IS 'Standard document reference (e.g. "23-OCFS-ADM-15-R1")';
