# Research Pipeline V5 Implementation Status

> **Version:** V5 (Proactive Context + Argument Framing)
> **Last Updated:** 2026-02-04
>
> **Note:** The pipeline was significantly simplified in Feb 2026 (see `docs/PIPELINE_SIMPLIFICATION_PLAN.md`).
> Many V4 files referenced below have been deleted or replaced. The current file structure is in the
> "File Structure (Current)" section at the bottom.

## Status Overview

| Phase | Component | Status | Notes |
|-------|-----------|--------|-------|
| 0 | Validation Study | ✅ Complete | 43.5% error rate identified |
| 1 | V5 Documentation | ✅ Complete | V5 design docs created |
| 2 | Schema Migration | ✅ Complete | Migration run, Drizzle schema updated |
| 3 | Prompt Updates | ✅ Complete | 3-layer caching, argument framing |
| 4 | Context Builder Refactor | ✅ Complete | Proactive filtering, summary fallback |
| 5 | Tier 1 Refactor | ✅ Complete | Argument framing, recommendations, V5 fields |
| 6 | Tier 2 Refactor | ✅ Complete | T1→T2 handoff + re-run mechanics |
| 7 | Tier 3 Refactor | ✅ Complete | Merged Tier 4 into Tier 3 (3-tier pipeline) |
| 8 | CLI & Integration | ✅ Complete | 3-tier flow, all 237 tests pass |
| 9 | Tier 3 Web Search | ✅ Complete | Single-call approach, state localization |

---

## V4 → V5 Refactor Overview

**This is a refactor, not a greenfield implementation.** V4 code exists and works.

### What Existed (V4) — Now Simplified

> These V4 files were refactored/deleted during pipeline simplification (Feb 2026).
> See `docs/PIPELINE_SIMPLIFICATION_PLAN.md` for the full history.

| Component | V4 Location | Current Location |
|-----------|-------------|-----------------|
| Backend pipeline | `backend/scripts/research_pipeline/` | Same (simplified) |
| Pydantic models | `models/` | `models/` (unchanged) |
| Context builder | `context_builder.py` (facade) | `context/` subpackage |
| Tier runners | `tier_runners.py` (facade) | `tiers/` subpackage |
| Orchestrator | `tier_orchestrator.py` (class) | `pipeline_runner.py` (flat functions) |
| DB writer | `db_writer.py` (facade) | `db/` subpackage |
| CLI | `cli.py` | `cli.py` (simplified flags) |
| Prompts | `prompts/research_pipeline.yaml` | Same |
| Issue configs | `prompts/compliance_issues.yaml` | Same (43 issue types) |
| DB schema | `compliance_issue_analyses` table | Same (V5 columns) |
| Batch persistence | `batch_persistence.py` | **Deleted** — resume via DB |

### Key V5 Changes

| Area | V4 Approach | V5 Approach | Current Location |
|------|-------------|-------------|-----------------|
| Context gathering | Reactive (LLM requests) | Proactive (keyword filter) | `context/proactive.py` |
| Argument framing | None | Tier 1 outputs `best_argument_*` | `tiers/tier1_runner.py`, prompts |
| Tier structure | 4 tiers | 3 tiers (merge T3+T4) | `pipeline_runner.py`, `state_machine.py` |
| Re-runs | Not tracked | `rerun_count`, `forced_classification` | `tiers/tier2_runner.py`, `db/analysis_writer.py` |
| Summary fallback | None | Truncated content when no summary | `context/proactive.py` |
| Tier 3 triggers | Various thresholds | Canonical: ≥7 claims_no_alt, ≥8 burdensome | `routing.py` |

---

## Phase 0: Validation Study ✅

**Status:** Complete

The validation study compared Tier 2 classifications against a verification tier and found:

| Metric | Value |
|--------|-------|
| Items analyzed | 115 |
| Error rate | 43.5% |
| Errors from prompt interpretation | 98% |
| Errors from missing information | 2% |

**Key Finding:** Models had the information they needed but misinterpreted it. The solution is better prompting (argument framing) and proactive context, not more tiers.

