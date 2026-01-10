-- Migration: 0028_tier2_web_search_disambiguation
-- V5.2: Add Tier 2 web search disambiguation fields
-- These fields help Tier 3 avoid returning results about similar but different programs

-- Add program context fields to compliance_issue_analyses
ALTER TABLE compliance_issue_analyses
ADD COLUMN IF NOT EXISTS program_context TEXT,
ADD COLUMN IF NOT EXISTS not_to_confuse_with TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS search_scope_guidance TEXT;

-- Add comments for documentation
COMMENT ON COLUMN compliance_issue_analyses.program_context IS 'V5.2: Specific program/agency context for web search disambiguation';
COMMENT ON COLUMN compliance_issue_analyses.not_to_confuse_with IS 'V5.2: List of similar-sounding programs that Tier 3 should NOT treat as relevant';
COMMENT ON COLUMN compliance_issue_analyses.search_scope_guidance IS 'V5.2: Guidance for Tier 3 on what to focus on vs avoid in web searches';
