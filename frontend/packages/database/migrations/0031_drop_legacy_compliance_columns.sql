-- Migration 0031: Drop legacy compliance_issues columns
--
-- These columns were superseded by the research pipeline columns added in
-- migration 0027, which also backfilled all existing data:
--
--   matched_pattern   → regex_match_pattern
--   matched_context   → regex_match_context
--   requirement_text  → verbatim_supporting_text (text[])
--   impact_assessment → decision_rationale
--
-- Before dropping, make regex_match_context NOT NULL (matched_context was NOT NULL,
-- and 0027 guaranteed all rows have data).

-- Step 1: Ensure regex_match_context has no NULLs, then set NOT NULL
UPDATE compliance_issues
  SET regex_match_context = matched_context
  WHERE regex_match_context IS NULL AND matched_context IS NOT NULL;

ALTER TABLE compliance_issues
  ALTER COLUMN regex_match_context SET NOT NULL;

-- Step 2: Drop the legacy columns
ALTER TABLE compliance_issues DROP COLUMN matched_pattern;
ALTER TABLE compliance_issues DROP COLUMN matched_context;
ALTER TABLE compliance_issues DROP COLUMN requirement_text;
ALTER TABLE compliance_issues DROP COLUMN impact_assessment;
