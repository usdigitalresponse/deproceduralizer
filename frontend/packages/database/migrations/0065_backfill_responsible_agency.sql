-- Backfill responsible_agency on jenai_analyses and compliance_issue_analyses
-- Uses the NYCRR title→agency mapping from regulatory_documents title-level entries

-- jenai_analyses: regulations (via document_id → regulatory_documents)
UPDATE jenai_analyses ja
SET responsible_agency = subq.agency_name
FROM (
    SELECT rd.id AS doc_id, titles.agency_name
    FROM regulatory_documents rd
    JOIN (
        SELECT DISTINCT
            rd2.nycrr_title AS title_num,
            INITCAP(SPLIT_PART(rd2.title, ' - ', 2)) AS agency_name
        FROM regulatory_documents rd2
        WHERE rd2.jurisdiction = 'NY'
          AND rd2.hierarchy_level = 'title'
          AND rd2.title LIKE '%-%'
          AND SPLIT_PART(rd2.title, ' - ', 2) = UPPER(SPLIT_PART(rd2.title, ' - ', 2))
          AND LENGTH(SPLIT_PART(rd2.title, ' - ', 2)) > 5
    ) titles ON rd.nycrr_title = titles.title_num
    WHERE rd.jurisdiction = 'NY'
) subq
WHERE ja.document_id = subq.doc_id
  AND ja.responsible_agency IS NULL;

-- jenai_analyses: guidance (via guidance_document_id → guidance_documents.agency)
UPDATE jenai_analyses ja
SET responsible_agency = gd.agency
FROM guidance_documents gd
WHERE ja.guidance_document_id = gd.id
  AND ja.responsible_agency IS NULL
  AND gd.agency IS NOT NULL;

-- compliance_issue_analyses: regulations
UPDATE compliance_issue_analyses cia
SET responsible_agency = subq.agency_name
FROM (
    SELECT rd.id AS doc_id, titles.agency_name
    FROM regulatory_documents rd
    JOIN (
        SELECT DISTINCT
            rd2.nycrr_title AS title_num,
            INITCAP(SPLIT_PART(rd2.title, ' - ', 2)) AS agency_name
        FROM regulatory_documents rd2
        WHERE rd2.jurisdiction = 'NY'
          AND rd2.hierarchy_level = 'title'
          AND rd2.title LIKE '%-%'
          AND SPLIT_PART(rd2.title, ' - ', 2) = UPPER(SPLIT_PART(rd2.title, ' - ', 2))
          AND LENGTH(SPLIT_PART(rd2.title, ' - ', 2)) > 5
    ) titles ON rd.nycrr_title = titles.title_num
    WHERE rd.jurisdiction = 'NY'
) subq
WHERE cia.document_id = subq.doc_id
  AND cia.responsible_agency IS NULL;

-- compliance_issue_analyses: guidance
UPDATE compliance_issue_analyses cia
SET responsible_agency = gd.agency
FROM guidance_documents gd
WHERE cia.guidance_document_id = gd.id
  AND cia.responsible_agency IS NULL
  AND gd.agency IS NOT NULL;
