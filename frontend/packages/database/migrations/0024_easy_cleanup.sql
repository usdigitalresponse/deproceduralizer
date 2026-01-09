-- Easy Cleanup Candidate Detection
-- Adds fields to flag regulations where modern alternatives already exist in practice
-- or are authorized by state law, making them low-hanging fruit for cleanup.

ALTER TABLE compliance_issue_analyses ADD COLUMN IF NOT EXISTS
  easy_cleanup_candidate BOOLEAN DEFAULT FALSE;

ALTER TABLE compliance_issue_analyses ADD COLUMN IF NOT EXISTS
  cleanup_type VARCHAR;

ALTER TABLE compliance_issue_analyses ADD COLUMN IF NOT EXISTS
  cleanup_evidence TEXT;

ALTER TABLE compliance_issue_analyses ADD COLUMN IF NOT EXISTS
  cleanup_recommendation TEXT;

ALTER TABLE compliance_issue_analyses ADD COLUMN IF NOT EXISTS
  cleanup_effort VARCHAR;

-- Add check constraint for cleanup_type
ALTER TABLE compliance_issue_analyses ADD CONSTRAINT
  compliance_issue_analyses_cleanup_type_check
  CHECK (cleanup_type IS NULL OR cleanup_type IN ('alternative_in_practice', 'alternative_authorized', 'peer_state_solution'));

-- Add check constraint for cleanup_effort
ALTER TABLE compliance_issue_analyses ADD CONSTRAINT
  compliance_issue_analyses_cleanup_effort_check
  CHECK (cleanup_effort IS NULL OR cleanup_effort IN ('trivial', 'easy', 'medium'));

-- Index for filtering easy cleanup candidates
CREATE INDEX IF NOT EXISTS idx_compliance_issue_analyses_easy_cleanup
  ON compliance_issue_analyses (easy_cleanup_candidate)
  WHERE easy_cleanup_candidate = TRUE;

COMMENT ON COLUMN compliance_issue_analyses.easy_cleanup_candidate IS 'True if this is a low-hanging fruit cleanup opportunity';
COMMENT ON COLUMN compliance_issue_analyses.cleanup_type IS 'Type: alternative_in_practice, alternative_authorized, peer_state_solution';
COMMENT ON COLUMN compliance_issue_analyses.cleanup_evidence IS 'URL or citation proving the alternative exists';
COMMENT ON COLUMN compliance_issue_analyses.cleanup_recommendation IS 'Specific suggested regulation text change';
COMMENT ON COLUMN compliance_issue_analyses.cleanup_effort IS 'Effort level: trivial, easy, or medium';
