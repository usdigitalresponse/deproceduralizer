-- Add readability metrics to guidance_documents
-- Computed locally via textstat Python library (no LLM cost)

ALTER TABLE guidance_documents
  ADD COLUMN IF NOT EXISTS flesch_kincaid_grade real,
  ADD COLUMN IF NOT EXISTS flesch_reading_ease real,
  ADD COLUMN IF NOT EXISTS gunning_fog real,
  ADD COLUMN IF NOT EXISTS automated_readability_index real,
  ADD COLUMN IF NOT EXISTS coleman_liau_index real,
  ADD COLUMN IF NOT EXISTS smog_index real,
  ADD COLUMN IF NOT EXISTS dale_chall_readability_score real,
  ADD COLUMN IF NOT EXISTS linsear_write_formula real,
  ADD COLUMN IF NOT EXISTS reading_grade_level varchar(50),
  ADD COLUMN IF NOT EXISTS difficult_word_count integer,
  ADD COLUMN IF NOT EXISTS word_count integer,
  ADD COLUMN IF NOT EXISTS sentence_count integer;
