# New York Regulations Scraper

This repo scrapes and processes New York state regulations. It's currently a bit ad hoc as we're iterating on the approach.

## Current State

The codebase has grown organically and isn't yet a clean start-to-finish pipeline. Here's what exists:

### Key Scripts

- **`full_pipeline.py`** - The main script used to download and process NY regulations data initially
- **`populate_hierarchy.py`** - Populates hierarchy/structure data for regulations
- **`analyze_red_flags.py`** - LLM-based analysis we're testing out for identifying potential issues in regulations
- **`ny_regulations_scraper.py`** - Core scraping logic
- **`migrate_to_postgres.py`** - Database migration utilities

### Data

- `individual_regulations/` - Individual regulation JSON files
- `ny_regulations_from_cache.json` - Cached scraped data
- `red_flag_analysis_*.csv/json` - Output from LLM analysis

### Web Frontend

- `apps/web/` - Next.js frontend for viewing red flag analysis results with SSR data fetching
- `packages/database/` - Shared database package with Drizzle ORM schema and repositories

## Project Structure

This is a pnpm monorepo with the following structure:

```
deproceduralizer/
├── apps/
│   └── web/              # Next.js frontend
├── packages/
│   └── database/         # Shared Drizzle ORM package
├── pnpm-workspace.yaml   # Monorepo config
└── ...
```

## What We Ran

1. Ran `full_pipeline.py` for the initial downloading of NY regulation data
2. Ran `populate_hierarchy.py` to build out the hierarchy structure
3. Testing LLM analysis stuff with `analyze_red_flags.py`

## Goal

Consolidate these scripts so there's a single clear pipeline that does everything from start to finish. Right now you need to know which scripts to run in which order.

## Setup

### Prerequisites

- Node.js 18+
- pnpm (`npm install -g pnpm`)
- Python 3.10+
- PostgreSQL (or use Neon cloud database)

### Database Setup

See `DATABASE_SETUP.md` for Postgres setup instructions.

### Environment Variables

Create a `.env` file in the project root with:

```bash
DATABASE_URL=postgresql://user:password@host:port/dbname?sslmode=require
```

For the web app, also create `apps/web/.env.local` with the same `DATABASE_URL`.

### Installation

```bash
# Install Python dependencies
pip install -r requirements.txt

# Install Node.js dependencies
pnpm install
```

### Running the Web Frontend

```bash
# Development mode
cd apps/web
pnpm dev

# Or from the root
pnpm --filter web dev
```

### Building for Production

```bash
pnpm --filter web build
```

## Web Frontend Features

The web frontend includes:

- **SSR data fetching** - Data is loaded server-side from the PostgreSQL database
- **Red flag viewer** - View and search regulatory compliance issues
- **Reviewer workflow** - Review and flag red flags with:
  - Review status (unreviewed, confirmed, false_positive, needs_context, deferred)
  - Priority levels (1-5)
  - Impact type classification
  - Reviewer notes
  - Automatic reviewer name persistence via localStorage

## Database Schema

The database includes the following tables:

- `regulatory_documents` - Regulation text and metadata
- `analyses` - LLM analysis results
- `red_flags` - Identified compliance issues with reviewer fields
- `statute_references` - Legal citations

See `packages/database/src/schema/` for the full Drizzle schema definitions.

## Deployment

### Vercel

1. Link your project: `vercel link`
2. Add the `DATABASE_URL` environment variable:
   ```bash
   echo 'your-database-url' | vercel env add DATABASE_URL production
   ```
3. Deploy: `vercel --prod`
