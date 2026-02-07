-- Migration 0036: Drop review/developer columns from compliance_issues
-- PR 6.3: These fields have been moved to compliance_issue_analyses
-- Data was backfilled in migration 0035

-- Drop review columns
ALTER TABLE compliance_issues DROP COLUMN IF EXISTS review_status;
ALTER TABLE compliance_issues DROP COLUMN IF EXISTS reviewed_by;
ALTER TABLE compliance_issues DROP COLUMN IF EXISTS reviewed_at;
ALTER TABLE compliance_issues DROP COLUMN IF EXISTS justification_notes;
ALTER TABLE compliance_issues DROP COLUMN IF EXISTS team_notes;
ALTER TABLE compliance_issues DROP COLUMN IF EXISTS impact_type;
ALTER TABLE compliance_issues DROP COLUMN IF EXISTS severity;
ALTER TABLE compliance_issues DROP COLUMN IF EXISTS original_severity;

-- Drop developer columns
ALTER TABLE compliance_issues DROP COLUMN IF EXISTS developer_status;
ALTER TABLE compliance_issues DROP COLUMN IF EXISTS developer_assigned;
ALTER TABLE compliance_issues DROP COLUMN IF EXISTS developer_notes;
ALTER TABLE compliance_issues DROP COLUMN IF EXISTS resolution_type;
ALTER TABLE compliance_issues DROP COLUMN IF EXISTS resolution_comments;
ALTER TABLE compliance_issues DROP COLUMN IF EXISTS developer_question;
ALTER TABLE compliance_issues DROP COLUMN IF EXISTS developer_checked_at;

-- Drop indexes that referenced these columns (if they still exist)
DROP INDEX IF EXISTS idx_compliance_issues_review_status;
DROP INDEX IF EXISTS idx_compliance_issues_severity;
DROP INDEX IF EXISTS idx_compliance_issues_developer_status;
DROP INDEX IF EXISTS idx_compliance_issues_developer_assigned;
DROP INDEX IF EXISTS idx_ci_state_review_severity;
DROP INDEX IF EXISTS idx_ci_state_req_severity;
