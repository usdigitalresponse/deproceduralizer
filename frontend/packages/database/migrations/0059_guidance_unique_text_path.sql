-- Prevent duplicate guidance_documents rows for the same text_path.
-- The OCFS-new import used Python's non-deterministic hash() for catalog_id,
-- causing each run to create new rows instead of upserting. This unique index
-- ensures that even if catalog_id varies, text_path remains unique.
--
-- Run dedup_guidance.py BEFORE applying this migration to clean existing dupes.

CREATE UNIQUE INDEX IF NOT EXISTS idx_gd_text_path
  ON guidance_documents(text_path)
  WHERE text_path IS NOT NULL;
