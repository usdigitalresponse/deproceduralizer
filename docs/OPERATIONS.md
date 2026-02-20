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
11. JenAI Pipeline    →  jenai_analyses + jenai_issues tables (LLM single-pass)
12. Refresh Stats     →  precomputed counts on regulatory_documents
```

**Step dependencies:**
- Steps 1-4 are sequential prerequisites
- Step 5 (cross-references) can run anytime after Step 1 (only needs scraped documents)
- Steps 6 and 7 can run in parallel (no dependency on each other)
- **Step 8 depends on Steps 5 and 6** — the research pipeline uses document summaries and cross-reference summaries as LLM context
- Steps 9-10 are independent of 8 and can run anytime after Step 1
- **Step 11 depends on Steps 5 and 6** — JenAI uses summaries, cross-refs, and definitions as rich LLM context
- Step 12 should run last (after any step that changes counts)

## Full State Analysis (e.g., NY)

Replace `NY`/`ny` with `NJ`/`nj` for New Jersey or `NYC`/`nyc` for New York City. All commands run from the project root unless noted.

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
cd backend

# Scan NYCRR for NY state law citations (default):
python3 scripts/link_ny_statutes.py --dry-run
python3 scripts/link_ny_statutes.py

# Scan RCNY for NY state law citations:
python3 scripts/link_ny_statutes.py --source nyc --dry-run
python3 scripts/link_ny_statutes.py --source nyc

# Filter by law or title:
python3 scripts/link_ny_statutes.py --law SOS --title 18
python3 scripts/link_ny_statutes.py --source nyc --title 47
```

| Flag | Description |
|------|-------------|
| `--dry-run` | Preview citations found without writing to DB |
| `--source ny\|nyc` | Which regulations to scan: `ny` (NYCRR, default) or `nyc` (RCNY) |
| `--law SOS` | Only link citations to a specific law |
| `--title 18` | Only scan regulations from a specific title |

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

#### RCNY (Rules of the City of New York)

Parsed from ALP XML export. **Manual download** from American Legal Publishing:
https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-1
→ "Rules of the City of New York" → "Download" → select XML format

Extract `XML.zip` to `data/rcny_xml/` (the XML files should be at `data/rcny_xml/XML/*.xml`).

```bash
cd backend

# Parse XML and save to JSON (no DB):
python3 scripts/rcny_parser.py --parse-only

# Full pipeline (parse → JSON → DB → hierarchy):
python3 scripts/rcny_parser.py

# Use cached JSON (skip re-parsing):
python3 scripts/rcny_parser.py --skip-parse

# Parse only Title 1 (for testing):
python3 scripts/rcny_parser.py --title 1
```

| Flag | Description |
|------|-------------|
| `--parse-only` | Only parse XML + save JSON, skip DB |
| `--skip-parse` | Use cached JSON, skip XML parsing |
| `--skip-db` | Skip database operations |
| `--hierarchy-only` | Only update parent_id relationships |
| `--title N` | Only parse a specific title number |

| Cost | Time |
|------|------|
| Free (local XML files) | ~4s parse, ~2min DB ingest |

#### NYC Health Code

Parsed from ALP HTML export. The Health Code (Articles 1-205 under Titles I-V) covers child care,
environmental sanitation, vital statistics, etc.

**Manual download** from American Legal Publishing:
https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-1
→ Navigate to "New York City Health Code" → use browser "Save As" to save the full page HTML.

Save as `newyorkcity-ny-1_health.html` in the project root.

```bash
cd backend

# Parse HTML and save to JSON (no DB):
python3 scripts/health_code_parser.py --parse-only

# Full pipeline (parse → JSON → DB → hierarchy):
python3 scripts/health_code_parser.py

# Use cached JSON (skip re-parsing):
python3 scripts/health_code_parser.py --skip-parse

# Parse only Title III (child care articles):
python3 scripts/health_code_parser.py --title III
```

| Flag | Description |
|------|-------------|
| `--parse-only` | Only parse HTML + save JSON, skip DB |
| `--skip-parse` | Use cached JSON, skip HTML parsing |
| `--skip-db` | Skip database operations |
| `--title ROMAN` | Only parse a specific title (e.g., III) |

| Cost | Time |
|------|------|
| Free (local HTML file) | ~1s parse, ~1min DB ingest |

**Note:** Health Code records use the same `rcny_*` DB fields as RCNY data, with
`source_index` offset at 100,000 to avoid collision. `state='NYC'` for both.

#### Link NYC Statutes to Regulations

