-- Migration: Create statutes table and update regulation_statute_links FK
-- Issues: #47 (Populate statutes table), #48 (Add parent_id for hierarchy)

-- Create statutes table
CREATE TABLE IF NOT EXISTS statutes (
  id BIGSERIAL PRIMARY KEY,
  citation VARCHAR(50) NOT NULL,
  state VARCHAR(2) NOT NULL,
  title TEXT,
  content TEXT,

  -- NJ-specific fields (NJSA - New Jersey Statutes Annotated)
  njsa_title VARCHAR(10),
  njsa_title_name TEXT,
  njsa_chapter VARCHAR(20),
  njsa_section VARCHAR(20),
  njsa_section_name TEXT,

  -- Hierarchy for tree navigation (Issue #48)
  parent_id BIGINT REFERENCES statutes(id) ON DELETE SET NULL,
  hierarchy_level VARCHAR(50),  -- 'title', 'chapter', 'section'
  hierarchy_path TEXT,

  -- Metadata
  source_index INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Unique constraint on state + citation
  CONSTRAINT unique_state_citation UNIQUE(state, citation)
);

-- Create indexes for statutes table
CREATE INDEX IF NOT EXISTS idx_statutes_state ON statutes(state);
CREATE INDEX IF NOT EXISTS idx_statutes_citation ON statutes(citation);
CREATE INDEX IF NOT EXISTS idx_statutes_parent_id ON statutes(parent_id);
CREATE INDEX IF NOT EXISTS idx_statutes_hierarchy_level ON statutes(hierarchy_level);
CREATE INDEX IF NOT EXISTS idx_statutes_njsa_title ON statutes(njsa_title);

-- Drop existing FK constraint on regulation_statute_links.statute_id (if exists)
-- Note: This may fail if constraint doesn't exist - that's OK
DO $$
BEGIN
  ALTER TABLE regulation_statute_links
    DROP CONSTRAINT IF EXISTS regulation_statute_links_statute_id_regulatory_documents_id_fk;
EXCEPTION WHEN OTHERS THEN
  -- Ignore errors if constraint doesn't exist
  NULL;
END $$;

-- Note: We cannot add the new FK yet because statutes table may be empty
-- The FK will be enforced at the application level until statutes are populated
-- After running nj_statutes.py, you can add:
-- ALTER TABLE regulation_statute_links
--   ADD CONSTRAINT regulation_statute_links_statute_id_statutes_id_fk
--   FOREIGN KEY (statute_id) REFERENCES statutes(id) ON DELETE CASCADE;