**Reference:** `docs/compliance_issue_experiments/tier2_validation_study.md`

---

## Phase 1: V5 Documentation ✅

**Status:** Complete

V5 architecture documentation created:

| Document | Purpose |
|----------|---------|
| [OVERVIEW.md](./OVERVIEW.md) | High-level architecture diagram |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Full technical specification |
| [CONTEXT_STRATEGY.md](./CONTEXT_STRATEGY.md) | Proactive context gathering |
| [DATA_MODELS.md](./DATA_MODELS.md) | Pydantic model specifications |
| [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) | This document |

V4 documentation archived to `archive/v4-progressive-disclosure/`.

---

## Phase 2: Schema Migration ✅

**Status:** Complete

### Migration File

`frontend/packages/database/migrations/0022_v5_research_pipeline.sql`

### Changes

**Add V5 columns:**
- `tier1_argument_framing` (JSONB) - best_argument_* fields
- `tier1_recommendations` (JSONB) - context_requests array [{context_type, identifier, need_level, reason}]
- `tier2_rerun_count` (INTEGER) - re-run tracking
- `tier2_context_requests_made` (JSONB) - what was requested and why
- `tier2_forced_classification` (BOOLEAN) - true if max re-runs exceeded

**Update tier3/tier4 columns:**
- V5 Tier 3 = Web verification (was V4 Tier 4)
- Rename tier4 columns to align with V5 naming
- Add `tier3_flags` (JSONB) for EvidencedFlags

**Backward compatibility:**
- Keep `pipeline_version` column to distinguish V4 vs V5 results
- Don't drop V4 columns immediately (can clean up later)

### Tasks

- [x] Create migration file
- [x] Run migration on dev database
- [x] Update Drizzle schema TypeScript file
- [x] Verify migration (all 10 V5 columns present)

---

## Phase 3: Prompt Updates ✅

**Status:** Complete

### File: `prompts/research_pipeline.yaml`

### Changes Needed

1. **Tier 1: Add argument framing output**
   ```yaml
   # Add to Tier 1 output schema:
   best_argument_burdensome: Optional[str]  # Only if needs_research
   best_argument_justified: Optional[str]
   best_argument_unrelated: Optional[str]
   context_requests: list[ContextRequest]  # [{context_type, identifier, need_level, reason}]
   ```

2. **Tier 1: Conditional framing instruction**
   ```
   If ALL matches are false positives:
   - Output classification: "all_false_positives"
   - Skip argument framing and recommendations

   If ANY match is genuine:
   - Output classification: "needs_research"
   - Provide all three best_argument_* fields
   - Provide recommendations for Tier 2
   ```

3. **Tier 2: Add re-run mechanics**
   ```
   If you need additional context:
   - Set classification: "needs_context"
   - Specify what you need in context_requests

   You will be re-run with the requested context (max 2 re-runs).
   ```

4. **Tier 2: Inject Tier 1 framing**
   ```
   ## Tier 1's Argument Framing
   Consider these perspectives as you analyze:
   - Burdensome: {best_argument_burdensome}
   - Justified: {best_argument_justified}
   - Unrelated: {best_argument_unrelated}
   ```

5. **Tier 3: Update trigger thresholds**
   - Issue types: add `mandated_reports`
   - `claims_no_alternative`: severity ≥ 7 (was ≥ 6)
   - Burdensome: severity ≥ 8 (was ≥ 7)

### Tasks

- [x] Update Tier 1 system prompt with argument framing
- [x] Update Tier 1 output schema
- [x] Update Tier 2 prompt with framing injection
- [x] Update Tier 2 for re-run mechanics
- [x] Update Tier 3 (merge old Tier 4 web search)
- [x] Remove Tier 4 (absorbed into Tier 3)

---

## Phase 4: Context Builder Refactor ✅

**Status:** Complete

### Files Modified

