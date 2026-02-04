# Research Pipeline Simplification Plan

> **Status: IN PROGRESS**
> - Phases 0-1, 2.1-2.4, 3, 6, 7: ✅ Complete
> - Phases 4-5: 📋 Planned (not started)

**Goal**: Reduce research pipeline from ~23,000 lines to ~5,000 lines while preserving functionality.

**Principles**:
1. **One PR = One Change** - Each PR does exactly one thing
2. **Tests First** - Write/update tests before changing code
3. **Green to Green** - All tests pass before AND after each PR
4. **Behavioral Tests** - Test "what it does" not "how it's structured"
5. **Delete Tests for Deleted Code** - When we remove a module, remove its tests

---

## Open PRs — Merge Order

| PR | Title | Base | Merge Order |
|----|-------|------|-------------|
| [#90](https://github.com/michaeleboyce/deproceduralizer/pull/90) | CLI simplification (Phases 0-1 + 2.1) | `main` | 1st |
| [#96](https://github.com/michaeleboyce/deproceduralizer/pull/96) | Remove batch persistence (Phases 2.2-2.4) | `#90` branch | 2nd (auto-retargets to main after #90 merges) |
| [#95](https://github.com/michaeleboyce/deproceduralizer/pull/95) | Table refactor + regex-only searcher (Phases 6-7) | `main` | Any order with #90 |
| [#97](https://github.com/michaeleboyce/deproceduralizer/pull/97) | Flatten state machine (Phase 3) | `#96` branch | 3rd (auto-retargets after #96 merges) |
| [#91](https://github.com/michaeleboyce/deproceduralizer/pull/91) | E2E fixes + filter refactor | rebased onto #90+#95 | **Last** |

Closed PRs (subsumed): #83, #84, #85, #86, #89, #93

---

## Current Status

| Phase | Description | Status | PR |
|-------|-------------|--------|----|
| 0 | Test Infrastructure | ✅ Complete | #90 |
| 1 | Simplify CLI | ✅ Complete | #90 |
| 2.1 | Persistence Migration Test | ✅ Complete | #90 |
| 2.2-2.4 | Remove Batch Persistence | ✅ Complete | #96 |
| 3 | Flatten State Machine | ✅ Complete | #97 |
| 4 | Consolidate Files | 📋 Planned | — |
| 5 | Final Cleanup | 📋 Planned | — |
| 6 | Refactor Compliance Issue Tables ([#88](https://github.com/michaeleboyce/deproceduralizer/issues/88)) | ✅ Complete | #95 |
| 7 | Eliminate Redundant Searcher LLM Call ([#94](https://github.com/michaeleboyce/deproceduralizer/issues/94)) | ✅ Complete | #95 |

---

## Completed Work

### PR #90: CLI Simplification (Phases 0-1 + 2.1)

**Phase 0: Test Infrastructure**
- Added 29 behavioral contract tests in `test_pipeline_contract.py`
- Fixed hardcoded paths in `test_pipeline_integration.py`

**Phase 1: Simplify CLI**

| Change | Details |
|--------|---------|
| **Simplified flag names** | `--issue`, `--all`, `--limit`, `--web-search` (from verbose versions) |
| **Cost-safe defaults** | Dry-run by default (`--execute` to opt in), `--global-limit` defaults to 100 |
| **Issue selection required** | Must pass `--issue` or `--all` (no implicit "run everything") |
| **Removed `--resume-batch`/`--resume-tier`** | Batch API keeps results 29 days; just rerun with same params |
| **Removed `--sequential`** | Default batched mode should just work |
| **Removed `resume_from_batch()`** | ~190 lines of batch recovery code |

**Phase 2.1: Persistence Migration Test**
- Test verifying pipeline works with `persistence=None`

### PR #96: Remove Batch Persistence (Phases 2.2-2.4)

Branched from #90. Combined all three steps into one PR:

| Step | What | Details |
|------|------|---------|
| 2.2-2.3 | Remove persistence from CLI + orchestrator | Removed `get_persistence()`, `check_and_resume()`, all `self.persistence` blocks |
| 2.4 | Delete `batch_persistence.py` + tests | Deleted ~455 lines code + ~538 lines tests + ~194 lines migration tests |

**Key insight**: Disk-based persistence was never used for resume — the DB (`get_existing_analyses()`) was always the real source of truth.

### PR #95: Table Refactor + Regex-Only Searcher (Phases 6-7)

**Phase 6: Refactor Compliance Issue Tables**

| Step | What | Migrations |
|------|------|------------|
| 6.1 | Drop 4 legacy columns from `compliance_issues` | 0031 |
| 6.2 | Remove 6 duplicate analysis fields, read from analyses | 0032-0033 |
| 6.3 | Move 15 review/developer columns to analyses | 0034-0036 |
| 6.5 | Add `analysis_id` FK, replace 16 composite JOINs | 0037 |

**Result**: `compliance_issues` is a pure regex match store; `compliance_issue_analyses` is single source of truth for analysis + review data.

**Phase 7: Eliminate Redundant Searcher LLM Call**
- Removed ~800 lines of LLM code from `searcher.py`
- Searcher is now regex-only (no API calls)
- Pipeline: regex scan -> Tier 1 (LLM filter) -> Tier 2 (classify) -> Tier 3 (verify)

---

## Remaining Work (Phases 3-5)

### Phase 3: Flatten the State Machine ✅

Completed in PR #97. Branched from #96, targets #96 (auto-retargets after merge).

| Step | What | Status |
|------|------|--------|
| 3.1 | Add `pipeline_runner.py` + 19 tests (coexistence) | ✅ Complete |
| 3.2 | Migrate CLI to use `pipeline_runner` | ✅ Complete |
| 3.3 | Simplify `ProcessingState` (15 → 8 states), remove batch_id fields | ✅ Complete |
| 3.4 | Delete `TierOrchestrator` (-1,275 lines) + `test_tier_orchestrator.py` (-444 lines) | ✅ Complete |

**Result**: `TierOrchestrator` class replaced by flat functions in `pipeline_runner.py`. Net ~1,026 lines removed.

### Phase 4: Consolidate Files

| Step | What | Status |
|------|------|--------|
| 4.1 | Merge 4 DB files -> 1 `db.py` | Not started |
| 4.2 | Merge 4 model files -> 1 `models.py` | Not started |
| 4.3 | Merge 4 tier files -> 1 `tiers.py` | Not started |
| 4.4 | Merge 5 context files -> 1 `context.py` | Not started |
| 4.5 | Remove unused modules | Not started |

### Phase 5: Final Cleanup

| Step | What | Status |
|------|------|--------|
| 5.1 | Update documentation | Not started |
| 5.2 | Clean up test files | Not started |

---

## Summary

| Phase | Est. Lines Removed | Status |
|-------|--------------------|--------|
| 0-1 + 2.1 | ~800 + tests | ✅ PR #90 |
| 2.2-2.4 | ~1,200 (code + tests) | ✅ PR #96 |
| 6 | ~300 (columns) + schema cleanup | ✅ PR #95 |
| 7 | ~800 + LLM cost savings | ✅ PR #95 |
| 3 | ~1,026 | ✅ PR #97 |
| 4 | ~3,000 | 📋 Planned |
| 5 | ~500 | 📋 Planned |

**Total**: ~8,900 lines to remove + schema consolidation + LLM cost reduction

---

## Branching Strategy for Phase 3+

Phase 3 touches `cli.py` and `tier_orchestrator.py` heavily (same files as #90 and #96).
**Branch from `refactor/remove-batch-persistence`** (the #96 branch) to avoid conflicts.
Target the PR at #96's branch. GitHub auto-retargets after #96 merges.

---

## Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-02-03 | Plan created | Initial plan with 22 PRs across 5 phases |
| 2026-02-03 | Phases 0-1 complete | PRs #83-#86, #89-#90 created |
| 2026-02-04 | Phase 6 complete | Table refactor, migrations 0031-0037 |
| 2026-02-04 | Phase 7 complete | Searcher is regex-only, ~800 lines removed |
| 2026-02-04 | PR consolidation | 9 PRs -> 3 clean PRs (#90, #95, #91). Closed #83, #84, #85, #86, #89, #93. |
| 2026-02-04 | Phase 2.2-2.4 complete | PR #96: removed batch persistence (-1,358 lines). Targets #90 branch. |
| 2026-02-04 | Phase 3 complete | PR #97: flatten state machine, replace TierOrchestrator with pipeline_runner (-1,026 lines). Targets #96 branch. |
