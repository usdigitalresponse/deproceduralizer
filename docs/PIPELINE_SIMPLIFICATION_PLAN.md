# Research Pipeline Simplification Plan

> **Status: IN PROGRESS**
> - Phase 0: ✅ Complete (PR #83 awaiting approval)
> - Phase 1: 🔄 In Progress (PRs 1.1-1.3 ready, 1.4 remaining)
> - Phase 2: 🔄 In Progress (PR 2.1 ready)
> - Phase 3-5: 📋 Planned

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
| 0 | Test Infrastructure | ✅ Complete | PR #83 awaiting approval |
| 1 | Simplify CLI | 🔄 In Progress | 3/4 (PRs #84, #85, #89 ready) |
| 2 | Remove Batch Persistence | 🔄 In Progress | 1/4 (PR 2.1 ready) |
| 3 | Flatten State Machine | 📋 Planned | 0/5 |
| 4 | Consolidate Files | 📋 Planned | 0/5 |
| 5 | Final Cleanup | 📋 Planned | 0/2 |

**Total Progress**: 4/21 PRs ready for review

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

### PR 1.1: Add Default Values to CLI Arguments ✅ DONE

**Branch**: `refactor/cli-defaults`
**PR**: https://github.com/michaeleboyce/deproceduralizer/pull/84

**Goal**: Make most arguments optional with sensible defaults so you can run:
```bash
python3 -m scripts.research_pipeline.cli --state nj
```
Instead of:
```bash
python3 -m scripts.research_pipeline.cli \
  --state nj --all \
  --limit 50 \
  --max-tier 2
```

**Changes**:
| Flag | Before | After (Default) |
|------|--------|-----------------|
| `--limit` | Required | `1000` |
| `--max-tier` | Required | `2` |
| `--web-search` | Required | `false` |
| `--issue` / `--all` | One required | `--all` if neither specified |

**Tests to verify**:
- [x] Contract tests still pass (29/29)
- [x] `--state nj` alone works
- [x] Explicit flags still override defaults
- [x] Added 4 new tests in `TestCLIDefaults`

**Status**: ✅ Ready for review

---

### PR 1.2: Simplify CLI Flag Names 🔄 IN PROGRESS

**Branch**: `refactor/cli-flag-names`

**Change**: Rename verbose flags.

| Old | New |
|-----|-----|
| `--max-docs-per-issue` | `--limit` |
| `--global-docs-limit` | (remove) |
| `--enable-web-search true/false` | `--web-search` (flag) |
| `--issue-type` | `--issue` |
| `--all-issues` | `--all` |

**Progress**:
- [x] Updated argument definitions in cli.py (lines 1382-1419)
- [x] Update argument processing code (lines 1472-1478) - remove `global_docs_limit`, use `args.max_docs`
- [x] Update function calls to `run_all_issues()` and `run_test()` - remove `global_docs_limit` param
- [x] Update tests in `test_cli.py` to use new flag names
- [x] Run tests and verify
- [ ] Commit and create PR

**Status**: ✅ Ready for PR

**Next**: PR 1.4 (remove `--sequential` flag)

---

### PR 1.3: Remove Batch Recovery CLI Flags ✅ DONE

**Branch**: `refactor/remove-resume-flags`
**PR**: https://github.com/michaeleboyce/deproceduralizer/pull/89

**What was done**:
- Removed `resume_from_batch()` function (~190 lines)
- Removed `--resume-batch` and `--resume-tier` CLI arguments
- Removed batch recovery mode handling in main()
- Updated SKILL.md documentation

**Why**: Batch API keeps results 29 days. If something fails, rerun with same parameters (auto-resumes) or use `--force-rerun`.

**Status**: ✅ Ready for review

---

### PR 1.4: Remove `--sequential` Flag ⬜

**Branch**: `refactor/remove-sequential`

**Change**: Remove `--sequential` mode. Default mode should just work.

**Status**: ⬜ Not started

---

## Phase 2: Remove Batch Persistence Layer

### PR 2.1: Create Migration Test ✅ DONE

**Branch**: `refactor/persistence-optional-test`

**Purpose**: Verify pipeline works without persistence before removing it.

**Discovery**: The code is **already designed for optional persistence**!
- `TierOrchestrator` already defaults `persistence=None`
- All 8 persistence usages have guards: `if self.persistence and self.run_dir:`
- Realtime mode already runs with `persistence=None`

**Tests added** (6 tests in `test_persistence_optional.py`):
- [x] Orchestrator instantiates with persistence=None
- [x] Multiple issue types work without persistence
- [x] Realtime mode pattern verified
- [x] TrackedUnit processing works without persistence
- [x] Contract: persistence parameter is optional
- [x] Contract: run_dir parameter is optional

**Status**: ✅ Ready for PR

---

### PR 2.2: Make Persistence Optional (Default None) - SKIP

**Branch**: `refactor/persistence-optional`

**Change**: Change `TierOrchestrator.__init__` to default `persistence=None`.

**Status**: ⏭️ SKIP - Already done! `persistence` already defaults to `None` in the constructor.

**Next step**: Go directly to PR 2.3 (remove persistence usage from CLI)

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

## Phase 5: Final Cleanup

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

## Summary

| Phase | PRs | Est. Lines Removed | Checkpoint |
|-------|-----|-------------------|------------|
| 0 | 2 | 0 (adding tests) | Contract tests pass |
| 1 | 4 | ~800 | CLI is simple |
| 2 | 4 | ~1,000 | No persistence |
| 3 | 5 | ~2,500 | Simple runner |
| 4 | 5 | ~3,000 | Fewer files |
| 5 | 2 | ~500 | Docs updated |

**Total**: 22 PRs, ~8,000 lines removed

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
| 2026-02-03 | PR 1.2 complete | Flag names ([PR #85](https://github.com/michaeleboyce/deproceduralizer/pull/85)) |
| 2026-02-03 | PR 2.1 complete | Migration test - discovered persistence already optional! |
| 2026-02-03 | PR 2.2 skipped | Already implemented - persistence defaults to None |
| 2026-02-03 | PR 1.3 complete | Remove resume flags ([PR #89](https://github.com/michaeleboyce/deproceduralizer/pull/89)) - 269 lines removed |