| File | Changes |
|------|---------|
| `models/context.py` | Added 4 new V5 models (SiblingSummary, CrossRefSummary, AncestorSummary, ProactiveTier1Context) |
| `models/__init__.py` | Updated exports for new models |
| `context_builder.py` | Added constants, helper functions, `build_proactive_context()` |
| `tier_runners.py` | Added `format_proactive_context()` for prompt injection |
| `tests/test_research_pipeline.py` | Added ~750 lines of V5 tests |

### Implementation Details

1. **Proactive keyword filtering**
   ```python
   SIBLING_KEYWORDS = {
       "exemption": ["exempt", "exemption", "waiver", "exception", ...],
       "alternatives": ["electronic", "online", "digital", "remote", ...],
       "scope": ["applicability", "scope", "general provisions", ...],
       "enforcement": ["penalty", "penalties", "violation", "fine", ...],
   }
   KEYWORD_PRIORITY = ["exemption", "alternatives", "scope", "enforcement"]
   ```

2. **Priority-based summary fetching** via `prioritize_summaries()`:
   - Priority 1: Preceding sibling (unless excludable)
   - Priority 2: Following sibling (unless excludable)
   - Priority 3: Keyword-matched siblings (sorted by category priority)
   - Priority 4: Keyword-matched cross-refs (deduplicated)
   - Max 20 summaries total (ancestors not counted toward limit)

3. **Summary fallback** via `get_summary_or_fallback()`:
   - Uses summary if exists and substantive (>10 chars)
   - Falls back to truncated content (500 chars) with sentence boundary detection
   - Last resort: "[Title only]: {title}"
   - Returns `is_fallback` flag for LLM transparency

4. **Excludable patterns** via `is_excludable()`:
   ```python
   EXCLUDABLE_PATTERNS = [
       "definitions", "defined terms",
       "table of contents", "contents",
       "reserved", "repealed",
       "appendix", "appendices",
   ]
   ```

5. **Catalog size limits**:
   - `MAX_SUMMARIES = 20` (siblings + cross-refs combined)
   - `MAX_SIBLING_CATALOG = 50`
   - `MAX_CROSS_REF_CATALOG = 100`
   - Truncation flags in output model

### Tasks

- [x] Add enforcement keywords
- [x] Implement priority-based summary selection
- [x] Add summary fallback logic
- [x] Add excludable pattern filtering
- [x] Add catalog size limits (50 siblings, 100 cross-refs)
- [x] Add new V5 models (SiblingSummary, CrossRefSummary, AncestorSummary, ProactiveTier1Context)
- [x] Add format_proactive_context() to tier_runners.py
- [x] Update tests (~750 lines of unit and integration tests)

---

## Phase 5: Tier 1 Refactor ✅

**Status:** Complete

### File: `backend/scripts/research_pipeline/tier_runners.py`

### Changes Needed

1. **Update Tier1Output model**
   ```python
   class Tier1Output(BaseModel):
       # Existing
       relevant_match_indices: list[int]
       dismissed_matches: list[DismissedMatch]
       classification: Literal["all_false_positives", "needs_research"]

       # NEW: Argument framing (Optional - only if needs_research)
       best_argument_burdensome: Optional[str] = None
       best_argument_justified: Optional[str] = None
       best_argument_unrelated: Optional[str] = None

       # NEW: Context requests for Tier 2 to fetch
       context_requests: list[ContextRequest] = Field(default_factory=list)
       # Each ContextRequest has: context_type, identifier, need_level, reason
   ```

2. **Pass proactive context to Tier 1**
   - Pre-fetched sibling/cross-ref summaries
   - Full catalogs for recommendations

### Tasks

- [x] Update Tier1Output model in `models/` - Added V5 fields (argument framing, recommendations)
- [x] Update `prepare_tier1_batch()` to include proactive context
- [x] Update response parsing for new fields
- [x] Update db_writer for new columns (tier1_argument_framing, tier1_recommendations)
- [x] Update tests - Added ~300 lines of Phase 5/6 tests

---

## Phase 6: Tier 2 Refactor ✅

**Status:** Complete

### File: `backend/scripts/research_pipeline/tier_runners.py`

