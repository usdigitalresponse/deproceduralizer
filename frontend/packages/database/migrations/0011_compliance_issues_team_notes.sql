-- Consolidate reviewer_notes into team_notes for compliance_issues
-- team_notes replaces reviewer_notes (matches red_flags and definitions pattern)

-- 1. Ensure team_notes column exists
ALTER TABLE compliance_issues
ADD COLUMN IF NOT EXISTS team_notes TEXT;

COMMENT ON COLUMN compliance_issues.team_notes IS 'Notes for development team - process notes, research tasks, questions';

-- 2. Migrate any existing reviewer_notes data to team_notes
UPDATE compliance_issues
SET team_notes = reviewer_notes
WHERE reviewer_notes IS NOT NULL AND team_notes IS NULL;

-- 3. Drop the deprecated reviewer_notes column
ALTER TABLE compliance_issues
DROP COLUMN IF EXISTS reviewer_notes;
