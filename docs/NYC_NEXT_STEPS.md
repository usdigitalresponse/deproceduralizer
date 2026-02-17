# NYC Multi-Jurisdiction — Next Steps

> **Last updated:** 2026-02-16
> **Current branch:** `feature/rcny-scraper` (PR #172)

## What's Done

All three NYC data sources are in the production database:

| Source | Table | Records | Status |
|--------|-------|---------|--------|
| NYC Charter | `statutes` | 850 | ✅ Clean hierarchy |
| NYC Admin Code | `statutes` | 10,241 | ✅ Clean hierarchy |
| RCNY Rules | `regulatory_documents` | 7,777 | ✅ Clean hierarchy |

Migrations applied to prod: 0044 (RCNY schema + `regulatory_documents` state widening), 0045 (statutes CHECK), 0046 (compliance_issue_analyses + cross_references CHECK).

## Step 1: Merge PR #172 ✅ Ready

All review items addressed. Build passes, E2E tests pass.

What's in the PR:
- ✅ Drizzle schema: `rcny_*` columns, `nyc_*` statute columns, `'nyc'` in StateCode/VALID_STATES
- ✅ Frontend: NYC in STATE_CONFIG (emerald accent), CSS variables, URL parsers, static routes
- ✅ All components use `formatStateCitation` (no hardcoded NYCRR/NJAC formatters)
- ✅ `StateContextBar` uses dynamic CSS variable names (not hardcoded ternary)
- ✅ `isValidState` guards replace `as StateCode` casts
- ✅ Backend: RCNY parser with logging/ETA, DB null checks, JSON error handling, exit codes
- ✅ `get_filtered_documents` handles RCNY prefix/columns
- ✅ Migrations 0044-0046 widen CHECK constraints on all tables with state column
- ✅ schema.md documents RCNY columns and new indexes

**Action: merge PR #172.**

## Step 2: Document Jurisdiction Model (issue #158)

Docs-only PR. Update these files:
- `.claude/skills/database/schema.md` — add "Jurisdiction Model" section explaining `state` column semantics
- `CLAUDE.md` — add jurisdiction model note under Backend Patterns
- `frontend/packages/database/src/schema/constants.ts` — add JSDoc comment on `StateCode`
- `frontend/apps/web/src/types/state.ts` — add comment on `STATE_CONFIG`

## Step 3: Document Tags Table (issue #161)

- Write migration for `document_tags` table (see issue #161 for schema)
- Add Drizzle schema
- Add `--tag` flag to `scan_compliance_issues.py` (optional, backwards compatible)
- This enables selective scanning of NYC titles

## Step 4: Verify/Refresh NYC Statute Linking (issue #170)

- Run `cd backend && uv run python scripts/link_nyc_statutes.py --dry-run` to check existing RCNY→NYC links
- If links found, run without `--dry-run`
- Consider extending the linker for RCNY→NYC statute links (new script or extend existing)

## Step 5: Configure Pipeline for NYC (issue #163)

- Add `NYC_CONFIG` StateConfig in backend
- Test: `python backend/scripts/scan_compliance_issues.py --state nyc` (regex scan, free)
- Tag childcare/permitting RCNY titles for scanning (RCNY Title 47 = health/childcare, needs verification)
- Run expensive pipeline steps only on tagged documents

## Step 6: Cross-Jurisdiction Links (issue #162)

- Add `link_type`, `source_jurisdiction`, `target_jurisdiction` to `cross_references`
- Build RCNY↔NYCRR citation extractor
- Backfill existing data

## Older Issues (Lower Priority)

- **#45** — Verify compliance issue detection (spot-check)
- **#31** — Investigate 3,146 unlinked NY definitions
- **#16** — Table parsing in regulations
- **#11** — Extraneous newlines in regulation display
