-- Deeper agency deduplication: merge ~30 "New York (State) Department of X" variants
-- and sub-office patterns ("Dept of X, Office of Y") into parent departments.
-- Preserves specific office names as aliases. Reduces agency count from ~400 to ~370.

-- Re-create merge helper (dropped in 0071)
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
-- 1. Department of Health (target: id 355)
-- ============================================================================
DO $$
BEGIN
  PERFORM merge_agency(125, 355);  -- New York Department of Health or local health department (1 fine)
  PERFORM merge_agency(467, 355);  -- New York Department of Health and Superintendent of Insurance (1 fine)
  PERFORM merge_agency(187, 355);  -- New York State Department of Health, Office of Medicaid Management (2 fines)
  PERFORM merge_agency(195, 355);  -- New York State Department of Health / Division of Criminal Justice Services (1 fine)
  PERFORM merge_agency(210, 355);  -- New York State Department of Health, Office of Vital Records (2 fines)
END $$;

-- ============================================================================
-- 2. Department of Housing and Community Renewal (target: id 446)
--    Division of HCR is the same entity (renamed over time)
-- ============================================================================
DO $$
BEGIN
  PERFORM merge_agency(437, 446);  -- New York Department of Housing and Community Renewal (DHCR) (3 fines)
  PERFORM merge_agency(348, 446);  -- New York Division of Housing and Community Renewal (DHCR) (2 fines)
  PERFORM merge_agency(404, 446);  -- Division of Housing and Community Renewal (152 fines)
  PERFORM merge_agency(371, 446);  -- Division of Housing and Community Renewal Office of Rent Administration (1 fine)
END $$;

-- ============================================================================
-- 3. Department of Social Services (target: id 101)
-- ============================================================================
DO $$
BEGIN
  PERFORM merge_agency(258, 101);  -- New York Department of Social Services / OTDA (1 fine)
  PERFORM merge_agency(379, 101);  -- New York State Department of Social Services, Division of Medical Assistance (4 fines)
END $$;

-- ============================================================================
-- 4. OTDA (target: id 50) — sub-office merge
-- ============================================================================
DO $$
BEGIN
  PERFORM merge_agency(214, 50);   -- Office of Human Resource Development, OTDA (1 fine)
END $$;

-- ============================================================================
-- 5. Department of Law (target: id 197)
-- ============================================================================
DO $$
BEGIN
  PERFORM merge_agency(311, 197);  -- Department of Law of the State of New York (6 fines)
  PERFORM merge_agency(351, 197);  -- Department of Law, Charities Bureau (13 fines)
  PERFORM merge_agency(337, 197);  -- New York Department of Law, Real Estate Finance Bureau (1 fine)
END $$;

-- ============================================================================
-- 6. Department of State (target: id 381)
-- ============================================================================
DO $$
BEGIN
  PERFORM merge_agency(568, 381);  -- Department of State, Division of Corporations (1 fine)
  PERFORM merge_agency(580, 381);  -- New York State Department of State - Division of Commercial Operations (18 fines)
  PERFORM merge_agency(541, 381);  -- New York State Department of State - Division of Licensing Services (2 fines)
END $$;

-- ============================================================================
-- 7. Department of Mental Hygiene (target: id 89)
-- ============================================================================
DO $$
BEGIN
  PERFORM merge_agency(246, 89);   -- Department of Mental Hygiene - Office of Mental Health (1 fine)
END $$;

-- ============================================================================
-- 8. Department of Motor Vehicles (target: id 41)
-- ============================================================================
DO $$
BEGIN
  PERFORM merge_agency(249, 41);   -- Department of Motor Vehicles, State of New York (1 fine)
END $$;

-- ============================================================================
-- 9. Department of Labor (target: id 190)
--    Compound ref "NY Dept of Labor - Workers' Comp Board" → merge into Labor
-- ============================================================================
DO $$
BEGIN
  PERFORM merge_agency(551, 190);  -- New York Department of Labor - Workers' Compensation Board (1 fine)
END $$;

-- ============================================================================
-- 10. Office of General Services (target: id 264)
-- ============================================================================
DO $$
BEGIN
  PERFORM merge_agency(536, 264);  -- New York State Office of General Services Bureau of Parking Services (2 fines)
END $$;

