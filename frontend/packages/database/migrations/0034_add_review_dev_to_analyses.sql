-- Migration 0034: Add review/developer tracking columns to compliance_issue_analyses
-- PR 6.3: Move review/developer fields from compliance_issues to compliance_issue_analyses
-- These columns track human review decisions and developer resolution at the analysis level
-- (one per document_id + issue_type pair) rather than per regex match.

-- Review fields
ALTER TABLE compliance_issue_analyses ADD COLUMN review_status VARCHAR(50) DEFAULT 'unreviewed';
ALTER TABLE compliance_issue_analyses ADD COLUMN reviewed_by VARCHAR(255);
ALTER TABLE compliance_issue_analyses ADD COLUMN reviewed_at TIMESTAMP;
ALTER TABLE compliance_issue_analyses ADD COLUMN justification_notes TEXT;
ALTER TABLE compliance_issue_analyses ADD COLUMN team_notes TEXT;
ALTER TABLE compliance_issue_analyses ADD COLUMN impact_type VARCHAR(100);

-- Reviewer-editable severity (named reviewer_severity to avoid collision with pipeline severity)
ALTER TABLE compliance_issue_analyses ADD COLUMN reviewer_severity INTEGER;
ALTER TABLE compliance_issue_analyses ADD COLUMN reviewer_original_severity INTEGER;

-- Developer tracking fields
ALTER TABLE compliance_issue_analyses ADD COLUMN developer_status VARCHAR(50) DEFAULT 'unresolved';
ALTER TABLE compliance_issue_analyses ADD COLUMN developer_assigned VARCHAR(50);
ALTER TABLE compliance_issue_analyses ADD COLUMN developer_notes TEXT;
ALTER TABLE compliance_issue_analyses ADD COLUMN resolution_type VARCHAR(50);
ALTER TABLE compliance_issue_analyses ADD COLUMN resolution_comments TEXT;
ALTER TABLE compliance_issue_analyses ADD COLUMN developer_question TEXT;
ALTER TABLE compliance_issue_analyses ADD COLUMN developer_checked_at TIMESTAMP;

-- Indexes for common query patterns
CREATE INDEX idx_cia_review_status ON compliance_issue_analyses(review_status);
CREATE INDEX idx_cia_developer_status ON compliance_issue_analyses(developer_status);
CREATE INDEX idx_cia_developer_assigned ON compliance_issue_analyses(developer_assigned);
