# Database Maintenance

## Recomputing Hierarchy Stats

The precomputed stats in `regulatory_documents` must be refreshed after:
- Data imports or scraping runs
- Changes to `parent_id` relationships
- Compliance issues are updated

**Check for mismatches:**
```sql
SELECT jurisdiction, COUNT(*) as mismatches
FROM (
  SELECT rd.id, rd.jurisdiction, rd.direct_child_count,
    (SELECT COUNT(*) FROM regulatory_documents c WHERE c.parent_id = rd.id) as actual
  FROM regulatory_documents rd
) rd
WHERE rd.direct_child_count != rd.actual
GROUP BY jurisdiction;
```

**Recompute all stats (run in order):**

```bash
# Step 1: direct_child_count
./scripts/db-query.sh "UPDATE regulatory_documents rd SET direct_child_count = (SELECT COUNT(*) FROM regulatory_documents c WHERE c.parent_id = rd.id)"

# Step 2: descendant_count
./scripts/db-query.sh "WITH descendant_counts AS (
  SELECT rd.id, (
    WITH RECURSIVE descendants AS (
      SELECT id FROM regulatory_documents WHERE parent_id = rd.id
      UNION ALL
      SELECT c.id FROM regulatory_documents c JOIN descendants d ON c.parent_id = d.id
    ) SELECT COUNT(*) FROM descendants
  ) as cnt
  FROM regulatory_documents rd WHERE rd.direct_child_count > 0
)
UPDATE regulatory_documents rd SET descendant_count = dc.cnt FROM descendant_counts dc WHERE rd.id = dc.id"

```

## Definitions Migration

After importing new definitions, populate `document_id` by URL matching:

```bash
./scripts/db-query.sh "UPDATE definitions d SET document_id = rd.id FROM regulatory_documents rd WHERE rd.url = d.url AND d.document_id IS NULL"
```

**When to run:**
- After any new definition extraction batch
- After importing definitions from external sources
- If definitions show without source regulation links

**Verify:**
```bash
./scripts/db-query.sh "SELECT COUNT(*) as missing_doc_id FROM definitions WHERE document_id IS NULL"
./scripts/db-query.sh "SELECT COUNT(*) as with_doc_id FROM definitions WHERE document_id IS NOT NULL"
```

## Database Health Auditing

**Check column usage:**
```sql
SELECT
  'table_name' as table_name,
  'column_name' as column_name,
  COUNT(*) as total,
  COUNT(column_name) as non_null
FROM table_name;
```

**Find orphaned definitions:**
```sql
SELECT COUNT(*) FROM definitions d
WHERE d.document_id IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM regulatory_documents rd WHERE rd.id = d.document_id);
```

## Known Unused Columns (Dec 2025, verified Dec 26, 2025)

**Completely empty:**
- `statute_references` - entire table (0 rows)
- `regulatory_documents.scraped_from_url` - 0 of 123k rows
- `definitions.notes` - 0 of 50k rows
- `compliance_issues.statute_citation` - 0 of 189 rows
