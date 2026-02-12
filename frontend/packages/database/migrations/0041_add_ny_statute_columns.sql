-- Add NY-specific columns to statutes table (NYCLS - New York Consolidated Laws)
-- Parallels existing njsa_* columns for NJ statutes

ALTER TABLE statutes ADD COLUMN IF NOT EXISTS nycls_law_id VARCHAR(10);
ALTER TABLE statutes ADD COLUMN IF NOT EXISTS nycls_law_name TEXT;
ALTER TABLE statutes ADD COLUMN IF NOT EXISTS nycls_article VARCHAR(20);
ALTER TABLE statutes ADD COLUMN IF NOT EXISTS nycls_article_name TEXT;
ALTER TABLE statutes ADD COLUMN IF NOT EXISTS nycls_section VARCHAR(20);
ALTER TABLE statutes ADD COLUMN IF NOT EXISTS nycls_section_name TEXT;

CREATE INDEX IF NOT EXISTS idx_statutes_nycls_law_id ON statutes(nycls_law_id);
