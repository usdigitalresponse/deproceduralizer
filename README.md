# Deproceduralizer

A regulatory analysis tool that identifies "red flags" — compliance issues, procedural complexity, and implementation challenges in government regulations. Uses AI-powered analysis to help policy reviewers and government staff understand and manage regulatory complexity.

Built with support from the **Recoding America Fund**.

## Overview

Deproceduralizer scrapes state regulations from Cornell Law's Legal Information Institute, analyzes them using LLM-powered detection (based on Jennifer Pahlka's framework), and provides an interactive web interface for human review and triage.

**Currently supported states:**
- New York (NYCRR)
- New Jersey (NJAC)

## Architecture

```
Cornell Law Website
        ↓
    Scraper Scripts (ny/nj_regulations_scraper.py)
        ↓
    JSON cache (data/scraped_data/, data/nj_scraped_data/)
        ↓
    [Built-in: migrate_regulations_to_db() + refresh_all_stats()]
        ↓
    PostgreSQL (Neon)
        ↓
    Analysis Scripts (red_flags.py, batch_definitions.py, compliance_issues/searcher.py)
        ↓
    Next.js Web App (server actions query DB directly via Drizzle)
        ↓
    Human Review Queue
```

> **Note:** The scrapers handle migration automatically. The UI queries PostgreSQL directly via server actions — it does not call the Python backend.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Python 3.10+, Claude API (Anthropic), psycopg, Pydantic |
| Database | PostgreSQL via Neon, Drizzle ORM |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4, Radix UI |
| Deployment | Vercel |

## Project Structure

```
deproceduralizer/
├── backend/                          # Python backend
│   ├── config.py                     # Path configuration
│   ├── shared_utils.py               # DB, LLM, parsing utilities
│   ├── requirements.txt              # Python dependencies
│   └── scripts/                      # Executable scripts
│       ├── ny_regulations_scraper.py # NY scraper (includes DB migration)
│       ├── nj_regulations_scraper.py # NJ scraper (includes DB migration)
│       ├── red_flags.py              # LLM red flag analysis
│       ├── batch_definitions.py      # Batch definition extraction
│       ├── link_definitions.py       # Link definitions to documents
│       ├── compliance_issues/        # Compliance issue detection
│       │   └── searcher.py           # Regex compliance issue scanner
│       └── ...
│
├── frontend/                         # Next.js monorepo
│   ├── pnpm-workspace.yaml           # Monorepo config
│   ├── apps/
│   │   └── web/                      # Main web application
│   │       ├── src/
│   │       │   ├── app/              # Next.js App Router
│   │       │   ├── components/       # React components
│   │       │   ├── lib/actions/      # Server actions
│   │       │   └── ...
│   │       └── ...
│   └── packages/
│       └── database/                 # Shared Drizzle ORM package
│           ├── src/schema/           # Table definitions
│           └── src/repositories/     # Data access layer
│
├── DATABASE_SETUP.md                 # Database setup guide
└── .env                              # Environment variables (gitignored)
```

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- pnpm (`npm install -g pnpm`)
- PostgreSQL (or Neon cloud database)
- Anthropic API key (for Claude LLM analysis)

### 1. Install Dependencies

```bash
# Python dependencies (use uv for package management per project standards)
uv pip install -r backend/requirements.txt
# Or with pip: pip install -r backend/requirements.txt

# Node.js dependencies
cd frontend && pnpm install
```

### 2. Configure Environment

Create a `.env` file in the project root:

```bash
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
ANTHROPIC_API_KEY=sk-ant-...
```

For the web app, also create `frontend/apps/web/.env.local` with the same `DATABASE_URL`.

### 3. Set Up Database

See `DATABASE_SETUP.md` for detailed Postgres/Neon setup instructions and how to run migrations.

### 4. Run the Pipeline

```bash
# Scrape regulations (includes DB migration and stats refresh)
python backend/scripts/ny_regulations_scraper.py
# or
python backend/scripts/nj_regulations_scraper.py

# Run analysis pipelines (after scraping)
python backend/scripts/batch_definitions.py submit --state NJ
python backend/scripts/batch_definitions.py process
python backend/scripts/link_definitions.py --state NJ
python backend/scripts/scan_compliance_issues.py --state nj
python backend/scripts/red_flags.py --state NY
python backend/scripts/detect_regulatory_status.py --state NJ
```

