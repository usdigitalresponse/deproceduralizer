-- Add precomputed descendant regulation link counts to statutes table
-- Mirrors the pattern used for descendant_compliance_issue_count on regulatory_documents
ALTER TABLE statutes ADD COLUMN descendant_linked_regulation_count integer DEFAULT 0;
ALTER TABLE statutes ADD COLUMN descendant_enabling_authority_count integer DEFAULT 0;
