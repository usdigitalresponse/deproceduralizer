-- Multi-label topic classification for Barrier findings
-- Topics are assigned by LLM batch classification (classify_topics.py)
-- 50 topics across 4 groups: agency/domain, process type, affected population, reform theme

ALTER TABLE barrier_issues ADD COLUMN IF NOT EXISTS topics TEXT[] DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_barrier_issues_topics ON barrier_issues USING GIN(topics);
