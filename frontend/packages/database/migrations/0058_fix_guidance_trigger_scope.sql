-- Fix guidance_documents trigger to fire on ANY update, not just title/content.
--
-- The original trigger (0054) only fires on UPDATE OF title, content, which means
-- updated_at is not refreshed when other columns change (status, agency, etc.).
--
-- This replacement trigger fires on all updates but only recomputes search_vector
-- when title or content actually changed.

DROP TRIGGER IF EXISTS trig_gd_search ON guidance_documents;

CREATE OR REPLACE FUNCTION guidance_documents_search_trigger() RETURNS trigger AS $$
BEGIN
    NEW.updated_at := NOW();

    -- Only recompute search_vector if title or content changed (or on INSERT)
    IF TG_OP = 'INSERT'
       OR NEW.title IS DISTINCT FROM OLD.title
       OR NEW.content IS DISTINCT FROM OLD.content THEN
        NEW.search_vector := setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
                              setweight(to_tsvector('english', COALESCE(NEW.content, '')), 'C');
    END IF;

    RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trig_gd_search
    BEFORE INSERT OR UPDATE ON guidance_documents
    FOR EACH ROW EXECUTE FUNCTION guidance_documents_search_trigger();