```bash
cd backend

# Scan NYCRR for NYC citations (default):
python3 scripts/link_nyc_statutes.py --dry-run
python3 scripts/link_nyc_statutes.py

# Scan RCNY for NYC citations:
python3 scripts/link_nyc_statutes.py --source nyc --dry-run
python3 scripts/link_nyc_statutes.py --source nyc

# Filter by title:
python3 scripts/link_nyc_statutes.py --title 9
python3 scripts/link_nyc_statutes.py --source nyc --title 47
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
python backend/scripts/batch_definitions.py submit --state NY   # or NJ, NYC
python backend/scripts/batch_definitions.py status              # poll until "ended"
python backend/scripts/batch_definitions.py process --batch-id <id>
```

- Uses Anthropic Batch API (50% cost savings vs realtime)
- Finds sections with "definition", "glossary", "meaning of" in title/content
- Results cached in `data/outputs/batches/`
- Use `--skip-done` to avoid reprocessing, `--title 3A` to filter by title
- Subcommands: `submit`, `status`, `process`, `resume` (retry failed requests), `continue` (extract from truncated sections)
- Resume failed docs: `python backend/scripts/batch_definitions.py resume --batch-id <id>`
- Continue truncated: `python backend/scripts/batch_definitions.py continue --state NY --dry-run`

| Cost | Time |
|------|------|
| ~$ (Haiku) | Hours (batch queue, up to 24h) |

### Step 4: Link Definitions

```bash
python backend/scripts/link_definitions.py run --state NY       # or NJ, NYC
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
python3 -m scripts.cross_references.run_extraction --state NYC --output db   # RCNY → NYCRR links
```

- Extracts internal citations between regulatory documents (e.g., "18 NYCRR 505.14", "section 624.8 of this Part")
- Regex-based detection → resolution to target document IDs
- Reference types: NYCRR, NJAC, NY short-form, same-section
- NYC mode: scans RCNY text for NYCRR citations, resolves against NY regulation documents
- Use `--limit 50` to test on a subset, `--dry-run` to preview without writing
- Use `--output json` to save results to file instead of DB, `--output console` for quick summary
- Can filter by title: `--title 18` (NYCRR title for NY, RCNY title for NYC)

| Cost | Time |
|------|------|
| Free | Minutes |

### Step 6: Generate Summaries

Runs bottom-up through 5 hierarchy phases (sections → subchapters → chapters → parts → titles).

```bash
cd backend

# Run all phases for a single title (submit → poll → process → import to DB)
python3 -m scripts.summarization.cli --state NY --title 18 --run-all-phases

# NYC (flat hierarchy — only sections phase runs)
python3 -m scripts.summarization.cli --state NYC --title 3 --run-all-phases

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

Multiple titles can be summarized concurrently — each `run_phase` call passes its `batch_id` to `process_results`, which uses `batch_mapping.json` for exact directory lookup instead of globbing by phase name.

**Recovery:** If `--run-all-phases` stalls or crashes after batches were submitted (e.g., deadlock on DB import, API throttling), use the recovery script to pull completed results directly from the Anthropic API and import them:

```bash
cd backend

# Recover all missing summaries for a state
python3 -m scripts.summarization.recover_batches --state NY

# Recover for a specific title
python3 -m scripts.summarization.recover_batches --state NY --title 16

# Preview without importing
python3 -m scripts.summarization.recover_batches --state NY --dry-run

