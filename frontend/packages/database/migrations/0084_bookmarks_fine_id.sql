-- Add fine_id to bookmarks table for bookmarking individual fines/fees/penalties
ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS fine_id BIGINT
    REFERENCES fines_fees_penalties(id) ON DELETE CASCADE;

-- Drop old CHECK and replace with one that allows fine_id
ALTER TABLE bookmarks DROP CONSTRAINT IF EXISTS chk_bookmarks_one_document_source;
ALTER TABLE bookmarks ADD CONSTRAINT chk_bookmarks_source_type CHECK (
    (fine_id IS NOT NULL AND document_id IS NULL AND guidance_document_id IS NULL)
    OR
    (fine_id IS NULL AND (document_id IS NOT NULL OR guidance_document_id IS NOT NULL))
);

-- Unique index: one bookmark per fine
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookmarks_unique_fine
    ON bookmarks(fine_id) WHERE fine_id IS NOT NULL;

-- Lookup index
CREATE INDEX IF NOT EXISTS idx_bookmarks_fine ON bookmarks(fine_id);
