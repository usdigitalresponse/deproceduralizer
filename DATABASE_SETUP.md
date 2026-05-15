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

Migration `0000_base_tables.sql` bootstraps the core tables (`regulatory_documents`, `definitions`) for fresh databases. All subsequent migrations build on top of these.

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
WHERE jurisdiction = 'NY' AND type = 'regulation'
AND has_implementation_issues = TRUE
ORDER BY analyzed_at DESC;
```

## Dependencies

Install required Python packages:

```bash
pip install psycopg pandas python-dotenv
```

## Additional Tables

Beyond the core tables (`regulatory_documents`, `definitions`, `statute_references`), the database includes:

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
WHERE requirement_found = true AND jurisdiction = 'NJ'
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
UNION ALL SELECT 'compliance_issue_analyses', COUNT(*) FROM compliance_issue_analyses"
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

## Restoring from a Snapshot

Use this when standing up a fresh database from a `data/db_backup/<UTC-timestamp>/` snapshot — typical scenarios: spinning up a local copy, point-in-time recovery, or sharing a frozen dataset with a collaborator.

Each snapshot directory also has its own `README.md` (generated by the export script) with snapshot-specific details — including the exact row counts and sha256 hashes that `manifest.json` records.

### 1. Recreate the schema

```bash
export DATABASE_URL=postgresql://...
SNAPSHOT=data/db_backup/2026-05-15T20-22-11Z   # pick the snapshot you want
psql "$DATABASE_URL" -f "$SNAPSHOT/schema.sql"
```

This creates every table, index, sequence, and constraint with no rows.

### 2. Restore data table-by-table

JSONL files in a snapshot are encoded with `row_to_json(t)` — one row per line, full `jsonb` fidelity. For a normal (unchunked) table:

```bash
TABLE=agencies
unzip -p "$SNAPSHOT/$TABLE.jsonl.zip" > "/tmp/$TABLE.jsonl"
python3 - <<'PY'
import json, os
import psycopg
table = os.environ["TABLE"]
with psycopg.connect(os.environ["DATABASE_URL"]) as conn, conn.cursor() as cur:
    with open(f"/tmp/{table}.jsonl") as f:
        for line in f:
            row = json.loads(line)
            cols = ", ".join(row.keys())
            placeholders = ", ".join(["%s"] * len(row))
            cur.execute(
                f"INSERT INTO {table} ({cols}) VALUES ({placeholders})",
                [json.dumps(v) if isinstance(v, (dict, list)) else v for v in row.values()],
            )
    conn.commit()
PY
```

For a **chunked** table (`regulatory_documents`, `prompt_templates`, `guidance_documents`, `statutes`), concatenate the parts in order first:

```bash
TABLE=regulatory_documents
for z in "$SNAPSHOT/$TABLE"/*.zip; do unzip -p "$z"; done > "/tmp/$TABLE.jsonl"
# then use the same Python loop as above
```

After loading, advance each table's primary key sequence to past the highest restored id, e.g.:

```sql
SELECT setval(pg_get_serial_sequence('regulatory_documents', 'id'),
              (SELECT max(id) FROM regulatory_documents));
```

### 3. Sensitive tables

The `$SNAPSHOT/sensitive/` subdirectory contains schema-only dumps for tables that hold user/PII data (`share_tokens`, `bookmarks`, `document_notes`, `eval_human_votes`, `prompt_feedback`). Their structure is restored by `schema.sql` in step 1.

Sample `*.sample.jsonl.zip` files exist for a few of those tables with PII columns nulled — useful for testing UI flows, **not** for restoring real user state. Real values must be re-collected; they were intentionally not exported.

`llm_api_cache` is **excluded** from every snapshot (regeneratable; may contain raw prompts). The cache will rebuild itself as the pipeline runs.

### 4. Verify

```bash
# Row counts should match $SNAPSHOT/manifest.json
psql "$DATABASE_URL" -c "SELECT 'regulatory_documents', count(*) FROM regulatory_documents
  UNION ALL SELECT 'statutes', count(*) FROM statutes
  UNION ALL SELECT 'compliance_issues', count(*) FROM compliance_issues;"

# sha256-verify a zip against the manifest
jq -r '.tables.agencies.files[0].sha256' "$SNAPSHOT/manifest.json"
sha256sum "$SNAPSHOT/agencies.jsonl.zip"
```
