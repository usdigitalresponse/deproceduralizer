-- Remove red flags feature

-- Drop view that depends on analyses table
DROP VIEW IF EXISTS latest_analyses;

DROP TABLE IF EXISTS red_flags;
DROP TABLE IF EXISTS analyses;

ALTER TABLE regulatory_documents
  DROP COLUMN IF EXISTS descendant_flag_count,
  DROP COLUMN IF EXISTS descendant_max_severity,
  DROP COLUMN IF EXISTS has_descendant_analysis;
