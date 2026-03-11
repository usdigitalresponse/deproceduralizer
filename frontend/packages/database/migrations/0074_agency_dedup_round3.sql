-- Agency deduplication round 3: merge remaining "State X" / "NYS X" / prefix variants,
-- successor agencies (Racing→Gaming, Insurance Dept→DFS already done), and SUNY duplicates.
-- Reduces agency count from ~362 to ~335.

CREATE OR REPLACE FUNCTION merge_agency(source_id bigint, target_id bigint) RETURNS void AS $$
BEGIN
  UPDATE fines_fees_penalties SET agency_id = target_id WHERE agency_id = source_id;
  INSERT INTO agency_aliases (agency_id, alias, source)
    SELECT target_id, alias, source FROM agency_aliases WHERE agency_id = source_id
    ON CONFLICT (agency_id, alias) DO NOTHING;
  INSERT INTO agency_aliases (agency_id, alias, source)
    SELECT target_id, canonical_name, 'merge' FROM agencies WHERE id = source_id
    ON CONFLICT (agency_id, alias) DO NOTHING;
  DELETE FROM agencies WHERE id = source_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 1. State Liquor Authority (target: id 141 — 752 fines, most active)
--    "NYS Liquor Authority" = "State Liquor Authority" = "SLA"
-- ============================================================================
DO $$
BEGIN
  -- Merge 254 first (its name "State Liquor Authority" conflicts with the rename below)
  PERFORM merge_agency(254, 141);  -- State Liquor Authority (143 fines)
  -- Now safe to rename
  UPDATE agencies SET canonical_name = 'State Liquor Authority' WHERE id = 141;
  PERFORM merge_agency(121, 141);  -- SLA (State Liquor Authority) (10 fines)
END $$;

-- ============================================================================
-- 2. Education Department (target: id 22 — 878 fines)
-- ============================================================================
DO $$
BEGIN
  PERFORM merge_agency(116, 22);   -- State Education Department (17 fines)
  PERFORM merge_agency(401, 22);   -- Department of Education (15 fines)
END $$;

-- ============================================================================
-- 3. Port Authority of New York and New Jersey (target: id 420 — 45 fines)
--    NOT merging Airport Authority (217) — distinct generic/local entity
-- ============================================================================
DO $$
BEGIN
  PERFORM merge_agency(298, 420);  -- The Port Authority of New York and New Jersey (6 fines)
  PERFORM merge_agency(561, 420);  -- Port Authority (2 fines)
END $$;

-- ============================================================================
-- 4. State Commission of Correction (target: id 583 — 13 fines)
-- ============================================================================
DO $$
BEGIN
  PERFORM merge_agency(30, 583);   -- New York State Commission of Correction (1 fine)
END $$;

-- ============================================================================
-- 5. State Board of Elections (target: id 344 — 5 fines)
-- ============================================================================
DO $$
BEGIN
  PERFORM merge_agency(130, 344);  -- New York State Board of Elections (1 fine)
END $$;

-- ============================================================================
-- 6. Board of Law Examiners (target: id 56 — 7 fines)
-- ============================================================================
DO $$
BEGIN
  PERFORM merge_agency(215, 56);   -- New York Board of Law Examiners (7 fines)
END $$;

-- ============================================================================
-- 7. State Energy Office (target: id 560 — 6 fines)
-- ============================================================================
DO $$
BEGIN
  PERFORM merge_agency(573, 560);  -- New York State Energy Office (1 fine)
END $$;

-- ============================================================================
-- 8. State College for Teachers at Albany (target: id 340 — 2 fines)
-- ============================================================================
DO $$
BEGIN
  PERFORM merge_agency(209, 340);  -- State College for Teachers at Albany (1 fine)
  UPDATE agencies SET canonical_name = 'State College for Teachers at Albany' WHERE id = 340;
END $$;

