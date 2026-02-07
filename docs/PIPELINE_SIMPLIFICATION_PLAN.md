# Research Pipeline Simplification Plan

> **Status: IN PROGRESS**
> - Phases 0-1 + 2.1: ✅ Complete — consolidated in [PR #90](https://github.com/michaeleboyce/deproceduralizer/pull/90)
> - Phase 6 + Phase 7: ✅ Complete — consolidated in [PR #95](https://github.com/michaeleboyce/deproceduralizer/pull/95)
> - Phases 2.2-5: 📋 Planned (not started)

**Goal**: Reduce research pipeline from ~23,000 lines to ~5,000 lines while preserving functionality.

**Principles**:
1. **One PR = One Change** - Each PR does exactly one thing
2. **Tests First** - Write/update tests before changing code
3. **Green to Green** - All tests pass before AND after each PR
4. **Behavioral Tests** - Test "what it does" not "how it's structured"
5. **Delete Tests for Deleted Code** - When we remove a module, remove its tests

---

## PR Consolidation

On 2026-02-04, 9 open PRs were consolidated into 2 independent PRs to simplify review:

| PR | Title | What's Included | Merge Order |
|----|-------|-----------------|-------------|
| [#90](https://github.com/michaeleboyce/deproceduralizer/pull/90) | Consolidate CLI simplification (Phases 0-1 + 2.1) | Former PRs #83, #84, #85, #86, #89 | Any |
| [#95](https://github.com/michaeleboyce/deproceduralizer/pull/95) | Phase 6 + Phase 7: Table refactor + regex-only searcher | Former PR #93 | Any |

**These two PRs touch completely different files and can be merged in any order.**

Also open: [PR #91](https://github.com/michaeleboyce/deproceduralizer/pull/91) (E2E test fixes) — separate feature, may need minor conflict resolution with either PR.

Closed PRs (subsumed): #83, #84, #85, #86, #89, #93

---

## Current Status

| Phase | Description | Status | PR |
|-------|-------------|--------|----|
| 0 | Test Infrastructure | ✅ Complete | #90 |
| 1 | Simplify CLI | ✅ Complete | #90 |
| 2.1 | Persistence Migration Test | ✅ Complete | #90 |
| 2.2-2.4 | Remove Batch Persistence | 📋 Planned | — |
| 3 | Flatten State Machine | 📋 Planned | — |
| 4 | Consolidate Files | 📋 Planned | — |
| 5 | Final Cleanup | 📋 Planned | — |
| 6 | Refactor Compliance Issue Tables ([#88](https://github.com/michaeleboyce/deproceduralizer/issues/88)) | ✅ Complete | #95 |
| 7 | Eliminate Redundant Searcher LLM Call ([#94](https://github.com/michaeleboyce/deproceduralizer/issues/94)) | ✅ Complete | #95 |

---

## PR #90: CLI Simplification (Phases 0-1 + 2.1)

### Phase 0: Test Infrastructure

- Added 29 behavioral contract tests in `test_pipeline_contract.py`
- Fixed hardcoded paths in `test_pipeline_integration.py`

### Phase 1: Simplify CLI

| Change | Details |
|--------|---------|
| **Simplified flag names** | `--issue`, `--all`, `--limit`, `--web-search` (from verbose versions) |
| **Cost-safe defaults** | Dry-run by default (`--execute` to opt in), `--global-limit` defaults to 100 |
| **Issue selection required** | Must pass `--issue` or `--all` (no implicit "run everything") |
| **Removed `--resume-batch`/`--resume-tier`** | Batch API keeps results 29 days; just rerun with same params |
| **Removed `--sequential`** | Default batched mode should just work |
| **Removed `resume_from_batch()`** | ~190 lines of batch recovery code |

### Phase 2.1: Persistence Migration Test

- Test verifying pipeline works with `persistence=None`

### Tests

- 14 CLI tests (help output, defaults, cost-safe behavior, removed flags)
- 29 contract tests (tier behavior, routing, DB saves, data models)
- 5 persistence-optional tests

---

## PR #95: Table Refactor + Regex-Only Searcher (Phases 6-7)

### Phase 6: Refactor Compliance Issue Tables

| Step | What | Migrations |
|------|------|------------|
| 6.1 | Drop 4 legacy columns from `compliance_issues` | 0031 |
| 6.2 | Remove 6 duplicate analysis fields, read from analyses | 0032-0033 |
| 6.3 | Move 15 review/developer columns to analyses | 0034-0036 |
| 6.5 | Add `analysis_id` FK, replace 16 composite JOINs | 0037 |

**Result**: `compliance_issues` is a pure regex match store; `compliance_issue_analyses` is single source of truth for analysis + review data.

### Phase 7: Eliminate Redundant Searcher LLM Call

- Removed ~800 lines of LLM code from `searcher.py`
- Searcher is now regex-only (no API calls)
- Pipeline: regex scan → Tier 1 (LLM filter) → Tier 2 (classify) → Tier 3 (verify)

---

## Remaining Work (Phases 2.2-5)

### Phase 2.2-2.4: Remove Batch Persistence

| PR | What | Status |
|----|------|--------|
| 2.2 | Make persistence optional (default None) | ⬜ Not started |
| 2.3 | Remove persistence usage from CLI | ⬜ Not started |
| 2.4 | Delete `batch_persistence.py` (~990 lines) | ⬜ Not started |

### Phase 3: Flatten the State Machine

| PR | What | Status |
|----|------|--------|
| 3.1 | Add simple pipeline runner test | ⬜ Not started |
| 3.2 | Create simple pipeline runner (~200 lines) | ⬜ Not started |
| 3.3 | Migrate CLI to use simple runner | ⬜ Not started |
| 3.4 | Delete state machine (~680 lines) | ⬜ Not started |
| 3.5 | Delete old orchestrator (~1,800 lines) | ⬜ Not started |

### Phase 4: Consolidate Files

| PR | What | Status |
|----|------|--------|
| 4.1 | Merge 4 DB files → 1 `db.py` | ⬜ Not started |
| 4.2 | Merge 4 model files → 1 `models.py` | ⬜ Not started |
| 4.3 | Merge 4 tier files → 1 `tiers.py` | ⬜ Not started |
| 4.4 | Merge 5 context files → 1 `context.py` | ⬜ Not started |
| 4.5 | Remove unused modules | ⬜ Not started |

### Phase 5: Final Cleanup

| PR | What | Status |
|----|------|--------|
| 5.1 | Update documentation | ⬜ Not started |
| 5.2 | Clean up test files | ⬜ Not started |

---

## Summary

| Phase | Est. Lines Removed | Status |
|-------|-------------------|--------|
| 0-1 + 2.1 | ~800 + tests | ✅ PR #90 |
| 6 | ~300 (columns) + schema cleanup | ✅ PR #95 |
| 7 | ~800 + LLM cost savings | ✅ PR #95 |
| 2.2-2.4 | ~1,000 | 📋 Planned |
| 3 | ~2,500 | 📋 Planned |
| 4 | ~3,000 | 📋 Planned |
| 5 | ~500 | 📋 Planned |

**Total**: ~8,900 lines to remove + schema consolidation + LLM cost reduction

---

## Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-02-03 | Plan created | Initial plan with 22 PRs across 5 phases |
| 2026-02-03 | Phases 0-1 complete | PRs #83-#86, #89-#90 created |
| 2026-02-04 | Phase 6 complete | Table refactor, migrations 0031-0037 |
| 2026-02-04 | Phase 7 complete | Searcher is regex-only, ~800 lines removed |
| 2026-02-04 | PR consolidation | 9 PRs → 2 independent PRs (#90, #95) for easier review |
