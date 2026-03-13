-- Immutable wrapper needed because to_tsvector('english', ...) is STABLE, not IMMUTABLE,
-- and PostgreSQL requires IMMUTABLE functions in index expressions.
CREATE OR REPLACE FUNCTION jenai_issues_search_tsvector(explanation text, tags text[])
RETURNS tsvector
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT to_tsvector('english', coalesce(explanation, '') || ' ' || coalesce(array_to_string(tags, ' '), ''));
$$;

-- GIN index on tsvector for fast full-text search over explanation + tags
CREATE INDEX idx_jenai_issues_search ON jenai_issues
  USING GIN (jenai_issues_search_tsvector(explanation, tags));
