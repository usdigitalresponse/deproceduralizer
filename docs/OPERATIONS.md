# Operations Runbook

Complete guide for running the Deproceduralizer analysis pipeline on a state's regulations.

## Pipeline Overview

```
1. Scrape             →  regulatory_documents table
1b. Exclude           →  marks non-regulatory sections (exec orders, military code, data tables)
2. Regulatory Status  →  marks repealed/reserved/expired sections
3. Definitions        →  definitions table
4. Link Definitions   →  definition_document_occurrences table
5. Cross-References   →  cross_references table (internal citations between documents)
6. Summaries          →  summary, keywords, section_type on regulatory_documents
7. Compliance Scan    →  compliance_issues table (regex matches)
8. Research Pipeline  →  compliance_issue_analyses table (LLM Tier 1-3)
9. IBR Scan           →  incorporations_by_reference table
10. Red Flags         →  analyses table
11. Refresh Stats     →  precomputed counts on regulatory_documents
```

**Step dependencies:**
- Steps 1-4 are sequential prerequisites
- Step 5 (cross-references) can run anytime after Step 1 (only needs scraped documents)
- Steps 6 and 7 can run in parallel (no dependency on each other)
- **Step 8 depends on Steps 5 and 6** — the research pipeline uses document summaries and cross-reference summaries as LLM context
- Steps 9-10 are independent of 8 and can run anytime after Step 1
- Step 11 should run last (after any step that changes counts)

## Full State Analysis (e.g., NY)

Replace `NY`/`ny` with `NJ`/`nj` for New Jersey. All commands run from the project root unless noted.

### Step 1: Scrape Regulations

```bash
python backend/scripts/ny_regulations_scraper.py
```

- Scrapes NYCRR from Cornell Law's Legal Information Institute
- Creates JSON cache in `data/scraped_data/`
- Automatically runs `migrate_regulations_to_db()` + `refresh_all_stats()`
- Progress tracked in `progress.json`, `failed_urls.json`, `scraped_from_urls.json`
- Use `--fresh` to clear progress and start over

For NJ statutes (separate from NJAC regulations):
```bash
python backend/scripts/nj_statutes.py
```

For NY statutes (from OpenLegislation API):
```bash
# First: get a free API key at https://legislation.nysenate.gov/
# Set NY_OPEN_LEG_API_KEY in .env

# Test with child care-relevant laws first:
python backend/scripts/ny_statutes.py EXC SOS PBH EDN

# All consolidated laws (~95 laws):
python backend/scripts/ny_statutes.py
```

Key flags:
| Flag | Description |
|------|-------------|
| `EXC SOS PBH EDN` | Specific law IDs (positional args) |
| `--fetch-only` | Only cache API data, skip DB |
| `--skip-fetch` | Use cached JSON, skip API calls |
| `--skip-db` | Skip database operations |
| `--hierarchy-only` | Only update parent_id relationships |
| `--fresh` | Clear all caches and re-fetch |
| `--delay 0.5` | Custom delay between API calls (default: 0.2s) |

| Cost | Time |
|------|------|
| Free (API key required) | Hours (network-bound) |

#### Link NY Statutes to Regulations

After ingesting statutes, scan regulation text for statute citations and link them:

```bash
# Preview (no DB writes):
python backend/scripts/link_ny_statutes.py --dry-run

# Full scan:
python backend/scripts/link_ny_statutes.py

# Filter by law or title:
python backend/scripts/link_ny_statutes.py --law SOS --title 18
```

| Flag | Description |
|------|-------------|
| `--dry-run` | Preview citations found without writing to DB |
| `--law SOS` | Only link citations to a specific law |
| `--title 18` | Only scan regulations from a specific NYCRR title |

| Cost | Time |
|------|------|
| Free | Minutes |

#### NYC Statutes (Charter + Administrative Code)

Parsed from local HTML files:

```bash
cd backend

# Parse HTML and save to JSON (no DB):
python3 scripts/nyc_statutes.py --parse-only

# Full pipeline (parse → JSON → DB → hierarchy):
python3 scripts/nyc_statutes.py

# Use cached JSON (skip re-parsing):
python3 scripts/nyc_statutes.py --skip-parse
```

| Flag | Description |
|------|-------------|
| `--parse-only` | Only parse HTML + save JSON, skip DB |
| `--skip-parse` | Use cached JSON, skip HTML parsing |
| `--skip-db` | Skip database operations |
| `--hierarchy-only` | Only update parent_id relationships |
| `--charter-only` | Only parse Charter sections |
| `--admin-only` | Only parse Administrative Code sections |

