# Cross-Reference Extraction Guide

## Prerequisites

1. Working directory:
   ```bash
   cd ~/Documents/Programming/raf/deproceduralizer/backend/scripts
   ```

2. Environment variables set (DATABASE_URL in .env)

3. Python dependencies installed:
   ```bash
   pip install psycopg python-dotenv
   ```

## Running Extraction

### Full Extraction (Database Output)

```bash
# Extract and write directly to database
python3 -m cross_references.run_extraction --state NJ --output db
python3 -m cross_references.run_extraction --state NY --output db
python3 -m cross_references.run_extraction --state NYC --output db
```

### Test Run (JSON Output)

```bash
# Extract sample to JSON for review
python3 -m cross_references.run_extraction --state NJ --limit 100 --output json
```

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `--state` | State to process (NY or NJ) | Required |
| `--limit` | Max documents to process | All |
| `--output` | Output format: json, console, both, db | both |

## Output

### JSON Output
Files saved to `outputs/` directory:
- `ny_extraction_YYYYMMDD_HHMMSS.json`
- `nj_extraction_YYYYMMDD_HHMMSS.json`

### Database Output
- Rows written to `cross_references` table
- `cross_reference_count` updated on `regulatory_documents`

## Monitoring Progress

The extraction script displays progress:
```
Progress: 1000/5000 docs (3456 refs, ETA: 120s)
```

## Post-Extraction Verification

```bash
# Check total counts
./scripts/db-query.sh "SELECT jurisdiction, count(*) FROM cross_references GROUP BY jurisdiction"

# Check resolution rate
./scripts/db-query.sh "SELECT jurisdiction, count(*) as total, sum(case when is_resolved then 1 else 0 end) as resolved FROM cross_references GROUP BY jurisdiction"

# Sample unresolved
./scripts/db-query.sh "SELECT raw_text, normalized_citation, resolution_notes FROM cross_references WHERE is_resolved = false LIMIT 20"
```

## Troubleshooting

### Low Resolution Rate

1. Check cache sizes in resolver output:
   ```
   Building citation lookup caches...
     NYCRR cache: 46949 entries
     NJAC cache: 52460 entries
   ```

2. Sample unresolved to identify patterns:
   ```sql
   SELECT ref_type, normalized_citation, resolution_notes
   FROM cross_references
   WHERE is_resolved = false
   ORDER BY ref_type
   LIMIT 50;
   ```

3. Common unresolved reasons:
   - Federal statute references (false positives)
   - Missing chapters in database
   - Typos in source documents

### Re-running Extraction

The extraction uses DELETE + INSERT pattern:
1. Deletes existing refs for each source document
2. Inserts new refs
3. Updates `cross_reference_count`

This means re-running is safe and idempotent.

## Performance Notes

- Full NJ extraction: ~35 minutes
- Full NY extraction: ~20 minutes
- Most time spent on database writes (progress shown)
