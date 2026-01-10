-- Add federal mandate tracking columns for Tier 4 output
-- These fields are in Tier4Output but were not being persisted.

ALTER TABLE compliance_issue_analyses
ADD COLUMN federal_mandate_found BOOLEAN DEFAULT FALSE;

ALTER TABLE compliance_issue_analyses
ADD COLUMN state_has_discretion BOOLEAN DEFAULT TRUE;

-- Add comment for documentation
COMMENT ON COLUMN compliance_issue_analyses.federal_mandate_found IS 'True if web search confirmed a federal mandate requiring this regulation';
COMMENT ON COLUMN compliance_issue_analyses.state_has_discretion IS 'True if state has discretion in how to implement the requirement';