### Changes Needed

1. **Merge old Tier 3 into Tier 2**
   - Tier 2 now does full document analysis (was Tier 3)
   - Tier 2 can request additional context → re-run

2. **Add re-run mechanics**
   ```python
   async def run_tier2_with_reruns(
       doc_id: int,
       initial_context: Tier2Context,
       max_reruns: int = 2,
   ) -> Tier2Output:
       rerun_count = 0
       while rerun_count <= max_reruns:
           output = await call_tier2_llm(context)
           if output.classification != "needs_context":
               return output
           # Fetch requested context
           context = add_context(context, output.context_requests)
           rerun_count += 1
       # Force classification
       return await call_tier2_llm(context, force=True)
   ```

3. **Update Tier2Output model**
   ```python
   class Tier2Output(BaseModel):
       # Existing fields...

       # NEW: Re-run tracking
       rerun_count: int = 0
       context_requests_made: list[dict] = Field(default_factory=list)
       forced_classification: bool = False
   ```

4. **Inject Tier 1 argument framing**
   - Pass `best_argument_*` from Tier 1 to Tier 2 prompt

### Tasks

**Completed (T1→T2 Handoff):**
- [x] Add argument framing injection to prompt - Added `_format_tier1_argument()`, `_format_tier1_recommendations()`
- [x] Update `prepare_tier2_batch()` to pass V5 variables
- [x] Update Tier2Output model - Added `cites_federal_statute`, `federal_citation`, `claims_no_alternative`
- [x] Update db_writer for V5 Tier 2 columns
- [x] Add re-run placeholders to prompt (`additional_context`, `rerun_count`, `forced_classification_warning`)

**Completed (Re-run Mechanics):**
- [x] Add `TIER2_RERUNNING` state to ProcessingState enum
- [x] Add `tier2_rerun_count`, `tier2_accumulated_context`, `tier2_context_requests_made`, `tier2_forced_classification` to TrackedUnit
- [x] Implement `run_tier2_with_reruns()` async function with re-run loop
- [x] ~~Add `_format_accumulated_context()` and `_format_forced_classification_warning()` formatters~~ (removed - unused)
- [x] Add `tier2_reruns` parameter to TierOrchestrator and run_pipeline()
- [x] Update `_run_tier2()` to use `run_tier2_with_reruns()` when enabled
- [x] Update `save_tier2_results()` to save re-run tracking columns
- [x] Add 14 tests for re-run mechanics

---

## Phase 7: Tier 3 Refactor ✅

**Status:** Complete

### Files Modified

| File | Changes |
|------|---------|
| `state_machine.py` | Removed TIER4 states, TIER3_COMPLETE → DONE |
| `models/llm_outputs.py` | Merged Tier4Output into Tier3Output, added EvidencedFlag |
| `models/database.py` | Deleted ComplianceIssueTier4Update |
| `models/inputs.py` | Deleted Tier4Input |
| `tiers/` (was `tier_runners.py`) | Renamed run_tier4_realtime → run_tier3_realtime, deleted prepare_tier3_batch |
| `pipeline_runner.py` (was `tier_orchestrator.py`) | Removed _run_tier4(), updated _run_tier3() to use real-time API |
| `db/analysis_writer.py` (was `db_writer.py`) | Deleted save_tier4_results(), added web columns to save_tier3_results() |
| `result_processor.py` | tier3_output is now final tier |
| `cost_tracker.py` | Tier 3 uses real-time API (no batch discount) |
| `prompt_loader.py` | Only loads tiers 1-3 |
| `__init__.py` | Updated exports |
| `models/__init__.py` | Updated exports |

### V5 Canonical Tier 3 Triggers

