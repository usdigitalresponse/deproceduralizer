-- Migration: Definition Cross-Reference Types
-- Adds two new dimensions for categorizing cross-references:
--   1. reference_completeness: 'pure_pointer' | 'hybrid'
--   2. reference_target: 'same_corpus' | 'federal' | 'external_standard' | 'other'
-- Also renames is_verbatim to is_verbatim_text_complete for clarity

-- Rename is_verbatim to is_verbatim_text_complete
ALTER TABLE definitions RENAME COLUMN is_verbatim TO is_verbatim_text_complete;

-- Add cross-reference categorization columns
ALTER TABLE definitions ADD COLUMN reference_completeness VARCHAR(20);
ALTER TABLE definitions ADD COLUMN reference_target VARCHAR(30);

-- Add check constraints for valid values
ALTER TABLE definitions ADD CONSTRAINT chk_reference_completeness
  CHECK (reference_completeness IS NULL OR reference_completeness IN ('pure_pointer', 'hybrid'));

ALTER TABLE definitions ADD CONSTRAINT chk_reference_target
  CHECK (reference_target IS NULL OR reference_target IN ('same_corpus', 'federal', 'external_standard', 'other'));

-- Add column comments for documentation
COMMENT ON COLUMN definitions.is_verbatim_text_complete IS 'True if verbatim_text is a complete, usable definition on its own';
COMMENT ON COLUMN definitions.reference_completeness IS 'pure_pointer = no inline definition (just pointer), hybrid = has inline definition plus reference';
COMMENT ON COLUMN definitions.reference_target IS 'Where the reference points: same_corpus (NJ/NY regs), federal (CFR/USC), external_standard (industry orgs), other';
