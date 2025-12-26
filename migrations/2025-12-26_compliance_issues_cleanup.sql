-- Migration: Clean up compliance_issues table
-- Date: 2025-12-26
-- Description: Simplify schema with clearer field names and remove unused columns
--
-- BEFORE RUNNING: Back up your data!
--   pg_dump -t compliance_issues your_database > compliance_issues_backup.sql

BEGIN;

-- ============================================================================
-- Step 1: Add new columns
-- ============================================================================

-- Add severity (1-10 scale from LLM)
ALTER TABLE compliance_issues
ADD COLUMN IF NOT EXISTS severity INTEGER CHECK (severity >= 1 AND severity <= 10);

-- Add impact_assessment (LLM's explanation of why this is/isn't problematic)
ALTER TABLE compliance_issues
ADD COLUMN IF NOT EXISTS impact_assessment TEXT;

-- Add url back (was in some versions, needed for linking)
ALTER TABLE compliance_issues
ADD COLUMN IF NOT EXISTS url TEXT;

-- ============================================================================
-- Step 2: Rename columns for clarity
-- ============================================================================

-- term_matched -> matched_pattern (it's the regex pattern, not a term)
ALTER TABLE compliance_issues
RENAME COLUMN term_matched TO matched_pattern;

-- context -> matched_context (text window around the regex match)
ALTER TABLE compliance_issues
RENAME COLUMN context TO matched_context;

-- llm_confirmed -> requirement_found (did LLM find an actual requirement?)
ALTER TABLE compliance_issues
RENAME COLUMN llm_confirmed TO requirement_found;

-- requirement_quote -> requirement_text (the specific text creating the requirement)
ALTER TABLE compliance_issues
RENAME COLUMN requirement_quote TO requirement_text;

-- from_statute -> required_by_statute (true=statute mandates, false=agency added)
ALTER TABLE compliance_issues
RENAME COLUMN from_statute TO required_by_statute;

-- ============================================================================
-- Step 3: Drop unused columns
-- ============================================================================

-- statute_citation - never populated
ALTER TABLE compliance_issues DROP COLUMN IF EXISTS statute_citation;

-- Overkill review tracking - just need status and notes
ALTER TABLE compliance_issues DROP COLUMN IF EXISTS reviewed_by;
ALTER TABLE compliance_issues DROP COLUMN IF EXISTS reviewed_at;

-- Redundant with new severity/impact_assessment
ALTER TABLE compliance_issues DROP COLUMN IF EXISTS priority;
ALTER TABLE compliance_issues DROP COLUMN IF EXISTS impact_type;

-- Developer workflow fields - not used
ALTER TABLE compliance_issues DROP COLUMN IF EXISTS developer_status;
ALTER TABLE compliance_issues DROP COLUMN IF EXISTS developer_assigned;
ALTER TABLE compliance_issues DROP COLUMN IF EXISTS developer_notes;
ALTER TABLE compliance_issues DROP COLUMN IF EXISTS resolution_type;
ALTER TABLE compliance_issues DROP COLUMN IF EXISTS resolution_comments;
ALTER TABLE compliance_issues DROP COLUMN IF EXISTS developer_question;
ALTER TABLE compliance_issues DROP COLUMN IF EXISTS developer_checked_at;

-- Also drop justification_notes if it exists (was being misused for LLM metadata)
ALTER TABLE compliance_issues DROP COLUMN IF EXISTS justification_notes;

-- ============================================================================
-- Step 4: Update indexes (drop old, create new with correct names)
-- ============================================================================

-- Drop indexes that reference old column names (if they exist)
DROP INDEX IF EXISTS idx_compliance_issues_developer_status;
DROP INDEX IF EXISTS idx_compliance_issues_developer_assigned;

-- Ensure we have the important indexes
CREATE INDEX IF NOT EXISTS idx_compliance_issues_requirement_found
ON compliance_issues(requirement_found);

CREATE INDEX IF NOT EXISTS idx_compliance_issues_severity
ON compliance_issues(severity) WHERE severity IS NOT NULL;

-- ============================================================================
-- Step 5: Add comments for documentation
-- ============================================================================

COMMENT ON TABLE compliance_issues IS
'Tracks compliance issues found in regulations (wet signatures, mail-only, etc.)';

COMMENT ON COLUMN compliance_issues.matched_pattern IS
'The regex pattern that triggered the scan (e.g., "bear.{0,10}signature")';

COMMENT ON COLUMN compliance_issues.matched_context IS
'~600 char text window around the regex match';

COMMENT ON COLUMN compliance_issues.requirement_found IS
'LLM verified this is actually a requirement (not a false positive from regex)';

COMMENT ON COLUMN compliance_issues.requirement_text IS
'The specific text from the regulation creating the requirement';

COMMENT ON COLUMN compliance_issues.required_by_statute IS
'true = statute mandates this, false = agency added it, null = unknown';

COMMENT ON COLUMN compliance_issues.severity IS
'How problematic is this requirement (1-10 scale)';

COMMENT ON COLUMN compliance_issues.impact_assessment IS
'LLM explanation of why this requirement is or is not problematic';

COMMENT ON COLUMN compliance_issues.review_status IS
'Human review status: unreviewed, confirmed, rejected_false_positive';

COMMENT ON COLUMN compliance_issues.reviewer_notes IS
'Human explanation of review decision';

COMMIT;

-- ============================================================================
-- VERIFICATION: Run after migration to check results
-- ============================================================================
--
-- Check column names:
--   \d compliance_issues
--
-- Check data preserved:
--   SELECT COUNT(*) FROM compliance_issues;
--   SELECT requirement_found, COUNT(*) FROM compliance_issues GROUP BY requirement_found;
