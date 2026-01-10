-- Performance optimization indexes
-- Added based on database performance analysis

-- FK index for CASCADE deletes on statutes table
-- Without this, deleting a statute requires full table scan of regulation_statute_links
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reg_statute_links_statute_cascade
  ON regulation_statute_links(statute_id);

-- Resume query optimization for research pipeline
-- Used when fetching analyses that need to continue from a specific tier
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cia_highest_tier
  ON compliance_issue_analyses(highest_tier_completed)
  WHERE highest_tier_completed IS NOT NULL;

-- Dashboard query optimization for confirmed issues
-- Filters by state, then requirement_found status, then severity
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ci_state_req_severity
  ON compliance_issues(state, requirement_found, severity)
  WHERE requirement_found = TRUE;

-- Cross-references bidirectional lookup optimization
-- Supports "show resolved references from this document" queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_crossrefs_source_resolved
  ON cross_references(source_document_id, is_resolved);