```python
# High-risk issue types (require severity >= 6 to trigger)
if issue_type in ("newspaper", "notarization", "wet_signature",
                  "witness", "in_person", "mandated_reports") and severity >= 6:
    return ProcessingState.TIER3_PENDING

# Federal statute citation
if tier2.cites_federal_statute:
    return ProcessingState.TIER3_PENDING

# Claims no alternative with high severity
if tier2.claims_no_alternative and severity >= 7:
    return ProcessingState.TIER3_PENDING

# Burdensome with very high severity
if tier2.classification == "burdensome" and severity >= 8:
    return ProcessingState.TIER3_PENDING

# Controversial justified items
if tier2.classification == "justified" and tier2.potentially_controversial:
    return ProcessingState.TIER3_PENDING

# Federal mandate suspected
if tier2.federal_mandate_suspected:
    return ProcessingState.TIER3_PENDING
```

### Tasks

- [x] Merge Tier 4 logic into Tier 3
- [x] Remove old Tier 3 batch code
- [x] Update trigger thresholds
- [x] Add `mandated_reports` to issue type triggers
- [x] Update db_writer to use tier3 columns for web results
- [x] Update tests (all 237 pass)

---

## Phase 8: CLI & Integration ✅

**Status:** Complete (integrated with Phase 7)

The CLI and orchestrator were updated as part of Phase 7:

- State machine updated for 3-tier flow
- Orchestrator uses `run_tier3_realtime()` for web search
- Cost tracking updated (Tier 3 = real-time, no batch discount)
- All 237 tests pass

### Tasks

- [x] Update state machine
- [x] Update orchestrator for 3-tier flow
- [x] Update cost estimates
- [x] Integration tests (237 tests pass)

---

## Phase 9: Tier 3 Web Search Refactor ✅

**Status:** Complete (2026-01-04)

Refactored Tier 3 web search from a broken two-step approach to a working single-call approach.

### Problem with Original Two-Step Approach

1. **Step 1**: Call Claude with `web_search` tool → encrypted content returned
2. **Step 2**: Try to extract results → `encrypted_content` unreadable
3. Pass to analysis call → no actual web content available

The `encrypted_content` in `web_search_tool_result` blocks is only decrypted for Claude *during the same API call* - it cannot be extracted and passed to a second call.

### Single-Call Solution

1. Single API call where Claude:
   - Performs web searches using `web_search` tool
   - Analyzes results internally (has access to decrypted content)
   - Outputs structured JSON matching `Tier3Output` schema

2. Citation extraction from `text` blocks:
   - Claude's text responses include `citations` array with `cited_text`
   - Up to 150 chars of actual quoted content from each source
   - Merged into evidence arrays

3. State-specific location:
   ```python
   "user_location": {
       "type": "approximate",
       "city": "Trenton",
       "region": "New Jersey",
       "country": "US"
   }
   ```

### Files Changed

| File | Changes |
|------|---------|
| `tier_runners.py` | `get_web_search_tool()`, `extract_web_search_response()`, `_parse_tier3_json_response()`, refactored `run_tier3_realtime()` |
| `prompts/research_pipeline.yaml` | Updated tier3 section for single-call, fixed evidence schema |
| `docs/research_pipelines/OVERVIEW.md` | Added Tier 3 implementation section |

### Tasks

- [x] Add `get_web_search_tool(state)` with `user_location` parameter
- [x] Add `extract_web_search_response()` for citation extraction
- [x] Add `_parse_tier3_json_response()` for JSON parsing without `response_format`
- [x] Refactor `run_tier3_realtime()` to single-call approach
- [x] Update prompt YAML with correct evidence schema (`type`/`identifier` not `url`/`source_type`)
- [x] Add implementation notes to OVERVIEW.md
- [x] Test with real candidate (N.J.A.C. 11:15-3.5)

---

## File Structure (Current)

Updated February 2026 after pipeline simplification (see `docs/PIPELINE_SIMPLIFICATION_PLAN.md`).

### Module Layout

