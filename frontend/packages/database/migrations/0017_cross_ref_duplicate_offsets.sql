-- Migration: Allow duplicate raw_text at different offsets
-- This enables:
-- 1. Multiple occurrences of the same citation to be stored (currently only first is kept)
-- 2. Abbreviated sections like "4.1" from "N.J.A.C. 7:1A-3.1, 4.1, 5.1" to be stored separately

-- Drop the old constraint that prevented duplicate raw_text per document
ALTER TABLE cross_references
  DROP CONSTRAINT IF EXISTS cross_references_source_document_id_raw_text_key;

-- Add new constraint that allows same raw_text at different positions
-- This is needed because:
-- - Same citation can appear multiple times in a document (all should be highlighted)
-- - Abbreviated refs like "4.1" might appear multiple times referring to different sections
ALTER TABLE cross_references
  ADD CONSTRAINT cross_references_source_document_id_raw_text_offset_key
  UNIQUE(source_document_id, raw_text, start_offset);

-- Add index for efficient lookups by normalized_citation (used during resolution)
CREATE INDEX IF NOT EXISTS idx_cross_references_normalized_citation
  ON cross_references(normalized_citation);
