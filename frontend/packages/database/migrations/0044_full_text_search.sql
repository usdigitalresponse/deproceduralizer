-- Full-Text Search: Add tsvector columns, GIN indexes, backfill data, and update triggers
-- Tables: regulatory_documents, statutes, compliance_issue_analyses

-- ============================================
-- 1. Add tsvector columns
-- ============================================

ALTER TABLE regulatory_documents ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE statutes ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE compliance_issue_analyses ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- ============================================
-- 2. Backfill existing data with weighted vectors
-- ============================================

-- regulatory_documents: title(A) + summary(B) + content(C)
UPDATE regulatory_documents SET search_vector =
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(content, '')), 'C');

-- statutes: title(A) + content(C)
UPDATE statutes SET search_vector =
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(content, '')), 'C');

-- compliance_issue_analyses: tier2_reasoning + tier3_reasoning + verbatim_requirements (unweighted)
-- Note: verbatim_requirements is text[], must use array_to_string
UPDATE compliance_issue_analyses SET search_vector =
  to_tsvector('english', coalesce(tier2_reasoning, '')) ||
  to_tsvector('english', coalesce(tier3_reasoning, '')) ||
  to_tsvector('english', coalesce(array_to_string(verbatim_requirements, ' '), ''));

-- ============================================
-- 3. Create GIN indexes for fast FTS queries
-- ============================================

CREATE INDEX IF NOT EXISTS idx_regulatory_documents_search_vector
  ON regulatory_documents USING GIN (search_vector);

CREATE INDEX IF NOT EXISTS idx_statutes_search_vector
  ON statutes USING GIN (search_vector);

CREATE INDEX IF NOT EXISTS idx_compliance_issue_analyses_search_vector
  ON compliance_issue_analyses USING GIN (search_vector);

-- ============================================
-- 4. Trigger functions to keep vectors updated
-- ============================================

CREATE OR REPLACE FUNCTION regulatory_documents_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.summary, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.content, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION statutes_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.content, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION compliance_issue_analyses_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    to_tsvector('english', coalesce(NEW.tier2_reasoning, '')) ||
    to_tsvector('english', coalesce(NEW.tier3_reasoning, '')) ||
    to_tsvector('english', coalesce(array_to_string(NEW.verbatim_requirements, ' '), ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. Attach triggers (BEFORE INSERT OR UPDATE of relevant columns)
-- ============================================

DROP TRIGGER IF EXISTS trg_regulatory_documents_search_vector ON regulatory_documents;
CREATE TRIGGER trg_regulatory_documents_search_vector
  BEFORE INSERT OR UPDATE OF title, summary, content
  ON regulatory_documents
  FOR EACH ROW
  EXECUTE FUNCTION regulatory_documents_search_vector_update();

DROP TRIGGER IF EXISTS trg_statutes_search_vector ON statutes;
CREATE TRIGGER trg_statutes_search_vector
  BEFORE INSERT OR UPDATE OF title, content
  ON statutes
  FOR EACH ROW
  EXECUTE FUNCTION statutes_search_vector_update();

DROP TRIGGER IF EXISTS trg_compliance_issue_analyses_search_vector ON compliance_issue_analyses;
CREATE TRIGGER trg_compliance_issue_analyses_search_vector
  BEFORE INSERT OR UPDATE OF tier2_reasoning, tier3_reasoning, verbatim_requirements
  ON compliance_issue_analyses
  FOR EACH ROW
  EXECUTE FUNCTION compliance_issue_analyses_search_vector_update();
