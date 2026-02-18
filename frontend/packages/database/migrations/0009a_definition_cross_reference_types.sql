-- Migration: Definition Cross-Reference Types
-- Adds two new dimensions for categorizing cross-references:
--   1. reference_completeness: 'pure_pointer' | 'hybrid'
--   2. reference_target: 'same_corpus' | 'federal' | 'external_standard' | 'other'
-- Also renames is_verbatim to is_verbatim_text_complete for clarity

-- Rename is_verbatim to is_verbatim_text_complete (guarded for idempotency)
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'definitions' AND column_name = 'is_verbatim') THEN
        ALTER TABLE definitions RENAME COLUMN is_verbatim TO is_verbatim_text_complete;
    END IF;
END $$;

-- Add cross-reference categorization columns
ALTER TABLE definitions ADD COLUMN IF NOT EXISTS reference_completeness VARCHAR(20);
ALTER TABLE definitions ADD COLUMN IF NOT EXISTS reference_target VARCHAR(30);

-- Add check constraints for valid values (guarded for idempotency)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'chk_reference_completeness') THEN
        ALTER TABLE definitions ADD CONSTRAINT chk_reference_completeness
            CHECK (reference_completeness IS NULL OR reference_completeness IN ('pure_pointer', 'hybrid'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'chk_reference_target') THEN
        ALTER TABLE definitions ADD CONSTRAINT chk_reference_target
            CHECK (reference_target IS NULL OR reference_target IN ('same_corpus', 'federal', 'external_standard', 'other'));
    END IF;
END $$;

-- Add column comments for documentation
COMMENT ON COLUMN definitions.is_verbatim_text_complete IS 'True if verbatim_text is a complete, usable definition on its own';
COMMENT ON COLUMN definitions.reference_completeness IS 'pure_pointer = no inline definition (just pointer), hybrid = has inline definition plus reference';
COMMENT ON COLUMN definitions.reference_target IS 'Where the reference points: same_corpus (NJ/NY regs), federal (CFR/USC), external_standard (industry orgs), other';
