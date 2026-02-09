-- Migration 0039: Track views in migration history
-- These views were previously only defined in schema.sql (now removed).
-- Using CREATE OR REPLACE for idempotency (views already exist in live DB).

CREATE OR REPLACE VIEW latest_analyses AS
SELECT d.*, a.id as analysis_id, a.analyzed_at, a.has_implementation_issues,
       a.overall_complexity, a.requires_technical_review, a.has_reporting_requirement,
       a.num_flags, a.max_severity, a.summary
FROM regulatory_documents d
LEFT JOIN analyses a ON d.id = a.document_id AND a.is_current = TRUE;

CREATE OR REPLACE VIEW document_hierarchy AS
SELECT p.id as parent_id, p.title as parent_title, p.hierarchy_level as parent_level,
       c.id as child_id, c.title as child_title, c.hierarchy_level as child_level
FROM regulatory_documents p
JOIN regulatory_documents c ON c.parent_id = p.id;
