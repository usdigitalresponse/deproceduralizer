-- Add summarization columns to guidance_documents
-- See: https://github.com/michaeleboyce/deproceduralizer/issues/273

ALTER TABLE guidance_documents
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS section_type varchar(50),
  ADD COLUMN IF NOT EXISTS keywords text[],
  ADD COLUMN IF NOT EXISTS applies_to text[],
  ADD COLUMN IF NOT EXISTS has_form boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_ibr boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS target_audience text[],
  ADD COLUMN IF NOT EXISTS is_application boolean;
