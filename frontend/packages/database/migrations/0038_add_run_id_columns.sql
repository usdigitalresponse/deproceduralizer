-- STATUS: PENDING - Not yet applied to live Neon DB.
-- After applying, add run_id to Drizzle schema files (analyses.ts, compliance-issues.ts)

-- Migration: Add run_id columns to analysis tables
-- Purpose: Enable tracking which pipeline run produced each analysis result
-- Date: 2025-01-01

-- Add run_id to analyses table (for red_flags tracking)
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS run_id VARCHAR(32);

-- Add run_id to compliance_issues table
ALTER TABLE compliance_issues ADD COLUMN IF NOT EXISTS run_id VARCHAR(32);

-- Create indexes for efficient queries by run_id
CREATE INDEX IF NOT EXISTS idx_analyses_run_id ON analyses(run_id);
CREATE INDEX IF NOT EXISTS idx_compliance_issues_run_id ON compliance_issues(run_id);

-- Add comments for documentation
COMMENT ON COLUMN analyses.run_id IS 'Pipeline run identifier for tracking which run produced this analysis';
COMMENT ON COLUMN compliance_issues.run_id IS 'Pipeline run identifier for tracking which run produced this issue';
