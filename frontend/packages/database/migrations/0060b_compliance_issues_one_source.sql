-- Add CHECK constraint on compliance_issues ensuring exactly one source.
-- Mirrors cia_one_source on compliance_issue_analyses (migration 0058).

ALTER TABLE compliance_issues DROP CONSTRAINT IF EXISTS ci_one_source;
ALTER TABLE compliance_issues ADD CONSTRAINT ci_one_source CHECK (
    (document_id IS NOT NULL)::int + (guidance_document_id IS NOT NULL)::int = 1
);