-- ============================================================================
-- 9. SUNY College at Buffalo (target: id 429 — 8 fines)
--    All three refer to the same campus (now SUNY Buffalo State)
-- ============================================================================
DO $$
BEGIN
  PERFORM merge_agency(443, 429);  -- State University College at Buffalo (3 fines)
  PERFORM merge_agency(462, 429);  -- State University of New York at Buffalo (1 fine)
END $$;

-- ============================================================================
-- 10. SUNY Geneseo (target: id 263 — 7 fines)
-- ============================================================================
DO $$
BEGIN
  PERFORM merge_agency(440, 263);  -- State University College of Arts and Science at Geneseo (4 fines)
END $$;

-- ============================================================================
-- 11. Gaming Commission (target: id 62 — 522 fines)
--     Racing Commission (pre-1973) → Racing and Wagering Board → Gaming Commission (2013)
-- ============================================================================
DO $$
BEGIN
  PERFORM merge_agency(289, 62);   -- New York Racing Commission (6 fines)
  PERFORM merge_agency(133, 62);   -- New York Racing and Wagering Board (10 fines)
END $$;

-- ============================================================================
-- 12. DOCCS (target: id 262 — 57 fines)
--     Dept of Correctional Services renamed to DOCCS in 2011 (merged with Division of Parole)
-- ============================================================================
DO $$
BEGIN
  PERFORM merge_agency(155, 262);  -- Department of Correctional Services (7 fines)
  PERFORM merge_agency(399, 262);  -- Division of Parole (1 fine) — merged into DOCCS in 2011
END $$;

-- ============================================================================
-- 13. Division of Criminal Justice Services (target: id 150 — 64 fines)
--     Compound "DCJS and/or NMLSR" refs all point to DCJS
-- ============================================================================
DO $$
BEGIN
  PERFORM merge_agency(145, 150);  -- State Division of Criminal Justice Services and/or NMLSR (1 fine)
  PERFORM merge_agency(453, 150);  -- State Division of Criminal Justice Services and/or National Mortgage... (1 fine)
  PERFORM merge_agency(194, 150);  -- Criminal Justice Services and/or Nationwide Mortgage Licensing... (1 fine)
END $$;

-- ============================================================================
-- 14. State Police (target: id 131 — 19 fines)
--     Division of State Police IS the New York State Police
-- ============================================================================
DO $$
BEGIN
  PERFORM merge_agency(295, 131);  -- Division of State Police (1 fine)
END $$;

-- ============================================================================
-- 15. NMLS (target: id 167 — 1 fine)
--     All three refer to the same mortgage licensing system
-- ============================================================================
DO $$
BEGIN
  PERFORM merge_agency(146, 167);  -- Nationwide Mortgage Licensing System and Registry (NMLSR) (1 fine)
  PERFORM merge_agency(168, 167);  -- National Mortgage Licensing System and Registry (1 fine)
END $$;

-- ============================================================================
-- 16. NYC Dept of Environmental Protection (target: id 218 — 5 fines)
--     "Department of Environmental Protection" in NY context = NYC DEP
-- ============================================================================
DO $$
BEGIN
  PERFORM merge_agency(332, 218);  -- Department of Environmental Protection (1 fine)
END $$;

-- ============================================================================
-- 17. State teachers colleges (target: id 147 — 4 fines)
-- ============================================================================
DO $$
BEGIN
  PERFORM merge_agency(581, 147);  -- New York State College for Teachers at Buffalo and State teachers colleges (2 fines)
END $$;

-- ============================================================================
-- 18. Renames (no merges, just fix verbose "New York State" prefixes)
-- ============================================================================

-- "New York State Board of Parole" → "Board of Parole"
UPDATE agencies SET canonical_name = 'Board of Parole' WHERE id = 361;
INSERT INTO agency_aliases (agency_id, alias, source)
  VALUES (361, 'New York State Board of Parole', 'merge')
  ON CONFLICT (agency_id, alias) DO NOTHING;

-- ============================================================================
-- Cleanup
-- ============================================================================
DROP FUNCTION merge_agency(bigint, bigint);
