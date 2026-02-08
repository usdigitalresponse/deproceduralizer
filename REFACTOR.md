# Refactor: Consolidate compliance_issues into compliance_issue_analyses

> **Status: PROPOSED / FUTURE WORK**
> The pipeline simplification (PRs #90-#102, Feb 2026) is complete. This document proposes
> a follow-up consolidation of the two compliance tables into one. Not yet implemented.

## Problem

We have two tables that overlap heavily:

| Table | Rows | Columns | Granularity |
|-------|------|---------|-------------|
| `compliance_issues` | 11,343 | 34 | One row per **regex match** |
| `compliance_issue_analyses` | 8,526 | 74 | One row per **(document, issue_type)** pair |

The `compliance_issues` table started as a regex match store but accumulated analysis, review, and developer tracking columns over time. The research pipeline later created `compliance_issue_analyses` at the correct granularity (document-level), duplicating much of the same data.

The open PRs (#90-#98) attempt to fix this with 7 incremental migrations (0031-0037) that surgically move columns from `compliance_issues` to `compliance_issue_analyses`, then strip `compliance_issues` down to 11 columns. This works but is fragile:
- 3 destructive DROP COLUMN migrations (0031, 0033, 0036), two non-idempotent
- A "most-reviewed-wins" backfill strategy that loses 2 conflicting reviews
- 7 sequential migrations that must run in exact order
- The end result (11-column match table + 74-column analysis table + FK) is still two tables for what is conceptually one entity

## Proposal

Drop `compliance_issues` entirely. Make `compliance_issue_analyses` the single source of truth, storing regex matches as a JSONB column.

### Before (current)

```
compliance_issues (34 cols, 11,343 rows)
  ├── id, document_id, issue_type, state, occurrence_number
  ├── regex_match_pattern, regex_match_context     ← match data
  ├── requirement_found, severity, decision_rationale  ← duplicated from analyses
  ├── review_status, reviewed_by, justification_notes  ← review data
  └── developer_status, developer_assigned, ...        ← dev tracking

compliance_issue_analyses (74 cols, 8,526 rows)
  ├── id, document_id, issue_type, state
  ├── tier1_*, tier2_*, tier3_* outputs            ← pipeline results
  ├── final_severity, requirement_found            ← canonical analysis
  └── (no review/dev tracking yet)
```

### After (proposed)

```
compliance_issues (renamed from compliance_issue_analyses, ~80 cols, ~8,534 rows)
  ├── id, document_id, issue_type, state
  ├── regex_matches JSONB                          ← absorbed from old table
  ├── tier1_*, tier2_*, tier3_* outputs            ← pipeline results
  ├── final_severity, requirement_found            ← canonical analysis
  ├── review_status, reviewed_by, ...              ← review data (moved here)
  └── developer_status, developer_assigned, ...    ← dev tracking (moved here)
```

The `regex_matches` JSONB column stores the match array:
```json
[
  {
    "pattern": "shall be signed",
    "context": "...the application shall be signed in ink by the applicant...",
    "occurrence_number": 1
  },
  {
    "pattern": "original signature",
    "context": "...must bear the original signature of the licensee...",
    "occurrence_number": 2
  }
]
```

## What data exists today

Based on actual database queries (Feb 2026):

### Legacy columns (0031 targets) — fully migrated, safe to drop
| Old Column | New Column | Rows with data only in old |
|---|---|---|
| `matched_pattern` | `regex_match_pattern` | **0** |
| `matched_context` | `regex_match_context` | **0** |
| `requirement_text` | `verbatim_supporting_text` | **0** |
| `impact_assessment` | `decision_rationale` | **0** |

### Analysis columns — already in analyses table
| Column | CI rows with data | Already in CIA? |
|---|---|---|
| `requirement_found` | 11,343 | Yes |
| `is_verbatim` | 11,343 | Yes |
| `required_by_statute` | 5,887 | Yes (`cites_federal_statute`) |
| `statute_citation` | 0 | Yes (`federal_citation`) |
| `verbatim_supporting_text` | 11,343 | Yes (`verbatim_requirements`) |
| `decision_rationale` | 11,343 | Yes (`tier1_reasoning`) |

Note: 1,131 rows have severity mismatches between tables because the research pipeline updated severity during Tier 2/3. The `compliance_issue_analyses.final_severity` is the more accurate value.

### Review data — small volume, minor conflicts
| Field | Non-default rows |
|---|---|
| `review_status != 'unreviewed'` | 322 |
| `reviewed_at IS NOT NULL` | 327 |
| `justification_notes IS NOT NULL` | 306 |
| `team_notes IS NOT NULL` | 111 |
| `developer_status != 'unresolved'` | 0 |
| `developer_checked_at IS NOT NULL` | 0 |

Of 1,703 multi-match groups, only **4 have genuinely conflicting review decisions** across different regex matches. The "most-reviewed-wins" strategy from the PRs is acceptable — only 2 groups (doc 110579, doc 185200) would lose a minority review opinion.

### Orphan compliance_issues (no analysis row)
Only **8 unique (document_id, issue_type) pairs** (9 rows) exist in `compliance_issues` without a corresponding `compliance_issue_analyses` row. These are from the original searcher and need minimal analysis rows created before the merge.

## Migration plan

### Single migration: `0031_consolidate_compliance_tables.sql`

```sql
-- Step 1: Create analysis rows for the 8 orphan pairs
INSERT INTO compliance_issue_analyses (document_id, issue_type, state, ...)
SELECT ... FROM compliance_issues ci
LEFT JOIN compliance_issue_analyses cia ON ...
WHERE cia.id IS NULL AND ci.occurrence_number = 1;

-- Step 2: Add regex_matches JSONB column
ALTER TABLE compliance_issue_analyses
ADD COLUMN regex_matches JSONB DEFAULT '[]'::jsonb;

-- Step 3: Backfill regex_matches from compliance_issues
UPDATE compliance_issue_analyses cia
SET regex_matches = (
  SELECT jsonb_agg(
    jsonb_build_object(
      'pattern', ci.regex_match_pattern,
      'context', ci.regex_match_context,
      'occurrence_number', ci.occurrence_number
    ) ORDER BY ci.occurrence_number
  )
  FROM compliance_issues ci
  WHERE ci.document_id = cia.document_id
    AND ci.issue_type = cia.issue_type
);

-- Step 4: Add review/developer columns
ALTER TABLE compliance_issue_analyses
ADD COLUMN review_status VARCHAR(50) DEFAULT 'unreviewed',
ADD COLUMN reviewed_by VARCHAR(255),
ADD COLUMN reviewed_at TIMESTAMP,
ADD COLUMN justification_notes TEXT,
ADD COLUMN team_notes TEXT,
ADD COLUMN impact_type VARCHAR(100),
ADD COLUMN reviewer_severity INTEGER,
ADD COLUMN developer_status VARCHAR(50) DEFAULT 'unresolved',
ADD COLUMN developer_assigned VARCHAR(50),
ADD COLUMN developer_notes TEXT,
ADD COLUMN resolution_type VARCHAR(50),
ADD COLUMN resolution_comments TEXT,
ADD COLUMN developer_question TEXT,
ADD COLUMN developer_checked_at TIMESTAMP;

-- Step 5: Backfill review/dev data (most-reviewed-wins)
WITH ranked AS (
  SELECT document_id, issue_type, review_status, reviewed_by, reviewed_at,
         justification_notes, team_notes, impact_type, severity as reviewer_severity,
         developer_status, developer_assigned, developer_notes,
         resolution_type, resolution_comments, developer_question, developer_checked_at,
         ROW_NUMBER() OVER (
           PARTITION BY document_id, issue_type
           ORDER BY (reviewed_at IS NOT NULL) DESC,
                    (developer_checked_at IS NOT NULL) DESC,
                    (review_status != 'unreviewed') DESC,
                    id ASC
         ) AS rn
  FROM compliance_issues
)
UPDATE compliance_issue_analyses cia
SET review_status = r.review_status,
    reviewed_by = r.reviewed_by,
    reviewed_at = r.reviewed_at,
    justification_notes = r.justification_notes,
    team_notes = r.team_notes,
    impact_type = r.impact_type,
    reviewer_severity = r.reviewer_severity,
    developer_status = r.developer_status,
    developer_assigned = r.developer_assigned,
    developer_notes = r.developer_notes,
    resolution_type = r.resolution_type,
    resolution_comments = r.resolution_comments,
    developer_question = r.developer_question,
    developer_checked_at = r.developer_checked_at
FROM ranked r
WHERE r.document_id = cia.document_id
  AND r.issue_type = cia.issue_type
  AND r.rn = 1;

-- Step 6: Drop old table
DROP TABLE compliance_issues;

-- Step 7: Rename
ALTER TABLE compliance_issue_analyses RENAME TO compliance_issues;

-- Step 8: Add indexes
CREATE INDEX idx_ci_review_status ON compliance_issues(review_status);
CREATE INDEX idx_ci_developer_status ON compliance_issues(developer_status);
CREATE INDEX idx_ci_state_review ON compliance_issues(state, review_status);
```

## Frontend changes

### Repository layer
- `compliance-issues.repository.ts`: Rewrite to query single `compliance_issues` table (formerly `compliance_issue_analyses`)
- Remove all composite-key JOINs between the two tables — everything is on one table now
- `regex_matches` accessed via JSONB operators when needed (e.g., detail panel showing individual matches)
- Review/developer updates target the same table directly

### Schema (Drizzle)
- Delete `schema/compliance-issues.ts` (old table schema)
- Rename `schema/compliance-issue-analyses.ts` → `schema/compliance-issues.ts`
- Add `regexMatches` JSONB column + review/developer columns to schema
- Update all imports

### Components
- Remove all `matchedPattern`, `matchedContext`, `requirementText`, `impactAssessment` fallback logic
- Match display components read from `regex_matches` JSONB instead of joining to a separate table
- Review and developer forms update the same `compliance_issues` row directly

## Backend changes

### Research pipeline
- `analysis_writer.py`: Write directly to `compliance_issues` (the renamed table)
- Remove all `UPDATE compliance_issues SET requirement_found = ...` logic that updated the old match rows
- Tier 1 still receives match IDs but stores them as `tier1_relevant_match_ids` / `tier1_dismissed_match_ids` (array columns already exist on the analyses table)

### Compliance scanner (`scan_compliance_issues.py`)
- Instead of `INSERT INTO compliance_issues` per regex match, build the matches array and `INSERT INTO compliance_issues` as a single analysis row with `regex_matches` JSONB
- Or: insert matches into a temp staging area, then consolidate into the analysis row

### Hierarchy stats (`refresh_hierarchy_stats.py`)
- Update `refresh_compliance_stats()` queries to use the single table

## What this replaces

This single-migration approach replaces **all 7 PR migrations** (0031-0037):

### Current state (post-simplification)
Migrations 0031-0037 have been applied. Legacy columns dropped, review/developer data moved to
`compliance_issue_analyses`, `analysis_id` FK added. This proposal would go further by merging
both tables into one.

### What this would replace
| Completed Migration | Consolidation Impact |
|---|---|
| 0031 (drop legacy columns) | Old table dropped entirely |
| 0032 (backfill orphan analyses) | Absorbed into Step 1 |
| 0033 (drop analysis fields from CI) | Old table dropped entirely |
| 0034 (add review/dev to analyses) | Absorbed into Step 4 |
| 0035 (backfill review/dev) | Absorbed into Step 5 |
| 0036 (drop review/dev from CI) | Old table dropped entirely |
| 0037 (add analysis_id FK) | Unnecessary — single table, no FK needed |

## Advantages over incremental approach

1. **One migration instead of seven** — simpler to review, test, and roll back
2. **No non-idempotent DROP COLUMN** — the old table is dropped whole
3. **No FK maintenance** — single table eliminates composite-key JOINs
4. **Cleaner frontend code** — one table to query, no LEFT JOINs, no fallback logic
5. **Regex matches preserved** — JSONB column retains all match data without a separate table
6. **Same data loss profile** — identical "most-reviewed-wins" strategy, same 2 minor conflicts

## Risks

1. **Larger single migration** — if it fails partway through, need to restore from backup (but Neon has point-in-time recovery)
2. **JSONB querying** — filtering by individual match patterns requires JSONB operators instead of simple WHERE clauses (but this is rarely needed)
3. **Frontend rewrite scope** — larger upfront change to repository layer (but the incremental PRs also rewrite this code)
4. **Pipeline compatibility** — the research pipeline and compliance scanner both need updates to write to the new schema

## Testing plan

1. Take Neon branch snapshot before migration
2. Run migration on Neon branch
3. Verify row counts: `compliance_issues` should have ~8,534 rows
4. Verify `regex_matches` populated: `SELECT COUNT(*) FROM compliance_issues WHERE regex_matches != '[]'`
5. Verify review data preserved: `SELECT COUNT(*) FROM compliance_issues WHERE review_status != 'unreviewed'` should be ~322
6. Run frontend smoke tests against branch database
7. Verify pipeline dry-run works with new schema
8. If all good, promote branch to main
