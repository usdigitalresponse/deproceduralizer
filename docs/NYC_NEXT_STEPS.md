# NYC Multi-Jurisdiction — Next Steps

> **Last updated:** 2026-02-17
> **Current branch:** `feature/nyc-jurisdiction-docs` (PR #189)

## What's Done

All three NYC data sources are in the production database:

| Source | Table | Records | Status |
|--------|-------|---------|--------|
| NYC Charter | `statutes` | 850 | ✅ Clean hierarchy |
| NYC Admin Code | `statutes` | 10,241 | ✅ Clean hierarchy |
| RCNY Rules | `regulatory_documents` | 7,777 | ✅ Clean hierarchy |

Migrations applied to prod: 0044 (RCNY schema + `regulatory_documents` state widening), 0045 (statutes CHECK), 0046 (compliance_issue_analyses + cross_references CHECK), 0048 (document_tags).

## Step 1: Merge PR #172 ✅ Merged

Merged 2026-02-17. Includes Drizzle schema, frontend NYC support, RCNY parser, migrations 0044-0046.

## Step 2: Document Jurisdiction Model (issue #158) ✅ Done

- ✅ `.claude/skills/database/schema.md` — added "Jurisdiction Model" section with table + checklist
- ✅ `CLAUDE.md` — added jurisdiction model note under Backend Patterns
- ✅ `frontend/packages/database/src/schema/constants.ts` — added JSDoc on `StateCode`
- ✅ `frontend/apps/web/src/types/state.ts` — added comment on `STATE_CONFIG`
- ✅ Fixed stale `cross_references_state_check` in schema.md (was missing NYC)

## Step 3: Document Tags Table (issue #161) ✅ Done

- ✅ Migration 0048: `document_tags` table with `UNIQUE(document_id, tag)`
- ✅ Drizzle schema (`document-tags.ts`) with relations
- ✅ `--tag` flag on `scan_compliance_issues.py` (optional, backwards compatible)
- ✅ `--state nyc` choice added to scanner + `NYC_CONFIG` in config.py
- ✅ `BasePatternSearcher.search()` accepts `tag` param (JOIN filter on `document_tags`)
- ✅ schema.md updated with `document_tags` table + tag conventions

## Step 4: Verify/Refresh NYC Statute Linking (issue #170) ✅ Done

- ✅ NYC statute data verified: 850 Charter + 10,241 Admin Code (imported 2026-02-16)
- ✅ NYCRR→NYC links: 96 created (84 matched to DB statutes)
- ✅ RCNY→NYC links: 1,626 created (1,496 matched) — extended script with `--source nyc`
- ✅ Link type breakdown: 689 enabling_authority, 489 reference, 232 requirement, 216 definition
- ✅ Script supports `--source ny` (default, NYCRR) or `--source nyc` (RCNY)

## Step 5: Configure Pipeline for NYC (issue #163)

- `NYC_CONFIG` already added to compliance scanner config (Step 3)
- Test: `python backend/scripts/scan_compliance_issues.py --state nyc --dry-run` (regex scan, free)
- Tag childcare/permitting RCNY titles for scanning (RCNY Title 47 = health/childcare, needs verification)
- Run: `--state nyc --tag scan:compliance` to scan only tagged documents
- Run expensive pipeline steps only on tagged documents

## Step 5b: RCNY Linkage ✅ Done

Three categories of RCNY citation links:

| Link Type | Script | Links | Match Rate |
|-----------|--------|-------|------------|
| RCNY → NY state laws | `link_ny_statutes.py --source nyc` | 398 (370 matched) | 93% |
| RCNY → NYCRR | `run_extraction.py --state NYC` | 3,953 (3,945 resolved) | 99.8% |
| RCNY → Federal (USC/CFR) | No script (caught by pipeline) | — | Skipped |

- `link_ny_statutes.py` extended with `--source nyc` to scan RCNY for NY Consolidated Law citations
- `run_extraction.py` extended with `--state NYC` to scan RCNY for NYCRR citations
- Added RCNY-style law name variants to `ny_law_names.py` (e.g., "New York State Criminal Procedure" → CPL)
- Fixed section suffix case normalization (`114-b` → `114-B` to match DB format)
- Federal citations will be captured when the compliance pipeline runs on RCNY (Step 5)

## Step 6: Cross-Jurisdiction Links (issue #162)

- Add `link_type`, `source_jurisdiction`, `target_jurisdiction` to `cross_references`
- Backfill existing data with jurisdiction metadata

## Older Issues (Lower Priority)

- **#45** — Verify compliance issue detection (spot-check)
- **#31** — Investigate 3,146 unlinked NY definitions
- **#16** — Table parsing in regulations
- **#11** — Extraneous newlines in regulation display
