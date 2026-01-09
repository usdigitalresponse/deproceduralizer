-- Migration: Populate display columns from hierarchy_path
-- See backend/config/short_title_extraction.json for extraction rules documentation
--
-- IMPORTANT: All extraction uses ONLY hierarchy_path - no state-specific fields
-- This keeps the logic state-agnostic and derivable from the breadcrumb

-- Helper: Get last element of hierarchy_path (the current document's breadcrumb)
-- Example: "LII > State Regs > ... > N.Y. Comp. Codes R. & Regs. Tit. 1 § 22.30 - Basis"
--       -> "N.Y. Comp. Codes R. & Regs. Tit. 1 § 22.30 - Basis"

-- =============================================================================
-- POPULATE short_title
-- =============================================================================
-- Rules (in priority order):
-- 1. has_dash: Extract text after ' - '
-- 2. nj_admin_no_dash: Extract text after last comma (for appendixes)
-- 3. ny_comp_no_dash: Extract text after last comma (for appendixes)
-- 4. plain_name: Use as-is

UPDATE regulatory_documents
SET short_title = (
  WITH last_crumb AS (
    SELECT SPLIT_PART(hierarchy_path, ' > ', array_length(string_to_array(hierarchy_path, ' > '), 1)) AS val
  )
  SELECT
    CASE
      -- Rule 1: Has ' - ' delimiter -> extract after it
      WHEN (SELECT val FROM last_crumb) LIKE '% - %'
      THEN TRIM(SUBSTRING(
        (SELECT val FROM last_crumb)
        FROM POSITION(' - ' IN (SELECT val FROM last_crumb)) + 3
      ))
      -- Rule 2: NJ Admin citation without dash -> after last comma
      WHEN (SELECT val FROM last_crumb) LIKE 'N.J. Admin%'
      THEN TRIM(REVERSE(SPLIT_PART(REVERSE((SELECT val FROM last_crumb)), ',', 1)))
      -- Rule 3: NY Comp citation without dash -> after last comma
      WHEN (SELECT val FROM last_crumb) LIKE 'N.Y. Comp%'
      THEN TRIM(REVERSE(SPLIT_PART(REVERSE((SELECT val FROM last_crumb)), ',', 1)))
      -- Rule 4: Plain name -> use as-is
      ELSE (SELECT val FROM last_crumb)
    END
)
WHERE hierarchy_path IS NOT NULL;

-- =============================================================================
-- POPULATE level_identifier
-- =============================================================================
-- Rules:
-- 1. NY/NJ with § symbol: Extract between '§ ' and ' - '
-- 2. Part X: Extract between 'Part ' and ' - '
-- 3. Subchapter X: Extract between 'Subchapter ' and ' - '
-- 4. Title X: Extract between 'Title ' and ' - '
-- 5. Chapter X: Extract between 'Chapter ' and ' - '

UPDATE regulatory_documents
SET level_identifier = (
  WITH last_crumb AS (
    SELECT SPLIT_PART(hierarchy_path, ' > ', array_length(string_to_array(hierarchy_path, ' > '), 1)) AS val
  )
  SELECT
    CASE
      -- Has § symbol: extract between '§ ' and ' - ' (or end)
      WHEN (SELECT val FROM last_crumb) LIKE '%§%'
      THEN TRIM(
        CASE
          WHEN (SELECT val FROM last_crumb) LIKE '%§% - %'
          THEN SUBSTRING(
            (SELECT val FROM last_crumb)
            FROM POSITION('§ ' IN (SELECT val FROM last_crumb)) + 2
            FOR POSITION(' - ' IN SUBSTRING((SELECT val FROM last_crumb) FROM POSITION('§ ' IN (SELECT val FROM last_crumb)))) - 2
          )
          ELSE SUBSTRING((SELECT val FROM last_crumb) FROM POSITION('§ ' IN (SELECT val FROM last_crumb)) + 2)
        END
      )
      -- Part X - Name
      WHEN (SELECT val FROM last_crumb) LIKE 'Part %'
      THEN TRIM(
        CASE
          WHEN (SELECT val FROM last_crumb) LIKE 'Part % - %'
          THEN SUBSTRING((SELECT val FROM last_crumb) FROM 6 FOR POSITION(' - ' IN (SELECT val FROM last_crumb)) - 6)
          ELSE SUBSTRING((SELECT val FROM last_crumb) FROM 6)
        END
      )
      -- Subchapter X - Name
      WHEN (SELECT val FROM last_crumb) LIKE 'Subchapter %'
      THEN TRIM(
        CASE
          WHEN (SELECT val FROM last_crumb) LIKE 'Subchapter % - %'
          THEN SUBSTRING((SELECT val FROM last_crumb) FROM 12 FOR POSITION(' - ' IN (SELECT val FROM last_crumb)) - 12)
          ELSE SUBSTRING((SELECT val FROM last_crumb) FROM 12)
        END
      )
      -- Title X - Name
      WHEN (SELECT val FROM last_crumb) LIKE 'Title %'
      THEN TRIM(
        CASE
          WHEN (SELECT val FROM last_crumb) LIKE 'Title % - %'
          THEN SUBSTRING((SELECT val FROM last_crumb) FROM 7 FOR POSITION(' - ' IN (SELECT val FROM last_crumb)) - 7)
          ELSE SUBSTRING((SELECT val FROM last_crumb) FROM 7)
        END
      )
      -- Chapter X - Name
      WHEN (SELECT val FROM last_crumb) LIKE 'Chapter %'
      THEN TRIM(
        CASE
          WHEN (SELECT val FROM last_crumb) LIKE 'Chapter % - %'
          THEN SUBSTRING((SELECT val FROM last_crumb) FROM 9 FOR POSITION(' - ' IN (SELECT val FROM last_crumb)) - 9)
          ELSE SUBSTRING((SELECT val FROM last_crumb) FROM 9)
        END
      )
      ELSE NULL
    END
)
WHERE hierarchy_path IS NOT NULL;

-- =============================================================================
-- POPULATE citation
-- =============================================================================
-- Rules:
-- 1. NY with Tit. and §: "{title_num} NYCRR {section_num}"
-- 2. NJ with §: "N.J.A.C. {citation}"

UPDATE regulatory_documents
SET citation = (
  WITH last_crumb AS (
    SELECT SPLIT_PART(hierarchy_path, ' > ', array_length(string_to_array(hierarchy_path, ' > '), 1)) AS val
  )
  SELECT
    CASE
      -- NY section: "N.Y. Comp. Codes R. & Regs. Tit. 10 § 154.4 - Village"
      -- -> "10 NYCRR 154.4"
      WHEN (SELECT val FROM last_crumb) ~ 'N\.Y\. Comp.*[Tt]it\.?\s*\d+.*§'
      THEN (
        -- Extract title number (after Tit. or tit.)
        REGEXP_REPLACE(
          SUBSTRING((SELECT val FROM last_crumb) FROM '[Tt]it\.?\s*(\d+)'),
          '[Tt]it\.?\s*', ''
        )
        || ' NYCRR ' ||
        -- Extract section (between § and ' - ')
        TRIM(
          CASE
            WHEN (SELECT val FROM last_crumb) LIKE '%§% - %'
            THEN SUBSTRING(
              (SELECT val FROM last_crumb)
              FROM POSITION('§ ' IN (SELECT val FROM last_crumb)) + 2
              FOR POSITION(' - ' IN SUBSTRING((SELECT val FROM last_crumb) FROM POSITION('§ ' IN (SELECT val FROM last_crumb)))) - 2
            )
            ELSE SUBSTRING((SELECT val FROM last_crumb) FROM POSITION('§ ' IN (SELECT val FROM last_crumb)) + 2)
          END
        )
      )
      -- NJ section: "N.J. Admin. Code § 8:43D-4.6 - Written"
      -- -> "N.J.A.C. 8:43D-4.6"
      WHEN (SELECT val FROM last_crumb) LIKE 'N.J. Admin%§%'
      THEN 'N.J.A.C. ' || TRIM(
        CASE
          WHEN (SELECT val FROM last_crumb) LIKE '%§% - %'
          THEN SUBSTRING(
            (SELECT val FROM last_crumb)
            FROM POSITION('§ ' IN (SELECT val FROM last_crumb)) + 2
            FOR POSITION(' - ' IN SUBSTRING((SELECT val FROM last_crumb) FROM POSITION('§ ' IN (SELECT val FROM last_crumb)))) - 2
          )
          ELSE SUBSTRING((SELECT val FROM last_crumb) FROM POSITION('§ ' IN (SELECT val FROM last_crumb)) + 2)
        END
      )
      ELSE NULL
    END
)
WHERE hierarchy_path IS NOT NULL;