| Cost | Time |
|------|------|
| Free (local HTML file) | ~30s parse, ~1min DB ingest |

#### Link NYC Statutes to Regulations

```bash
cd backend

# Preview links (dry run):
python3 scripts/link_nyc_statutes.py --dry-run

# Create links:
python3 scripts/link_nyc_statutes.py

# Filter by NYCRR title:
python3 scripts/link_nyc_statutes.py --title 9
```

| Cost | Time |
|------|------|
| Free | ~15s |

### Step 1b: Exclude Non-Regulatory Sections

```bash
# Preview what would be excluded:
python backend/scripts/batch_exclude_ny_sections.py --dry-run

# Apply exclusions:
python backend/scripts/batch_exclude_ny_sections.py
```

- Batch-excludes NY sections that are not administrative regulations
- Sets `exclude_from_analysis = TRUE` with documented reasons per category
- Categories: executive orders, military code, chemical/hazmat tables, water classification tables, shellfish/geographic enumerations, fee schedules
- Idempotent — safe to re-run (skips already-excluded sections)
- See `.claude/skills/database/schema.md` for full category breakdown

| Cost | Time |
|------|------|
| Free | Seconds |

### Step 2: Detect Regulatory Status

```bash
python backend/scripts/detect_regulatory_status.py --state NY
```

- Parses titles to mark sections as reserved, repealed, recodified, or expired
- Sets `regulatory_status` and `recodified_to` columns on `regulatory_documents`
- Use `--dry-run` to preview, `--reset` to clear all statuses first

| Cost | Time |
|------|------|
| Free | Seconds |

### Step 3: Extract Definitions

```bash
python backend/scripts/batch_definitions.py submit --state NY
python backend/scripts/batch_definitions.py status              # poll until "ended"
python backend/scripts/batch_definitions.py process --batch-id <id>
```

- Uses Anthropic Batch API (50% cost savings vs realtime)
- Finds sections with "definition", "glossary", "meaning of" in title/content
- Results cached in `data/outputs/batches/`
- Use `--skip-done` to avoid reprocessing, `--title 3A` to filter by title
- Resume failed docs: `python backend/scripts/batch_definitions.py resume --batch-dir data/outputs/batches/<dir>`

| Cost | Time |
|------|------|
| ~$ (Haiku) | Hours (batch queue, up to 24h) |

### Step 4: Link Definitions

```bash
python backend/scripts/link_definitions.py run --state NY
python backend/scripts/backfill_definition_scope.py --state NY
```

- `link_definitions` creates `definition_document_occurrences` — links definitions to documents where terms appear (word-boundary regex matching)
- `backfill_definition_scope` infers `scope_level` and `scope_document_id` for definitions with null scope
- Use `--force` to reprocess ignoring cache, `--dry-run` to preview

| Cost | Time |
|------|------|
| Free | Minutes |

### Step 5: Extract Cross-References

```bash
cd backend
python3 -m scripts.cross_references.run_extraction --state NY --output db
```

- Extracts internal citations between regulatory documents (e.g., "18 NYCRR 505.14", "section 624.8 of this Part")
- Regex-based detection → resolution to target document IDs
- Reference types: NYCRR, NJAC, NY short-form, same-section
- Use `--limit 50` to test on a subset, `--dry-run` to preview without writing
- Use `--output json` to save results to file instead of DB, `--output console` for quick summary
- Can filter by title: `--title 18`

| Cost | Time |
|------|------|
| Free | Minutes |

### Step 6: Generate Summaries

Runs bottom-up through 5 hierarchy phases (sections → subchapters → chapters → parts → titles).

```bash
cd backend

# Run all phases for a single title (submit → poll → process → import to DB)
python3 -m scripts.summarization.cli --state NY --title 18 --run-all-phases

# Dry run (preview what would be submitted)
python3 -m scripts.summarization.cli --state NY --title 18 --run-all-phases --dry-run

# Manual phase control (if needed)
python3 -m scripts.summarization.cli --state NY --title 18 --phase sections --submit
python3 -m scripts.summarization.cli --state NY --status --watch
python3 -m scripts.summarization.cli --state NY --phase sections --process
```

