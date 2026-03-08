# Common Queries

## Document Statistics

```sql
-- Count by jurisdiction
SELECT jurisdiction, COUNT(*) FROM regulatory_documents GROUP BY jurisdiction;

-- Count by hierarchy level
SELECT hierarchy_level, COUNT(*) FROM regulatory_documents GROUP BY hierarchy_level;

```

## Hierarchy Queries

```sql
-- Root documents (titles)
SELECT * FROM regulatory_documents WHERE parent_id IS NULL AND jurisdiction = 'NY';

-- Children of a document
SELECT * FROM regulatory_documents WHERE parent_id = 123;

-- Ancestor chain (breadcrumbs)
WITH RECURSIVE ancestors AS (
    SELECT * FROM regulatory_documents WHERE id = 456
    UNION ALL
    SELECT rd.* FROM regulatory_documents rd
    JOIN ancestors a ON rd.id = a.parent_id
)
SELECT * FROM ancestors ORDER BY id;
```

## Research Pipeline Queries (V5)

```sql
-- Pipeline version distribution
SELECT pipeline_version, COUNT(*)
FROM compliance_issue_analyses
GROUP BY pipeline_version;

-- Tier completion status
SELECT
  CASE
    WHEN tier3_completed_at IS NOT NULL THEN 'complete'
    WHEN tier3_classification IS NOT NULL THEN 'tier3_done'
    WHEN tier2_classification IS NOT NULL THEN 'tier2_done'
    WHEN tier1_classification IS NOT NULL THEN 'tier1_done'
    ELSE 'pending'
  END as status,
  COUNT(*)
FROM compliance_issue_analyses
GROUP BY 1 ORDER BY 1;

-- Classification distribution
SELECT
  COALESCE(tier3_classification, tier2_classification, tier1_classification) as classification,
  COUNT(*)
FROM compliance_issue_analyses
WHERE pipeline_version = 'v5'
GROUP BY 1;

-- High severity burdensome issues
SELECT cia.id, rd.citation, cia.issue_type, cia.final_severity
FROM compliance_issue_analyses cia
JOIN regulatory_documents rd ON cia.document_id = rd.id
WHERE cia.final_severity >= 7
  AND cia.requirement_found = true
  AND cia.is_justified = false
ORDER BY cia.final_severity DESC;

-- Items pending Tier 3 (web search)
SELECT id, document_id, issue_type, severity
FROM compliance_issue_analyses
WHERE pipeline_version = 'v5'
  AND tier2_classification IS NOT NULL
  AND tier3_completed_at IS NULL
  AND (cites_federal_statute = true OR claims_no_alternative = true OR severity >= 8);

-- Federal mandate analysis
SELECT issue_type,
  COUNT(*) as total,
  SUM(CASE WHEN cites_federal_statute THEN 1 ELSE 0 END) as cites_federal,
  SUM(CASE WHEN federal_mandate_found THEN 1 ELSE 0 END) as confirmed_federal
FROM compliance_issue_analyses
WHERE pipeline_version = 'v5'
GROUP BY issue_type
ORDER BY cites_federal DESC;
```
