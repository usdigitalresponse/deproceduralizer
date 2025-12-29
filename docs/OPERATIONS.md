# Operations Runbook

Step-by-step guide for running the Deproceduralizer pipeline.

## Pipeline Overview

```
Scrape → Clean/Cache → Migrate → Refresh Stats → Definitions → Link Definitions
    → Compliance Issues → IBR Scan → Red Flags → Regulatory Status
```

## Step-by-Step

### 1. Scrape Regulations

```bash
python backend/scripts/ny_regulations_scraper.py
# or
python backend/scripts/nj_regulations_scraper.py
```

- Creates JSON cache in `data/scraped_data/` (NY) or `data/nj_scraped_data/` (NJ)
- Progress tracked in `progress.json`, `failed_urls.json`, `scraped_from_urls.json`
- Use `--fresh` to start over (clears progress files and forces re-scrape)
- Automatically calls `migrate_regulations_to_db()` and `refresh_all_stats()`

### 2. Extract Definitions

```bash
python backend/scripts/batch_definitions.py submit --state NJ
python backend/scripts/batch_definitions.py status
python backend/scripts/batch_definitions.py process
```

- Uses Anthropic Batch API (50% cost savings)
- Results cached in `data/outputs/batches/`
- Use `resume` to retry failed documents from `errors.log`

### 3. Link Definitions

```bash
python backend/scripts/link_definitions.py --state NJ
python backend/scripts/backfill_definition_scope.py --state NJ
```

- Creates `definition_document_occurrences` entries
- Links definitions to documents where terms appear in text
- Backfill fixes incomplete `scope_document_id` values

### 4. Detect Compliance Issues

```bash
python backend/scripts/compliance_issues/searcher.py --state NJ
```

- Regex triage → LLM verification → save results
- Stores "no issue" rows (`requirement_found=false`) for audit trail
- Issue patterns defined in `prompts/compliance_issues.yaml`

### 5. Scan Incorporations by Reference

```bash
python backend/scripts/ibr_scanner.py --state NJ
```

- Dedicated table: `incorporations_by_reference`
- Detects NFPA, ICC, ASTM, CFR, and other external standards

### 6. Run Red Flag Analysis

```bash
python backend/scripts/red_flags.py --state NY
```

- Older analyses are deleted on rerun (red_flags cascade with analysis)
- `analyses.is_current = TRUE` marks the latest analysis per document
- Skip-done logic uses `is_current` to avoid re-analyzing unchanged documents

### 7. Detect Regulatory Status

```bash
python backend/scripts/detect_regulatory_status.py --state NJ
```

- Marks sections as reserved/repealed/recodified/expired
- Sets `regulatory_status` and `recodified_to` columns

## Data Layout

| Directory | Contents |
|-----------|----------|
| `data/scraped_data/` | NY scrape cache + progress files |
| `data/nj_scraped_data/` | NJ scrape cache + progress files |
| `data/outputs/batches/` | Batch processing results by issue type |
| `data/ny_regulations_from_cache.json` | Processed NY regulations (from cache step) |
| `data/nj_regulations_from_cache.json` | Processed NJ regulations (from cache step) |

### Progress Files (per scraper)

| File | Purpose |
|------|---------|
| `progress.json` | Visited URLs and total count |
| `failed_urls.json` | URLs that failed to scrape |
| `scraped_from_urls.json` | Maps each URL to its referring page |

### Batch Output (per batch)

| File | Purpose |
|------|---------|
| `batch_info.json` | Batch API ID, status, timestamps, counts |
| `errors.log` | Failed document IDs (for resume) |

## Offline vs Online Architecture

### Offline Pipeline (Python)

- All scripts in `backend/scripts/`
- Writes directly to PostgreSQL via `psycopg`
- No connection to Next.js app
- Uses `shared_utils.py` for DB, LLM, and parsing utilities

### Online UI (Next.js)

- Server actions in `frontend/apps/web/src/lib/actions/`
- Queries PostgreSQL via Drizzle ORM (`frontend/packages/database/src/client.ts`)
- Does NOT call Python backend
- All data access is read-only (review updates go directly to DB)

## Common Operations

### Re-run a single state from scratch

```bash
# Clear progress and re-scrape
python backend/scripts/nj_regulations_scraper.py --fresh
```

### Refresh statistics only

```bash
python backend/scripts/refresh_hierarchy_stats.py --structure --state NJ
python backend/scripts/refresh_hierarchy_stats.py --analysis --state NJ
python backend/scripts/refresh_hierarchy_stats.py --compliance --state NJ
```

### Check batch status

```bash
python backend/scripts/batch_definitions.py status
```

### Resume failed batch documents

```bash
python backend/scripts/batch_definitions.py resume --batch-dir data/outputs/batches/NJ_full_20251226
```

## Prompts

All prompts live in the `/prompts/` directory:

- Core analysis prompts: `prompts/core.yaml` (red_flags, definitions)
- Compliance issues: `prompts/compliance_issues.yaml` (43 issue types with patterns + prompts)
- Frontend copy: `frontend/apps/web/src/data/prompts.yaml` (copied from `prompts/core.yaml` via prebuild)

TypeScript types are auto-generated from YAML - run `python scripts/generate_prompt_types.py` after modifying `prompts/compliance_issues.yaml`.

Run `pnpm prebuild` in `frontend/apps/web/` if the `/prompts` page fails in development.
