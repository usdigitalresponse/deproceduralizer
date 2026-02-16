-- Allow 'NYC' in compliance_issue_analyses and cross_references CHECK constraints
-- These tables were created with CHECK (state IN ('NY', 'NJ')) in migrations 0018 and 0016

-- compliance_issue_analyses: drop inline CHECK and add named constraint
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
            AND att.attname = 'state'
    LOOP
        EXECUTE format('ALTER TABLE compliance_issue_analyses DROP CONSTRAINT %I', constraint_name);
    END LOOP;
END $$;

ALTER TABLE compliance_issue_analyses ADD CONSTRAINT chk_cia_state CHECK (state IN ('NY', 'NJ', 'NYC'));

-- cross_references: drop inline CHECK and add named constraint
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
            AND att.attname = 'state'
    LOOP
        EXECUTE format('ALTER TABLE cross_references DROP CONSTRAINT %I', constraint_name);
    END LOOP;
END $$;

ALTER TABLE cross_references ADD CONSTRAINT chk_cr_state CHECK (state IN ('NY', 'NJ', 'NYC'));
