# Database Setup Guide

## Initial Setup (One-time)

### 1. Create Neon Database

1. Go to [console.neon.tech](https://console.neon.tech)
2. Create a new project
3. Copy the connection string (looks like `postgresql://user:password@host/dbname`)

### 2. Set Environment Variable

Add to your `.env` file:
```
DATABASE_URL=postgresql://user:password@host/dbname
```

### 3. Create Tables

The database schema is defined in `frontend/packages/database/src/schema/`.

Migration `0000_base_tables.sql` bootstraps the 4 core tables (`regulatory_documents`, `analyses`, `red_flags`, `definitions`) for fresh databases. All subsequent migrations build on top of these.

For a new database, run all migrations in lexicographic sort order:

```bash
for f in frontend/packages/database/migrations/*.sql; do
  echo "Running $f..."
  psql $DATABASE_URL -f "$f"
done
```

Or run a specific migration:
```bash
psql $DATABASE_URL -f frontend/packages/database/migrations/0007a_add_display_columns.sql
```

**Naming convention:** Migrations use 4-digit zero-padded prefixes (e.g., `0000_`, `0001_`). When multiple migrations share the same number, they use `a`/`b`/`c` suffixes (e.g., `0007a_`, `0007b_`, `0043a_`, `0043b_`) to preserve sort order.

## Migrate Data

Data migration is handled automatically by the scraper scripts:

```bash
# Scrape and migrate in one step
python backend/scripts/ny_regulations_scraper.py
# or
python backend/scripts/nj_regulations_scraper.py
```

The scrapers call `lib.migration.migrate_regulations_to_db()` which:
- Creates `regulatory_documents` entries for each regulation
- Handles hierarchy relationships (parent_id)
- Uses `ON CONFLICT` for safe re-runs
- Refreshes denormalized statistics automatically

## Schema Sources

| Source | Purpose |
|--------|---------|
| `frontend/packages/database/migrations/*.sql` | Incremental migrations (run in order for new DBs) |
| `frontend/packages/database/src/schema/` | Drizzle type definitions |
| `.claude/skills/database/schema.md` | Human-readable documentation |

For new databases, run migrations in order. Views (`latest_analyses`, `document_hierarchy`) are created by migration 0039.

## Test Connection

```bash
python3 << 'EOF'
import psycopg
import os
from dotenv import load_dotenv

load_dotenv()
try:
    conn = psycopg.connect(os.getenv("DATABASE_URL"))
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM regulatory_documents")
        count = cur.fetchone()[0]
    print(f"✓ Connected! Found {count} documents in database")
    conn.close()
except Exception as e:
    print(f"✗ Connection failed: {e}")
EOF
```

## Common Queries

### See all NY regulations with issues
```sql
SELECT * FROM latest_analyses
WHERE state = 'NY' AND type = 'regulation'
AND has_implementation_issues = TRUE
ORDER BY analyzed_at DESC;
```

### Find high-severity flags
```sql
SELECT
  d.title,
  rf.category,
  rf.severity,
  rf.explanation
FROM red_flags rf
JOIN analyses a ON rf.analysis_id = a.id
JOIN regulatory_documents d ON a.document_id = d.id
WHERE rf.severity >= 8 AND d.state = 'NY'
ORDER BY rf.severity DESC;
```

### Compare regulations vs policy documents
```sql
SELECT type, COUNT(*), AVG(max_severity) as avg_severity
FROM latest_analyses
WHERE state = 'NY'
GROUP BY type;
```

### Count flags by category
```sql
SELECT
  rf.category,
  COUNT(*) as count,
  AVG(rf.severity) as avg_severity
FROM red_flags rf
JOIN analyses a ON rf.analysis_id = a.id
JOIN regulatory_documents d ON a.document_id = d.id
WHERE d.state = 'NY' AND a.is_current = TRUE
GROUP BY rf.category
ORDER BY count DESC;
```

## Dependencies

Install required Python packages:

```bash
pip install psycopg pandas python-dotenv
```

## Additional Tables

Beyond the core tables (`regulatory_documents`, `analyses`, `red_flags`, `statute_references`), the database includes:

| Table | Purpose |
|-------|---------|
| `definitions` | Extracted regulatory terms with scope tracking (28k+ records) |
| `compliance_issues` | Regex-matched compliance issue candidates (links to `compliance_issue_analyses` for LLM analysis + review) |
| `compliance_issue_analyses` | LLM analysis results + human review for compliance issues (one per document + issue type) |
| `definition_document_occurrences` | Many-to-many tracking of where terms appear |
| `incorporations_by_reference` | External standards (NFPA, ICC, ASTM) referenced in regulations |
| `cross_references` | Internal citations between regulatory documents (NYCRR, NJAC refs) |
| `document_notes` | User annotations on regulations |
| `prompt_feedback` | Feedback on LLM prompts |
| `regulation_statute_links` | Regulation-to-statute cross-references |
| `statutes` | NJ/NY statutes for linking to regulations |
| `statute_mandate_checks` | LLM analysis of whether cited statutes mandate flagged regulatory issues |

See `.claude/skills/database/schema.md` for complete schema documentation.

## Additional Queries

### Find definitions by scope level
```sql
SELECT term, verbatim_text, scope_level
FROM definitions
WHERE scope_level = 'part' AND review_status = 'confirmed'
ORDER BY term;
```

### Count compliance issues by type
```sql
-- Note: requirement_found is on compliance_issue_analyses (not compliance_issues)
-- compliance_issues = regex match store, compliance_issue_analyses = LLM analysis + review
SELECT issue_type, COUNT(*) as count
FROM compliance_issue_analyses
WHERE requirement_found = true AND state = 'NJ'
GROUP BY issue_type
ORDER BY count DESC;
```

### Definition review statistics
```sql
SELECT
  review_status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 1) as pct
FROM definitions
GROUP BY review_status;
```

## Verify Data

Use the helper script to quickly check table counts:

```bash
./scripts/db-query.sh "SELECT 'regulatory_documents' as tbl, COUNT(*) FROM regulatory_documents
UNION ALL SELECT 'definitions', COUNT(*) FROM definitions
UNION ALL SELECT 'compliance_issues', COUNT(*) FROM compliance_issues
UNION ALL SELECT 'red_flags', COUNT(*) FROM red_flags"
```

Or describe a table's schema:
```bash
./scripts/db-query.sh describe regulatory_documents
```

## Notes

- The migration script uses `ON CONFLICT` to handle re-runs gracefully
- When re-analyzing a document, old analyses are marked `is_current = FALSE`
- The `latest_analyses` view always shows the most recent analysis for each document
- Statute references are linked by document ID, not by title match