```
backend/scripts/research_pipeline/
    # Entry points
    __init__.py              # Public API exports only
    cli.py                   # Thin CLI (dry-run by default, --execute to run)

    # Core orchestration
    pipeline_runner.py       # Flat functions (replaced TierOrchestrator class)
    state_machine.py         # ProcessingState (8 states), TrackedUnit

    # Shared infrastructure
    ids.py                   # make_custom_id(), parse_custom_id()
    routing.py               # Tier 3 escalation rules, triggers
    config.py                # Centralized: batch sizes, models, thresholds

    # Database layer
    db/
        __init__.py
        connection.py        # DatabaseManager (context managers)
        document_queries.py  # ProcessingUnitBuilder (unified fetch)
        analysis_writer.py   # save_tier*_results()
        analysis_reader.py   # get_existing_analyses() — resume source of truth

    # Context layer
    context/
        __init__.py
        queries.py           # SQL queries (sibling, crossref, ancestor)
        catalog.py           # ContextCatalog assembly
        proactive.py         # V5 keyword filtering, summary selection
        fetchers.py          # Summary/full-text retrieval

    # Tier runners
    tiers/
        __init__.py
        base.py              # TierRunner protocol
        tier1_runner.py      # Tier 1 batch preparation, 4-layer caching
        tier2_runner.py      # Tier 2 + re-run mechanics
        tier3_runner.py      # Tier 3 web search orchestration
        web_search.py        # Web search tool, extraction

    # Prompt handling
    formatting.py            # All prompt formatters
    prompt_loader.py         # YAML config loading

    # Supporting modules
    result_processor.py      # Batch result parsing
    cost_tracker.py          # Token/cost tracking
    context_registry.py      # Context audit trail
    pipeline_logger.py       # Pipeline logging

    # Maintenance scripts
    maintenance/
        backfill_legacy_analyses.py

    # Models
    models/
        __init__.py
        llm_outputs.py       # Tier1/2/3Output, EvidencedFlag
        context.py           # Context data models
        matches.py           # ProcessingUnit, MatchInfo
        database.py          # DB update models

prompts/
    research_pipeline.yaml   # V5 tier prompts
    compliance_issues.yaml   # 43 issue-specific configs (patterns + prompts)
```

### Deleted in Simplification (Feb 2026)

| File | Reason | PR |
|------|--------|----|
| `tier_orchestrator.py` | Replaced by `pipeline_runner.py` (flat functions) | #97 |
| `batch_persistence.py` | Resume via DB, not disk | #96 |
| `db_writer.py` | Facade — import from `db/` directly | #98 |
| `tier_runners.py` | Facade — import from `tiers/` directly | #98 |
| `context_builder.py` | Facade — import from `context/` directly | #98 |
| `prompting/` | Unused module | #98 |

### Architectural Principles

1. **Flat orchestration**: No orchestrator class — `pipeline_runner.py` has flat functions
2. **Composable Tiers**: Each tier is a component (prepare → run → process) with clear I/O
3. **DB-based resume**: `get_existing_analyses()` is the source of truth (no disk persistence)
4. **Centralized Config**: No scattered constants — all in `config.py`
5. **Direct imports**: No facade re-exports — import from `db/`, `tiers/`, `context/` directly

---

## Cost Estimates

| Component | Volume | Cost/1000 | Total @ 250k |
|-----------|--------|-----------|--------------|
| Tier 1 (batch) | 100% | $0.25 | $63 |
| Tier 2 (batch) | ~70% | $1.50 | $263 |
| Tier 2 re-runs (real-time) | ~10% | $3.00 | $75 |
| Tier 3 (real-time + web) | ~15% | $12-15 | $450-563 |
| **Total** | | | **~$850-965** |

**API Strategy:**
- Tier 1 & Tier 2 initial: Batch API (50% cost savings, 24hr latency OK)
- Tier 2 re-runs: Real-time API (cannot wait 24hr between context requests, max 2 re-runs)
- Tier 3: Real-time API (web search is synchronous)

---

## Related Documentation

- [OVERVIEW.md](./OVERVIEW.md) - Architecture diagram
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Full technical specification
- [CONTEXT_STRATEGY.md](./CONTEXT_STRATEGY.md) - Proactive context gathering
- [DATA_MODELS.md](./DATA_MODELS.md) - Pydantic model specifications
- [Validation Study](../compliance_issue_experiments/tier2_validation_study.md) - Error analysis
