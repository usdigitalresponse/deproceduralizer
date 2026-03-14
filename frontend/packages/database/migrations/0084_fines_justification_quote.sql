-- Add justification_quote column for verbatim regulation text supporting the justification
ALTER TABLE fines_fees_penalties
  ADD COLUMN IF NOT EXISTS justification_quote text;
