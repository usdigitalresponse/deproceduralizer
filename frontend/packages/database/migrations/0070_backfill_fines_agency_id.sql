-- Backfill agency_id on fines_fees_penalties via canonical name + alias matching

-- Pass 1: Exact match on responsible_agency = canonical_name
UPDATE fines_fees_penalties f
SET agency_id = a.id
FROM agencies a
WHERE f.responsible_agency = a.canonical_name
  AND f.jurisdiction = a.jurisdiction
  AND f.agency_id IS NULL;

-- Pass 2: Match remaining via agency_aliases lookup (case-sensitive)
UPDATE fines_fees_penalties f
SET agency_id = aa.agency_id
FROM agency_aliases aa
JOIN agencies a ON aa.agency_id = a.id
WHERE f.responsible_agency = aa.alias
  AND f.jurisdiction = a.jurisdiction
  AND f.agency_id IS NULL;

-- Pass 3: Case-insensitive fallback for remaining unmatched
UPDATE fines_fees_penalties f
SET agency_id = aa.agency_id
FROM agency_aliases aa
JOIN agencies a ON aa.agency_id = a.id
WHERE LOWER(f.responsible_agency) = LOWER(aa.alias)
  AND f.jurisdiction = a.jurisdiction
  AND f.agency_id IS NULL;
