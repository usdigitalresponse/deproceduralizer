-- Rename `state` column to `jurisdiction` across all tables
-- This migration does NOT update Drizzle schema — that will be a separate step

BEGIN;

-- =============================================================================
-- 1. Rename the column on all 9 tables
-- =============================================================================

ALTER TABLE regulatory_documents RENAME COLUMN state TO jurisdiction;
ALTER TABLE compliance_issues RENAME COLUMN state TO jurisdiction;
ALTER TABLE compliance_issue_analyses RENAME COLUMN state TO jurisdiction;
ALTER TABLE bookmarks RENAME COLUMN state TO jurisdiction;
ALTER TABLE cross_references RENAME COLUMN state TO jurisdiction;
ALTER TABLE document_notes RENAME COLUMN state TO jurisdiction;
ALTER TABLE incorporations_by_reference RENAME COLUMN state TO jurisdiction;
ALTER TABLE jenai_analyses RENAME COLUMN state TO jurisdiction;
ALTER TABLE statutes RENAME COLUMN state TO jurisdiction;

-- =============================================================================
-- 2. Drop existing and create CHECK constraints with new column name
-- =============================================================================

-- regulatory_documents
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
            AND att.attname = 'jurisdiction'
    LOOP
        EXECUTE format('ALTER TABLE regulatory_documents DROP CONSTRAINT %I', constraint_name);
    END LOOP;
END $$;

ALTER TABLE regulatory_documents ADD CONSTRAINT chk_rd_jurisdiction CHECK (jurisdiction IN ('NY', 'NJ', 'NYC'));

-- compliance_issues
DO $$
DECLARE
    constraint_name text;
BEGIN
    FOR constraint_name IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_attribute att ON att.attnum = ANY(con.conkey)
            AND att.attrelid = con.conrelid
        WHERE con.conrelid = 'compliance_issues'::regclass
            AND con.contype = 'c'
            AND att.attname = 'jurisdiction'
    LOOP
        EXECUTE format('ALTER TABLE compliance_issues DROP CONSTRAINT %I', constraint_name);
    END LOOP;
END $$;

ALTER TABLE compliance_issues ADD CONSTRAINT chk_ci_jurisdiction CHECK (jurisdiction IN ('NY', 'NJ', 'NYC'));

-- compliance_issue_analyses
DO $$
DECLARE
    constraint_name text;
BEGIN
    FOR constraint_name IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_attribute att ON att.attnum = ANY(con.conkey)
            AND att.attrelid = con.conrelid
        WHERE con.conrelid = 'compliance_issue_analyses'::regclass
            AND con.contype = 'c'
            AND att.attname = 'jurisdiction'
    LOOP
        EXECUTE format('ALTER TABLE compliance_issue_analyses DROP CONSTRAINT %I', constraint_name);
    END LOOP;
END $$;

ALTER TABLE compliance_issue_analyses ADD CONSTRAINT chk_cia_jurisdiction CHECK (jurisdiction IN ('NY', 'NJ', 'NYC'));

-- cross_references
DO $$
DECLARE
    constraint_name text;
BEGIN
    FOR constraint_name IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_attribute att ON att.attnum = ANY(con.conkey)
            AND att.attrelid = con.conrelid
        WHERE con.conrelid = 'cross_references'::regclass
            AND con.contype = 'c'
            AND att.attname = 'jurisdiction'
    LOOP
        EXECUTE format('ALTER TABLE cross_references DROP CONSTRAINT %I', constraint_name);
    END LOOP;
END $$;

ALTER TABLE cross_references ADD CONSTRAINT chk_cr_jurisdiction CHECK (jurisdiction IN ('NY', 'NJ', 'NYC'));

-- incorporations_by_reference
-- Note: no prior CHECK exists; this creates a new constraint
DO $$
DECLARE
    constraint_name text;
BEGIN
    FOR constraint_name IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_attribute att ON att.attnum = ANY(con.conkey)
            AND att.attrelid = con.conrelid
        WHERE con.conrelid = 'incorporations_by_reference'::regclass
            AND con.contype = 'c'
            AND att.attname = 'jurisdiction'
    LOOP
        EXECUTE format('ALTER TABLE incorporations_by_reference DROP CONSTRAINT %I', constraint_name);
    END LOOP;
END $$;

ALTER TABLE incorporations_by_reference ADD CONSTRAINT chk_ibr_jurisdiction CHECK (jurisdiction IN ('NY', 'NJ', 'NYC'));

-- statutes
DO $$
DECLARE
    constraint_name text;
BEGIN
    FOR constraint_name IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_attribute att ON att.attnum = ANY(con.conkey)
            AND att.attrelid = con.conrelid
        WHERE con.conrelid = 'statutes'::regclass
            AND con.contype = 'c'
            AND att.attname = 'jurisdiction'
    LOOP
        EXECUTE format('ALTER TABLE statutes DROP CONSTRAINT %I', constraint_name);
    END LOOP;
END $$;

ALTER TABLE statutes ADD CONSTRAINT chk_statutes_jurisdiction CHECK (jurisdiction IN ('NY', 'NJ', 'NYC'));

-- bookmarks (no prior CHECK — new constraint)
ALTER TABLE bookmarks ADD CONSTRAINT chk_bookmarks_jurisdiction CHECK (jurisdiction IN ('NY', 'NJ', 'NYC'));

-- document_notes (no prior CHECK — new constraint)
ALTER TABLE document_notes ADD CONSTRAINT chk_document_notes_jurisdiction CHECK (jurisdiction IN ('NY', 'NJ', 'NYC'));

-- jenai_analyses (no prior CHECK — new constraint)
ALTER TABLE jenai_analyses ADD CONSTRAINT chk_jenai_jurisdiction CHECK (jurisdiction IN ('NY', 'NJ', 'NYC'));

-- =============================================================================
-- 3. Recreate unique indexes/constraints referencing `state`
-- =============================================================================

-- regulatory_documents: unique index on (jurisdiction, source_index, type)
DROP INDEX IF EXISTS idx_rd_state_source_type;
CREATE UNIQUE INDEX idx_rd_jurisdiction_source_type ON regulatory_documents (jurisdiction, source_index, type);

-- statutes: unique constraint on (jurisdiction, citation)
ALTER TABLE statutes DROP CONSTRAINT IF EXISTS unique_state_citation;
ALTER TABLE statutes DROP CONSTRAINT IF EXISTS statutes_state_citation_key;
ALTER TABLE statutes ADD CONSTRAINT unique_jurisdiction_citation UNIQUE (jurisdiction, citation);

COMMIT;
