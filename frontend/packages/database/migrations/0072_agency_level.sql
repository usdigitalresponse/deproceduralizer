-- Add government level classification to agencies
-- Values: federal, state, county, city, village, town, authority, judiciary, generic

ALTER TABLE agencies ADD COLUMN IF NOT EXISTS level varchar(20);

ALTER TABLE agencies ADD CONSTRAINT chk_agencies_level
  CHECK (level IS NULL OR level IN (
    'federal', 'state', 'county', 'city', 'village', 'town', 'authority', 'judiciary', 'generic'
  ));

CREATE INDEX idx_agencies_level ON agencies(level) WHERE level IS NOT NULL;

-- ============================================================================
-- Classification via cascading UPDATEs (order matters — most specific first)
-- ============================================================================

-- 1. Federal agencies
UPDATE agencies SET level = 'federal' WHERE level IS NULL AND (
  canonical_name ILIKE 'U.S.%'
  OR canonical_name ILIKE 'United States%'
  OR canonical_name ILIKE 'Federal %'
  OR canonical_name IN (
    'Centers for Medicare and Medicaid Services',
    'Environmental Protection Agency',
    'Social Security Administration',
    'Administration for Children and Families',
    'Delaware River Basin Commission',
    'Susquehanna River Basin Commission',
    'NMLSR',
    'National Mortgage Licensing System and Registry',
    'Nationwide Mortgage Licensing System and Registry (NMLSR)',
    'Nationwide Multistate Licensing System (NMLS)'
  )
);

-- 2. Village-level (very specific "Village of" pattern)
UPDATE agencies SET level = 'village' WHERE level IS NULL AND (
  canonical_name ILIKE 'Village of%'
  OR canonical_name ILIKE 'Board of Trustees of the Village%'
  OR canonical_name ILIKE 'Board of Water Commissioners of the Village%'
);

-- 3. Town-level
UPDATE agencies SET level = 'town' WHERE level IS NULL AND (
  canonical_name ILIKE 'Town of%'
  OR canonical_name ILIKE 'Town Board%'
);

-- 4. City-level (includes NYC)
UPDATE agencies SET level = 'city' WHERE level IS NULL AND (
  (canonical_name ILIKE 'City of%' AND canonical_name NOT ILIKE 'City Court%')
  OR canonical_name ILIKE 'New York City%'
  OR canonical_name ILIKE 'NYC %'
  OR jurisdiction = 'NYC'
  OR canonical_name IN (
    'Fire Department of New York',
    'Transit Adjudication Bureau',
    'Criminal Court of the City of New York',
    'Civil Court of the City of New York',
    'Department of Finance of the City of New York',
    'Department of Public Utilities of the City of Troy'
  )
);

-- 5. County-level
UPDATE agencies SET level = 'county' WHERE level IS NULL AND (
  canonical_name ILIKE '%County%'
);

-- 6. Judiciary (courts, judges, judicial system)
UPDATE agencies SET level = 'judiciary' WHERE level IS NULL AND (
  canonical_name ILIKE '%Court%'
  OR canonical_name ILIKE '%Appellate%'
  OR canonical_name ILIKE '%Judicial%'
  OR canonical_name ILIKE '%Judiciary%'
  OR canonical_name IN (
    'Clerk of the Court',
    'Unified Court System',
    'Ethics Commission for the Unified Court System',
    'Supreme Court'
  )
);

-- 7. State agencies (broad — departments, offices, divisions, boards, commissions, SUNY, etc.)
UPDATE agencies SET level = 'state' WHERE level IS NULL AND (
  canonical_name ILIKE 'Department of%'
  OR canonical_name ILIKE 'Office of%'
  OR canonical_name ILIKE 'Division of%'
  OR canonical_name ILIKE 'Bureau of%'
  OR canonical_name ILIKE 'Commissioner of%'
  OR canonical_name ILIKE 'State %'
  OR canonical_name ILIKE 'New York State%'
  OR canonical_name ILIKE 'New York Department%'
  OR canonical_name ILIKE 'New York Division%'
  OR canonical_name ILIKE 'New York Board%'
  OR canonical_name ILIKE 'New York Racing%'
  OR canonical_name ILIKE 'SUNY%'
  OR canonical_name ILIKE 'State University%'
  OR canonical_name ILIKE 'Board of Regents%'
  OR canonical_name ILIKE 'Board of Commissioners%'
  OR canonical_name ILIKE 'NYS %'
  OR canonical_name ILIKE 'SLA %'
  OR canonical_name ILIKE '%Commission%'
  OR canonical_name IN (
    'Attorney General',
    'Education Department',
    'Executive Department',
    'Gaming Commission',
    'Tax Commission',
    'OASAS',
    'ParksCorp',
    'Secretary of State of New York',
    'Empire State Development',
    'Adirondack Park Agency',
    'Workers'' Compensation Board',
    'Higher Education Services Corporation',
    'New York Housing Finance Agency',
    'New York Inter-Urban Water Company',
    'Hudson River Park Trust',
    'Canal Corporation',
    'District Attorney',
    'Local Board of Health',
    'Local Departments of Social Services',
    'Local Health Commissioner or Health Officer'
  )
);

