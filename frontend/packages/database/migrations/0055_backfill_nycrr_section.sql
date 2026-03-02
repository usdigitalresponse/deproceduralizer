-- Migration: 0055_backfill_nycrr_section
-- Purpose: Backfill nycrr_section from hierarchy_path for NY regulation documents
--
-- Root cause: 21,102 out of 61,620 NY regulation docs (34%) have NULL nycrr_section.
-- The section number IS present in hierarchy_path (e.g., "§§ 360-3.2 - Conditions of eligibility")
-- but was never extracted into the structured nycrr_section column during ingestion.
--
-- This affects cross-reference resolution: guidance→regulation citations like "18 NYCRR 360-4.8"
-- fail to resolve because the resolver looks up nycrr_section which is NULL.
-- Also affects 5,540 existing reg→reg cross-references targeting NULL-section docs.
--
-- Regex: §+\s*([\d][\d.-]*) extracts section from patterns like:
--   "§§ 360-3.2 - Conditions" → "360-3.2"
--   "§§ 86-2.37 - Submission" → "86-2.37"
--   "§§ 69-4.23 - Eligibility" → "69-4.23"
-- Uses [\d.-] instead of [\d\w-] to avoid over-matching letters (e.g., "360-Appendix").
--
-- Batched: processes ~2000 rows per iteration to reduce WAL pressure.

DO $$
DECLARE
  _rows_affected INT;
  _total INT := 0;
BEGIN
  LOOP
    UPDATE regulatory_documents
    SET nycrr_section = (regexp_match(hierarchy_path, '§+\s*([\d][\d\-.]*)') )[1]
    WHERE id IN (
      SELECT id FROM regulatory_documents
      WHERE state = 'NY'
        AND type = 'regulation'
        AND nycrr_section IS NULL
        AND hierarchy_path ~ '§'
      LIMIT 2000
    );

    GET DIAGNOSTICS _rows_affected = ROW_COUNT;
    _total := _total + _rows_affected;
    RAISE NOTICE 'Backfilled batch: % rows (total so far: %)', _rows_affected, _total;

    EXIT WHEN _rows_affected = 0;
  END LOOP;

  RAISE NOTICE 'Backfill complete: % rows updated', _total;
END $$;
