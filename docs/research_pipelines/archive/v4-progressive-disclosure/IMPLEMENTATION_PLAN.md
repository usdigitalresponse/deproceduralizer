
# Research Pipeline Implementation Plan

> **Status: PHASE 5 COMPLETE**
> Comprehensive 7-phase implementation for 4-tier LLM research pipeline.
> Created: 2026-01-01
> Updated: 2026-01-02 (Phase 5 completed - CLI, backfill, Langfuse integration)

## Executive Summary

This plan covers the full implementation of a 4-tier progressive disclosure research pipeline for regulatory compliance analysis. The pipeline processes 10,542 regex matches grouped into 8,534 (document, issue_type) processing units.

**Estimated Cost:** ~$77 (~$46 with caching)
**Estimated Duration:** 5-7 weeks
**Key Innovation:** 77% token savings via progressive context disclosure

---

## Phase Overview

```
          ┌──────────────────────────────────────────────────────────────────────────────────────────┐
          │                            RESEARCH PIPELINE IMPLEMENTATION                              │
          └──────────────────────────────────────────────────────────────────────────────────────────┘

PHASE 1   ┌─────────────────────────────────┐     ┌─────────────────────────────────┐
FOUNDATION│  DATABASE MIGRATIONS            │  || │  PYDANTIC MODELS & CONFIG       │
(Week 1)  │  - Create analyses table        │     │  - context.py                   │
          │  - Add indexes                  │     │  - matches.py                   │
          │  - Drizzle schema               │     │  - llm_outputs.py               │
          └────────────────┬────────────────┘     └────────────────┬────────────────┘
                           │                                        │
                           └──────────────────┬─────────────────────┘
                                              ▼
PHASE 2   ┌───────────────────────────────────────────────────────────────────────────────────────────┐
CONTEXT   │  CONTEXT BUILDER INFRASTRUCTURE                                                           │
(Week 2)  │  - context_builder.py (catalog, fetching)                                                 │
          │  - context_registry.py (deduplication)                                                    │
          │  - Batch SQL queries (ancestors, siblings, definitions, cross-refs)                       │
          └────────────────────────────────────────────────────┬──────────────────────────────────────┘
                                                               ▼
PHASE 3   ┌─────────────────────────────────┐     ┌─────────────────────────────────┐
TIER 1&2  │  TIER 1: MATCH FILTERING        │ --> │  TIER 2: SUMMARY RESEARCH       │
(Week 3)  │  - tier1_filtering.py           │     │  - tier2_summary.py             │
          │  - Match grouping logic         │     │  - 12-step analysis             │
          │  - False positive detection     │     │  - Severity calculation         │
          │  - Context catalog display      │     │  - Context request handling     │
          └─────────────────────────────────┘     └────────────────┬────────────────┘
                                                                   ▼
PHASE 4   ┌─────────────────────────────────┐     ┌─────────────────────────────────┐
TIER 3&4  │  TIER 3: FULL CONTEXT           │ --> │  TIER 4: WEB SEARCH            │
(Week 4)  │  - tier3_fulltext.py            │     │  - tier4_websearch.py          │
          │  - Full text fetching           │     │  - Real-time API integration   │
          │  - Severity adjustment          │     │  - Federal mandate detection    │
          └─────────────────────────────────┘     └────────────────┬────────────────┘
                                                                   ▼
PHASE 5   ┌───────────────────────────────────────────────────────────────────────────────────────────┐
CLI & DB  │  CLI & DATABASE INTEGRATION                                                               │
(Week 5)  │  - cli.py (entry point)                                                                  │
          │  - db_writer.py (tier updates)                                                           │
          │  - cost_tracker.py                                                                       │
          │  - Backfill legacy data                                                                  │
          └────────────────────────────────────────────────────┬──────────────────────────────────────┘
                                                               ▼
PHASE 6   ┌─────────────────────────────────┐     ┌─────────────────────────────────┐
FRONTEND  │  REPOSITORY UPDATES             │  || │  UI COMPONENTS                  │
(Week 6)  │  - New table queries            │     │  - Tier progress indicator      │
          │  - Field mappings               │     │  - Evidence display             │
          │  - Analysis join queries        │     │  - Web source badges            │
          └─────────────────────────────────┘     └────────────────┬────────────────┘
                                                                   ▼
PHASE 7   ┌───────────────────────────────────────────────────────────────────────────────────────────┐
TESTING   │  END-TO-END TESTING & VALIDATION                                                          │
(Week 7)  │  - Sample batch run (100 items)                                                          │
          │  - Full run (8,534 items)                                                                │
          │  - Cost validation vs. estimate                                                          │
          │  - Quality review (10% sample)                                                           │
          └───────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Foundation - Database & Models

**Goal:** Establish the database structure and core Pydantic models that all other phases depend on.

### Tasks

#### File Reorganization (Pre-requisite)

- [x] Move `docs/research_pipelines/research_pipeline.yaml` → `prompts/research_pipeline.yaml` (S)
  - Contains tier prompts (system + templates)
  - Aligns with existing `prompts/core.yaml` and `prompts/compliance_issues.yaml`

- [x] Move `docs/research_pipelines/issue_configs/` → `prompts/issue_configs/` (S)
  - Contains 43 issue-specific YAML configs
  - Includes positive/negative indicators, severity modifiers, examples
  - Update any imports/references in code and docs

- [x] Update CLAUDE.md and CLAUDE.local.md references to new paths (S)

#### Database

- [x] Create SQL migration `0018_compliance_issue_analyses.sql` (M) ✅
  - New `compliance_issue_analyses` table with 53 columns
  - All tier-tracking fields (tier1_*, tier2_*, tier3_*, tier4_*)
  - UNIQUE constraint on (document_id, issue_type)

- [x] Create SQL migration `0019_add_analyses_indexes.sql` (S) ✅
  - Classification indexes (tier1/2/3/4_classification)
  - Workflow indexes (needs_tier2, needs_tier3, needs_tier4, justified_controversial)
  - GIN index on context_used JSONB
  - 16 indexes total

- [x] Create Drizzle schema `compliance-issue-analyses.ts` (M) ✅
  - All columns matching SQL schema
  - Type exports (ComplianceIssueAnalysis, NewComplianceIssueAnalysis)
  - Classification type aliases
  - ContextEntry, ContextRequest, DismissedMatch interfaces

- [x] Update schema index.ts to export new schema (S) ✅

#### Prompt Infrastructure

- [x] Create `backend/scripts/research_pipeline/prompt_loader.py` (M) ✅
  - Load tier prompts from `prompts/research_pipeline.yaml`
  - Load issue configs from `prompts/issue_configs/`
  - Format functions for indicators, modifiers, examples
  - TierConfig and IssueConfig dataclasses
  - Note: Separate from shared_utils.py to avoid coupling

#### Pydantic Models

- [x] Create `backend/scripts/research_pipeline/__init__.py` (S) ✅

- [x] Create `backend/scripts/research_pipeline/models/__init__.py` (S) ✅

- [x] Create `backend/scripts/research_pipeline/models/context.py` (M) ✅
  - SiblingEntry, CrossRefEntry, AncestorEntry
  - ContextCatalog, ContextRequest
  - ContextEntryLLM, ContextEntryDB

- [x] Create `backend/scripts/research_pipeline/models/matches.py` (S) ✅
  - MatchInfo, DismissedMatch, ProcessingUnit

- [x] Create `backend/scripts/research_pipeline/models/llm_outputs.py` (L) ✅
  - Tier1Output, Tier2Output, Tier3Output, Tier4Output
  - JSON string validators for LLM quirks

- [x] Create `backend/scripts/research_pipeline/models/database.py` (M) ✅
  - ComplianceIssueTier1Update through Tier4Update

- [x] Create `backend/scripts/research_pipeline/models/inputs.py` (M) ✅
  - Tier1Input, Tier2Input, Tier3Input, Tier4Input

- [x] Run migrations on dev database (S) ✅
  - Table created with 53 columns
  - 16 indexes created

### Deliverables
- SQL migrations ready to apply
- Drizzle schema compiles and exports types
- All Pydantic models importable and validated
- Empty `compliance_issue_analyses` table created

### Depends On
- None (starting point)

### Enables
- Phase 2: Context Builder (uses models)
- Phase 3: Tier implementations (uses models)
- Phase 5: DB Writer (uses table)
- Phase 6: Frontend (uses Drizzle schema)

### Parallelism
`DATABASE (migrations + Drizzle) || PYDANTIC MODELS (all model files)`

---

## Phase 2: Context Builder Infrastructure

**Goal:** Build the context assembly and deduplication system that all tiers use.

### Tasks

#### Cache Batching Strategy

- [x] Design batch ordering for cache efficiency (M) ✅
  - Group by issue_type first (same system prompt = cache hits)
  - Within issue_type, group by subchapter (siblings share parent context)
  - Document ordering strategy in code comments
  - Measure: Track cache hit rate in sample runs

- [x] Implement batch grouping in orchestrator (S) ✅
  - `group_for_cache_efficiency()` function
  - Returns ordered list optimized for prompt caching

#### Context Builder (Reuse Existing Queries)

- [x] Create `backend/scripts/research_pipeline/context_builder.py` (L) ✅
  - **Import from** `backend/scripts/local_summarization/db_queries.py`:
    - `get_ancestors_batch()` - Already implements recursive CTE
    - Sibling logic from `get_documents_by_level()` / `get_children()`
  - Add new functions:
    - `build_context_catalog()` - Assemble catalog for Tier 1
    - `fetch_immediate_siblings()` - Get prev/next sections with summaries
    - `fetch_requested_summaries()` - Get summaries for Tier 2
    - `fetch_full_text_items()` - Get full content for Tier 3

- [x] Implement Tier 2 context rules (M) ✅
  - **Full document content**: Always include in Tier 2 (not just summaries)
  - **Definitions always included**: Tier 2+ always gets inherited definitions
  - **Definitions-via-cross-ref optimization**: When cross-ref targets a definitions
    section, pull from definitions table (not full section content)
  - `get_definitions_for_document()` - Get inherited definitions via scope chain

- [x] Create batch SQL queries (extend existing) (M) ✅
  - `get_siblings_batch()` - All siblings for multiple documents
  - `get_crossrefs_batch()` - Cross-references for multiple documents
  - `get_definitions_batch()` - Definitions with scope inheritance

#### Context Registry & Audit Trail

- [x] Create `backend/scripts/research_pipeline/context_registry.py` (M) ✅
  - ContextRegistry class for deduplication
  - Track seen_doc_ids
  - Handle "also_appears_as" for dual-role documents
  - `render_for_tier()` method (summary vs full text)
  - **`to_context_used()`** - Export as JSON for storage in context_used column

- [x] Implement context_used tracking (M) ✅
  - Collect all context items used during analysis
  - Store source document IDs for auditability
  - Format: `[{type, identifier, source_doc_id, content_hash}]`
  - Enable post-hoc queries like "which analyses used this definition?"

#### Issue Config Loading

- [x] Create `backend/scripts/research_pipeline/issue_config_loader.py` (M) ✅
  - Consolidated into prompt_loader.py
  - Load issue configs from `prompts/issue_configs/`
  - Parse positive_indicators, negative_indicators
  - Format severity_baseline, severity_modifiers
  - Format examples for few-shot learning

- [x] Add tests for context builder (M) ✅
  - Test batch queries return expected structure
  - Test deduplication works correctly
  - Test sibling ordering by citation
  - Test context_used JSON serialization

### Deliverables
- Context builder can assemble catalog for any document
- Context registry deduplicates correctly and exports audit trail
- Issue configs load and format for prompt injection
- Batch queries work efficiently (< 1 second for 100 documents)
- Batches ordered for cache efficiency

### Depends On
- Phase 1: Pydantic models (uses context models)

### Enables
- Phase 3: Tiers 1 & 2 (use context builder)
- Phase 4: Tier 3 (uses full text fetching)

---

## Phase 3: Tier 1 & Tier 2 Implementation

**Goal:** Implement match filtering (Tier 1) and summary-based research (Tier 2).

### Tier 1 Tasks

- [x] Create `backend/scripts/research_pipeline/tier1_filtering.py` (L) ✅
  - Implemented in tier_runners.py as `prepare_tier1_batch()`
  - `group_matches_by_document()` - Create ProcessingUnits
  - `format_matches_for_prompt()` - Format match list with context
  - `build_tier1_prompt()` - Assemble system + template
  - `parse_tier1_output()` - Validate and parse LLM response
  - `run_tier1_batch()` - Submit batch via BatchManager

- [x] Create match grouping SQL query (M) ✅
  - Group regex matches by (document_id, issue_type)
  - Include occurrence_number, regex_match_pattern, regex_match_context
  - Order by document for batch cache efficiency

- [x] Implement Tier 1 prompt template injection (S) ✅
  - Inject {issue_type}, {issue_description}
  - Inject {positive_indicators}, {negative_indicators}
  - Inject {issue_examples} from issue config

### Tier 2 Tasks

- [x] Create `backend/scripts/research_pipeline/tier2_summary.py` (L) ✅
  - Implemented in tier_runners.py as `prepare_tier2_batch()`
  - `build_tier2_input()` - Assemble input from Tier 1 output
  - `format_context_for_tier2()` - Format requested summaries
  - `build_tier2_prompt()` - Assemble system + template
  - `parse_tier2_output()` - Validate and parse LLM response
  - `run_tier2_batch()` - Submit batch via BatchManager

- [x] Implement 12-step analysis in system prompt (M) ✅
  - Format the procedure steps
  - Include severity calculation guidance
  - Add steelmanning requirement

- [x] Implement verbatim extraction validation (S) ✅
  - `check_verbatim()` function in result_processor.py
  - Check quotes exist in document content

#### Tier Routing Rules (1 → 2)

- [x] Implement Tier 1 → Tier 2 routing logic (M) ✅
  - Implemented in state_machine.py and tier_orchestrator.py
  - Route to Tier 2 when: `tier1_classification != "unrelated"`
  - Skip Tier 2 when: `tier1_classification == "unrelated"` (false positive filtered)
  - Store `needs_tier2` flag in database
  - Log routing decisions for debugging

- [x] Add tests for Tier 1 & 2 (M) ✅
  - Test match grouping creates correct ProcessingUnits
  - Test prompt formatting includes all required sections
  - Test output parsing validates all fields
  - Test routing logic correctly identifies Tier 2 candidates

### Deliverables
- Tier 1 can filter false positives from 8,534 processing units
- Tier 2 can analyze with summary context
- Verbatim extraction validated against source
- Tier 1 → 2 routing implemented with logging

### Depends On
- Phase 1: Models (Tier1Output, Tier2Output, etc.)
- Phase 2: Context builder (catalog, summaries, definitions)

### Enables
- Phase 4: Tier 3 (needs Tier 2 output)
- Phase 5: CLI (orchestrates tiers)

---

## Phase 4: Tier 3 & Tier 4 Implementation

**Goal:** Implement full context deep dive (Tier 3) and web search validation (Tier 4).

### Tier 3 Tasks

- [x] Create `backend/scripts/research_pipeline/tier3_fulltext.py` (L) ✅
  - Implemented in tier_runners.py as `prepare_tier3_batch()`
  - `build_tier3_input()` - Include Tier 2 analysis + full text
  - `fetch_full_text_for_requests()` - Get requested item content
  - `build_tier3_prompt()` - Include Tier 2 values in template
  - `parse_tier3_output()` - Validate severity adjustment
  - `run_tier3_batch()` - Submit batch via BatchManager

- [x] Implement severity adjustment logic (M) ✅
  - Calculate final_severity = tier2_severity + tier3_adjustment
  - Validate adjustment range (-3 to +3)
  - Store adjustment reasoning

- [x] Implement reclassification handling (S) ✅
  - Handle justified/unrelated reclassification
  - Update verbatim_requirements if refined

#### Tier Routing Rules (2 → 3)

- [x] Implement Tier 2 → Tier 3 routing logic (M) ✅
  - Implemented in state_machine.py `get_next_state()`
  - Route to Tier 3 when ANY of:
    - `needs_full_context == true`
    - `ambiguity_type` is set (needs resolution)
    - `potentially_controversial == true`
  - Skip Tier 3 when: Clear burdensome/justified with high confidence
  - Store `needs_tier3` flag in database
  - Log routing decisions with reason

### Tier 4 Tasks

- [x] Create `backend/scripts/research_pipeline/tier4_websearch.py` (L) ✅
  - Implemented in tier_runners.py as `run_tier4_realtime()`
  - `build_tier4_input()` - Include Tier 3 analysis + web topics
  - `execute_web_search()` - Use Claude's **built-in web_search tool**
  - `parse_tier4_output()` - Extract web sources from tool results
  - `run_tier4_realtime()` - Real-time API (not batch, web search requires it)

- [x] Implement Claude web_search tool integration (M) ✅
  - Use `tools=[WEB_SEARCH_TOOL]` with type "web_search_20250305"
  - Parse `server_tool_use` and `web_search_tool_result` blocks
  - Extract search results and citations via `extract_web_search_results()`
  - No external API dependencies (Exa/Tavily not needed)

- [x] Implement web source tracking (M) ✅
  - Parse web search results from Claude response
  - Store in context_used with type "web_search"
  - Extract URLs, titles, snippets, page_age

- [x] Implement federal mandate detection (S) ✅
  - Tier4Output model has federal_mandate_found, state_has_discretion
  - Prompt instructs Claude to detect and classify

#### Tier Routing Rules (3 → 4)

- [x] Implement Tier 3 → Tier 4 routing logic (M) ✅
  - Implemented in state_machine.py `get_next_state()`
  - Route to Tier 4 when ANY of:
    - `classification == "needs_full_context"` with external ambiguity
    - `needs_web_search == true`
    - Federal mandate suspected but unconfirmed
  - Skip Tier 4 when: Low severity or clear local-only regulation
  - Store `needs_tier4` flag in database
  - Log routing decisions with reason

- [x] Add tests for Tier 3 & 4 (M) ✅
  - 12 new unit tests for web search functionality
  - Test WEB_SEARCH_TOOL definition
  - Test WebSearchResult and WebSearchQuery dataclasses
  - Test extract_web_search_results() parsing
  - Test format_web_results_for_prompt() formatting
  - All 66 tests pass

### Deliverables
- Tier 3 can resolve uncertain cases with full context
- Tier 4 can validate high-severity items via Claude's web search
- Federal mandate detection working
- All tier outputs validated
- Tier 2→3 and 3→4 routing implemented with logging

### Depends On
- Phase 3: Tier 2 output (needed for Tier 3 input)
- Phase 2: Context builder (full text fetching)

### Enables
- Phase 5: CLI (orchestrates all tiers)

---

## Phase 5: CLI & Database Integration

**Goal:** Build the command-line interface and database writer.

### Tasks

- [x] Create `backend/scripts/research_pipeline/cli.py` (L) ✅
  - Production-ready CLI
  - `run` command - Full pipeline execution (via tier_orchestrator.py)
  - `--max-tier` flag - Stop at tier N
  - `--issue-type` flag - Filter by issue type
  - `--num-docs` flag - Process N items only
  - `--realtime` flag - Use realtime API instead of batch

- [x] Create `backend/scripts/research_pipeline/db_writer.py` (M) ✅
  - `save_tier1_results()` - Save Tier 1 results
  - `save_tier2_results()` - Save Tier 2 results + context_used JSON
  - `save_tier3_results()` - Save Tier 3 results + context_used JSON
  - `save_tier4_results()` - Save Tier 4 results + web_sources JSON
  - `save_final_results()` - Calculate final classification
  - `save_all_results()` - Wrapper for all saves

- [x] Create `backend/scripts/research_pipeline/cost_tracker.py` (S) ✅
  - Track input/output tokens per tier
  - Calculate costs per tier and total
  - Generate cost report via `CostTracker.summary()`

- [x] Create backfill script for legacy data (M) ✅
  - `backend/scripts/research_pipeline/backfill_legacy_analyses.py` created
  - Group existing compliance_issues by (document_id, issue_type)
  - Create analysis records with pipeline_version='legacy'
  - Copy requirement_found, severity, verbatim_supporting_text
  - Supports --dry-run, --limit, --state, --issue-type flags
  - Dry run tested: 8,524 groups ready for migration

- [x] Create `backend/scripts/research_pipeline/orchestrator.py` (M) ✅
  - Implemented as tier_orchestrator.py
  - Coordinate tier execution via `TierOrchestrator` class
  - Handle tier transitions based on classification
  - Track progress with ETA display
  - Handle batch API polling

#### Langfuse Observability Integration

- [x] Integrate existing Langfuse client (M) ✅
  - Use `backend/observability/` module (already exists)
  - Create `LLMTraceContext` with run_id, stage (tier1/tier2/tier3/tier4), state
  - Wire up `log_batch_submission()` when submitting Tier 1-3 batches
  - Wire up `log_batch_result()` for each batch result
  - Wire up `log_batch_completion()` with totals
  - Wire up `log_generation()` for Tier 4 real-time calls
  - Call `flush_langfuse()` at pipeline end
  - Added `get_tier_stats()` method to CostTracker for token/cost logging

- [x] Add tier-specific tracing (S) ✅
  - Tag traces with tier number and issue_type
  - Track cache hit tokens via cache_read_tokens parameter
  - Enable cost breakdown by tier in Langfuse dashboard

- [x] Add CLI tests (S) ✅
  - TestCLIArgumentParsing (3 tests)
  - TestCostTrackerIntegration (2 tests)
  - TestLangfuseIntegration (2 tests)
  - TestBackfillScript (3 tests)
  - Total: 76 tests passing

#### Remaining Execution Tasks

- [x] Execute backfill migration (S) ✅
  - Ran `python3 backend/scripts/research_pipeline/backfill_legacy_analyses.py`
  - Migrated all 8,524 legacy groups to compliance_issue_analyses
  - Verified counts: 8,524 legacy + 10 v4 test records

- [ ] Run end-to-end pipeline test (M)
  - Run `python3 -m scripts.research_pipeline.cli --realtime --num-docs 5 --max-tier 2`
  - Verify Langfuse traces appear in dashboard
  - Verify database records created correctly

- [x] Update OPERATIONS.md documentation (S) ✅
  - Added research pipeline commands (step 5)
  - Documented backfill script usage
  - Added troubleshooting section
  - Added cost breakdown table

### Deliverables
- CLI can run full pipeline end-to-end
- Database writer saves all tier results
- Cost tracking reports accurate numbers
- Legacy data backfilled
- Progress display shows ETA
- All LLM calls traced in Langfuse with tier/issue_type tags

### Depends On
- Phase 1: Database table exists
- Phase 3: Tier 1 & 2 implementations
- Phase 4: Tier 3 & 4 implementations

### Enables
- Phase 7: Full production run

---

## Phase 6: Frontend Updates

**Goal:** Update the frontend to display new analysis data.

### Repository Layer

- [ ] Create `compliance-issue-analyses.repository.ts` (M)
  - `getByDocumentId()` - Get analysis for a document
  - `getByDocumentAndIssueType()` - Get specific analysis
  - `getAllPaginated()` - Paginated list with filters
  - `getCountsByTier()` - Count items at each tier

- [ ] Update `compliance-issues.repository.ts` (S)
  - Add JOIN to compliance_issue_analyses for tier data
  - Add tier-based filtering options

### UI Components

- [ ] Create `TierProgressIndicator.tsx` (M)
  - Show which tier item reached (1-4)
  - Visual indicator (dots or badges)
  - Link to tier-specific reasoning

- [ ] Create `EvidenceDisplay.tsx` (M)
  - Display context_used entries
  - Show quotes with source citations
  - Collapsible sections by context type

- [ ] Create `WebSourceBadge.tsx` (S)
  - Badge for source type (government/academic/etc.)
  - Link to source URL
  - Date if available

- [ ] Update `ComplianceIssueCard.tsx` (M)
  - Add tier progress indicator
  - Add evidence display section
  - Add web sources if Tier 4 completed
  - Show arguments for/against

- [ ] Update `ComplianceIssueDisplayCard.tsx` (S)
  - Add tier indicator
  - Show final_severity (not just severity)

- [ ] Run smoke tests (S)

### Deliverables
- New table data accessible via repository
- Tier progress visible in UI
- Evidence/context display working
- Web sources shown with badges

### Depends On
- Phase 1: Drizzle schema
- Phase 5: Data in database (at least test data)

### Enables
- Phase 7: User validation of results

---

## Phase 7: Testing & Validation

**Goal:** Validate the pipeline works correctly at scale.

### Tasks

#### Sample Run & Metrics Collection

- [ ] Run sample batch (100 items) (M)
  - Select diverse issue types
  - Verify all tiers execute
  - Check output quality manually

- [ ] Measure and report key metrics (M)
  - **Cache hit rate**: Track via BatchManager, report %
  - **Tier 1 filter rate**: % of items filtered as "unrelated"
  - **Tier escalation rates**: % routed to Tier 2, 3, 4
  - **Routing decision breakdown**: Log reasons for escalation
  - **Verbatim accuracy**: % of quotes found in source
  - **Cost per tier**: Actual tokens vs. estimates
  - Store metrics in a summary JSON for comparison

- [ ] Review cost vs. estimate (S)
  - Compare actual tokens to estimates
  - Verify caching is working (target: meaningful cache hits)
  - Adjust cost_tracker if needed

#### Quality Validation

- [ ] Quality review (10% sample) (M)
  - Review 850 items manually
  - Check classification accuracy
  - Verify severity assignments
  - Check verbatim extraction accuracy

- [ ] Run full batch (8,534 items) (L)
  - Submit Tier 1 batch
  - Process through all tiers
  - Monitor for errors
  - Collect final statistics and metrics

#### Optimization & Documentation

- [ ] Performance optimization (M)
  - Identify slow queries
  - Add indexes if needed
  - Optimize batch sizes

- [ ] Documentation updates (S)
  - Update OPERATIONS.md with new scripts
  - Update README with pipeline description
  - Add troubleshooting guide
  - Document observed metrics from production run

- [ ] Create monitoring script (S)

### Deliverables
- 8,534 items processed through pipeline
- Metrics report: cache hit rate, filter rate, escalation rates, cost breakdown
- Actual cost within 20% of estimate (~$77)
- Quality validation complete
- Documentation updated

### Depends On
- All previous phases complete

---

## Parallelism Matrix

| Work Item | Can Run Parallel With |
|-----------|----------------------|
| SQL migrations | Pydantic models, issue config loader |
| Drizzle schema | Pydantic models (after migrations) |
| context.py | matches.py, llm_outputs.py, database.py |
| matches.py | context.py, llm_outputs.py, database.py |
| llm_outputs.py | context.py, matches.py, database.py |
| context_builder.py | context_registry.py, issue_config_loader.py |
| tier1_filtering.py | (must complete before tier2) |
| tier2_summary.py | (must complete before tier3) |
| tier3_fulltext.py | tier4_websearch.py (both need tier2) |
| CLI | db_writer.py, cost_tracker.py |
| Repository updates | UI component updates |

---

## Risk Areas

### High Risk

1. **Batch API latency** - 24-hour batch window may not complete before next run needed
   - Mitigation: Plan for 2-3 day initial processing time
   - Mitigation: Implement resume capability for interrupted batches

2. **Cost estimation accuracy** - Token counts may vary significantly
   - Mitigation: Run 100-item sample first, validate costs
   - Mitigation: Implement --limit flag for controlled runs

3. **Context token limits** - Full text may exceed context window
   - Mitigation: Implement token counting before submission
   - Mitigation: Truncate very long documents with note

### Medium Risk

4. **Web search rate limits** - Tier 4 real-time API may hit limits
   - Mitigation: Add rate limiting with backoff
   - Mitigation: Queue items if rate limited

5. **LLM output validation** - Pydantic parsing may fail on edge cases
   - Mitigation: Log all parsing failures for review
   - Mitigation: Implement retry with simplified prompt

6. **Legacy data backfill** - Matching old records to new structure
   - Mitigation: Test backfill on dev database first
   - Mitigation: Keep old table intact, don't modify

### Low Risk

7. **Issue config format** - 40 YAML files need consistent structure
   - Mitigation: All 40 files already created, validated
   - Mitigation: Add schema validation in loader

8. **Frontend breaking changes** - New fields may break existing displays
   - Mitigation: All new fields are nullable
   - Mitigation: Run smoke tests before deployment

---

## Estimated Timeline

| Phase | Duration | Cumulative |
|-------|----------|------------|
| Phase 1: Foundation | 3-4 days | Week 1 |
| Phase 2: Context Builder | 3-4 days | Week 2 |
| Phase 3: Tiers 1 & 2 | 4-5 days | Week 3 |
| Phase 4: Tiers 3 & 4 | 3-4 days | Week 4 |
| Phase 5: CLI & DB | 3-4 days | Week 5 |
| Phase 6: Frontend | 3-4 days | Week 6 |
| Phase 7: Testing | 4-5 days | Week 7 |

**Total: 5-7 weeks** (depending on batch API latency and validation cycles)

---

## File Structure

```
prompts/
├── research_pipeline.yaml      # Tier prompt templates (moved from docs/)
└── issue_configs/              # Issue-specific configs (moved from docs/)
    ├── _index.yaml
    ├── wet_signature.yaml
    ├── notarization.yaml
    └── ... (43 total)