-- 8. Authority (quasi-governmental — remaining "Authority" and "Corporation" entries)
UPDATE agencies SET level = 'authority' WHERE level IS NULL AND (
  canonical_name ILIKE '%Authority%'
  OR canonical_name ILIKE '%Corporation%'
);

-- 9. Generic (everything remaining)
UPDATE agencies SET level = 'generic' WHERE level IS NULL;

-- ============================================================================
-- Manual fixes for misclassifications and edge cases
-- ============================================================================

-- These are state agencies, not "authority" or other
UPDATE agencies SET level = 'state' WHERE canonical_name IN (
  'Fredonia State Teachers College and Potsdam State Teachers College',
  'Criminal Justice Services and/or Nationwide Mortgage Licensing System and Registry (NMLSR)',
  'Advanced Home Health Aide Training Program (licensed or certified agency or hospice)',
  'Food Stamp Program Administrator',
  'Program For Elderly Pharmaceutical Insurance Coverage',
  'Independent Dispute Resolution Entity (IDRE)',
  'Individual Onsite Water Supply Systems',
  'Individual Onsite Water Supply Systems - Statewide Water Quality Standards',
  'Individual Onsite Water Supply Systems - Statewide Water Quality Standards / Department of Health',
  'Health Commissioner or Health Officer of City or County/Part-County Health District, or State Regional Health Director, or Grade I or Grade II Public Health Administrator, or Public Health Director, or County Health Director'
);

-- These are federal, not state (caught by Commission pattern)
UPDATE agencies SET level = 'federal' WHERE canonical_name IN (
  'Office of Child Support Enforcement'
);

-- Local water boards/districts → generic (they serve specific localities but aren't gov entities per se)
UPDATE agencies SET level = 'generic' WHERE canonical_name IN (
  'Warrensburg Water District',
  'Hillcrest Water District No. 1',
  'Niagara Falls Water Board',
  'Water Board',
  'Water Board (Buffalo, New York)',
  'Airport Authority',
  'Local Transit Authority',
  'Housing company',
  'Thomson Prometric',
  'Steamship and Railroad Association (SRAA)',
  'Permit-Issuing Official',
  'Transit Supervisor, Superintendent or Manager',
  'Certified radiation equipment safety officer',
  'Social Services District',
  'Local health units',
  'Local government offices authorized by delegation',
  'County or part-county health officer or certified radiation equipment safety officer',
  'County or part-county health officer or city health district',
  'County, part-county, or city health department or local health officer',
  'New York City and counties outside New York City',
  'New York City agencies',
  'Town, Village or City Justice Court',
  'Criminal court of the jurisdiction where the violation occurs',
  'State licensing agency with authority for the host clinic'
);

-- Hyde Park Fire Department is a local entity
UPDATE agencies SET level = 'town' WHERE canonical_name = 'Hyde Park Fire Department';

-- Buffalo water/sewer boards are city-level
UPDATE agencies SET level = 'city' WHERE canonical_name IN (
  'City of Buffalo Water Board',
  'Buffalo Sewer Authority'
);

-- Skyport entities → authority
UPDATE agencies SET level = 'authority' WHERE canonical_name IN (
  'Skyport Association of America',
  'Skyports Authority of America (SRAA)',
  'Skyports Rail Access Authority'
);

-- Nassau County as standalone → county
UPDATE agencies SET level = 'county' WHERE canonical_name = 'Nassau County';
