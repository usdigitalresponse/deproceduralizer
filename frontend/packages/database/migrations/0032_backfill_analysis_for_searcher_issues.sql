-- Migration 0032: Backfill compliance_issue_analyses for searcher-only issues
--
-- PR 6.2 moves 6 analysis fields from compliance_issues to compliance_issue_analyses.
-- Before we can read from analyses exclusively, every compliance_issue needs a
-- corresponding analysis row. This migration creates minimal analysis rows for the
-- 9 orphan issues that have no analysis yet.
--
-- The backfill copies LLM data from compliance_issues (occurrence_number = 1)
-- into a new compliance_issue_analyses row with pipeline_version = 'searcher'.

INSERT INTO compliance_issue_analyses (
  document_id, issue_type, state, grouped_match_count,
  requirement_found, is_verbatim, final_severity,
  verbatim_requirements,
  cites_federal_statute, federal_citation,
  tier1_reasoning,
  highest_tier_completed, pipeline_version
)
SELECT
  ci.document_id,
  ci.issue_type,
  ci.state,
  (SELECT COUNT(*) FROM compliance_issues ci2
   WHERE ci2.document_id = ci.document_id AND ci2.issue_type = ci.issue_type),
  ci.requirement_found,
  ci.is_verbatim,
  ci.severity,
  ci.verbatim_supporting_text,
  ci.required_by_statute,
  ci.statute_citation,
  ci.decision_rationale,
  0,
  'searcher'
FROM compliance_issues ci
LEFT JOIN compliance_issue_analyses cia
  ON ci.document_id = cia.document_id AND ci.issue_type = cia.issue_type
WHERE cia.id IS NULL
  AND ci.occurrence_number = 1;
