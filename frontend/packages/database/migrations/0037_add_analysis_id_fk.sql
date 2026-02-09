-- Migration 0037: Add analysis_id FK to compliance_issues
-- PR 6.5: Formalizes the many-to-one relationship (many regex matches -> one document-level analysis)
-- Replaces composite (document_id, issue_type) JOINs with a single-column FK JOIN

-- Add nullable FK column
ALTER TABLE compliance_issues
ADD COLUMN analysis_id BIGINT REFERENCES compliance_issue_analyses(id) ON DELETE SET NULL;

-- Index for FK joins
CREATE INDEX idx_compliance_issues_analysis_id ON compliance_issues(analysis_id);

-- Backfill from existing composite key relationship
UPDATE compliance_issues ci
SET analysis_id = cia.id
FROM compliance_issue_analyses cia
WHERE ci.document_id = cia.document_id
  AND ci.issue_type = cia.issue_type
  AND ci.analysis_id IS NULL;
