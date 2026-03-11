-- Deep agency deduplication: curated merges for major clusters, capitalization fixes, garbage cleanup
-- Phase 2 of agency normalization (Phase 1: 0068-0070 created tables + automated dedup)

-- ============================================================================
-- Helper function: merge one agency into another
-- ============================================================================
CREATE OR REPLACE FUNCTION merge_agency(source_id bigint, target_id bigint) RETURNS void AS $$
BEGIN
  -- Move fines from source to target
  UPDATE fines_fees_penalties SET agency_id = target_id WHERE agency_id = source_id;
  -- Move aliases (skip conflicts)
  INSERT INTO agency_aliases (agency_id, alias, source)
    SELECT target_id, alias, source FROM agency_aliases WHERE agency_id = source_id
    ON CONFLICT (agency_id, alias) DO NOTHING;
  -- Add source canonical_name as alias of target
  INSERT INTO agency_aliases (agency_id, alias, source)
    SELECT target_id, canonical_name, 'merge' FROM agencies WHERE id = source_id
    ON CONFLICT (agency_id, alias) DO NOTHING;
  -- Delete source
  DELETE FROM agencies WHERE id = source_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 1. Attorney General cluster → id 423
-- ============================================================================
DO $$
BEGIN
  -- Rename target to shorter canonical form
  UPDATE agencies SET canonical_name = 'Attorney General' WHERE id = 423;

  -- Merge variants
  PERFORM merge_agency(53, 423);   -- New York State Department of Law, Office of the Attorney General
  PERFORM merge_agency(118, 423);  -- Attorney General of the State of New York
  PERFORM merge_agency(256, 423);  -- New York Attorney General, Charities Bureau
  PERFORM merge_agency(300, 423);  -- New York Attorney General's Charities Bureau
  PERFORM merge_agency(305, 423);  -- ...Charities Bureau Registration Section
  PERFORM merge_agency(345, 423);  -- ...Office of Economic Justice Investor Protection Bureau
  PERFORM merge_agency(456, 423);  -- NY Dept Housing Preservation and Development / NY Attorney General
  PERFORM merge_agency(557, 423);  -- Attorney General of New York
END $$;

-- ============================================================================
-- 2. Tax cluster → id 271 (Department of Taxation and Finance)
-- ============================================================================
DO $$
BEGIN
  PERFORM merge_agency(83, 271);   -- Department of Tax and Finance
  PERFORM merge_agency(199, 271);  -- New York Department of Tax
  PERFORM merge_agency(317, 271);  -- Tax Department
  PERFORM merge_agency(368, 271);  -- TAX
  PERFORM merge_agency(503, 271);  -- Department of Taxation
  PERFORM merge_agency(540, 271);  -- Tax Department of New York
  PERFORM merge_agency(367, 271);  -- Tax Department of New York State
END $$;

-- Tax Commission sub-cluster → id 76 (distinct historical entity)
DO $$
BEGIN
  PERFORM merge_agency(46, 76);    -- State Tax Commission
  PERFORM merge_agency(232, 76);   -- Tax Commission of the State of New York
END $$;

-- ============================================================================
-- 3. Banking / Financial Services cluster → id 103
-- ============================================================================
DO $$
BEGIN
  -- Merge 107 first (its canonical_name is "Department of Financial Services" which
  -- conflicts with the rename below if it still exists as a separate agency)
  PERFORM merge_agency(107, 103);  -- Department of Financial Services

  -- Now safe to rename target to shorter canonical form
  UPDATE agencies SET canonical_name = 'Department of Financial Services' WHERE id = 103;

  PERFORM merge_agency(2, 103);    -- Banking
  PERFORM merge_agency(24, 103);   -- Financial Services
  PERFORM merge_agency(94, 103);   -- NY DFS - Banking Division
  PERFORM merge_agency(102, 103);  -- Banking Department
  PERFORM merge_agency(134, 103);  -- Department of Banking
  PERFORM merge_agency(251, 103);  -- Banking Department of New York

  -- Delete 0-fine title artifacts (no fines, just noise from NYCRR title parsing)
  DELETE FROM agency_aliases WHERE agency_id IN (11, 12);
  DELETE FROM agencies WHERE id IN (11, 12);
END $$;

-- ============================================================================
-- 4. OTDA cluster → id 50 (Office of Temporary and Disability Assistance)
-- ============================================================================
DO $$
BEGIN
  PERFORM merge_agency(278, 50);   -- OTDA
  PERFORM merge_agency(326, 50);   -- NY State Dept of Temporary and Disability Services (OTDA)
  PERFORM merge_agency(369, 50);   -- Office of the Temporary and Disability Assistance
  PERFORM merge_agency(396, 50);   -- NY Dept Social Services / Office of TDA
  PERFORM merge_agency(451, 50);   -- NY Dept of Temporary and Disability Assistance
END $$;

