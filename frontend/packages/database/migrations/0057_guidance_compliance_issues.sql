-- Add guidance_document_id to compliance_issues
-- Same pattern as cross_references: nullable FK with CHECK constraint
-- ensuring exactly one of document_id / guidance_document_id is set.
-- Indexes split into 0057b (CONCURRENTLY) to avoid blocking writes.

ALTER TABLE compliance_issues
    ADD COLUMN IF NOT EXISTS guidance_document_id BIGINT REFERENCES guidance_documents(id) ON DELETE CASCADE;

-- Make document_id nullable (was NOT NULL) since guidance matches use guidance_document_id
ALTER TABLE compliance_issues ALTER COLUMN document_id DROP NOT NULL;

-- Exactly one source must be set
ALTER TABLE compliance_issues DROP CONSTRAINT IF EXISTS compliance_issues_one_source;
ALTER TABLE compliance_issues ADD CONSTRAINT compliance_issues_one_source CHECK (
    (document_id IS NOT NULL)::int + (guidance_document_id IS NOT NULL)::int = 1
);

-- Drop the old unique constraint (replacement indexes in 0057b)
ALTER TABLE compliance_issues DROP CONSTRAINT IF EXISTS unique_document_issue_occurrence;