See `docs/OPERATIONS.md` for detailed step-by-step instructions.

### 5. Start the Web App

```bash
cd frontend/apps/web
pnpm dev
```

Open http://localhost:3000

## Backend Scripts

### Scrapers

| Script | Purpose |
|--------|---------|
| `ny_regulations_scraper.py` | Scrape NYCRR from Cornell Law. Outputs JSON files with regulation text, hierarchy, and metadata. |
| `nj_regulations_scraper.py` | Scrape NJAC from Cornell Law. Similar output format for New Jersey. |

### Data Processing

The scrapers handle migration automatically via `shared_utils.migrate_regulations_to_db()`:
- Imports scraped JSON into PostgreSQL
- Creates `regulatory_documents` records with hierarchy
- Handles re-runs safely with `ON CONFLICT`
- Refreshes denormalized stats (child counts, descendant flag counts, max severity)

| Script | Purpose |
|--------|---------|
| `refresh_hierarchy_stats.py` | Manually refresh denormalized statistics if needed. Use `--structure` for hierarchy stats, `--analysis` for flag stats, `--compliance` for compliance stats. |

### Analysis

| Script | Purpose |
|--------|---------|
| `red_flags.py` | LLM-powered analysis identifying 12 categories of implementation red flags. Uses Claude API with structured output. |
| `batch_definitions.py` | Batch LLM-powered definition extraction with caching and progress tracking. |
| `link_definitions.py` | Link extracted definitions to documents where terms appear. |
| `scan_compliance_issues.py` | Regex compliance issue detection (40+ issue types). LLM analysis via research pipeline. |
| `backfill_definition_scope.py` | Fix incomplete definition scopes. |

### Red Flag Categories

Based on Jennifer Pahlka's framework:

1. `complexity_policy_debt` — Legacy policy constraints
2. `options_become_requirements` — Optional items treated as mandatory
3. `policy_implementation_separation` — Gap between policy and implementation
4. `overwrought_legalese` — Unnecessarily complex language
5. `cascade_of_rigidity` — Cascading inflexibility
6. `mandated_steps_not_outcomes` — Process focus vs. results focus
7. `administrative_burdens` — Unnecessary administrative requirements
8. `no_feedback_loops` — Lack of evaluation mechanisms
9. `process_worship_oversight` — Over-focus on process compliance
10. `zero_risk_language` — Eliminating all flexibility
11. `frozen_technology` — Locked-in specific technologies
12. `implementation_opportunity` — Opportunities for improvement

## Web Application

### Routes

| Route | Description |
|-------|-------------|
| `/[state]` | Main regulations table with search and filters |
| `/[state]/browse` | Interactive hierarchy tree browser |
| `/[state]/review` | Review queues (red flags, compliance issues, definitions) |
| `/[state]/review?mode=developer` | Developer mode for implementation tracking |
| `/[state]/definitions` | Definitions glossary with A-Z filter |
| `/[state]/regulations/[id]` | Regulation detail with analysis |
| `/prompts` | View and provide feedback on LLM prompts |

### Features

**Regulations View**
- Paginated table with search
- Filter by: severity, complexity, has flags, implementation issues, technical review, reporting requirements
- Sort by: max severity, flag count, title, complexity

**Browse Hierarchy**
- Interactive tree view of regulation structure
- Expandable/collapsible nodes
- Filter by: analyzed, has flags, severity level, has definitions
- Shows descendant counts and max severity

**Review Queues**
- Separate queues for red flags, compliance issues, and definitions
- Filter by status, severity, category, issue type
- Keyboard navigation (j/k to navigate, n for next unreviewed, v to view regulation)
- Update each item with review status, priority, impact type, notes, and reviewer name
- Progress indicators showing review completion