- Uses Anthropic Batch API (Haiku, 50% savings)
- `--run-all-phases` handles everything: submit, poll, process, import to DB for each phase
- Each parent phase uses child summaries as input — must run in order
- Requires `--title <N>` to prevent accidental 50K+ doc submissions
- Use `--dry-run` to preview what would be submitted
- Can also be triggered as a post-pipeline step via the research pipeline CLI:
  ```bash
  python3 -m scripts.research_pipeline.cli --state ny --all-issues --execute --title 18 --summarize
  ```
- Import updates `regulatory_documents` with: `summary`, `section_type`, `keywords`, `applies_to`, `has_form`, `has_ibr`

**IMPORTANT: Step 6 must complete before Step 8.** The research pipeline (Step 8) uses summaries as context at multiple stages:
- **Tier 1** includes each document's summary in the analysis prompt
- **Tier 2** fetches summaries for related documents (siblings, cross-references) to provide broader context
- **Proactive context** pre-fetches sibling and cross-reference summaries for richer LLM analysis

Without summaries, the pipeline falls back to truncated content excerpts or titles, which significantly degrades analysis quality. Steps 6 and 7 can run in parallel since the regex scan (Step 7) doesn't use summaries.

| Cost | Time |
|------|------|
| ~$100/state, ~$2-5/title (Haiku) | Hours per phase (batch queue) |

### Step 7: Scan Compliance Issues (Regex)

```bash
python backend/scripts/scan_compliance_issues.py --state ny
```

- Regex-only scan — finds candidate matches for 41 compliance issue types
- Patterns defined in `prompts/compliance_issues.yaml`
- Use `--issue wet_signature` for a single type, `--dry-run` to search without saving
- Use `--list-issues` to see all available issue types

| Cost | Time |
|------|------|
| Free | Minutes |

### Step 8: Research Pipeline (LLM Analysis)

```bash
cd backend
python3 -m scripts.research_pipeline.cli --state ny --all-issues --execute
```

**This is the most expensive step. Always ask before running.**

- 3-tier LLM analysis on regex matches from Step 7:
  - **Tier 1**: Filter false positives
  - **Tier 2**: Classify burden + assign severity (1-10)
  - **Tier 3**: Web search verification (opt-in with `--web-search`)
- Default is **dry-run** — must pass `--execute` to actually run
- Default uses **batch API** (50% savings) — use `--realtime` for immediate results at 2x cost

Key flags:
| Flag | Default | Description |
|------|---------|-------------|
| `--execute` | off | Actually run (default is dry-run preview) |
| `--limit N` | 1000 | Max docs per issue type |
| `--global-limit N` | 100 | Max total docs across all issues |
| `--max-tier 1\|2\|3` | 2 | How far to process |
| `--web-search` | off | Enable Tier 3 web search |
| `--realtime` | off | Use realtime API (2x cost, immediate) |
| `--title N` | none | Filter by regulatory title |
| `--force-rerun` | off | Reprocess already-analyzed docs |
| `--statute-mandate` | off | Run statute mandate checks after pipeline (NY only) |
| `--run-statute-mandate-only` | off | Run only the statute mandate check step |

**Statute Mandate Checks** (NY only, post-pipeline):
```bash
# Preview what would be checked
cd backend
python3 -m scripts.research_pipeline.cli --state ny --all-issues --run-statute-mandate-only

# Run checks on first 10 pairs
python3 -m scripts.research_pipeline.cli --state ny --all-issues --run-statute-mandate-only --execute --limit 10
```

See `.claude/skills/research-pipeline/SKILL.md` for full documentation including state machine, tier triggers, and cost estimates.

| Cost | Time |
|------|------|
| $1-60+ depending on scope | Hours (batch), minutes (realtime) |

### Step 9: Scan Incorporations by Reference

```bash
python backend/scripts/ibr_scanner.py --state ny
```

- Detects external standards incorporated by reference (NFPA, ICC, ASTM, CFR, etc.)
- Regex search → LLM confirmation → saves confirmed IBRs
- Use `--batch` for Anthropic Batch API, `--dry-run` to search without saving

| Cost | Time |
|------|------|
| ~$ (Haiku) | Minutes to hours |

### Step 10: Red Flag Analysis

```bash
python backend/scripts/red_flags.py --state NY
```

