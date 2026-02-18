-- Add NYC-specific columns to statutes table (NYC Charter + Administrative Code)
-- Parallels existing nycls_* and njsa_* column patterns

-- Widen state column to fit 'NYC' (currently VARCHAR(2))
ALTER TABLE statutes ALTER COLUMN state TYPE VARCHAR(3);

-- NYC-specific columns
ALTER TABLE statutes ADD COLUMN IF NOT EXISTS nyc_doc_type VARCHAR(20);    -- 'charter' or 'admin_code'
ALTER TABLE statutes ADD COLUMN IF NOT EXISTS nyc_title VARCHAR(10);       -- Admin Code title number
ALTER TABLE statutes ADD COLUMN IF NOT EXISTS nyc_chapter VARCHAR(20);     -- Chapter ID
ALTER TABLE statutes ADD COLUMN IF NOT EXISTS nyc_section VARCHAR(30);     -- Section number
ALTER TABLE statutes ADD COLUMN IF NOT EXISTS nyc_section_name TEXT;       -- Section title

CREATE INDEX IF NOT EXISTS idx_statutes_nyc_doc_type ON statutes(nyc_doc_type) WHERE nyc_doc_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_statutes_nyc_title ON statutes(nyc_title) WHERE nyc_title IS NOT NULL;
