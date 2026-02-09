-- Migration: 0029_backfill_final_severity
-- Purpose: Backfill final_severity for records where it was never set
--
-- Root cause: save_final_results() only runs at end of full pipeline orchestrator run.
-- Records processed by batch mode or interrupted runs never had this field populated.
--
-- Safety: Verified 0 active batch jobs. For records awaiting Tier 3, save_final_results()
-- will overwrite with correct computed value when pipeline completes.

-- Backfill final_severity based on highest completed tier:
-- - Tier 2 only: final_severity = severity
-- - Tier 3 with adjustment: final_severity = severity + tier3_severity_adjustment (clamped 1-10)

UPDATE compliance_issue_analyses
SET final_severity = CASE
    WHEN tier3_classification IS NOT NULL AND tier3_severity_adjustment IS NOT NULL THEN
        GREATEST(1, LEAST(10, severity + tier3_severity_adjustment))
    ELSE severity
    END,
    updated_at = NOW()
WHERE severity IS NOT NULL
  AND final_severity IS NULL;
