-- Add primary_affected_population and domain_relevance_score to compliance_issue_analyses
-- These fields are populated during Tier 2 analysis (no extra LLM cost)

ALTER TABLE compliance_issue_analyses
  ADD COLUMN IF NOT EXISTS primary_affected_population varchar(50),
  ADD COLUMN IF NOT EXISTS domain_relevance_score integer;

-- Index for filtering by affected population
CREATE INDEX IF NOT EXISTS idx_cia_affected_population
  ON compliance_issue_analyses (primary_affected_population)
  WHERE primary_affected_population IS NOT NULL;