- Identifies 12 categories of implementation complexity (Jennifer Pahlka's framework)
- One analysis row per document in `analyses` table
- `is_current = TRUE` marks the latest analysis per document
- Use `--skip-done` to avoid re-analyzing, `--title 5` to filter, `--sample-size N` to limit
- Old analyses deleted on rerun (red_flags cascade)

| Cost | Time |
|------|------|
| $$ (Claude) | Hours |

### Step 11: Refresh Hierarchy Stats

```bash
python backend/scripts/refresh_hierarchy_stats.py --state NY
```

- Precomputes hierarchy statistics for frontend performance
- Updates: `child_count`, `descendant_count`, `descendant_flag_count`, `descendant_analyzed_count`, `compliance_issue_count`, `descendant_compliance_issue_count`
- Run after any step that changes document counts or analysis results
- Use `--structure`, `--analysis`, or `--compliance` to refresh only specific stat types

| Cost | Time |
|------|------|
| Free | Seconds |

## Running a Single Title End-to-End

To process a single title (e.g., NY Title 18) through the full pipeline:

```bash
# 1. Cross-references (extracts internal citations for pipeline context)
cd backend
python3 -m scripts.cross_references.run_extraction --state NY --title 18 --output db

# 2. Summaries (batch API — submit and wait for completion)
python3 -m scripts.summarization.cli --state NY --title 18 --run-all-phases

# 3. Research pipeline through Tier 3 with web search (after summaries complete)
python3 -m scripts.research_pipeline.cli --state ny --all --title 18 \
  --max-tier 3 --web-search --execute \
  --limit all --global-limit no-limit

# 4. Statute mandate checks (NY only, after research pipeline)
python3 -m scripts.research_pipeline.cli --state ny --all --title 18 \
  --run-statute-mandate-only --execute

# 5. Refresh hierarchy stats
python backend/scripts/refresh_hierarchy_stats.py --state NY
```

**Order matters:** Cross-references and summaries must finish before the research pipeline starts (the pipeline uses both as LLM context). The statute mandate check runs after the pipeline since it operates on pipeline results. Refresh stats runs last.

**Estimated cost per title:** ~$10-25 (summaries ~$2-5, pipeline ~$5-15, mandate checks ~$1-3)

## Planning & Estimation Scripts

These scripts help plan runs without making API calls or writing to the database.

| Command | Purpose |
|---------|---------|
| `python backend/scripts/estimate_compliance_run.py` | Token/cost/time estimates for research pipeline |
| `python backend/scripts/analyze_compliance_coverage.py` | Document overlap across issue types |
| `python backend/scripts/analyze_patterns.py` | Regex pattern coverage analysis (DuckDB) |
| `python backend/scripts/verify_langfuse.py` | Test Langfuse observability integration |

## Data Layout

| Directory | Contents |
|-----------|----------|
| `data/scraped_data/` | NY scrape cache + progress files |
| `data/nj_scraped_data/` | NJ scrape cache + progress files |
| `data/outputs/batches/` | Batch processing results by issue type |
| `backend/summaries_staging/` | Summarization batch results before DB import |

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
- Uses `backend/lib/` modules for DB, LLM, and parsing utilities

### Online UI (Next.js)

- Server actions in `frontend/apps/web/src/lib/actions/`
- Queries PostgreSQL via Drizzle ORM (`frontend/packages/database/src/client.ts`)
- Does NOT call Python backend
- All data access is read-only (review updates go directly to DB)

## Common Operations

### Re-run a single state from scratch

```bash
python backend/scripts/nj_regulations_scraper.py --fresh
```

### Refresh statistics only

```bash
python backend/scripts/refresh_hierarchy_stats.py --state NJ
# Or refresh specific stat types:
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
- Compliance issues: `prompts/compliance_issues.yaml` (41 issue types with patterns + prompts)
- Frontend copy: `frontend/apps/web/src/data/prompts.yaml` (copied from `prompts/core.yaml` via prebuild)

TypeScript types are auto-generated from YAML - run `python scripts/generate_prompt_types.py` after modifying `prompts/compliance_issues.yaml`.

Run `pnpm prebuild` in `frontend/apps/web/` if the `/prompts` page fails in development.

## Cost Summary

Approximate LLM costs per state (as of February 2025):

| Step | Model | Est. Cost |
|------|-------|-----------|
| 3. Definitions | Claude Haiku | ~$10-20 |
| 6. Summaries | Claude Haiku | ~$100 |
| 8. Research Pipeline (full) | Claude Haiku/Sonnet | ~$50-60 (observed, per title) |
| 9. IBR Scan | Claude Haiku | ~$5-10 |
| 10. Red Flags | Claude | ~$50-100 |
| **Total** | | **~$215-290** |

Costs depend on document count and average length. NY and NJ each have ~60K regulatory documents.
