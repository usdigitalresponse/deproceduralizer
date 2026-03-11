-- Seed agencies from NYCRR title-level documents and distinct fines values

-- Step 1: Insert canonical agencies from NYCRR title-level documents
-- Same mapping pattern as 0065_backfill_responsible_agency.sql
INSERT INTO agencies (jurisdiction, canonical_name)
SELECT DISTINCT 'NY', INITCAP(SPLIT_PART(rd.title, ' - ', 2)) AS agency_name
FROM regulatory_documents rd
WHERE rd.jurisdiction = 'NY'
  AND rd.hierarchy_level = 'title'
  AND rd.title LIKE '%-%'
  AND SPLIT_PART(rd.title, ' - ', 2) = UPPER(SPLIT_PART(rd.title, ' - ', 2))
  AND LENGTH(SPLIT_PART(rd.title, ' - ', 2)) > 5
ON CONFLICT (jurisdiction, canonical_name) DO NOTHING;

-- Step 2: Insert remaining distinct responsible_agency values from fines
-- that don't already match an existing canonical name (case-insensitive check
-- to avoid duplicates like "Department Of Health" vs "Department of Health")
INSERT INTO agencies (jurisdiction, canonical_name)
SELECT DISTINCT f.jurisdiction, f.responsible_agency
FROM fines_fees_penalties f
WHERE f.responsible_agency IS NOT NULL
  AND f.llm_confirmed = true
  AND NOT EXISTS (
    SELECT 1 FROM agencies a
    WHERE a.jurisdiction = f.jurisdiction
      AND LOWER(a.canonical_name) = LOWER(f.responsible_agency)
  )
ON CONFLICT (jurisdiction, canonical_name) DO NOTHING;

-- Step 3: Insert canonical names as their own aliases (source='canonical')
INSERT INTO agency_aliases (agency_id, alias, source)
SELECT a.id, a.canonical_name, 'canonical'
FROM agencies a
ON CONFLICT (agency_id, alias) DO NOTHING;

-- Step 4: Insert ALL-CAPS variants as aliases (source='title_map')
-- The NYCRR titles store agency names in ALL-CAPS (e.g., "DEPARTMENT OF HEALTH")
-- while canonical_name is InitCap (e.g., "Department Of Health")
INSERT INTO agency_aliases (agency_id, alias, source)
SELECT a.id, UPPER(a.canonical_name), 'title_map'
FROM agencies a
WHERE UPPER(a.canonical_name) != a.canonical_name
ON CONFLICT (agency_id, alias) DO NOTHING;

-- Step 5: Insert lowercase variants as aliases
INSERT INTO agency_aliases (agency_id, alias, source)
SELECT a.id, LOWER(a.canonical_name), 'title_map'
FROM agencies a
WHERE LOWER(a.canonical_name) != a.canonical_name
ON CONFLICT (agency_id, alias) DO NOTHING;

-- Step 6: Insert guidance document agency names as aliases where they match
-- an existing canonical agency (by case-insensitive comparison)
INSERT INTO agency_aliases (agency_id, alias, source)
SELECT DISTINCT a.id, gd.agency, 'guidance'
FROM guidance_documents gd
JOIN agencies a ON a.jurisdiction = 'NY'
  AND LOWER(a.canonical_name) = LOWER(gd.agency)
WHERE gd.agency IS NOT NULL
  AND gd.agency != a.canonical_name  -- skip if already the canonical name
ON CONFLICT (agency_id, alias) DO NOTHING;

-- Step 7: Merge case-variant duplicates (INITCAP from titles vs natural casing from LLM).
-- Keep the non-INITCAP version (natural English casing with lowercase prepositions).
-- Re-point fines, copy aliases, then delete the INITCAP duplicate.
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        WITH dups AS (
            SELECT
                LOWER(canonical_name) AS name_lower,
                array_agg(id ORDER BY id) AS ids,
                array_agg(canonical_name ORDER BY id) AS names
            FROM agencies
            GROUP BY jurisdiction, LOWER(canonical_name)
            HAVING COUNT(*) > 1
        )
        SELECT
            CASE
                WHEN names[1] != INITCAP(names[1]) THEN ids[1]
                WHEN names[2] != INITCAP(names[2]) THEN ids[2]
                ELSE ids[1]
            END AS keep_id,
            CASE
                WHEN names[1] != INITCAP(names[1]) THEN ids[2]
                WHEN names[2] != INITCAP(names[2]) THEN ids[1]
                ELSE ids[2]
            END AS remove_id
        FROM dups
    LOOP
        UPDATE fines_fees_penalties SET agency_id = r.keep_id WHERE agency_id = r.remove_id;
        INSERT INTO agency_aliases (agency_id, alias, source)
            SELECT r.keep_id, alias, source FROM agency_aliases WHERE agency_id = r.remove_id
            ON CONFLICT (agency_id, alias) DO NOTHING;
        DELETE FROM agencies WHERE id = r.remove_id;
    END LOOP;
END $$;

-- Step 8: Merge parenthetical variants — "Foo" and "Foo (bar)" are the same agency.
-- Keep the base name (shorter, without parenthetical) as canonical.
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        WITH pairs AS (
            SELECT
                CASE WHEN a2.canonical_name LIKE a1.canonical_name || ' (%' THEN a1.id ELSE a2.id END AS keep_id,
                CASE WHEN a2.canonical_name LIKE a1.canonical_name || ' (%' THEN a2.id ELSE a1.id END AS remove_id,
                CASE WHEN a2.canonical_name LIKE a1.canonical_name || ' (%' THEN a2.canonical_name ELSE a1.canonical_name END AS variant_name
            FROM agencies a1
            JOIN agencies a2 ON a1.jurisdiction = a2.jurisdiction
              AND a1.id < a2.id
              AND (
                a2.canonical_name LIKE a1.canonical_name || ' (%'
                OR a1.canonical_name LIKE a2.canonical_name || ' (%'
              )
        )
        SELECT keep_id, remove_id, variant_name FROM pairs
    LOOP
        UPDATE fines_fees_penalties SET agency_id = r.keep_id WHERE agency_id = r.remove_id;
        INSERT INTO agency_aliases (agency_id, alias, source)
        VALUES (r.keep_id, r.variant_name, 'manual')
        ON CONFLICT (agency_id, alias) DO NOTHING;
        INSERT INTO agency_aliases (agency_id, alias, source)
            SELECT r.keep_id, alias, source FROM agency_aliases WHERE agency_id = r.remove_id
            ON CONFLICT (agency_id, alias) DO NOTHING;
        DELETE FROM agencies WHERE id = r.remove_id;
    END LOOP;
END $$;
