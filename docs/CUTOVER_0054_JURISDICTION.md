# Cutover: Migration 0054 — Rename `state` → `jurisdiction`

## Overview

Migration 0054 renames the `state` column to `jurisdiction` on 9 tables, recreates CHECK constraints, and renames unique indexes. This is a **breaking rename** — there is no backward-compatible alias, so code and DB must be updated together.

**PR:** #217 (`abigail/jurisdiction-migration`)
**Migration file:** `frontend/packages/database/migrations/0054_rename_state_to_jurisdiction.sql`

## What the migration does

- Renames `state` → `jurisdiction` on: `regulatory_documents`, `compliance_issues`, `compliance_issue_analyses`, `bookmarks`, `cross_references`, `document_notes`, `incorporations_by_reference`, `barrier_analyses`, `statutes`
- Drops and recreates 6 existing CHECK constraints with new column name
- Adds 3 new CHECK constraints (for `bookmarks`, `document_notes`, `barrier_analyses` which never had them)
- Renames unique index `idx_rd_state_source_type` → `idx_rd_jurisdiction_source_type`
- Renames unique constraint `statutes_state_citation_key` → `unique_jurisdiction_citation`
- All wrapped in a single transaction (`BEGIN`/`COMMIT`)

## Pre-requisites

- [ ] All CI checks green on PR #217
- [ ] PR reviewed and approved
- [ ] Low-traffic window selected (migration causes ~1-2 min of frontend errors)
- [ ] `$PRODUCTION_DB_URL` available in terminal
- [ ] Smoke tests passing locally: `cd frontend/apps/web && pnpm test:e2e`

## Cutover sequence

### Step 1: Merge PR #217

```bash
gh pr merge 217 --squash
```

This triggers a Vercel build (~1-2 min). The new code references `jurisdiction` columns.

### Step 2: Run migration immediately

While Vercel is building, run the migration:

```bash
psql $PRODUCTION_DB_URL -f frontend/packages/database/migrations/0054_rename_state_to_jurisdiction.sql
```

The migration is **instant** — `ALTER TABLE RENAME COLUMN` is a metadata-only operation (no data rewrite), even on tables with 130K+ rows.

### Step 3: Wait for Vercel deployment

The old Vercel deployment will error for ~1 min (it references `state` but the column is now `jurisdiction`). Once the new build goes live, everything resolves.

Check deployment status:
```bash
# Watch for the deployment to complete
gh run list --limit 3
```

## Expected downtime

~1-2 minutes between migration completing and Vercel deploying the new code. During this window, the frontend will show `column "state" does not exist` errors.

## Post-cutover verification

### 1. Spot-check the live app

Visit these pages and verify they load without errors:
- Homepage (jurisdiction selector)
- Browse page (`/ny/browse`)
- Review queue (`/ny/review`)
- Analytics (`/ny/analytics`)
- Pipeline (`/ny/pipeline`)

### 2. Run smoke tests

```bash
cd frontend/apps/web && pnpm test:e2e
```

### 3. Run drift check

```bash
bash backend/scripts/check_jurisdiction_drift.sh
```

Expected output: `PASS: No jurisdiction drift detected.`

## Follow-up: Migration 0055 (index renames)

Non-blocking, cosmetic cleanup. Renames 13 non-unique indexes from `_state` to `_jurisdiction`. Run anytime after 0054:

```bash
psql $PRODUCTION_DB_URL -f frontend/packages/database/migrations/0055_rename_state_indexes.sql
```

## Rollback procedure

If something goes catastrophically wrong after migration 0054:

```sql
BEGIN;
ALTER TABLE regulatory_documents RENAME COLUMN jurisdiction TO state;
ALTER TABLE compliance_issues RENAME COLUMN jurisdiction TO state;
ALTER TABLE compliance_issue_analyses RENAME COLUMN jurisdiction TO state;
ALTER TABLE bookmarks RENAME COLUMN jurisdiction TO state;
ALTER TABLE cross_references RENAME COLUMN jurisdiction TO state;
ALTER TABLE document_notes RENAME COLUMN jurisdiction TO state;
ALTER TABLE incorporations_by_reference RENAME COLUMN jurisdiction TO state;
ALTER TABLE barrier_analyses RENAME COLUMN jurisdiction TO state;
ALTER TABLE statutes RENAME COLUMN jurisdiction TO state;
COMMIT;
```

Then revert the PR merge on main. Note: this will also need the CHECK constraints and indexes to be renamed back — use the inverse of migration 0054.

## Notes

- The `latest_analyses` view (`migration 0039`) references `d.state` — PostgreSQL auto-resolves this after column rename, but the view's output column will still be named `state`. Cosmetic only.
- 15 non-unique index **names** retain `_state` until migration 0055 runs. Functionally correct — PostgreSQL resolves indexes by column OID, not name.
- Backend Python scripts run locally (not deployed), so they use the new `jurisdiction` references immediately after `git pull`.