-- ============================================================================
-- 5. Single-acronym merges
-- ============================================================================
DO $$
BEGIN
  PERFORM merge_agency(303, 400);  -- OCFS → Office of Children and Family Services
  PERFORM merge_agency(257, 262);  -- DOCCS → Dept of Corrections and Community Supervision
  PERFORM merge_agency(277, 47);   -- Centers for Medicare & Medicaid Services (CMS) → CMS
END $$;

-- ============================================================================
-- 6. State-level Health cluster → id 355 (Department of Health)
-- ============================================================================
DO $$
BEGIN
  PERFORM merge_agency(38, 355);   -- State Board of Health
  PERFORM merge_agency(40, 355);   -- State Commissioner of Health
  PERFORM merge_agency(273, 355);  -- State Department of Health
  PERFORM merge_agency(299, 355);  -- State of New York Department of Health
END $$;

-- ============================================================================
-- 7. U.S. HHS cluster → id 140
-- ============================================================================
DO $$
BEGIN
  PERFORM merge_agency(112, 140);  -- U.S. DHHS Administration for Children and Families
  PERFORM merge_agency(182, 140);  -- Department of Health and Human Services
  PERFORM merge_agency(314, 140);  -- United States Department of Health and Human Services
END $$;

-- Office of Child Support Enforcement variants → merge with each other, keep separate from HHS
DO $$
BEGIN
  PERFORM merge_agency(231, 382);  -- USDHHS, OCSE (long) → USDHHS, OCSE (short id 382)
END $$;

-- ============================================================================
-- 8. NYC Health cluster → id 57
-- ============================================================================
DO $$
BEGIN
  PERFORM merge_agency(237, 57);   -- Department of Health and Mental Hygiene
  PERFORM merge_agency(532, 57);   -- New York City Department of Health
  PERFORM merge_agency(597, 57);   -- NYC Department of Health and Mental Hygiene
END $$;

-- ============================================================================
-- 9. Appellate Division cluster → id 342
-- ============================================================================
DO $$
BEGIN
  PERFORM merge_agency(543, 342);  -- Appellate Division of the Supreme Court of the State of NY
END $$;

-- ============================================================================
-- 10. Vague / generic entries → merge into <UNKNOWN> (id 374)
-- ============================================================================
DO $$
BEGIN
  PERFORM merge_agency(1, 374);    -- Appendices (not an agency)
  PERFORM merge_agency(26, 374);   -- Insurance (too vague, 0 fines)
  PERFORM merge_agency(55, 374);   -- authorized agency
  PERFORM merge_agency(234, 374);  -- County
  PERFORM merge_agency(241, 374);  -- hospital
  PERFORM merge_agency(312, 374);  -- inspection station
  PERFORM merge_agency(386, 374);  -- Authority
  PERFORM merge_agency(455, 374);  -- New York City (too vague)
  PERFORM merge_agency(458, 374);  -- the corporation
  PERFORM merge_agency(468, 374);  -- trust
  PERFORM merge_agency(538, 374);  -- Court
  PERFORM merge_agency(553, 374);  -- State of New York (too vague)
  PERFORM merge_agency(587, 374);  -- New York State (too vague)
END $$;

-- ============================================================================
-- 11. Capitalization fixes — lowercase entries that survived previous merges
-- ============================================================================

-- Simple INITCAP for entries that don't have tricky prepositions
UPDATE agencies SET canonical_name = 'Airport Authority' WHERE id = 217;
UPDATE agencies SET canonical_name = 'Water Board' WHERE id = 539;
UPDATE agencies SET canonical_name = 'Social Services District' WHERE id = 60;
UPDATE agencies SET canonical_name = 'Transit Supervisor, Superintendent or Manager' WHERE id = 149;
UPDATE agencies SET canonical_name = 'Permit-Issuing Official' WHERE id = 44;

-- Longer descriptive entries — capitalize first letter, keep natural English casing
UPDATE agencies SET canonical_name = 'County or part-county health officer or certified radiation equipment safety officer' WHERE id = 74;
UPDATE agencies SET canonical_name = 'Local government offices authorized by delegation' WHERE id = 75;
UPDATE agencies SET canonical_name = 'County, part-county, or city health department or local health officer' WHERE id = 363;
UPDATE agencies SET canonical_name = 'Criminal court of the jurisdiction where the violation occurs' WHERE id = 570;

-- Fix INITCAP artifacts from seed migration (prepositions should be lowercase)
-- These have "Of" / "And" that should be "of" / "and"
UPDATE agencies SET canonical_name = 'Division of the Budget' WHERE id = 119;
UPDATE agencies SET canonical_name = 'Division of Probation and Correctional Alternatives' WHERE id = 136;
UPDATE agencies SET canonical_name = 'Division of Alcoholic Beverage Control' WHERE id = 360;
UPDATE agencies SET canonical_name = 'Division of Parole' WHERE id = 399;
UPDATE agencies SET canonical_name = 'City of Yonkers Income Tax Surcharge on Residents and Earnings Tax on Nonresidents' WHERE id = 3;

-- ============================================================================
-- 12. Cleanup
-- ============================================================================
DROP FUNCTION merge_agency(bigint, bigint);
