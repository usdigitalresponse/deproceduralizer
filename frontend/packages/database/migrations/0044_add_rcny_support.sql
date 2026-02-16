-- Add RCNY (Rules of the City of New York) support
-- Widens state column to varchar(3) and adds rcny_* hierarchy columns

-- Step 1: Widen state columns from varchar(2) to varchar(3) to support 'NYC'
ALTER TABLE regulatory_documents ALTER COLUMN state TYPE varchar(3);
ALTER TABLE compliance_issues ALTER COLUMN state TYPE varchar(3);
ALTER TABLE compliance_issue_analyses ALTER COLUMN state TYPE varchar(3);
ALTER TABLE bookmarks ALTER COLUMN state TYPE varchar(3);
ALTER TABLE cross_references ALTER COLUMN state TYPE varchar(3);
ALTER TABLE document_notes ALTER COLUMN state TYPE varchar(3);
ALTER TABLE incorporations_by_reference ALTER COLUMN state TYPE varchar(3);

-- Step 2: Drop the old CHECK constraint and add an updated one
-- The constraint may have different auto-generated names depending on environment,
-- so we drop all check constraints on the state column and recreate.
DO $$
DECLARE
    constraint_name text;
BEGIN
    FOR constraint_name IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_attribute att ON att.attnum = ANY(con.conkey)
            AND att.attrelid = con.conrelid
        WHERE con.conrelid = 'regulatory_documents'::regclass
            AND con.contype = 'c'
            AND att.attname = 'state'
    LOOP
        EXECUTE format('ALTER TABLE regulatory_documents DROP CONSTRAINT %I', constraint_name);
    END LOOP;
END $$;

ALTER TABLE regulatory_documents ADD CONSTRAINT chk_rd_state CHECK (state IN ('NY', 'NJ', 'NYC'));

-- Step 3: Add RCNY-specific hierarchy columns
ALTER TABLE regulatory_documents
    ADD COLUMN IF NOT EXISTS rcny_title varchar(20),
    ADD COLUMN IF NOT EXISTS rcny_title_name text,
    ADD COLUMN IF NOT EXISTS rcny_chapter varchar(20),
    ADD COLUMN IF NOT EXISTS rcny_chapter_name text,
    ADD COLUMN IF NOT EXISTS rcny_section varchar(50),
    ADD COLUMN IF NOT EXISTS rcny_section_name text;

-- Step 4: Add index for NYC regulations
CREATE INDEX IF NOT EXISTS idx_rd_rcny_title ON regulatory_documents(rcny_title) WHERE state = 'NYC';
