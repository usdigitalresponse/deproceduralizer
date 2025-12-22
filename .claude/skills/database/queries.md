# Common Queries

## Document Statistics

```sql
-- Count by state
SELECT state, COUNT(*) FROM regulatory_documents GROUP BY state;

-- Count by hierarchy level
SELECT hierarchy_level, COUNT(*) FROM regulatory_documents GROUP BY hierarchy_level;

-- Documents without analysis
SELECT COUNT(*) FROM regulatory_documents rd
WHERE NOT EXISTS (SELECT 1 FROM analyses a WHERE a.document_id = rd.id);
```

## Analysis Queries

```sql
-- Analysis coverage
SELECT
    COUNT(*) as total,
    SUM(CASE WHEN a.id IS NOT NULL THEN 1 ELSE 0 END) as analyzed
FROM regulatory_documents rd
LEFT JOIN analyses a ON rd.id = a.document_id AND a.is_current = true;

-- High severity documents
SELECT rd.id, rd.title, a.max_severity, a.num_flags
FROM regulatory_documents rd
JOIN analyses a ON rd.id = a.document_id AND a.is_current = true
WHERE a.max_severity >= 7
ORDER BY a.max_severity DESC;

-- Complexity distribution
SELECT overall_complexity, COUNT(*)
FROM analyses WHERE is_current = true
GROUP BY overall_complexity;
```

## Red Flag Queries

```sql
-- By severity
SELECT severity, COUNT(*) FROM red_flags GROUP BY severity ORDER BY severity DESC;

-- By category
SELECT category, COUNT(*) FROM red_flags GROUP BY category ORDER BY COUNT(*) DESC;

-- Unreviewed high-severity
SELECT rf.*, a.document_id
FROM red_flags rf
JOIN analyses a ON rf.analysis_id = a.id
WHERE rf.review_status = 'unreviewed' AND rf.severity >= 7;

-- Review status breakdown
SELECT review_status, COUNT(*) FROM red_flags GROUP BY review_status;
```

## Hierarchy Queries

```sql
-- Root documents (titles)
SELECT * FROM regulatory_documents WHERE parent_id IS NULL AND state = 'NY';

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
