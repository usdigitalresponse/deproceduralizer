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

- `apps/web/` - Next.js frontend for viewing red flag analysis results

## What We Ran

1. Ran `full_pipeline.py` for the initial downloading of NY regulation data
2. Ran `populate_hierarchy.py` to build out the hierarchy structure
3. Testing LLM analysis stuff with `analyze_red_flags.py`

## Goal

Consolidate these scripts so there's a single clear pipeline that does everything from start to finish. Right now you need to know which scripts to run in which order.

## Setup

See `DATABASE_SETUP.md` for Postgres setup instructions.

```bash
pip install -r requirements.txt
```
