-- Report utility assessment fields for mandated_reports and reporting_frequency issue types.
-- Populated during Tier 2 analysis — no extra LLM cost (uses issue-specific prompt guidance).

ALTER TABLE compliance_issue_analyses
  ADD COLUMN IF NOT EXISTS report_serves_public boolean,
  ADD COLUMN IF NOT EXISTS report_duplicates_existing boolean,
  ADD COLUMN IF NOT EXISTS report_frequency_excessive boolean;
