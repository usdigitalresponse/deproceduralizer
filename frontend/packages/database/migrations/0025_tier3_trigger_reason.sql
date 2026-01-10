-- Add tier3_trigger_reason column to store why an item was escalated to Tier 3
-- This enables analysis of which triggers are most valuable

ALTER TABLE compliance_issue_analyses
ADD COLUMN IF NOT EXISTS tier3_trigger_reason TEXT;

-- Add comment explaining the column
COMMENT ON COLUMN compliance_issue_analyses.tier3_trigger_reason IS
'Human-readable reason for Tier 3 escalation (e.g., "High-risk issue type (notarization) + justified", "Random sample (10%)", "Low confidence (0.82) + severity 7")';

-- Create index for filtering/grouping by trigger reason
CREATE INDEX IF NOT EXISTS idx_compliance_issue_analyses_tier3_trigger_reason
ON compliance_issue_analyses(tier3_trigger_reason)
WHERE tier3_trigger_reason IS NOT NULL;