backend/scripts/research_pipeline/
├── __init__.py
├── cli.py                      # Entry point
├── orchestrator.py             # Tier coordination + batch grouping
├── prompt_loader.py            # Load prompts from YAML + validation
├── context_builder.py          # Context assembly (imports from db_queries.py)
├── context_registry.py         # Deduplication + audit trail
├── issue_config_loader.py      # Load issue configs
├── tier1_filtering.py          # Match filtering
├── tier2_summary.py            # Summary research
├── tier3_fulltext.py           # Full context
├── tier4_websearch.py          # Web validation (Claude web_search tool)
├── db_writer.py                # Database updates + context_used storage
├── cost_tracker.py             # Cost tracking + metrics
└── models/
    ├── __init__.py
    ├── context.py              # Context models
    ├── matches.py              # Match models
    ├── llm_outputs.py          # LLM output models
    ├── database.py             # DB update models
    └── inputs.py               # Tier input models

frontend/packages/database/
├── migrations/
│   ├── 0018_create_compliance_issue_analyses.sql
│   └── 0019_add_analyses_indexes.sql
└── src/
    ├── schema/
    │   └── compliance-issue-analyses.ts
    └── repositories/
        └── compliance-issue-analyses.repository.ts

frontend/apps/web/src/components/
├── issues/
│   ├── TierProgressIndicator.tsx
│   └── EvidenceDisplay.tsx
└── review/
    └── WebSourceBadge.tsx
```

---

## Critical Reference Files

| File | Purpose |
|------|---------|
| `prompts/research_pipeline.yaml` | All tier prompt templates |
| `prompts/issue_configs/` | 43 issue-specific configs with indicators/severity |
| `docs/research_pipelines/RESEARCH_PIPELINE_SCHEMA_PROPOSAL.md` | Complete 49-column database schema |
| `docs/research_pipelines/RESEARCH_PIPELINE_MODELS.md` | All Pydantic models |
| `backend/scripts/compliance_issues/searcher.py` | Existing pattern to follow |
| `backend/scripts/local_summarization/db_queries.py` | Batch SQL patterns |
| `backend/shared_utils.py` | BatchManager, format_batch_request |
