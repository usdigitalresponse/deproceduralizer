# Research Pipeline Simplification Plan

> **Status: IN PROGRESS**
> - Phase 0: 🔄 In Progress (PR 0.1 ready for review)
> - Phase 1-5: 📋 Planned

**Goal**: Reduce research pipeline from ~23,000 lines to ~5,000 lines while preserving functionality.

**Principles**:
1. **One PR = One Change** - Each PR does exactly one thing
2. **Tests First** - Write/update tests before changing code
3. **Green to Green** - All tests pass before AND after each PR
4. **Behavioral Tests** - Test "what it does" not "how it's structured"
5. **Delete Tests for Deleted Code** - When we remove a module, remove its tests

---

## Current Status

| Phase | Description | Status | PRs Merged |
|-------|-------------|--------|------------|
| 0 | Test Infrastructure | 🔄 In Progress | 0/2 |
| 1 | Simplify CLI | 📋 Planned | 0/4 |
| 2 | Remove Batch Persistence | 📋 Planned | 0/4 |
| 3 | Flatten State Machine | 📋 Planned | 0/5 |
| 4 | Consolidate Files | 📋 Planned | 0/5 |
| 5 | Final Cleanup | 📋 Planned | 0/2 |

**Total Progress**: 0/22 PRs

---

## Phase 0: Test Infrastructure (Before Any Refactoring)

### PR 0.1: Add End-to-End Pipeline Contract Test ⬜

**Branch**: `refactor/pipeline-contract-tests`

**Purpose**: Create high-level tests that validate the pipeline's *behavior* independent of internal structure. These tests should pass before AND after all refactoring.

**New file**: `backend/tests/research_pipeline/test_pipeline_contract.py`

**Tests to add**:
- [ ] `test_tier1_filters_false_positives` - Tier 1 marks false positives, true matches continue
- [ ] `test_tier2_classifies_and_scores` - Tier 2 produces classification + severity
- [ ] `test_tier3_runs_for_high_severity` - High severity docs escalate to Tier 3
- [ ] `test_results_saved_to_database` - Results persist to `compliance_issue_analyses`
- [ ] `test_dry_run_makes_no_changes` - `--dry-run` doesn't call APIs or write DB
- [ ] `test_skip_done_respects_existing` - Already-analyzed docs are skipped

**Status**: ⬜ Not started

---

### PR 0.2: Add CLI Integration Test ⬜

**Branch**: `refactor/cli-integration-tests`

**Purpose**: Test CLI argument parsing and dispatch with mocked internals.

**New file**: `backend/tests/research_pipeline/test_cli_integration.py`

**Tests to add**:
- [ ] `test_minimal_invocation` - `--state` alone works with defaults
- [ ] `test_dry_run_shows_preview` - `--dry-run` shows what would be processed
- [ ] `test_invalid_state_rejected` - Invalid `--state` errors clearly

**Status**: ⬜ Not started

---

## Phase 1: Simplify the CLI (Lowest Risk)

### PR 1.1: Add Default Values to CLI Arguments ⬜

**Branch**: `refactor/cli-defaults`

**Change**: Make most arguments optional with sensible defaults.

| Flag | Default |
|------|---------|
| `--limit` | 1000 |
| `--max-tier` | 2 |
| `--all-issues` | True (if no `--issue`) |
| `--web-search` | False |

**Status**: ⬜ Not started

---

### PR 1.2: Simplify CLI Flag Names ⬜

**Branch**: `refactor/cli-flag-names`

**Change**: Rename verbose flags.

| Old | New |
|-----|-----|
| `--max-docs-per-issue` | `--limit` |
| `--global-docs-limit` | (remove) |
| `--enable-web-search true/false` | `--web-search` (flag) |
| `--issue-type` | `--issue` |
| `--all-issues` | `--all` |

**Status**: ⬜ Not started

---

### PR 1.3: Remove Batch Recovery CLI Flags ⬜

**Branch**: `refactor/remove-resume-flags`

**Change**: Remove `--resume-batch` and `--resume-tier` flags.

**Why**: Batch API keeps results 29 days. If something fails, rerun with existing `--skip-done`.

**Status**: ⬜ Not started

---

### PR 1.4: Remove `--sequential` Flag ⬜

**Branch**: `refactor/remove-sequential`

**Change**: Remove `--sequential` mode. Default mode should just work.

**Status**: ⬜ Not started

---

## Phase 2: Remove Batch Persistence Layer

### PR 2.1: Create Migration Test ⬜

**Branch**: `refactor/persistence-optional-test`

**Purpose**: Verify pipeline works without persistence before removing it.

```python
def test_pipeline_without_persistence():
    """Pipeline should work with persistence=None."""
    orchestrator = TierOrchestrator(..., persistence=None, run_dir=None)
```

**Status**: ⬜ Not started

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
