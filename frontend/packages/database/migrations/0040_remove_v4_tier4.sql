-- Migration 0040: Remove V4/Tier4 backward compatibility
-- Migrates any remaining V4 data to V5 shape and drops tier4 columns.

-- Step 1: Copy tier4 data into tier3 for V4 records that only have tier4
UPDATE compliance_issue_analyses
SET
  tier3_classification = tier4_classification,
  tier3_reasoning = tier4_reasoning,
  tier3_severity_adjustment = tier4_severity_adjustment,
  tier3_completed_at = tier4_completed_at
WHERE tier3_classification IS NULL
  AND tier4_classification IS NOT NULL;

-- Step 2: Normalize highest_tier_completed from 4 to 3
UPDATE compliance_issue_analyses
SET highest_tier_completed = 3
WHERE highest_tier_completed = 4;

-- Step 3: Tag migrated rows
UPDATE compliance_issue_analyses
SET pipeline_version = 'v4-migrated'
WHERE pipeline_version = 'v4'
  AND tier4_classification IS NOT NULL;

-- Step 4: Change pipeline_version default from 'v4' to 'v5'
ALTER TABLE compliance_issue_analyses
  ALTER COLUMN pipeline_version SET DEFAULT 'v5';

-- Step 5: Update highest_tier_completed constraint from 0-4 to 0-3
ALTER TABLE compliance_issue_analyses
  DROP CONSTRAINT IF EXISTS cia_tier_check;
ALTER TABLE compliance_issue_analyses
  ADD CONSTRAINT cia_tier_check CHECK (highest_tier_completed >= 0 AND highest_tier_completed <= 3);

-- Step 6: Drop tier4 adjustment constraint
ALTER TABLE compliance_issue_analyses
  DROP CONSTRAINT IF EXISTS cia_tier4_adjustment_check;

-- Step 7: Drop tier4 columns
ALTER TABLE compliance_issue_analyses
  DROP COLUMN IF EXISTS tier4_classification,
  DROP COLUMN IF EXISTS tier4_severity_adjustment,
  DROP COLUMN IF EXISTS tier4_reasoning,
  DROP COLUMN IF EXISTS tier4_completed_at;

-- Step 8: Drop tier4-related indexes
DROP INDEX IF EXISTS idx_cia_tier4_classification;
DROP INDEX IF EXISTS idx_cia_needs_tier4;
DROP INDEX IF EXISTS idx_cia_justified_controversial;
