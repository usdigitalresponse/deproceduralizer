-- Migration 0035: Backfill review/developer data from compliance_issues to compliance_issue_analyses
-- PR 6.3: "Most-reviewed-wins" strategy — for each (document_id, issue_type) group,
-- pick the compliance_issues row with the most complete review data.
-- Ranking: reviewed_at NOT NULL > developer_checked_at NOT NULL > review_status != 'unreviewed' > lowest id

WITH ranked_issues AS (
  SELECT
    ci.document_id,
    ci.issue_type,
    ci.review_status,
    ci.reviewed_by,
    ci.reviewed_at,
    ci.justification_notes,
    ci.team_notes,
    ci.impact_type,
    ci.severity AS reviewer_severity,
    ci.original_severity AS reviewer_original_severity,
    ci.developer_status,
    ci.developer_assigned,
    ci.developer_notes,
    ci.resolution_type,
    ci.resolution_comments,
    ci.developer_question,
    ci.developer_checked_at,
    ROW_NUMBER() OVER (
      PARTITION BY ci.document_id, ci.issue_type
      ORDER BY
        (ci.reviewed_at IS NOT NULL) DESC,
        (ci.developer_checked_at IS NOT NULL) DESC,
        (ci.review_status != 'unreviewed') DESC,
        ci.id ASC
    ) AS rn
  FROM compliance_issues ci
)
UPDATE compliance_issue_analyses cia
SET
  review_status = ri.review_status,
  reviewed_by = ri.reviewed_by,
  reviewed_at = ri.reviewed_at,
  justification_notes = ri.justification_notes,
  team_notes = ri.team_notes,
  impact_type = ri.impact_type,
  reviewer_severity = ri.reviewer_severity,
  reviewer_original_severity = ri.reviewer_original_severity,
  developer_status = ri.developer_status,
  developer_assigned = ri.developer_assigned,
  developer_notes = ri.developer_notes,
  resolution_type = ri.resolution_type,
  resolution_comments = ri.resolution_comments,
  developer_question = ri.developer_question,
  developer_checked_at = ri.developer_checked_at
FROM ranked_issues ri
WHERE ri.document_id = cia.document_id
  AND ri.issue_type = cia.issue_type
  AND ri.rn = 1;
