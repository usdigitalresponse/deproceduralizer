-- Multi-label topic classification for JenAI findings
-- Topics are assigned by LLM batch classification (classify_topics.py)
-- 50 topics across 4 groups: agency/domain, process type, affected population, reform theme

ALTER TABLE jenai_issues ADD COLUMN IF NOT EXISTS topics TEXT[] DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_jenai_issues_topics ON jenai_issues USING GIN(topics);
