-- Allow 'NYC' in statutes.state CHECK constraint
-- Migration 0043 widened the column to varchar(3) but didn't update the CHECK

ALTER TABLE statutes DROP CONSTRAINT IF EXISTS chk_statutes_state;
ALTER TABLE statutes ADD CONSTRAINT chk_statutes_state
  CHECK (state IN ('NY', 'NJ', 'NYC'));
