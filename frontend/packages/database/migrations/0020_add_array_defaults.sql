-- Add default values for array columns in compliance_issue_analyses
-- These defaults were missing from 0018, causing NULL vs [] mismatch between
-- raw SQL inserts and Drizzle ORM inserts.

ALTER TABLE compliance_issue_analyses
ALTER COLUMN tier1_relevant_match_ids SET DEFAULT '{}';

ALTER TABLE compliance_issue_analyses
ALTER COLUMN tier1_dismissed_match_ids SET DEFAULT '{}';

ALTER TABLE compliance_issue_analyses
ALTER COLUMN verbatim_requirements SET DEFAULT '{}';

ALTER TABLE compliance_issue_analyses
ALTER COLUMN web_search_topics SET DEFAULT '{}';

-- Also update any existing NULL values to empty arrays for consistency
UPDATE compliance_issue_analyses
SET tier1_relevant_match_ids = '{}'
WHERE tier1_relevant_match_ids IS NULL;

UPDATE compliance_issue_analyses
SET tier1_dismissed_match_ids = '{}'
WHERE tier1_dismissed_match_ids IS NULL;

UPDATE compliance_issue_analyses
SET verbatim_requirements = '{}'
WHERE verbatim_requirements IS NULL;

UPDATE compliance_issue_analyses
SET web_search_topics = '{}'
WHERE web_search_topics IS NULL;
