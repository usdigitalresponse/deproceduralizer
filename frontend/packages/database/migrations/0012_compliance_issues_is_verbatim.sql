-- Add is_verbatim field to compliance_issues
-- Indicates whether requirement_text is a verbatim quote from the regulation

ALTER TABLE compliance_issues
ADD COLUMN IF NOT EXISTS is_verbatim BOOLEAN;

COMMENT ON COLUMN compliance_issues.is_verbatim IS
  'True if requirement_text is verbatim from regulation, False if paraphrased, NULL for legacy records';
