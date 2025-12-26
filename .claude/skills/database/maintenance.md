# Database Maintenance

## Recomputing Hierarchy Stats

The precomputed stats in `regulatory_documents` must be refreshed after:
- Data imports or scraping runs
- Changes to `parent_id` relationships
- New analyses are added

**Check for mismatches:**
```sql
SELECT state, COUNT(*) as mismatches
FROM (
  SELECT rd.id, rd.state, rd.direct_child_count,
    (SELECT COUNT(*) FROM regulatory_documents c WHERE c.parent_id = rd.id) as actual
  FROM regulatory_documents rd
) rd
WHERE rd.direct_child_count != rd.actual
GROUP BY state;
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

# Step 3: flag stats for non-leaf nodes
./scripts/db-query.sh "WITH flag_stats AS (
  SELECT rd.id,
    (WITH RECURSIVE descendants AS (
      SELECT id FROM regulatory_documents WHERE id = rd.id UNION ALL
      SELECT c.id FROM regulatory_documents c JOIN descendants d ON c.parent_id = d.id
    ) SELECT COALESCE(SUM(a.num_flags), 0) FROM analyses a WHERE a.is_current = true AND a.document_id IN (SELECT id FROM descendants)) as total_flags,
    (WITH RECURSIVE descendants AS (
      SELECT id FROM regulatory_documents WHERE id = rd.id UNION ALL
      SELECT c.id FROM regulatory_documents c JOIN descendants d ON c.parent_id = d.id
    ) SELECT MAX(a.max_severity) FROM analyses a WHERE a.is_current = true AND a.document_id IN (SELECT id FROM descendants)) as max_sev,
    (WITH RECURSIVE descendants AS (
      SELECT id FROM regulatory_documents WHERE id = rd.id UNION ALL
      SELECT c.id FROM regulatory_documents c JOIN descendants d ON c.parent_id = d.id
    ) SELECT EXISTS(SELECT 1 FROM analyses a WHERE a.is_current = true AND a.document_id IN (SELECT id FROM descendants))) as has_analysis
  FROM regulatory_documents rd WHERE rd.direct_child_count > 0
)
UPDATE regulatory_documents rd SET descendant_flag_count = fs.total_flags, descendant_max_severity = fs.max_sev, has_descendant_analysis = fs.has_analysis FROM flag_stats fs WHERE rd.id = fs.id"

# Step 4: flag stats for leaf nodes
./scripts/db-query.sh "UPDATE regulatory_documents rd SET
  descendant_flag_count = COALESCE(a.num_flags, 0),
  descendant_max_severity = a.max_severity,
  has_descendant_analysis = (a.id IS NOT NULL)
FROM (
  SELECT rd2.id, a2.id, a2.num_flags, a2.max_severity
  FROM regulatory_documents rd2
  LEFT JOIN analyses a2 ON a2.document_id = rd2.id AND a2.is_current = true
  WHERE rd2.direct_child_count = 0
) a WHERE rd.id = a.id"
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

## Known Unused Columns (Dec 2025, verified Dec 26)

**Completely empty:**
- `statute_references` - entire table (0 rows)
- `regulatory_documents.scraped_from_url` - 0 of 123k rows
- `definitions.notes` - 0 of 50k rows
- `red_flags.developer_*` fields - all 3,400 rows have developer_status='unresolved'
- `compliance_issues.statute_citation` - 0 of 189 rows

**Barely used (<1%):**
- `red_flags.reviewed_by/at` - 11 of 3,400 rows reviewed
- `red_flags.priority`, `impact_type` - rarely populated
