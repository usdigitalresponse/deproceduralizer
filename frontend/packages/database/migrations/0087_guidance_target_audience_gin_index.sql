-- Add GIN index on target_audience for array overlap (&&) filter performance
CREATE INDEX IF NOT EXISTS idx_gd_target_audience
  ON guidance_documents USING GIN(target_audience);