**Developer Mode**
- Track implementation status of reviewed items
- Developer assignment (Michael/Abigail)
- Resolution tracking (Implemented/Not Implemented)
- "Need More Info" queue for back-and-forth discussions

**Definitions Glossary**
- Searchable glossary with A-Z letter filter
- Two view modes: List (flat) and Grouped (aggregated terms)
- Quality indicators based on overlap scoring
- Links to source regulations with citations

**Compliance Issues**
- 40+ issue types (wet signatures, mail-only, certified mail, fax, obsolete tech, etc.)
- Regex-based candidate detection with LLM verification
- Statute attribution (from_statute flag indicates if requirement is in statute or regulation-added)

## Database Schema

### Core Tables

**regulatory_documents**
- Regulation text and metadata
- Hierarchy information (parent_id, hierarchy_level, hierarchy_path)
- NYCRR/NJAC citation components
- Denormalized stats (child counts, descendant flag counts)

**analyses**
- LLM analysis results per document
- Overall complexity (HIGH/MEDIUM/LOW)
- Summary, max severity, flag count
- `is_current` flag for versioning

**red_flags**
- Individual identified issues
- Category, explanation, severity (1-10)
- Implementation approach, effort estimate
- Review fields (status, priority, impact_type, notes, reviewer)

**statute_references**
- Legal citations extracted from regulations
- USC, CFR, public laws, state statutes

**definitions**
- Extracted defined terms with scope tracking
- Definition text, scope level, cross-reference detection
- Review and developer workflow fields

**compliance_issues**
- Detected compliance violations (40+ types)
- Statute attribution (from_statute flag)
- Review workflow with developer tracking

See `.claude/skills/database/schema.md` for complete schema documentation, or `frontend/packages/database/src/schema/` for Drizzle definitions.

## Development

### Backend Development

```bash
# Run individual scripts
python backend/scripts/red_flags.py --help

# Scripts support:
# - Progress bars (tqdm)
# - Resume capability (checkpoint files)
# - Batch processing
```

### Frontend Development

```bash
cd frontend/apps/web

pnpm dev      # Start dev server (http://localhost:3000)
pnpm build    # Production build
pnpm lint     # Run ESLint

# Or from frontend root:
pnpm --filter web dev
```

### Database Package

```bash
cd frontend/packages/database

pnpm generate  # Drizzle code generation
```

### Prompts Page

The `/prompts` page displays LLM prompts from `frontend/apps/web/src/data/prompts.yaml`.
This file is copied from `prompts/core.yaml` during build:

```bash
# In dev, if /prompts shows "file not found", run:
cd frontend/apps/web && pnpm prebuild
```

The prebuild script copies `prompts/core.yaml` → `src/data/prompts.yaml`. Compliance issue prompts are in `prompts/compliance_issues.yaml` and used directly by the backend.

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

3. Deploy:
   ```bash
   vercel --prod
   ```

The web app builds from `frontend/apps/web` with the build command configured in `vercel.json`.

## Data Coverage

| State | Source | Documents |
|-------|--------|-----------|
| New York | NYCRR (23 titles) | ~60,000 sections |
| New Jersey | NJAC | ~61,000 documents |

## Claude Code Hooks

This project uses Claude Code hooks to automate development workflow reminders:

| Hook | Event | Purpose |
|------|-------|---------|
| `check-remote-changes.sh` | SessionStart | Alerts when main branch has new commits not in current branch |
| `pre-push-reminder.py` | PreToolUse (git push) | Prompts to run smoke tests before pushing |
| `pre-commit-docs-reminder.py` | PreToolUse (git commit) | Prompts to update documentation before committing |
| `schema-update-reminder.py` | PostToolUse (schema edit) | Requires schema.md update when schema changes |

Hooks are configured in `.claude/settings.json` and scripts are in `.claude/hooks/`.

## Contributing

1. **Backend**: Add new scrapers or analysis scripts in `backend/scripts/`
2. **Frontend**: Components in `frontend/apps/web/src/components/`, server actions in `lib/actions/`
3. **Database**: Schema in `frontend/packages/database/src/schema/`, migrations in `frontend/packages/database/migrations/`

## License

See LICENSE file.
