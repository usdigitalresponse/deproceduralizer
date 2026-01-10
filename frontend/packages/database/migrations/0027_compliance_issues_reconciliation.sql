-- Migration 0027: compliance_issues reconciliation
-- Add new columns (research pipeline) while keeping old columns (production data)

-- Add new columns for research pipeline (they will be null for existing data)
ALTER TABLE compliance_issues ADD COLUMN IF NOT EXISTS regex_match_pattern VARCHAR(255);
ALTER TABLE compliance_issues ADD COLUMN IF NOT EXISTS regex_match_context TEXT;
ALTER TABLE compliance_issues ADD COLUMN IF NOT EXISTS verbatim_supporting_text TEXT[] DEFAULT '{}';
ALTER TABLE compliance_issues ADD COLUMN IF NOT EXISTS decision_rationale TEXT;

-- Copy data from old columns to new columns for existing records
UPDATE compliance_issues SET
    regex_match_pattern = matched_pattern,
    regex_match_context = matched_context,
    verbatim_supporting_text = CASE
        WHEN requirement_text IS NOT NULL THEN ARRAY[requirement_text]
        ELSE '{}'
    END,
    decision_rationale = impact_assessment
WHERE regex_match_pattern IS NULL;

-- Add comments
COMMENT ON COLUMN compliance_issues.regex_match_pattern IS 'New: Regex pattern that triggered scan (mirrors matched_pattern)';
COMMENT ON COLUMN compliance_issues.regex_match_context IS 'New: Text window around the regex match (mirrors matched_context)';
COMMENT ON COLUMN compliance_issues.verbatim_supporting_text IS 'New: Array of exact quotes from regulation (replaces single requirement_text)';
COMMENT ON COLUMN compliance_issues.decision_rationale IS 'New: LLM rationale for classification (mirrors impact_assessment)';

-- Note: Old columns (matched_pattern, matched_context, requirement_text, impact_assessment) are kept for backwards compatibility
