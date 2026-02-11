# Migration Squashing (0031-0040): Status & Options

## Current Live DB State

Checked 2026-02-09. The DB is **partially migrated**:

| Migration | Description | Status |
|-----------|-------------|--------|
| 0031 | Drop legacy compliance columns | Applied |
| 0032 | Backfill analysis for searcher issues | Applied |
| 0033 | Drop analysis fields from compliance_issues | Applied |
| 0034 | Add review/dev columns to analyses | Applied |
| 0035 | Backfill review/dev data to analyses | Applied |
| 0036 | Drop review/dev columns from compliance_issues | Applied |
| 0037 | Add analysis_id FK | Applied |
| 0038 | Add run_id columns | **Partial** — `run_id` exists on `compliance_issues` but NOT on `compliance_issue_analyses` |
| 0039 | Create database views | Applied |
| 0040 | Remove V4/tier4 support | **Not applied** — `tier4_classification`, `tier4_reasoning` still exist |

## What needs to happen

### Step 1: Finish applying missing migrations to live DB

Before squashing, the live DB needs to be caught up:

```bash
# These need to be run against the live Neon DB:
# 1. Add run_id to compliance_issue_analyses (0038 was partially applied)
# 2. Apply 0040 (remove tier4 columns)
```

**Question for Michael:** Should we just run 0038 and 0040 against the live DB now? The app code already expects these to be applied (the TypeScript schema references `run_id` on analyses and doesn't reference tier4 columns).

### Step 2: Squash for future new deployments

Once the live DB is at 0040, replace the 10 individual files with one combined migration. Two approaches:

**Option A: Simple replacement**
- Delete `0031_*.sql` through `0040_*.sql`
- Create single `0031_v5_schema_normalization.sql` that does everything
- Pros: Clean history, faster new DB setup
- Cons: If any environment is stuck between 0031-0040, re-running migrations would fail

**Option B: Idempotent squash**
- Same as Option A but every SQL statement uses `IF EXISTS` / `IF NOT EXISTS` guards
- Pros: Safe to re-run on any DB state (fresh, partial, or fully migrated)
- Cons: More verbose SQL, slightly harder to read

**Recommendation:** Option B (idempotent) is safer and not much more work.

## Context

All 10 migrations represent one logical change: the "V5 normalization" that moved analysis, review, and developer fields from `compliance_issues` to `compliance_issue_analyses`. They were committed Feb 4-8, 2026.
