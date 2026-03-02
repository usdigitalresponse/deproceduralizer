-- Indexes for guidance_document_id on compliance_issues (split from 0057).
-- Uses CONCURRENTLY to avoid blocking reads/writes on the table.
-- Follows pattern from migrations 0029a and 0030.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ci_guidance_document
    ON compliance_issues(guidance_document_id) WHERE guidance_document_id IS NOT NULL;

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_ci_unique_reg
    ON compliance_issues(document_id, issue_type, occurrence_number)
    WHERE document_id IS NOT NULL;

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_ci_unique_guidance
    ON compliance_issues(guidance_document_id, issue_type, occurrence_number)
    WHERE guidance_document_id IS NOT NULL;
