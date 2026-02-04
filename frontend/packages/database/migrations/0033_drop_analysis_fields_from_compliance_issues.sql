-- Migration 0033: Drop duplicate analysis fields from compliance_issues
--
-- PR 6.2: These 6 columns are now read from compliance_issue_analyses exclusively.
-- The backfill in 0032 ensured every compliance_issue has a corresponding analysis row.
-- severity and original_severity are kept on compliance_issues for now (deferred to PR 6.3).

ALTER TABLE compliance_issues DROP COLUMN requirement_found;
ALTER TABLE compliance_issues DROP COLUMN is_verbatim;
ALTER TABLE compliance_issues DROP COLUMN required_by_statute;
ALTER TABLE compliance_issues DROP COLUMN statute_citation;
ALTER TABLE compliance_issues DROP COLUMN verbatim_supporting_text;
ALTER TABLE compliance_issues DROP COLUMN decision_rationale;