# Scan more batches (default: 100, max depends on API history)
python3 -m scripts.summarization.recover_batches --state NY --limit 500
```

**Note:** `--run-all-phases` will **resubmit** batches for any phase without local `results.json` files, even if the batch already completed on Anthropic's side. Use the recovery script first to avoid duplicate submissions.

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
- Use `--list-issues` to see all available issue types, `--limit N` to cap matches per issue type
- Use `--tag scan:compliance` to only scan documents with that tag (requires `document_tags` table, see migration 0048)
- Supports `--state nyc` for NYC/RCNY regulations

| Cost | Time |
|------|------|
| Free | Minutes |

### Step 8: Research Pipeline (LLM Analysis)

```bash
cd backend
python3 -m scripts.research_pipeline.cli --state ny --all-issues --execute  # or nyc, nj
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
| `--no-cache` | off | Disable LLM API response cache |
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
python backend/scripts/ibr_scanner.py --state ny   # or nj, nyc
```

- Detects external standards incorporated by reference (NFPA, ICC, ASTM, CFR, etc.)
- Regex search → LLM confirmation → saves confirmed IBRs
- Use `--batch` for Anthropic Batch API, `--dry-run` to search without saving

| Cost | Time |
|------|------|
| ~$ (Haiku) | Minutes to hours |

### Step 10: Red Flag Analysis

```bash
python backend/scripts/red_flags.py --state NY   # or NJ, NYC
```

- Identifies 12 categories of implementation complexity (Jennifer Pahlka's framework)
- One analysis row per document in `analyses` table
- `is_current = TRUE` marks the latest analysis per document
- Use `--skip-done` to avoid re-analyzing, `--title 5` to filter, `--sample-size N` to limit
- Use `--dry-run` to preview, `--chapter II` to filter by chapter
- Use `--use-batch-api` for 50% cheaper batch processing, `--process-batch <batch_id>` to process a completed batch
- Old analyses deleted on rerun (red_flags cascade)

| Cost | Time |
|------|------|
| $$ (Claude) | Hours |

### Step 11: JenAI Pipeline (Single-Pass Enriched Analysis)

```bash
# Dry run (default) — shows section count, no execution
cd backend && python3 -m scripts.jenai_pipeline.cli --state ny --title 18

# Filter by part (e.g., child care Parts 413-419)
cd backend && python3 -m scripts.jenai_pipeline.cli --state ny --title 18 --part 414

# Execute pipeline (limit 20 sections)
cd backend && python3 -m scripts.jenai_pipeline.cli --state ny --title 18 --execute --limit 20

# Realtime mode (faster, 2x cost)
cd backend && python3 -m scripts.jenai_pipeline.cli --state ny --title 18 --part 414 --execute --realtime

# Re-run specific document(s) by ID
cd backend && python3 -m scripts.jenai_pipeline.cli --state ny --document-id 81899 --execute --realtime

# Multiple document IDs
cd backend && python3 -m scripts.jenai_pipeline.cli --state ny --document-id 81899 78696 --execute --realtime
```

- Single-pass enriched LLM pipeline analyzing regulatory sections for implementation complexity
- Uses 14-category framework: 13 Pahlka problem categories + adversarial WORST_THING
- Full rich context upfront: ancestor summaries, sibling summaries, cross-ref summaries, full definition text
- Results in `jenai_analyses` (one row per document) + `jenai_issues` (one row per category finding)
- **Depends on:** Step 5 (cross-references) and Step 6 (summaries) for context
- Uses Anthropic Batch API (Sonnet 4.5) for cost efficiency

| Cost | Time |
|------|------|
| ~$15-40/title | Hours (batch processing) |

**CLI flags:**
- `--state ny|nj|nyc` — Jurisdiction to analyze (required)
- `--title N` — Filter by title number
- `--part N` — Filter by part number (e.g., 413 for child care)
- `--limit N` — Max sections (default: 100)
- `--execute` — Actually run (default is dry-run)
- `--include-all-types` — Include reserved, definitions, scope sections (excluded by default)
- `--force` — Re-analyze sections that already have JenAI analyses
- `--realtime` — Use realtime API instead of batch (faster but 2x cost)
- `--no-cache` — Disable LLM API response cache
- `--document-id ID [ID ...]` — Target specific document ID(s) (auto-disables exclude_analyzed)

### Step 12: Refresh Hierarchy Stats

```bash
python backend/scripts/refresh_hierarchy_stats.py --state NY   # or NJ, NYC
```

- Precomputes hierarchy statistics for frontend performance
- Updates: `child_count`, `descendant_count`, `descendant_flag_count`, `descendant_analyzed_count`, `compliance_issue_count`, `descendant_compliance_issue_count`
- Run after any step that changes document counts or analysis results
- Use `--structure`, `--analysis`, `--compliance`, or `--statute-links` to refresh only specific stat types
- Use `--all-states` to refresh all states at once

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
python3 -m scripts.research_pipeline.cli --state ny --all-issues --title 18 \
  --max-tier 3 --web-search --execute \
  --limit all --global-limit no-limit

# 4. Statute mandate checks (NY only, after research pipeline)
python3 -m scripts.research_pipeline.cli --state ny --all-issues --title 18 \
  --run-statute-mandate-only --execute

# 5. Refresh hierarchy stats
python backend/scripts/refresh_hierarchy_stats.py --state NY
```

**Order matters:** Cross-references and summaries must finish before the research pipeline starts (the pipeline uses both as LLM context). The statute mandate check runs after the pipeline since it operates on pipeline results. Refresh stats runs last.