-- ============================================================================
-- 11. Insurance → Department of Financial Services (target: id 103)
--     DFS absorbed the Insurance Department in 2011
-- ============================================================================
DO $$
BEGIN
  PERFORM merge_agency(425, 103);  -- Department of Insurance (1 fine)
  PERFORM merge_agency(186, 103);  -- New York State Insurance Department (5 fines)
END $$;

-- ============================================================================
-- 12. Cannabis → Office of Cannabis Management (target: id 173)
--     OCM is the actual regulatory/enforcement body
--     Cannabis Control Board (436) and Liquor & Cannabis Board (184) kept separate
-- ============================================================================
DO $$
BEGIN
  PERFORM merge_agency(108, 173);  -- New York Department of Cannabis Control (4 fines)
  PERFORM merge_agency(501, 173);  -- New York Department of Cannabis Management (4 fines)
END $$;

-- ============================================================================
-- 13. Liquor Authority (target: id 254 — State Liquor Authority)
-- ============================================================================
DO $$
BEGIN
  PERFORM merge_agency(302, 254);  -- State of New York Liquor Authority (2 fines)
END $$;

-- ============================================================================
-- 14. Judiciary cluster
-- ============================================================================
DO $$
BEGIN
  -- → Judiciary (id 27)
  PERFORM merge_agency(178, 27);   -- Courts of the State of New York (3 fines)
  PERFORM merge_agency(185, 27);   -- Judiciary of New York (7 fines)

  -- → Clerk of the Court (id 170)
  PERFORM merge_agency(515, 170);  -- New York Judiciary - Clerk of the Court (5 fines)
  PERFORM merge_agency(464, 170);  -- New York State Unified Court System Clerk of the Court (2 fines)

  -- → Supreme Court (id 356)
  PERFORM merge_agency(534, 356);  -- New York Unified Court System - Supreme Court (2 fines)
END $$;

-- ============================================================================
-- 15. Appellate Division (target: id 342)
--     Merge specific-department variants into generic Appellate Division
-- ============================================================================
DO $$
BEGIN
  PERFORM merge_agency(479, 342);  -- Appellate Division, First Judicial Department (6 fines)
  PERFORM merge_agency(32, 342);   -- Appellate Division, Fourth Department (16 fines)
  PERFORM merge_agency(471, 342);  -- Third Judicial Department, Appellate Division (3 fines)
END $$;

-- ============================================================================
-- 16. Individual Onsite Water Supply Systems (target: id 25)
--     id 25 has 0 fines itself but is the canonical base name
-- ============================================================================
DO $$
BEGIN
  PERFORM merge_agency(212, 25);   -- Individual Onsite Water Supply Systems - Statewide Water Quality Standards (19 fines)
  PERFORM merge_agency(319, 25);   -- Individual Onsite Water Supply Systems - Statewide Water Quality Standards / Department of Health (1 fine)
END $$;

-- ============================================================================
-- 17. Renames — fix verbose names (no merges, just shorten)
-- ============================================================================

-- "New York State Division of State Police" → "Division of State Police"
UPDATE agencies SET canonical_name = 'Division of State Police' WHERE id = 295;
INSERT INTO agency_aliases (agency_id, alias, source)
  VALUES (295, 'New York State Division of State Police', 'merge')
  ON CONFLICT (agency_id, alias) DO NOTHING;

-- "New York State Office of the State Comptroller" → "Office of the State Comptroller"
UPDATE agencies SET canonical_name = 'Office of the State Comptroller' WHERE id = 582;
INSERT INTO agency_aliases (agency_id, alias, source)
  VALUES (582, 'New York State Office of the State Comptroller', 'merge')
  ON CONFLICT (agency_id, alias) DO NOTHING;

-- "Department of State Commission on Ethics and Lobbying in Government" (id 61) → merge into
-- "Commission on Ethics and Lobbying in Government" (id 350) — same entity, verbose variant
DO $$
BEGIN
  PERFORM merge_agency(61, 350);
END $$;

-- "Office of Administrative Trials and Hearings/Environmental Control Board" → "Office of Administrative Trials and Hearings"
UPDATE agencies SET canonical_name = 'Office of Administrative Trials and Hearings' WHERE id = 124;
INSERT INTO agency_aliases (agency_id, alias, source)
  VALUES (124, 'Office of Administrative Trials and Hearings/Environmental Control Board', 'merge')
  ON CONFLICT (agency_id, alias) DO NOTHING;

-- ============================================================================
-- Cleanup
-- ============================================================================
DROP FUNCTION merge_agency(bigint, bigint);
