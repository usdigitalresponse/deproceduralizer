-- Composite reform_priority_score for ranking burdensome issues by reform value.
-- Combines LLM severity + domain relevance + affected population vulnerability.
-- Computed post-Tier-2, not by the LLM.

ALTER TABLE compliance_issue_analyses
  ADD COLUMN IF NOT EXISTS reform_priority_score integer;

-- Backfill from existing data
UPDATE compliance_issue_analyses
SET reform_priority_score = COALESCE(severity, 0)
    + COALESCE(domain_relevance_score, 0)
    + CASE
        WHEN primary_affected_population IN ('vulnerable_populations', 'families', 'childcare_providers') THEN 1
        WHEN primary_affected_population IN ('government_staff') THEN -1
        ELSE 0
      END
WHERE tier2_classification IN ('burdensome', 'justified')
  AND severity IS NOT NULL;

-- Index for sorting/filtering by reform priority
CREATE INDEX IF NOT EXISTS idx_cia_reform_priority
  ON compliance_issue_analyses (reform_priority_score DESC)
  WHERE reform_priority_score IS NOT NULL;
