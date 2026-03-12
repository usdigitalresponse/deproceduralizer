-- Add jurisdiction_level and issuing_entity_confidence to fines_fees_penalties
-- See: https://github.com/michaeleboyce/deproceduralizer/issues/261

ALTER TABLE fines_fees_penalties
  ADD COLUMN IF NOT EXISTS jurisdiction_level varchar(20),
  ADD COLUMN IF NOT EXISTS jurisdiction_level_other text,
  ADD COLUMN IF NOT EXISTS issuing_entity_confidence numeric(3, 2);

-- Constrain jurisdiction_level to known values
ALTER TABLE fines_fees_penalties
  ADD CONSTRAINT chk_fines_jurisdiction_level
  CHECK (jurisdiction_level IS NULL OR jurisdiction_level IN ('federal', 'state', 'county', 'local', 'other'));

-- Constrain confidence to 0.0-1.0
ALTER TABLE fines_fees_penalties
  ADD CONSTRAINT chk_fines_entity_confidence
  CHECK (issuing_entity_confidence IS NULL OR (issuing_entity_confidence >= 0 AND issuing_entity_confidence <= 1));
