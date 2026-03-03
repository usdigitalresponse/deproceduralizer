-- Add guidance_document_id to compliance_issue_analyses
-- Same pattern as migration 0057 (compliance_issues): nullable FK with CHECK constraint
-- ensuring exactly one of document_id / guidance_document_id is set.

ALTER TABLE compliance_issue_analyses
    ADD COLUMN IF NOT EXISTS guidance_document_id BIGINT REFERENCES guidance_documents(id) ON DELETE CASCADE;

-- Make document_id nullable (was NOT NULL) since guidance analyses use guidance_document_id
ALTER TABLE compliance_issue_analyses ALTER COLUMN document_id DROP NOT NULL;

-- Exactly one source must be set
ALTER TABLE compliance_issue_analyses DROP CONSTRAINT IF EXISTS cia_one_source;
ALTER TABLE compliance_issue_analyses ADD CONSTRAINT cia_one_source CHECK (
    (document_id IS NOT NULL)::int + (guidance_document_id IS NOT NULL)::int = 1
);

CREATE INDEX IF NOT EXISTS idx_cia_guidance_document ON compliance_issue_analyses(guidance_document_id) WHERE guidance_document_id IS NOT NULL;

-- Drop the old unique constraint and replace with partial indexes that handle both FKs
-- The original unique constraint is on (document_id, issue_type)
ALTER TABLE compliance_issue_analyses DROP CONSTRAINT IF EXISTS unique_document_issue_type;
DROP INDEX IF EXISTS unique_document_issue_type;

-- For regulation analyses: unique on (document_id, issue_type)
CREATE UNIQUE INDEX IF NOT EXISTS idx_cia_unique_reg
    ON compliance_issue_analyses(document_id, issue_type)
    WHERE document_id IS NOT NULL;
-- For guidance analyses: unique on (guidance_document_id, issue_type)
CREATE UNIQUE INDEX IF NOT EXISTS idx_cia_unique_guidance
    ON compliance_issue_analyses(guidance_document_id, issue_type)
    WHERE guidance_document_id IS NOT NULL;
