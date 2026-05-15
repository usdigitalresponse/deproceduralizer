# Deproceduralizer

An AI-powered tool that helps government staff identify procedural barriers, outdated requirements, and unnecessary complexity buried in state regulations.

Built with support from the **Recoding America Fund**.

`States: NY | NJ | NYC` · `Next.js 16` · `Python 3.10+` · `Deployed on Vercel`

## What This Project Does

State administrative codes contain tens of thousands of regulatory sections — many with outdated procedural requirements (fax-only submissions, wet signatures, certified mail mandates) that are invisible at scale. No human team can read 120,000+ sections looking for these problems.

<!-- metric: ISSUE_TYPE_COUNT=49 -->
Deproceduralizer applies Jennifer Pahlka's regulatory burden framework through a combination of regex pattern matching and multi-tier LLM verification. It scans regulation text for 49 types of compliance issues, then uses Claude to filter false positives, classify burden severity, and verify findings against source statutes.

The result is an interactive web application where policy reviewers can browse regulations, review AI-identified findings, track triage decisions, and export actionable data — all organized by the regulatory hierarchy they already know.

## Table of Contents

- [Key Capabilities](#key-capabilities)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Web Application](#web-application)
- [Project Structure](#project-structure)
- [Analysis Pipeline](#analysis-pipeline)
- [Database Schema](#database-schema)
- [Database Backups](#database-backups)
- [Development](#development)
- [Deployment](#deployment)
- [Data Coverage](#data-coverage)
- [Contributing](#contributing)
- [License](#license)

## Key Capabilities

<!-- metric: ISSUE_TYPE_COUNT=49 -->
- **49 compliance issue types** — wet signatures, mail-only processes, fax requirements, obsolete technology mandates, excessive documentation, and more
- **3-tier research pipeline** — regex scan → LLM filtering → LLM classification with optional web search verification
- **JenAI burden analysis** — single-pass LLM pipeline applying Jennifer Pahlka's 18-category framework, producing composite burden scores per document <!-- metric: JENAI_CATEGORIES=18 -->
- **Tournament filtering** — three-round LLM bracket over JenAI findings (importance → fixability → grouping) that surfaces 20–40 actionable recommendations (text edits + structural fixes), powering the `/jenai` strategies page
- **Fines, fees & penalties extraction** — LLM structured extraction of monetary charges (amount, who pays, responsible agency, violation) from regulations and guidance, with post-scan enrichment for activity domain, estimated annual payers, and verbatim justification quotes
- **Post-pipeline enrichments** — multi-label topic tagging on JenAI findings (50-topic taxonomy), guidance audience classification (direction/expertise/target roles), and other Batch-API enrichments that layer on top of core pipeline output
- **Hierarchical summarization** — bottom-up summaries from sections through subchapters, chapters, parts, and titles using Anthropic Batch API
- **Multi-jurisdiction support** — New York State (NYCRR), New Jersey (NJAC), and New York City (RCNY + Charter/Admin Code) with extensible scraper architecture
- **Guidance documents** — sub-regulatory ADMs, LCMs, INFs, GIS, TSBs imported from the `nys-documents` catalog; a dedicated multi-step pipeline classifies them, detects supersedure chains, extracts cross-references to NYCRR and other guidance, and runs the same compliance scans as formal regulations
- **Human review workflow** — review queues with keyboard navigation, status tracking, priority assignment, and reviewer notes
- **Developer mode** — implementation tracking, developer assignment, and resolution status for reviewed findings
- **IBR detection** — identifies external standards incorporated by reference (NFPA, ICC, ASTM, CFR)
- **Analytics dashboard** — visualizations of compliance issue distribution, severity trends, and pipeline coverage
- **Statute mandate checking** — verifies whether cited statutes actually mandate flagged requirements (NY)
- **Cross-reference extraction** — maps internal citations between regulatory documents for contextual analysis
- **Saved items & marker groups** — save and organize regulations, guidance, fines, and analyses of interest for focused review

## Architecture

```
Cornell Law Website (Regulations + Statutes)
        ↓
    Scraper Scripts (ny/nj_regulations_scraper.py, ny_statutes.py)
        ↓
    JSON cache (data/scraped_data/, data/nj_scraped_data/)
        ↓
    [Built-in: migrate_regulations_to_db() + refresh_all_stats()]
        ↓
    PostgreSQL (Neon)
        ↓
    Analysis Pipeline (13 steps — see "Analysis Pipeline" below for the
                       canonical sequence; plus a separate Guidance Import
                       pipeline that loads sub-regulatory documents)
        ↓
    Next.js Web App (server actions query DB directly via Drizzle)
        ↓
    Human Review + Analytics
```

The Python backend handles scraping and AI analysis, writing results to PostgreSQL. The Next.js frontend reads from the same database via Drizzle ORM server actions — it never calls the Python backend directly.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Python 3.10+, Claude API (Anthropic), psycopg, Pydantic |
| Database | PostgreSQL via Neon, Drizzle ORM |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4, Radix UI |
| Visualization | D3, Visx, Nivo |
| Testing | Playwright (E2E smoke tests) |
| Package Manager | pnpm 9+ (workspaces monorepo) |
| Deployment | Vercel |

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- pnpm 9+ (`npm install -g pnpm`)
- PostgreSQL (or [Neon](https://neon.tech) cloud database)
- Anthropic API key (for Claude LLM analysis)

### Install

```bash
# Python dependencies
uv pip install -r backend/requirements.txt

# Node.js dependencies
cd frontend && pnpm install
```

### Environment

Create a `.env` file in the project root:

```bash
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
ANTHROPIC_API_KEY=sk-ant-...
```

For the web app, also create `frontend/apps/web/.env.local`:

```bash
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
```

### Database

See [`DATABASE_SETUP.md`](DATABASE_SETUP.md) for Postgres/Neon setup and migration instructions.

### Start the Web App

```bash
cd frontend/apps/web
pnpm dev --port 3010
```

Open http://localhost:3010 to browse the application immediately (assuming the database is populated).

### Run the Pipeline

<!-- metric: PIPELINE_STEPS=13 -->
The full analysis pipeline has 13 steps (plus a separate guidance-import pipeline). For a quick demo on a single title:

```bash
# Scrape NY regulations (includes DB migration)
python backend/scripts/ny_regulations_scraper.py

# Scan compliance issues (regex only, free, fast)
python backend/scripts/scan_compliance_issues.py --state ny
```

See [`docs/OPERATIONS.md`](docs/OPERATIONS.md) for the complete runbook with all steps, flags, cost estimates, and timing.

## Web Application

### Routes

| Route | Description |
|-------|-------------|
| `/` | Dashboard — cross-state overview and summary metrics |
| `/[state]` | Table View — paginated regulations table with search and filters |
| `/[state]/browse` | Browse — interactive hierarchy tree browser |
| `/[state]/search` | Search — full-text search across regulations with filters |
| `/[state]/definitions` | Glossary — definitions with A-Z filter, list/grouped views |
| `/[state]/statutes` | Statutes — browse linked state statutes |
| `/[state]/statutes/[id]` | Statute Detail — individual statute with linked regulations |
| `/[state]/guidance` | Guidance — sub-regulatory ADMs/LCMs/INFs from state agencies |
| `/[state]/ibr` | Standards (IBR) — incorporated-by-reference standards browser |
| `/[state]/fines` | Fines, Fees & Penalties — monetary charges with agency and who-pays breakdowns |
| `/[state]/jenai` | JenAI Strategies — single-pass burden analysis explorer |
| `/[state]/burden` | Burden — JenAI 18-category composite burden scores and drill-down |
| `/[state]/tags` | Tags — cross-domain tag analytics across regulations, guidance, fines, JenAI |
| `/[state]/review` | Review Mode — queues for compliance issues, definitions |
| `/[state]/review?mode=developer` | Developer Mode — implementation tracking and assignment |
| `/[state]/pipeline` | Pipeline — research pipeline status, funnel visualization, drill-downs |
| `/[state]/saved` | Saved — bookmarked regulations, guidance, fines, and analyses organized by marker group |
| `/[state]/analytics` | Analytics — compliance issue distribution and severity visualizations |
| `/[state]/regulations/[id]` | Regulation Detail — full text with analysis, flags, and cross-references |
| `/prompts` | Prompts — view and provide feedback on LLM prompts |
| `/onboarding` | Onboarding — first-run walkthrough for new reviewers |

### Features

**Dashboard** — Cross-state summary with key metrics, recent activity, and quick navigation to state-specific views.

**Table View** — Paginated regulation table with search. Filter by severity, complexity, flags, implementation issues, technical review, and reporting requirements. Sort by max severity, flag count, title, or complexity.

**Browse Hierarchy** — Interactive tree view of the regulation structure. Expand/collapse nodes, filter by analyzed status, flags, severity, or definitions. Shows descendant counts and max severity at each level.

**Glossary** — Searchable definitions with A-Z letter filter. List (flat) and Grouped (aggregated terms) view modes. Quality indicators based on overlap scoring, with links to source regulations.

**Statutes** — Browse state statutes linked to regulations. View which regulatory sections cite each statute and how requirements flow from legislation to administrative code.

**Standards (IBR)** — Browse external standards incorporated by reference in regulations (NFPA, ICC, ASTM, CFR). Shows which regulations reference each standard.

**Review Mode** — Separate queues for compliance issues and definitions. Filter by status, severity, category, or issue type. Keyboard navigation (j/k to navigate, n for next unreviewed, v to view regulation). Update items with review status, priority, impact type, notes, and reviewer name. Progress indicators showing review completion.

**Developer Mode** — Track implementation status of reviewed items. Developer assignment, resolution tracking (Implemented/Not Implemented), and "Need More Info" queue for back-and-forth discussions.

**Pipeline** — Monitor research pipeline execution with subtabs for different views, a research funnel visualization showing how candidates flow through tiers, and drill-down capabilities for investigating specific issues.

**Bookmarks** — Save regulations of interest for focused review sessions. Organize and manage saved items.

**Analytics** — Visualizations of compliance issue distribution across issue types and states, severity breakdowns, and pipeline coverage metrics.

## Project Structure

```
deproceduralizer/
├── backend/                              # Python backend
│   ├── config.py                         # Path configuration
│   ├── lib/                              # DB, LLM, parsing utilities
│   ├── requirements.txt                  # Python dependencies
│   └── scripts/                          # Analysis pipeline scripts
│       ├── ny_regulations_scraper.py     # NY scraper (includes DB migration)
│       ├── nj_regulations_scraper.py     # NJ scraper (includes DB migration)
│       ├── scan_compliance_issues.py     # Regex compliance issue scanner
│       ├── batch_definitions.py          # Batch definition extraction
│       ├── ibr_scanner.py                # Incorporation by reference scanner
│       ├── fines_scanner.py              # Fines/fees/penalties LLM extraction
│       ├── enrich_fines_activity.py      # Fines activity-category + payer-volume enrichment
│       ├── enrich_guidance_audience.py   # Guidance audience direction/expertise/role
│       ├── classify_topics.py            # JenAI 50-topic multi-label tagging
│       ├── jenai_tournament.py           # 3-round tournament filtering over JenAI findings
│       ├── import_tournament_results.py  # Load tournament JSON into DB
│       ├── research_pipeline/            # 3-tier compliance research pipeline
│       ├── jenai_pipeline/               # Single-pass 18-category burden analysis
│       ├── guidance_pipeline/            # Guidance import + classify + supersedure + refs
│       ├── summarization/                # Hierarchical summarization
│       ├── cross_references/             # Internal citation extraction
│       └── ...
│
├── frontend/                             # Next.js monorepo
│   ├── pnpm-workspace.yaml              # Monorepo config
│   ├── apps/
│   │   └── web/                          # Main web application
│   │       ├── src/
│   │       │   ├── app/                  # Next.js App Router (routes)
│   │       │   ├── components/           # React components
│   │       │   │   ├── analytics/        # Analytics visualizations
│   │       │   │   ├── browse/           # Hierarchy tree browser
│   │       │   │   ├── home/             # Dashboard components
│   │       │   │   ├── ibr/              # IBR standards browser
│   │       │   │   ├── issues/           # Compliance issues
│   │       │   │   ├── review/           # Review queue components
│   │       │   │   ├── statutes/         # Statute browser
│   │       │   │   └── ui/              # Shared UI primitives
│   │       │   └── lib/
│   │       │       ├── actions/          # Server actions (data access)
│   │       │       ├── constants/        # Centralized enums, nav config
│   │       │       └── url/              # nuqs URL state parsers
│   │       ├── e2e/                      # Playwright smoke tests
│   │       └── STYLE_GUIDE.md            # Component style guide
│   └── packages/
│       └── database/                     # Shared Drizzle ORM package
│           ├── src/schema/               # Table definitions
│           ├── src/repositories/         # Data access layer
│           └── migrations/               # DDL migrations
│
├── prompts/                              # LLM prompt definitions (YAML)
│   ├── core.yaml                         # Definitions prompts
│   ├── compliance_issues.yaml            # 49 issue types with patterns
│   ├── jenai.yaml                        # 18-category Pahlka burden framework
│   ├── research_pipeline.yaml            # 3-tier research pipeline prompts
│   ├── topic_classification.yaml         # Topic taxonomy prompts
│   ├── tournament.yaml                   # Prompt-tournament evaluation
│   └── issue_configs/                    # Per-issue-type prompt overrides
│
├── data/                                 # Generated/exported data artifacts
│   ├── db_backup/<UTC-timestamp>/        # Point-in-time JSONL DB snapshots
│   ├── outputs/                          # Pipeline output artifacts
│   └── summaries/                        # Summarization batch outputs
│
├── scripts/
│   ├── db-query.sh                       # Postgres query helpers
│   └── export_db_to_flatfiles.py         # DB → JSONL snapshot exporter
│
├── docs/
│   └── OPERATIONS.md                     # Pipeline runbook
│
├── .claude/                              # Claude Code configuration
│   ├── hooks/                            # Workflow automation hooks
│   └── skills/                           # Domain-specific skill docs
│
├── DATABASE_SETUP.md                     # Database setup guide (incl. restore-from-snapshot)
└── .env                                  # Environment variables (gitignored)
```

## Analysis Pipeline

The full pipeline transforms raw regulation text into structured, reviewable findings.

1. **Scrape** — Fetch regulations from Cornell Law into JSON cache, then migrate to PostgreSQL
2. **Exclude** — Mark non-regulatory sections (executive orders, military code, data tables) to skip in analysis
3. **Regulatory Status** — Detect repealed, reserved, recodified, or expired sections
4. **Definitions** — Extract defined terms using Anthropic Batch API (Haiku)
5. **Link Definitions** — Match definitions to documents where terms appear
6. **Cross-References** — Extract internal citations between regulatory documents
7. **Summaries** — Generate hierarchical summaries (sections → subchapters → chapters → parts → titles)
8. **Compliance Scan** — Regex-only detection of 49 compliance issue types (no LLM, free) <!-- metric: ISSUE_TYPE_COUNT=49 -->
9. **Research Pipeline** — 3-tier LLM analysis: filter false positives → classify burden/severity → web search verification
10. **IBR Scan** — Detect external standards incorporated by reference
11. **Fines Scan** — LLM structured extraction of fines, fees, penalties, surcharges, forfeitures
12. **JenAI Pipeline** — Single-pass LLM analysis applying the 18-category Pahlka burden framework <!-- metric: JENAI_CATEGORIES=18 -->
13. **Refresh Stats** — Precompute hierarchy statistics for frontend performance

**Dependencies:** Cross-References (6) can run anytime after Scrape (1). Summaries (7) and Compliance Scan (8) can run in parallel. Research Pipeline (9) and JenAI Pipeline (12) both depend on Cross-References (6) and Summaries (7). IBR (10) and Fines (11) are independent of the LLM pipelines. Refresh Stats (13) runs last.

> Note: `docs/OPERATIONS.md` numbers these the same way conceptually but labels Exclude as **1b** and Fines as **9b** (sub-steps grouped with their parent). The runbook is the source of truth for commands and flags.

### Guidance Documents Pipeline (separate)

A standalone multi-step pipeline (`python3 -m scripts.guidance_pipeline`) loads sub-regulatory documents from the `nys-documents` catalog and enriches them. Sub-steps:

| Sub-step | Flag | Output |
|----------|------|--------|
| Import | `--execute` | `guidance_documents` rows (catalog id, canonical ref, content, metadata) |
| Classify | `--classify` | `policy_category`, `is_attachment` (SQL rules, no LLM) |
| Clean refs | `--clean-refs` | normalized `canonical_ref` values |
| Detect supersedure | `--detect-supersedure` | `supersedes`, `superseded_by`, `revision_of`, `status` |
| Extract content refs | `--extract-content-refs` | rows in `cross_references` from guidance to NYCRR/guidance |
| Regex scan | `--regex-scan` | `compliance_issues` rows attributed to guidance |
| Gap analysis | `--gap-analysis` | read-only coverage report by agency/year/doc_type |

Optional downstream enrichments (separate scripts): `guidance_summarization` (Batch API summaries with cited regulation context), `enrich_guidance_audience` (audience direction/expertise/target roles), readability metrics. Core sub-steps are free (SQL/regex); LLM enrichments cost ~$1–7 per full corpus.

### Post-Pipeline Analysis

Workflows that operate on top of the core pipeline output:

- **JenAI Tournament** (`backend/scripts/jenai_tournament.py`) — Three-round LLM bracket (importance → tournament → pattern grouping) over JenAI findings, run as two passes (text edits + structural fixes). Outputs to `tournament_patterns`, `tournament_examples`, and `tournament_named_findings` tables; results feed the `/[state]/jenai` strategies page. Full run is ~$15 / ~40 min on Haiku 4.5. Import via `import_tournament_results.py`.
- **Topic Classification** (`backend/scripts/classify_topics.py`) — Multi-label tagging of JenAI findings against a 50-topic taxonomy. Writes to `jenai_issues.topics` (GIN-indexed). Invoked automatically at the tail end of the JenAI pipeline; can also be re-run standalone with `--execute`.
- **Fines Activity Enrichment** (`backend/scripts/enrich_fines_activity.py`) — Classifies fines into 17 activity domains, estimates annual payer volume buckets, and extracts verbatim justification quotes. Updates columns on `fines_fees_penalties`.
- **Guidance Audience Enrichment** (`backend/scripts/enrich_guidance_audience.py`) — Classifies guidance documents by audience direction (public/government), expertise level (lay/specialized/mixed), and target-audience tags. Updates columns on `guidance_documents`.

> **Status: PROTOTYPED** — A **Top-N Burden Memos** pipeline that uses headless CLI agents (`claude -p` / `gemini -p`) with web search and DB query tools to generate long-form structured burden-analysis writeups per top-burden document is currently prototyped on branch `worktree-shimmering-dancing-umbrella`. Thirty manually-validated example memos live in `docs/top-30-burden-analysis/` on that branch, alongside `META-PLAN-automated-burden-analysis.md` which proposes JSON output stored in three new tables (`burden_analysis_reports`, `burden_finding_reviews`, `burden_textual_changes`). Not yet merged to `main`.

See [`docs/OPERATIONS.md`](docs/OPERATIONS.md) for the complete runbook with commands, flags, cost estimates, and timing for each step.

## Database Schema

### Core Tables

| Table | Purpose |
|-------|---------|
| `regulatory_documents` | Regulation text, metadata, hierarchy, denormalized stats |
| `guidance_documents` | Sub-regulatory guidance (ADMs, LCMs, INFs, GIS, TSBs) imported from `nys-documents` |
| `agencies` | Canonical agency lookup for deduplicating `responsible_agency` across pipelines |
| `definitions` | Extracted defined terms with scope tracking |
| `definition_document_occurrences` | Links definitions to documents where terms appear |
| `compliance_issues` | Regex-matched compliance issue candidates (49 types) | <!-- metric: ISSUE_TYPE_COUNT=49 -->
| `compliance_issue_analyses` | LLM analysis + human review per document/issue type |
| `jenai_analyses` | JenAI single-pass burden analysis, one row per document |
| `jenai_issues` | Per-category findings (18 categories) with multi-label `topics` (50-topic taxonomy), linked to `jenai_analyses` |
| `tournament_patterns` | Mega-patterns produced by JenAI tournament filtering (per pass) |
| `tournament_examples` | Top-5 example findings per tournament pattern |
| `tournament_named_findings` | Named pass-1 tournament findings ("quick hits") |
| `fines_fees_penalties` | Structured extraction of monetary charges from regulations and guidance |
| `statute_references` | Legal citations extracted from regulations (USC, CFR, state) |
| `regulation_statute_links` | Many-to-many crosswalk between regulations and statutes |
| `statute_mandate_checks` | Whether cited statutes actually mandate flagged issues |
| `cross_references` | Internal citations between regulatory documents |
| `incorporations_by_reference` | External standards referenced in regulations |

See [`.claude/skills/database/schema.md`](.claude/skills/database/schema.md) for complete schema documentation, or [`frontend/packages/database/src/schema/`](frontend/packages/database/src/schema/) for Drizzle definitions.

## Database Backups

This repository doubles as a versioned mirror of the production database. Point-in-time snapshots live under [`data/db_backup/<UTC-timestamp>/`](data/db_backup/) — see [`data/db_backup/README.md`](data/db_backup/README.md) for the snapshot index.

Each snapshot contains:

- `schema.sql` — full `pg_dump --schema-only` of the `public` schema.
- `manifest.json` — per-file row counts, sizes, and sha256 hashes.
- `<table>.jsonl.zip` for each normal table; large tables are split into `<table>/<table>.part-NNN.jsonl.zip` chunks so every artifact stays under GitHub's 100 MB hard limit.
- `sensitive/` — schema-only dumps (and PII-redacted sample rows where useful) for tables containing user data (`share_tokens`, `bookmarks`, `document_notes`, `eval_human_votes`, `prompt_feedback`).
- `llm_api_cache` is excluded entirely (regeneratable and may contain raw prompts).

**Taking a new snapshot** — run from inside the active `deproceduralizer` working copy (where `DATABASE_URL` is set in `.env.local`):

```bash
cd /path/to/deproceduralizer
set -a && source .env.local && set +a
python3 /path/to/deproceduralizer-backup/scripts/export_db_to_flatfiles.py \
  --out-dir .db_backup_staging/$(date -u +%Y-%m-%dT%H-%M-%SZ)
# then mv the staged directory into deproceduralizer-backup/data/db_backup/ and commit
```

**Restoring from a snapshot** — see [`DATABASE_SETUP.md#restoring-from-a-snapshot`](DATABASE_SETUP.md#restoring-from-a-snapshot).

## Development

### Frontend

```bash
cd frontend/apps/web

pnpm dev --port 3010   # Start dev server
pnpm build             # Production build
pnpm lint              # Run ESLint
pnpm test:e2e          # Run Playwright smoke tests
```

### Backend

```bash
# Run module-based scripts
cd backend
python3 -m scripts.research_pipeline.cli --help
python3 -m scripts.summarization.cli --help
cd scripts && python3 -m cross_references.run_extraction --help && cd ..
```

### Database

```bash
cd frontend/packages/database
pnpm generate          # Drizzle code generation after schema changes
```

### Type Checking

```bash
# TypeScript
cd frontend/packages/database && npx tsc --noEmit

# Full build (includes type checking)
cd frontend && pnpm build
```

### Prompts

All LLM prompts live in `/prompts/` (YAML). The frontend copies them during build:

```bash
# If /prompts page shows "file not found" in dev:
cd frontend/apps/web && pnpm prebuild
```

TypeScript types are auto-generated from YAML:

```bash
python scripts/generate_prompt_types.py
```

## Deployment

### Vercel

1. Link your project:
   ```bash
   vercel link
   ```

2. Add environment variables:
   ```bash
   echo 'your-database-url' | vercel env add DATABASE_URL production
   ```

3. Deploy via git push (**do NOT run `vercel --prod` directly**):
   ```bash
   git push origin main
   ```
   Vercel auto-deploys from the `main` branch. You can also push a branch and promote it in the Vercel dashboard.

## Data Coverage

| Jurisdiction | Regulation Source | Documents | Statute Sources |
|--------------|-------------------|-----------|-----------------|
| New York (NY) | NYCRR (23 titles) | ~60,000 sections | NY Consolidated Laws (OpenLegislation API) |
| New Jersey (NJ) | NJAC | ~61,000 documents | NJ Statutes |
| New York City (NYC) | RCNY | sub-state | NYC Charter + Administrative Code |

In addition to the regulatory corpora above, the database holds a **guidance documents** corpus of ADMs, LCMs, INFs, GIS, TSBs, and similar sub-regulatory directives imported from the `nys-documents` catalog. Guidance is analyzed by the same downstream pipelines (compliance scan, fines extraction, JenAI burden analysis).

## Contributing

Key conventions:

- **Monorepo** — pnpm workspaces with shared `@deproceduralizer/database` package
- **URL state** — use `nuqs` with predefined parsers from `lib/url/parsers.ts` (never raw `useSearchParams`)
- **Data access** — server actions in `lib/actions/`, always import `server-only` in database-touching modules
- **Constants** — centralize enums, nav config, and option arrays in `lib/constants/`
- **Components** — follow [`STYLE_GUIDE.md`](frontend/apps/web/STYLE_GUIDE.md) for patterns and conventions
- **Testing** — run `pnpm test:e2e` in `frontend/apps/web` before pushing

References:
- [`frontend/apps/web/STYLE_GUIDE.md`](frontend/apps/web/STYLE_GUIDE.md) — component patterns and design system
- [`docs/OPERATIONS.md`](docs/OPERATIONS.md) — pipeline runbook with all commands and costs
- [`CLAUDE.md`](CLAUDE.md) — project conventions for AI-assisted development

This project uses Claude Code hooks (`.claude/hooks/`) for workflow enforcement: pre-push test reminders, pre-commit documentation checks, and schema update validation.

## License

See LICENSE file.