**Estimated cost per title:** ~$10-25 (summaries ~$2-5, pipeline ~$5-15, mandate checks ~$1-3)

### NYC End-to-End Example (Health Code Title III)

NYC pipeline is the same as NY, but note:
- NYC has RCNY + Health Code data (both use `state='NYC'`)
- RCNY hierarchy is flat (title/chapter/section — no subchapter/part)
- Health Code hierarchy is also flat (sections only, no chapter/title rollup in DB)
- Summarization only runs the sections phase for flat hierarchies
- Use `--skip-summary-check` on the research pipeline if many parent stub docs have no content

```bash
cd backend

# 1. Cross-references
python3 -m scripts.cross_references.run_extraction --state NYC --output db

# 2. Summaries (sections phase only for flat hierarchy)
python3 -m scripts.summarization.cli --state NYC --title 3 --run-all-phases

# 3. Research pipeline through Tier 3
python3 -m scripts.research_pipeline.cli --state nyc --all-issues --title 3 \
  --max-tier 3 --web-search --execute \
  --limit all --global-limit no-limit --skip-summary-check

# 4. Red flags
python backend/scripts/red_flags.py --state NYC --title 3

# 5. Refresh hierarchy stats
python backend/scripts/refresh_hierarchy_stats.py --state NYC
```

**Note:** `--skip-summary-check` is needed because many NYC docs are structural parent stubs with no content, making the summary percentage look low even when all summarizable sections are done.

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

### Re-process documents with HTML tables

One-time script to re-fetch HTML from Cornell Law and re-run the improved table converter
for documents whose content contains markdown tables. Needed after the `table_to_markdown()`
rewrite to fix colspan/rowspan handling.

```bash
cd backend

# Preview what would change:
python -m scripts.fix_table_content --dry-run

# Update DB (re-fetches from Cornell, ~1 req/sec):
python -m scripts.fix_table_content --execute

# Filter by state or specific doc:
python -m scripts.fix_table_content --execute --state NY
python -m scripts.fix_table_content --execute --id 200391
```

**Note:** Some source HTML tables on Cornell have inconsistent cell counts (data rows with
fewer `<td>` elements than the header). These render misaligned on Cornell too — our converter
matches the source faithfully. See issue #16 for details.

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

## Data Status (as of February 2026)

### Document Counts

| Jurisdiction | Table | Records | Source |
|-------------|-------|---------|--------|
| NY (NYCRR) | `regulatory_documents` | ~61,540 | Cornell Law scraper |
| NJ (NJAC) | `regulatory_documents` | ~60,000 | NJ.gov scraper |
| NYC (RCNY) | `regulatory_documents` | 7,777 | ALP XML export |
| NY statutes | `statutes` | 41,348 | OpenLegislation API (94 laws) |
| NJ statutes | `statutes` | ~16,000 | NJ.gov scraper |
| NYC Charter | `statutes` | 850 | Local HTML |
| NYC Admin Code | `statutes` | 10,241 | Local HTML |

### Statute Linking

| Source → Target | Links | Match Rate | Script |
|----------------|-------|------------|--------|
| NYCRR → NY laws | 6,437 | 77% matched to DB | `link_ny_statutes.py` |
| RCNY → NY laws | 398 | 93% matched | `link_ny_statutes.py --source nyc` |
| RCNY → NYCRR | 3,953 | 99.8% resolved | `run_extraction.py --state NYC` |
| RCNY → NYC laws | 1,626 | 92% matched | `link_nyc_statutes.py --source nyc` |

### Compliance Regex Matches

| State | Matches | Issue Types |
|-------|---------|-------------|
| NJ | 11,343 | 41 |
| NY | 9,571 | 41 |
| NYC | 2,008 | 41 |

### Pipeline Run History

| Run | Tier 1 | Tier 2 | Confirmed | Cost |
|-----|--------|--------|-----------|------|
| NY Title 18 (NYCRR) | 100 | 26 → 4 burdensome | 12 mandate checks (all not mandated) | $2.13 |
| NYC Title 24 (RCNY) | 100 | 5 → 2 burdensome | — | ~$0.30 |
| NYC Title 3 (Health Code) | 140 | 53 → 15 burdensome, 25 justified | T3: 6 burdensome, 6 justified | — |

### Definitions

- **28,544** definitions extracted (NY only)
- **89%** linked to source documents (25,724 of 28,544)
- **3,146** unlinked — see [issue #31](../../issues/31)
- NJ extraction: infrastructure ready, not yet run (see `DEFINITIONS_REMAINING_WORK.md`)
