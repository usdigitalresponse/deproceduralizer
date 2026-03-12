-- Enrich guidance audience classification (#281)
-- Adds direction (public/gov), expertise level (lay/specialized), and explanation text.
-- Expands on the existing target_audience array from the guidance summarization pipeline.

ALTER TABLE guidance_documents
  ADD COLUMN IF NOT EXISTS audience_direction varchar(20),
  ADD COLUMN IF NOT EXISTS audience_expertise varchar(20),
  ADD COLUMN IF NOT EXISTS audience_explanation text;
