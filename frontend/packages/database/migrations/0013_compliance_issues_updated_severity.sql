-- Migration: Replace priority with updated_severity
-- The updated_severity field allows reviewers to override the model's severity assessment
-- It pre-populates with the model's severity value

-- Add the new updated_severity column
ALTER TABLE compliance_issues ADD COLUMN IF NOT EXISTS updated_severity INTEGER;

-- Add constraint for valid range (1-10)
ALTER TABLE compliance_issues ADD CONSTRAINT compliance_issues_updated_severity_check
  CHECK (updated_severity >= 1 AND updated_severity <= 10);

-- Drop the priority column (no longer used)
ALTER TABLE compliance_issues DROP COLUMN IF EXISTS priority;
