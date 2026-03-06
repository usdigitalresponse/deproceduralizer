-- Widen fines_fees_penalties columns that can receive long LLM-generated values
ALTER TABLE fines_fees_penalties
  ALTER COLUMN who_pays TYPE text,
  ALTER COLUMN responsible_agency TYPE text,
  ALTER COLUMN per_unit TYPE text,
  ALTER COLUMN term_matched TYPE text;
