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
    Scraper Scripts (Python)
        ↓
    JSON files (per regulation)
        ↓
    migrate_to_postgres.py
        ↓
    PostgreSQL (Neon)
        ↓
    red_flags.py (LLM analysis via OpenAI)
        ↓
    Next.js Web App (Drizzle ORM)
        ↓
    Human Review Queue
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Python 3.10+, OpenAI API (GPT-5 nano), psycopg, Pydantic |
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
│       ├── ny_regulations_scraper.py # NY regulations scraper
│       ├── nj_regulations_scraper.py # NJ regulations scraper
│       ├── migrate_to_postgres.py    # Import data to DB
│       ├── red_flags.py              # LLM red flag analysis
│       ├── extract_definitions.py    # Definition extraction
│       ├── refresh_hierarchy_stats.py# Update denormalized stats
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
├── schema.sql                        # PostgreSQL schema
├── DATABASE_SETUP.md                 # Database setup guide
└── .env                              # Environment variables (gitignored)
```

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- pnpm (`npm install -g pnpm`)
- PostgreSQL (or Neon cloud database)
- OpenAI API key (for LLM analysis)

### 1. Install Dependencies

```bash
# Python dependencies
pip install -r backend/requirements.txt

# Node.js dependencies
cd frontend && pnpm install
```

### 2. Configure Environment

Create a `.env` file in the project root:

```bash
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
OPENAI_API_KEY=sk-...
```

For the web app, also create `frontend/apps/web/.env.local` with the same `DATABASE_URL`.

### 3. Set Up Database

```bash
psql $DATABASE_URL < schema.sql
```

See `DATABASE_SETUP.md` for detailed Postgres/Neon setup instructions.

### 4. Run the Pipeline

```bash
# Scrape regulations (choose state)
python backend/scripts/ny_regulations_scraper.py
# or
python backend/scripts/nj_regulations_scraper.py

# Import to database
python backend/scripts/migrate_to_postgres.py

# Update hierarchy statistics
python backend/scripts/refresh_hierarchy_stats.py --structure

# Run LLM analysis
python backend/scripts/red_flags.py

# Update analysis statistics
python backend/scripts/refresh_hierarchy_stats.py --analysis
```

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

| Script | Purpose |
|--------|---------|
| `migrate_to_postgres.py` | Import scraped JSON into PostgreSQL. Creates `regulatory_documents`, `analyses`, and `red_flags` records. Handles re-runs safely with `ON CONFLICT`. |
| `refresh_hierarchy_stats.py` | Update denormalized statistics (child counts, descendant flag counts, max severity) for fast browse queries. Run with `--structure` after import, `--analysis` after analysis. |

### Analysis

| Script | Purpose |
|--------|---------|
| `red_flags.py` | LLM-powered analysis identifying 12 categories of implementation red flags. Uses OpenAI GPT-5 nano with structured output. |
| `extract_definitions.py` | Extract defined terms from regulations with overlap scoring. |

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
| `/[state]/review` | Red flag review queue for human triage |
| `/[state]/regulations/[id]` | Regulation detail with analysis |

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

**Review Queue**
- Queue of red flags for human review
- Filter by status, severity, category
- Keyboard navigation between cards
- Update each flag with:
  - Review status (unreviewed, confirmed, false_positive, needs_context, deferred)
  - Priority (1-5)
  - Impact type (cost_savings, time_savings, accessibility, compliance_risk, operational_efficiency, citizen_experience)
  - Reviewer notes
  - Reviewer name (persisted in localStorage)

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
- Extracted defined terms
- Definition text, scope, overlap score

See `frontend/packages/database/src/schema/` for full Drizzle definitions.

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
| `schema-update-reminder.py` | PostToolUse (schema.sql edit) | Requires database.md update when schema changes |

Hooks are configured in `.claude/settings.json` and scripts are in `.claude/hooks/`.

## Contributing

1. **Backend**: Add new scrapers or analysis scripts in `backend/scripts/`
2. **Frontend**: Components in `frontend/apps/web/src/components/`, server actions in `lib/actions/`
3. **Database**: Schema changes in `frontend/packages/database/src/schema/`, update `schema.sql`

## License

See LICENSE file.
