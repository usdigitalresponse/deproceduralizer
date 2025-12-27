-- Migration: Add original_severity to preserve LLM-assigned severity
-- severity field becomes directly editable by reviewers
-- original_severity stores the LLM's initial assessment

-- Add original_severity column to store LLM's initial value
ALTER TABLE compliance_issues ADD COLUMN IF NOT EXISTS original_severity INTEGER;

-- Add constraint for valid range (1-10)
ALTER TABLE compliance_issues ADD CONSTRAINT compliance_issues_original_severity_check
  CHECK (original_severity >= 1 AND original_severity <= 10);

-- Copy existing severity values to original_severity for all records
-- This preserves the LLM assessment before reviewers start changing severity
UPDATE compliance_issues
SET original_severity = severity
WHERE original_severity IS NULL AND severity IS NOT NULL;

-- Drop updated_severity if it exists (from previous migration 0013)
ALTER TABLE compliance_issues DROP COLUMN IF EXISTS updated_severity;
