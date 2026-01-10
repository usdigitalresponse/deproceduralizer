-- Composite indexes for common query patterns
-- These optimize the review queue filtering by state + status + severity

-- Review queue filters by state, then status, then sorts by severity
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ci_state_review_severity
  ON compliance_issues(state, review_status, severity);

-- Browse by issue type within a state, sorted by severity
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ci_state_issue_severity
  ON compliance_issues(state, issue_type, severity);

-- Join compliance_issues to analyses by (document_id, issue_type)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cia_doc_issue
  ON compliance_issue_analyses(document_id, issue_type);

-- Filter analyses by state and tier2 classification
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cia_state_tier2
  ON compliance_issue_analyses(state, tier2_classification);
