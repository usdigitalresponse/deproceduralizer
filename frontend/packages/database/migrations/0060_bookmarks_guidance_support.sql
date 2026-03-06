-- Add guidance_document_id to bookmarks table
-- Allows bookmarking guidance documents alongside regulatory documents

ALTER TABLE bookmarks
    ADD COLUMN IF NOT EXISTS guidance_document_id BIGINT
        REFERENCES guidance_documents(id) ON DELETE CASCADE;

ALTER TABLE bookmarks ALTER COLUMN document_id DROP NOT NULL;

ALTER TABLE bookmarks ADD CONSTRAINT chk_bookmarks_one_document_source
    CHECK ((document_id IS NOT NULL)::int + (guidance_document_id IS NOT NULL)::int = 1);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bookmarks_unique_guidance_document
    ON bookmarks(guidance_document_id)
    WHERE guidance_document_id IS NOT NULL AND analysis_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_bookmarks_guidance_document
    ON bookmarks(guidance_document_id);
