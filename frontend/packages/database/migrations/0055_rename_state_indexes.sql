-- Rename indexes that still reference 'state' after migration 0054
-- These indexes function correctly (PostgreSQL resolves by column OID after RENAME COLUMN)
-- but their names are misleading. This is cosmetic cleanup only.

BEGIN;

-- regulatory_documents (4 indexes)
ALTER INDEX idx_documents_state RENAME TO idx_documents_jurisdiction;
ALTER INDEX idx_documents_state_type RENAME TO idx_documents_jurisdiction_type;
ALTER INDEX idx_documents_regulatory_status_state RENAME TO idx_documents_regulatory_status_jurisdiction;
ALTER INDEX idx_rd_state_section_type RENAME TO idx_rd_jurisdiction_section_type;

-- statutes (1 index)
ALTER INDEX idx_statutes_state RENAME TO idx_statutes_jurisdiction;

-- compliance_issues (2 indexes)
ALTER INDEX idx_compliance_issues_state RENAME TO idx_compliance_issues_jurisdiction;
ALTER INDEX idx_compliance_issues_state_issue RENAME TO idx_compliance_issues_jurisdiction_issue;

-- compliance_issue_analyses (2 indexes)
ALTER INDEX idx_cia_state_issue RENAME TO idx_cia_jurisdiction_issue;
ALTER INDEX idx_cia_state_severity RENAME TO idx_cia_jurisdiction_severity;

-- cross_references (1 index)
ALTER INDEX idx_crossrefs_state RENAME TO idx_crossrefs_jurisdiction;

-- bookmarks (1 index)
ALTER INDEX idx_bookmarks_state RENAME TO idx_bookmarks_jurisdiction;

-- incorporations_by_reference (1 index)
ALTER INDEX idx_ibr_state RENAME TO idx_ibr_jurisdiction;

-- jenai_analyses (1 index)
ALTER INDEX idx_jenai_analyses_state RENAME TO idx_jenai_analyses_jurisdiction;

COMMIT;
