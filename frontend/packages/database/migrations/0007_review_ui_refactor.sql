-- Migration: Review UI Refactor
-- Purpose: Split notes fields into justification_notes and team_notes,
--          add new review statuses for red_flags and compliance_issues,
--          rename columns for consistency across all tables

-- ============================================================================
-- PART 1: Add new column for justification_notes (before renaming reviewer_notes)
-- ============================================================================

-- Red Flags: Add justification_notes column
ALTER TABLE red_flags ADD COLUMN IF NOT EXISTS justification_notes TEXT;

-- Compliance Issues: Add justification_notes column
ALTER TABLE compliance_issues ADD COLUMN IF NOT EXISTS justification_notes TEXT;

-- ============================================================================
-- PART 2: Migrate review_status values (Red Flags and Compliance Issues ONLY)
-- Note: Definitions keeps its existing statuses unchanged
-- ============================================================================

-- Update existing 'false_positive' to 'rejected_clear_fp'
UPDATE red_flags SET review_status = 'rejected_clear_fp' WHERE review_status = 'false_positive';
UPDATE compliance_issues SET review_status = 'rejected_clear_fp' WHERE review_status = 'false_positive';

-- ============================================================================
-- PART 3: Rename columns for consistency
-- ============================================================================

-- Red Flags: Rename reviewer_notes -> team_notes
ALTER TABLE red_flags RENAME COLUMN reviewer_notes TO team_notes;

-- Compliance Issues: Rename reviewer_notes -> team_notes
ALTER TABLE compliance_issues RENAME COLUMN reviewer_notes TO team_notes;

-- Definitions: Rename correction_reason -> justification_notes
ALTER TABLE definitions RENAME COLUMN correction_reason TO justification_notes;

-- Definitions: Rename model_feedback -> team_notes
ALTER TABLE definitions RENAME COLUMN model_feedback TO team_notes;

-- ============================================================================
-- PART 4: Add developer tracking fields to compliance_issues (if missing)
-- These exist in red_flags but may be missing from compliance_issues
-- ============================================================================

ALTER TABLE compliance_issues ADD COLUMN IF NOT EXISTS developer_status VARCHAR(50) DEFAULT 'unresolved';
ALTER TABLE compliance_issues ADD COLUMN IF NOT EXISTS developer_assigned VARCHAR(50);
ALTER TABLE compliance_issues ADD COLUMN IF NOT EXISTS developer_notes TEXT;
ALTER TABLE compliance_issues ADD COLUMN IF NOT EXISTS resolution_type VARCHAR(50);
ALTER TABLE compliance_issues ADD COLUMN IF NOT EXISTS resolution_comments TEXT;
ALTER TABLE compliance_issues ADD COLUMN IF NOT EXISTS developer_question TEXT;
ALTER TABLE compliance_issues ADD COLUMN IF NOT EXISTS developer_checked_at TIMESTAMP;

-- Add indexes for developer fields if not exist
CREATE INDEX IF NOT EXISTS idx_compliance_issues_developer_status ON compliance_issues(developer_status);
CREATE INDEX IF NOT EXISTS idx_compliance_issues_developer_assigned ON compliance_issues(developer_assigned);
