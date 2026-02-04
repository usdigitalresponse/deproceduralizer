# Research Pipeline Simplification Plan

> **Status: IN PROGRESS**
> - Phase 0: ✅ Complete (PR #83 awaiting approval)
> - Phase 1: 🔄 In Progress (PRs 1.1-1.4 open, awaiting review)
> - Phase 2.1: ✅ Complete (PR #86 awaiting approval)
> - Phase 2-5: 📋 Planned
> - Phase 6.1: ✅ Complete (PR #93 — drop legacy columns)
> - Phase 6.2: ✅ Complete (PR #93 — remove duplicate analysis fields, read from analyses)
> - Phase 6.3: ✅ Complete — move review/developer tracking to analyses
> - Phase 6.4: ✅ Complete — frontend cleanup done incrementally in PRs 6.1-6.3
> - Phase 6.5: ✅ Complete — analysis_id FK on compliance_issues
> - Phase 7.1: ✅ Complete — audit confirmed no gaps
> - Phase 7.2: Skipped — no gaps to fill
> - Phase 7.3: ✅ Complete — searcher is regex-only, ~800 lines removed
> - Phase 7.4: ✅ Complete — docs updated, smoke tests pass

**Goal**: Reduce research pipeline from ~23,000 lines to ~5,000 lines while preserving functionality.

**Principles**:
1. **One PR = One Change** - Each PR does exactly one thing
2. **Tests First** - Write/update tests before changing code
3. **Green to Green** - All tests pass before AND after each PR
4. **Behavioral Tests** - Test "what it does" not "how it's structured"
5. **Delete Tests for Deleted Code** - When we remove a module, remove its tests

---

## Current Status

| Phase | Description | Status | PRs |
|-------|-------------|--------|-----|
| 0 | Test Infrastructure | ✅ Complete | PR #83 awaiting review |
| 1 | Simplify CLI | ✅ PRs Open | PRs #84-#85, #89-#90 awaiting review |
| 2 | Remove Batch Persistence | 🔄 In Progress | PR #86 awaiting review |
| 3 | Flatten State Machine | 📋 Planned | 0/5 |
| 4 | Consolidate Files | 📋 Planned | 0/5 |
| 5 | Final Cleanup | 📋 Planned | 0/2 |
| 6 | Refactor Compliance Issue Tables ([#88](https://github.com/michaeleboyce/deproceduralizer/issues/88)) | ✅ Complete | 5/5 (PRs 6.1-6.5 complete) |
| 7 | Eliminate Redundant Searcher LLM Call ([#94](https://github.com/michaeleboyce/deproceduralizer/issues/94)) | ✅ Complete | [PR #95](https://github.com/michaeleboyce/deproceduralizer/pull/95) awaiting review |

**Total Progress**: 16/31 PRs open or complete (Phases 0-1 done, Phase 2.1 done, Phase 6 done, Phase 7 done)

---

## Phase 0: Test Infrastructure (Before Any Refactoring)

### PR 0.1: Add Pipeline Contract Tests ✅ DONE

**Branch**: `refactor/pipeline-contract-tests`
**PR**: https://github.com/michaeleboyce/deproceduralizer/pull/83 (awaiting approval)

**What was done**:
- Added 29 behavioral contract tests in `test_pipeline_contract.py`
- Fixed hardcoded paths in `test_pipeline_integration.py` (3 tests were failing)
- Added this refactoring plan document

**Tests added**:
- [x] Tier 1, 2, 3 behavior contracts
- [x] Routing logic contracts
- [x] Database save function contracts
- [x] CLI importability contracts
- [x] Data model field contracts

**Status**: ✅ Complete, PR awaiting approval

---

### PR 0.2: CLI Integration Tests - SKIPPED

**Reason**: Already covered by existing `TestCLIIntegrationSubprocess` tests (which we fixed in PR 0.1) and contract tests.

---

## Phase 1: Simplify the CLI (Lowest Risk)

### PR 1.1: Add Default Values to CLI Arguments + Cost-Safe Defaults ✅ DONE

**Branch**: `refactor/cli-defaults`
**PR**: https://github.com/michaeleboyce/deproceduralizer/pull/84
**Addresses**: Issue #92 (cost-safe defaults)

**Goal**: Make arguments optional with cost-safe defaults. Expensive operations require explicit opt-in.

**Changes**:
| Flag | Before | After (Default) |
|------|--------|-----------------|
| `--max-docs-per-issue` | Required | `1000` |
| `--global-docs-limit` | Required | `100` (was `no-limit`) |
| `--max-tier` | Required | `2` |
| `--enable-web-search` | Required | `false` |
| `--issue-type` / `--all-issues` | One required | **Still required** (must be explicit) |
| `--dry-run` | Opt-in flag | **Default** (replaced with `--execute` to opt in) |

**Tests to verify**:
- [x] Contract tests still pass (29/29)
- [x] `--state nj --all-issues` dry-runs by default
- [x] `--state nj` alone errors (must specify issue selection)
- [x] Explicit flags still override defaults
- [x] Added 5 new tests in `TestCLIDefaults`

**Status**: ✅ Ready for review

---

### PR 1.2: Simplify CLI Flag Names ✅ DONE

**Branch**: `refactor/cli-flag-names`
**PR**: https://github.com/michaeleboyce/deproceduralizer/pull/85

**Change**: Rename verbose flags.

| Old | New |
|-----|-----|
| `--max-docs-per-issue` | `--limit` |
| `--global-docs-limit` | (remove) |
| `--enable-web-search true/false` | `--web-search` (flag) |
| `--issue-type` | `--issue` |
| `--all-issues` | `--all` |

**Status**: ✅ Ready for review

---

### PR 1.3: Remove Batch Recovery CLI Flags ✅ DONE

**Branch**: `refactor/remove-resume-flags`
**PR**: https://github.com/michaeleboyce/deproceduralizer/pull/89

**Change**: Remove `--resume-batch` and `--resume-tier` flags.

**Why**: Batch API keeps results 29 days. If something fails, rerun with existing `--skip-done`.

**Status**: ✅ Ready for review

---

### PR 1.4: Remove `--sequential` Flag ✅ DONE

**Branch**: `refactor/remove-sequential`
**PR**: https://github.com/michaeleboyce/deproceduralizer/pull/90

**Change**: Remove `--sequential` mode. Default mode should just work.

**Status**: ✅ Ready for review

---

## Phase 2: Remove Batch Persistence Layer

### PR 2.1: Create Migration Test ✅ DONE

**Branch**: `refactor/persistence-optional-test`
**PR**: https://github.com/michaeleboyce/deproceduralizer/pull/86

**Purpose**: Verify pipeline works without persistence before removing it.

```python
def test_pipeline_without_persistence():
    """Pipeline should work with persistence=None."""
    orchestrator = TierOrchestrator(..., persistence=None, run_dir=None)
```

**Status**: ✅ Ready for review

---

### PR 2.2: Make Persistence Optional (Default None) ⬜

**Branch**: `refactor/persistence-optional`

**Change**: Change `TierOrchestrator.__init__` to default `persistence=None`.

**Status**: ⬜ Not started

---

### PR 2.3: Remove Persistence Usage from CLI ⬜

**Branch**: `refactor/cli-no-persistence`

**Change**: Stop creating `BatchPersistence` in `cli.py`.

**Status**: ⬜ Not started

---

### PR 2.4: Delete Batch Persistence Module ⬜

**Branch**: `refactor/delete-persistence`

**Files to delete**:
- `backend/scripts/research_pipeline/batch_persistence.py` (454 lines)
- `backend/tests/research_pipeline/test_batch_persistence.py` (537 lines)

**Status**: ⬜ Not started

---

## Phase 3: Flatten the State Machine

### PR 3.1: Add Simple Pipeline Runner Test ⬜

**Branch**: `refactor/simple-runner-test`

**Purpose**: Define what a simplified runner should do.

**Status**: ⬜ Not started

---

### PR 3.2: Create Simple Pipeline Runner ⬜

**Branch**: `refactor/simple-runner`

**New file**: `backend/scripts/research_pipeline/runner.py` (~200 lines)

Simple sequential flow:
1. Submit all docs to Tier 1, collect results
2. Filter to docs needing Tier 2, submit, collect
3. If max_tier >= 3, run Tier 3 for qualifying docs
4. Return all results

**Status**: ⬜ Not started

---

### PR 3.3: Migrate CLI to Use Simple Runner ⬜

**Branch**: `refactor/cli-use-runner`

**Change**: Point CLI at new runner instead of orchestrator.

**Status**: ⬜ Not started

---

### PR 3.4: Delete State Machine ⬜

**Branch**: `refactor/delete-state-machine`

**Files to delete**:
- `backend/scripts/research_pipeline/state_machine.py` (236 lines)
- `backend/tests/research_pipeline/test_state_machine.py` (441 lines)

**Status**: ⬜ Not started

---

### PR 3.5: Delete Old Orchestrator ⬜

**Branch**: `refactor/delete-orchestrator`

**Files to delete**:
- `backend/scripts/research_pipeline/tier_orchestrator.py` (1,383 lines)
- `backend/tests/research_pipeline/test_tier_orchestrator.py` (443 lines)

**Status**: ⬜ Not started

---

## Phase 4: Consolidate Files

### PR 4.1: Merge DB Files ⬜

**Branch**: `refactor/consolidate-db`

**Before**: 4 files in `db/` (2,200 lines)
**After**: 1 file `db.py` (~600 lines)

**Status**: ⬜ Not started

---

### PR 4.2: Merge Model Files ⬜

**Branch**: `refactor/consolidate-models`

**Before**: 4 files in `models/`
**After**: 1 file `models.py`

**Status**: ⬜ Not started

---

### PR 4.3: Merge Tier Runner Files ⬜

**Branch**: `refactor/consolidate-tiers`

**Before**: 4 files in `tiers/`
**After**: 1 file `tiers.py`

**Status**: ⬜ Not started

---

### PR 4.4: Merge Context Files ⬜

**Branch**: `refactor/consolidate-context`

**Before**: 5 files in `context/` (2,000 lines)
**After**: 1 file `context.py` (~500 lines)

**Status**: ⬜ Not started

---

### PR 4.5: Remove Unused Modules ⬜

**Branch**: `refactor/remove-unused`

**Files to delete**:
- `cost_tracker.py` (367 lines)
- `ids.py` (inline the one function)
- `pipeline_logger.py` (use standard logging)

**Status**: ⬜ Not started

---

## Phase 5: Final Cleanup (Pipeline Code)

### PR 5.1: Update Documentation ⬜

**Branch**: `refactor/update-docs`

- Update `SKILL.md` with simplified CLI
- Update `CLAUDE.md` if needed
- Remove references to deleted modules

**Status**: ⬜ Not started

---

### PR 5.2: Clean Up Test Files ⬜

**Branch**: `refactor/cleanup-tests`

- Delete tests for deleted modules
- Consolidate remaining tests to match new structure
- Verify all contract tests still pass

**Status**: ⬜ Not started

---

## Phase 6: Refactor Compliance Issue Tables ([Issue #88](https://github.com/michaeleboyce/deproceduralizer/issues/88))

### Problem

Two tables — `compliance_issues` and `compliance_issue_analyses` — have overlapping columns and a confusing relationship:

- **`compliance_issues`**: One row per regex match per document. Written by the searcher (regex-only, no LLM — Phase 7).
- **`compliance_issue_analyses`**: One row per (document_id, issue_type) pair. Progressively filled by Tiers 1-4.
- **Overlap**: `requirement_found`, `severity`, `is_verbatim` exist in both tables with different semantics.
- **Fragile link**: `tier1_relevant_match_ids` / `tier1_dismissed_match_ids` are integer arrays referencing `compliance_issues.id` with no FK constraint.
- **Legacy columns**: `matched_pattern`, `matched_context`, `requirement_text`, `impact_assessment` in `compliance_issues` are superseded by newer columns but still present.

### Investigation Findings

After tracing the full data flow:

| Aspect | `compliance_issues` | `compliance_issue_analyses` |
|--------|--------------------|-----------------------------|
| **Granularity** | Per regex match (many per doc) | Per document+issue_type (one per doc) |
| **Written by** | Searcher + Tier 1 updates | Research pipeline Tiers 1-4 |
| **Read by** | Pipeline (Tier 1 fetches matches) | Pipeline (each tier reads prior state) |
| **Frontend use** | Review queue, print mode (individual matches) | Pipeline dashboard, review queue (analysis data) |
| **Review fields** | ~~`review_status`, `developer_status`, etc.~~ (moved to analyses in PR 6.3) | `review_status`, `developer_status`, etc. (PR 6.3) |

**Conclusion**: The tables are NOT fully redundant — they have different cardinality and serve different purposes. ~~But the overlap is confusing, legacy columns add noise, and the relationship is fragile.~~ **Resolved**: After Phase 6, `compliance_issues` is a pure match store linked to `compliance_issue_analyses` via `analysis_id` FK.

### Strategy: Clean Separation

Make `compliance_issues` a **pure match store** and `compliance_issue_analyses` the **single source of truth for all analysis results**. Move review/developer tracking to analyses since that's the document-level record users actually review.

---

### PR 6.1: Remove Legacy Columns from `compliance_issues` ✅ DONE

**Branch**: `refactor/ci-remove-legacy-columns`
**PR**: https://github.com/michaeleboyce/deproceduralizer/pull/93

**Change**: Drop superseded columns that have newer replacements.

| Column Removed | Replaced By |
|----------------|-------------|
| `matched_pattern` | `regex_match_pattern` |
| `matched_context` | `regex_match_context` (now NOT NULL) |
| `requirement_text` | `verbatim_supporting_text` |
| `impact_assessment` | `decision_rationale` |

**What was done**:
- Migration 0031 to drop 4 legacy columns and set `regex_match_context` NOT NULL
- Removed legacy columns from Drizzle schema, 4 repository query methods, 4 frontend components
- Removed `?? legacyColumn` fallbacks from all frontend components
- Updated `backfill_is_verbatim.py` to use new column names
- Updated `schema.sql`, `schema.md`, `REFACTOR.md`
- Added 6 E2E data integrity tests (pass before and after)
- All 38 smoke tests pass, build passes, grep clean

**Status**: ✅ Complete, PR awaiting review

---

### PR 6.2: Remove Duplicate Analysis Fields from `compliance_issues` ✅

**Branch**: `refactor/ci-remove-legacy-columns` (combined with PR 6.1)

**Change**: Removed 6 analysis fields from `compliance_issues` that are now read exclusively from `compliance_issue_analyses`. The `compliance_issues` table is now a pure match store. Severity and original_severity remain (deferred to PR 6.3).

| Column Removed from `compliance_issues` | Now Read From |
|--------------------------------------------|---------------------|
| `requirement_found` | `compliance_issue_analyses.requirement_found` |
| `is_verbatim` | `compliance_issue_analyses.is_verbatim` |
| `required_by_statute` | `compliance_issue_analyses.cites_federal_statute` |
| `statute_citation` | `compliance_issue_analyses.federal_citation` |
| `verbatim_supporting_text` | `compliance_issue_analyses.verbatim_requirements` |
| `decision_rationale` | `compliance_issue_analyses.tier1_reasoning` |

**Deferred to PR 6.3** (reviewer-editable): `severity`, `original_severity`

**What was done**:
- Repository methods (`getAllPaginated`, `getReviewedPaginated`, `getSuggestionBatch`, etc.) JOIN to analyses
- Filters (severity, requirementFound, requiredByStatute) read from analyses table
- Backend searcher writes analysis fields to `compliance_issue_analyses` instead of `compliance_issues`
- Migration 0032: Backfill 9 orphan issues missing analysis rows
- Migration 0033: Drop 6 columns
- 7 new E2E data integrity tests, all 57 tests passing

**Status**: ✅ Complete

---

### PR 6.3: Move Review/Developer Tracking to `compliance_issue_analyses` ✅

**Branch**: `refactor/ci-remove-legacy-columns` (combined with PRs 6.1-6.2)

**Change**: Moved 15 review/developer columns from `compliance_issues` to `compliance_issue_analyses`, since reviewers work at the (document, issue_type) level.

| Fields Moved |
|----------------|
| `review_status`, `reviewed_by`, `reviewed_at` |
| `justification_notes`, `team_notes`, `impact_type` |
| `severity` → `reviewer_severity`, `original_severity` → `reviewer_original_severity` |
| `developer_status`, `developer_assigned`, `developer_notes` |
| `resolution_type`, `resolution_comments` |
| `developer_question`, `developer_checked_at` |

**What was done**:
- Migration 0034: Add 15 columns to `compliance_issue_analyses` (with `reviewer_severity`/`reviewer_original_severity` naming to avoid collision with pipeline `severity`)
- Migration 0035: Backfill data using "most-reviewed-wins" CTE with ROW_NUMBER
- Migration 0036: Drop 15 columns and 6 indexes from `compliance_issues`
- Updated Drizzle schemas for both tables
- Major repository rewrite: added `findAnalysisForIssue()` helper, rewrote all mutations (`updateReview`, `updateDeveloperStatus`, `clearForReview`) and read queries to use analyses
- Updated server actions return types (`ComplianceIssueWithAnalysisFields`)
- Updated Python backend queries (`data_status.py`, `optimize.py`)
- Updated `schema.sql`, `schema.md`, documentation
- Count semantics changed: `getCountsByStatus` and `getDeveloperStatusCounts` now count analysis rows (one per document+issue_type) instead of match rows

**Status**: ✅ Complete

---

### PR 6.4: Frontend Query Cleanup ✅ DONE (completed in PRs 6.1-6.3)

**Branch**: `refactor/ci-remove-legacy-columns` (combined with PRs 6.1-6.3)

**Change**: All frontend cleanup was done incrementally as part of earlier PRs.

**Verification**:
- ✅ Drizzle schema is clean (no stale columns in either table)
- ✅ Repository queries correctly JOIN to `compliance_issue_analyses`
- ✅ Server actions return correct types (`ComplianceIssueWithAnalysisFields`)
- ✅ Components use correct aliased fields (severity, reviewStatus, etc.)
- ✅ All mutations (updateReview, updateDeveloperStatus, clearForReview) update analyses table
- ✅ Build passes with no type errors
- ✅ E2E data integrity tests verify old columns don't appear

**Status**: ✅ Complete (no separate PR needed)

---

### PR 6.5: Add `analysis_id` FK to `compliance_issues` ✅ DONE

**Branch**: `refactor/ci-remove-legacy-columns`
**Approach**: Option A — nullable `analysis_id` FK column on `compliance_issues` pointing to `compliance_issue_analyses.id`. Arrays (`tier1_relevant_match_ids`, `tier1_dismissed_match_ids`) stay as-is — they're audit snapshots, not structural links.

**Why**: Formalizes the many-to-one relationship (many regex matches → one document-level analysis), replaces 16 composite `(document_id, issue_type)` JOINs with a single-column FK JOIN, and simplifies `findAnalysisForIssue()` from a 2-step lookup to a direct read.

#### Files to modify

| File | Change | Status |
|------|--------|--------|
| `backend/migrations/0037_add_analysis_id_fk.sql` | **NEW** — add column, index, backfill | ✅ Done |
| `schema.sql` | Add `analysis_id` column + index to `compliance_issues` | ✅ Done |
| `frontend/packages/database/src/schema/compliance-issues.ts` | Add `analysisId` field with FK ref | ✅ Done |
| `frontend/packages/database/src/repositories/compliance-issues.repository.ts` | Replace 16 composite JOINs with FK JOIN + simplify `findAnalysisForIssue()` | ✅ Done |
| `backend/scripts/compliance_issues/searcher.py` | Fix stale `severity` column ref + set `analysis_id` after analysis INSERT | ✅ Done |
| `backend/scripts/research_pipeline/db/analysis_writer.py` | Remove stale column refs + set `analysis_id` after analysis UPSERT in `save_tier1_results()` | ✅ Done |
| `.claude/skills/database/schema.md` | Document `analysis_id` column | ✅ Done |
| `docs/PIPELINE_SIMPLIFICATION_PLAN.md` | Mark 6.5 complete | ✅ Done |

#### Implementation Details

**1. Migration (`0037_add_analysis_id_fk.sql`)** ✅
```sql
ALTER TABLE compliance_issues
ADD COLUMN analysis_id BIGINT REFERENCES compliance_issue_analyses(id) ON DELETE SET NULL;
CREATE INDEX idx_compliance_issues_analysis_id ON compliance_issues(analysis_id);
-- Backfill from existing composite key
UPDATE compliance_issues ci SET analysis_id = cia.id
FROM compliance_issue_analyses cia
WHERE ci.document_id = cia.document_id AND ci.issue_type = cia.issue_type AND ci.analysis_id IS NULL;
```

**2. Drizzle schema** ✅
Added `analysisId` with `references(() => complianceIssueAnalyses.id, { onDelete: 'set null' })`. Import from `compliance-issue-analyses` (no circular dependency).

**3. Repository JOINs** ✅ (16 sites replaced)
```typescript
// Before (composite, 4 lines each):
.leftJoin(complianceIssueAnalyses, and(
  eq(complianceIssues.documentId, complianceIssueAnalyses.documentId),
  eq(complianceIssues.issueType, complianceIssueAnalyses.issueType)
))
// After (FK, 1 line each):
.leftJoin(complianceIssueAnalyses,
  eq(complianceIssues.analysisId, complianceIssueAnalyses.id)
)
```

**4. `findAnalysisForIssue()` simplified** ✅
Reads `issue.analysisId` directly when populated. Falls back to composite `(document_id, issue_type)` lookup for NULL `analysisId` (safety net for unbackfilled rows).

**5. `searcher.py` changes** ✅
- Removed stale `severity` column from `INSERT INTO compliance_issues`
- Added `RETURNING id` to analysis INSERT + `UPDATE compliance_issues SET analysis_id` linkage

**6. `analysis_writer.py` changes** ✅
- Removed stale `requirement_found`/`decision_rationale` UPDATE on `compliance_issues` (columns dropped in PR 6.2)
- Added `RETURNING id` + `UPDATE compliance_issues SET analysis_id` to both INSERT blocks (all_false_positives and needs_research)

#### Verification

After all changes + migration applied:
1. **Build**: `cd frontend/apps/web && pnpm build` — no type errors
2. **Smoke tests**: `cd frontend/apps/web && pnpm test:e2e`
3. **SQL verification** (after backfill):
   - `SELECT COUNT(*) FROM compliance_issues WHERE analysis_id IS NULL;` → 0
   - `SELECT ci.id FROM compliance_issues ci JOIN compliance_issue_analyses cia ON cia.id = ci.analysis_id WHERE ci.document_id != cia.document_id OR ci.issue_type != cia.issue_type;` → 0 rows

**Status**: ✅ Complete — migration, schema.sql, Drizzle schema, 16 repository JOINs, `findAnalysisForIssue()`, searcher.py, analysis_writer.py, schema.md all done

---

### Phase 6 Sequencing

PRs should be done in order since each builds on the previous:

```
6.1 (legacy columns) → 6.2 (analysis fields) → 6.3 (review fields) → 6.4 (frontend) → 6.5 (FK)
```

**Note**: Phase 6 was completed before Phases 2-5 (pipeline simplification). The pipeline write paths were updated as part of Phase 6 (searcher.py and analysis_writer.py), so Phases 2-5 should be safe to proceed.

---

## Phase 7: Eliminate Redundant Searcher LLM Call ([Issue #94](https://github.com/michaeleboyce/deproceduralizer/issues/94), [PR #95](https://github.com/michaeleboyce/deproceduralizer/pull/95))

### Problem

The compliance issue pipeline currently runs content through the LLM up to 4 times:

| Step | Component | LLM Call? | What It Does |
|------|-----------|-----------|--------------|
| 0. Regex search | `searcher.py` → `search()` | No | Finds regex matches in regulation text |
| 1. Searcher triage | `searcher.py` → `analyze_match()` | **Yes** | Each match gets LLM analysis (requirement_found, severity, etc.) |
| 2. Tier 1 | `tier1_runner.py` | **Yes** | Re-analyzes the *same matches* to filter false positives with richer context |
| 3. Tier 2 | `tier2_runner.py` | **Yes** | Classifies surviving issues as burdensome/justified/unrelated |
| 4. Tier 3 | `tier3_runner.py` | **Yes** | Web-search verification for high-risk issues |

Steps 1 and 2 are redundant — the searcher runs each match through the LLM for initial analysis, then Tier 1 re-processes the same matches through the LLM again. We're paying for two LLM calls to answer the same question ("is this regex match a real compliance issue?"), with Tier 1 just having more context.

### Strategy

Make the searcher regex-only. Remove `analyze_match()` / `analyze_async()` LLM calls and let Tier 1 be the sole initial LLM gate. The pipeline becomes:

1. **Regex search** — finds candidate matches (no LLM, cheap)
2. **Tier 1** — initial LLM filtering with full context (replaces both current steps 1 and 2)
3. **Tier 2** — classifies
4. **Tier 3** — verifies (when needed)

This cuts the maximum LLM calls from 4 to 3 and removes the redundant call.

---

### PR 7.1: Audit Searcher Triage vs Tier 1 Coverage ✅ DONE

**Branch**: `refactor/remove-searcher-triage`
**PR**: https://github.com/michaeleboyce/deproceduralizer/pull/95

**Goal**: Document exactly what the searcher's `analyze_match()` LLM call produces and confirm Tier 1 already covers it (or identify gaps to fill).

**Findings**:
- Searcher LLM produces `ComplianceIssueInstance`: `requirement_found`, `severity`, `verbatim_supporting_text`, `required_by_statute`, `decision_rationale`
- Tier 1 covers `requirement_found` → `classification` (all_false_positives/needs_research) and `decision_rationale` → `reasoning`
- Tier 2 covers `severity`, `verbatim_supporting_text` → `verbatim_requirements`, `required_by_statute` → `cites_federal_statute`
- **No gaps found** — every searcher field has a pipeline equivalent
- Pipeline completely ignores searcher LLM output (reads only `regex_match_pattern`/`regex_match_context`)
- Tier 1 `save_tier1_results()` overwrites the searcher's analysis row via `ON CONFLICT`

**Tests added**: 14 contract tests in `backend/tests/test_searcher_triage_audit.py`
- `TestSearcherTriageFieldCoverage` (4 tests): field mapping verification
- `TestPipelineIgnoresSearcherLLMOutput` (2 tests): pipeline reads only regex data
- `TestSearcherWritesAnalysisThatGetsOverwritten` (3 tests): ON CONFLICT overwrites
- `TestSearcherLLMMethodsExist` (5 tests): document methods to remove in PR 7.3

**Status**: ✅ Complete — no gaps found, PR 7.2 can be skipped

---

### PR 7.2: Ensure Tier 1 Covers Searcher Triage Outputs — SKIPPED

**Reason**: PR 7.1 audit found no gaps. Every searcher field already has an equivalent in Tier 1 or Tier 2.

---

### PR 7.3: Remove LLM Triage from Searcher ✅ DONE

**Branch**: `refactor/remove-searcher-triage`
**PR**: https://github.com/michaeleboyce/deproceduralizer/pull/95

**Goal**: Remove all LLM methods from `searcher.py`. The searcher writes regex matches to the DB without LLM analysis. Update the scanner script.

**What was done**:
- Removed from `searcher.py`: `analyze_match()`, `analyze_async()`, `submit_batch()`, `process_batch_results()`, `create_prompt()`, `LIST_OUTPUT_INSTRUCTIONS`, `print_results()`, `save_results_json()`, `generate_html()`
- Removed LLM imports: `call_llm_parse_async`, `format_batch_request`, `BatchManager`, `parse_batch_result_tool_use`, `DEFAULT_MODEL`, `LLMTraceContext`, `flush_langfuse`, `BaseComplianceAnalysis`, `are_all_verbatim`
- Simplified `save_to_database()`: saves one row per regex match to `compliance_issues` only (no `compliance_issue_analyses` write)
- Added `print_summary()` for basic regex match output
- Rewrote `scan_compliance_issues.py`: removed `--batch`, `--process-batches`, `--concurrency` flags, simplified to regex scan + save
- Updated 16 tests: 8 now verify LLM methods are removed, 2 verify searcher is regex-only
- 569/572 backend tests pass (3 pre-existing failures on different machine)

**Lines removed**: ~700 from `searcher.py`, ~100 from `scan_compliance_issues.py`

**Status**: ✅ Complete

---

### PR 7.4: Update Docs and Tests ✅ DONE

**Branch**: `refactor/remove-searcher-triage`
**PR**: https://github.com/michaeleboyce/deproceduralizer/pull/95

**Goal**: Update pipeline documentation, remove references to searcher triage, run smoke tests.

**What was done**:
- Updated `PIPELINE_SIMPLIFICATION_PLAN.md`: Phase 7 status headers, current status table, summary
- Updated `OPERATIONS.md`: compliance issues section now documents 2-step process (regex scan + research pipeline)
- Updated `README.md`: tree view, command examples, script table
- Updated `CLAUDE.md`: compliance issues section with Step 1 / Step 2 instructions
- Smoke tests: 25/25 pass

**Status**: ✅ Complete

---

## Summary

| Phase | PRs | Est. Lines Removed | Checkpoint |
|-------|-----|-------------------|------------|
| 0 | 2 | 0 (adding tests) | Contract tests pass |
| 1 | 4 | ~800 | CLI is simple |
| 2 | 4 | ~1,000 | No persistence |
| 3 | 5 | ~2,500 | Simple runner |
| 4 | 5 | ~3,000 | Fewer files |
| 5 | 2 | ~500 | Docs updated |
| 6 | 5 | ~300 (columns) + schema cleanup | Clean table separation ([#88](https://github.com/michaeleboyce/deproceduralizer/issues/88)) |
| 7 | 4 | ~300 + LLM cost savings | Searcher is regex-only, 1 fewer LLM call per match ([#94](https://github.com/michaeleboyce/deproceduralizer/issues/94)) |

**Total**: 31 PRs, ~8,300 lines removed + schema consolidation + LLM cost reduction

---

## Testing Strategy

| Test Type | Purpose | When to Run |
|-----------|---------|-------------|
| **Contract tests** | Verify external behavior | Every PR |
| **Unit tests** | Verify internal logic | When touching that code |
| **CLI tests** | Verify argument parsing | Phase 1 PRs |
| **Integration tests** | Verify components together | Phases 3-4 |

**Key rule**: Delete a module → delete its tests. Consolidate modules → consolidate tests.

---

## Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-02-03 | Plan created | Initial plan with 22 PRs across 5 phases |
| 2026-02-03 | PR 0.1 complete | Contract tests + hardcoded path fix ([PR #83](https://github.com/michaeleboyce/deproceduralizer/pull/83)) |
| 2026-02-03 | PR 0.2 skipped | Already covered by existing tests |
| 2026-02-03 | PR 1.1 complete | CLI defaults ([PR #84](https://github.com/michaeleboyce/deproceduralizer/pull/84)) |
| 2026-02-03 | PR 1.2 complete | CLI flag names ([PR #85](https://github.com/michaeleboyce/deproceduralizer/pull/85)) |
| 2026-02-03 | PR 1.3 complete | Remove resume flags ([PR #89](https://github.com/michaeleboyce/deproceduralizer/pull/89)) |
| 2026-02-03 | PR 1.4 complete | Remove sequential flag ([PR #90](https://github.com/michaeleboyce/deproceduralizer/pull/90)) |
| 2026-02-03 | PR 2.1 complete | Persistence migration test ([PR #86](https://github.com/michaeleboyce/deproceduralizer/pull/86)) |
| 2026-02-04 | PR 1.1 updated | Cost-safe defaults per issue #92 (dry-run default, require explicit issue selection, global limit 100) |
| 2026-02-04 | Phase 6 planned | Investigated issue #88 — `compliance_issues` vs `compliance_issue_analyses` table overlap. Added 5-PR plan to clean separation |
| 2026-02-04 | PR 6.1 complete | Drop legacy columns from compliance_issues ([PR #93](https://github.com/michaeleboyce/deproceduralizer/pull/93)) — migration 0031, schema/repo/frontend/backend cleanup |
| 2026-02-04 | PR 6.2 complete | Remove duplicate analysis fields from compliance_issues — migrations 0032-0033, repo/frontend reads from analyses |
| 2026-02-04 | PR 6.3 complete | Move review/developer tracking to analyses — migrations 0034-0036, major repo rewrite, server action updates, Python backend updates |
| 2026-02-04 | PR 6.4 verified | Frontend cleanup already done in PRs 6.1-6.3 — build passes, schema/types/queries all clean. Marked complete. |
| 2026-02-04 | PR 6.5 started | Option A chosen: `analysis_id` FK. Migration 0037, schema.sql, Drizzle schema, 16 repository JOINs + `findAnalysisForIssue()` done. Python backend + docs remaining. |
| 2026-02-04 | PR 6.5 complete | Fixed stale columns in searcher.py (removed `severity` from INSERT) and analysis_writer.py (removed stale `requirement_found`/`decision_rationale` UPDATE). Added `RETURNING id` + `analysis_id` linkage to all 3 INSERT sites. Updated schema.md. Phase 6 complete. |
| 2026-02-04 | Phase 7 planned | Issue [#94](https://github.com/michaeleboyce/deproceduralizer/issues/94) — eliminate redundant LLM call in searcher. Searcher triage (`analyze_match()`) and Tier 1 both do LLM filtering on the same matches; plan to make searcher regex-only. |
| 2026-02-04 | PR 7.1 complete | Audit: every searcher LLM field has a pipeline equivalent. No gaps found. 14 contract tests added. |
| 2026-02-04 | PR 7.2 skipped | No gaps to fill — Tier 1+2 already cover all searcher triage outputs. |
| 2026-02-04 | PR 7.3 complete | Removed ~800 lines of LLM code from searcher.py and scan_compliance_issues.py. Searcher is now regex-only. 16 tests pass. |
| 2026-02-04 | PR 7.4 complete | Updated PIPELINE_SIMPLIFICATION_PLAN.md, OPERATIONS.md, README.md, CLAUDE.md. 25/25 smoke tests pass. Phase 7 complete. |
| 2026-02-04 | Phase 7 shipped | All Phase 7 work in [PR #95](https://github.com/michaeleboyce/deproceduralizer/pull/95), awaiting review. |
