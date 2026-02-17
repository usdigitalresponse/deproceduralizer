-- Add source/target jurisdiction metadata to cross_references
-- Enables querying cross-jurisdiction links (e.g., NYC RCNY → NY NYCRR)

-- Add columns (nullable — not all refs have resolved targets)
ALTER TABLE cross_references ADD COLUMN source_jurisdiction varchar(3);
ALTER TABLE cross_references ADD COLUMN target_jurisdiction varchar(3);

-- Add CHECK constraints
ALTER TABLE cross_references ADD CONSTRAINT chk_crossref_source_jurisdiction
    CHECK (source_jurisdiction IN ('NY', 'NJ', 'NYC'));
ALTER TABLE cross_references ADD CONSTRAINT chk_crossref_target_jurisdiction
    CHECK (target_jurisdiction IN ('NY', 'NJ', 'NYC'));

-- Backfill source_jurisdiction from the row's own state column
UPDATE cross_references SET source_jurisdiction = state;

-- Backfill target_jurisdiction from the resolved target document's state
UPDATE cross_references cr
SET target_jurisdiction = rd.state
FROM regulatory_documents rd
WHERE cr.target_document_id = rd.id
  AND cr.is_resolved = TRUE
  AND cr.target_document_id IS NOT NULL;

-- For same_section refs that are "resolved" but have no target_document_id,
-- the target is the same jurisdiction as the source
UPDATE cross_references
SET target_jurisdiction = source_jurisdiction
WHERE ref_type = 'same_section'
  AND is_resolved = TRUE
  AND target_document_id IS NULL
  AND target_jurisdiction IS NULL;

-- Make source_jurisdiction NOT NULL now that it's backfilled
ALTER TABLE cross_references ALTER COLUMN source_jurisdiction SET NOT NULL;

-- Add indexes for jurisdiction-based queries
CREATE INDEX idx_crossrefs_source_jurisdiction ON cross_references(source_jurisdiction);
CREATE INDEX idx_crossrefs_cross_jurisdiction ON cross_references(source_jurisdiction, target_jurisdiction)
    WHERE source_jurisdiction != target_jurisdiction;
