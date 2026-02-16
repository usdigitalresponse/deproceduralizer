# JenAI Pipeline: Two-Tier Regulatory Implementation Analysis

> **Status: APPROVED DESIGN**
> Approved 2026-02-15. Implementation plan to follow.

## Problem

The current red flag pipeline (`backend/scripts/red_flags.py`) analyzes each regulatory section in isolation with a single LLM call. This produces false positives because the LLM lacks context about the broader regulatory structure.

**Measured quality:** Testing on 8 NY child care flags found ~37% precision (1 fully valid, 2 partially valid, 5 false positives). Root causes:
- No sibling/hierarchy awareness (missed waiver provisions in the same Part)
- Can't distinguish safety mandates from bureaucratic overhead (flagged fire safety requirements as "administrative burden")
- Can't distinguish substantive eligibility criteria from procedural overhead
- Severity inflation (everything is 6-7)

## Solution

A two-tier pipeline where Tier 1 provides catalog-level context and Tier 2 provides full context for promoted items. New "JenAI" naming (Jennifer Pahlka + AI) with fresh database tables.

## Revised Category Taxonomy (14 categories)

### Kept from existing (refined):

| # | Category | Description | Key refinement |
|---|----------|-------------|----------------|
| 1 | **REGULATORY_COMPLEXITY** | Text so convoluted meaning is genuinely unclear | Merged: complexity_policy_debt + overwrought_legalese. Not just "has cross-references" |
| 2 | **POLICY_IMPLEMENTATION_SEPARATION** | Authority structures that separate policy from implementation | Detectable in org structure sections (attorneys vs. program offices) |
| 3 | **CASCADE_OF_RIGIDITY** | Conflicting absolute goals without prioritization | |
| 4 | **MANDATED_STEPS_NOT_OUTCOMES** | Prescribes procedures without stated goals | Tightened: must be genuinely procedural overhead, not eligibility or safety criteria |
| 5 | **ADMINISTRATIVE_BURDENS** | Physical friction: notaries, wet signatures, in-person | Must evaluate waiver accessibility |
| 6 | **NO_FEEDBACK_LOOPS** | One-shot design, no iteration authority | |
| 7 | **PROCESS_WORSHIP_OVERSIGHT** | Compliance-only audits, punish any deviation | |
| 8 | **ZERO_RISK_LANGUAGE** | Impossible absolutes | |
| 9 | **FROZEN_TECHNOLOGY** | Hard-coded architectures, formats, platforms | |
| 10 | **IMPLEMENTATION_OPPORTUNITY** | Positive patterns (metrics, burden reduction, pilot authority) | |

### New:

| # | Category | Description | Detection signals |
|---|----------|-------------|-------------------|
| 11 | **MISSING_OUTCOMES** | Regulation prescribes what to do but never defines success | Not prescriptive about metrics - outcomes can be qualitative |
| 12 | **UNCLEAR_DELEGATION** | Ambiguous authority, passive voice delegation, buck-passing | "appropriate authority shall determine...", multiple agencies without clear lead |
| 13 | **ACCESS_ASSUMPTION_BARRIERS** | Assumes specific environments, capabilities, or access | Suburban-centric, assumes internet/transportation/banking, climate/geography |
| 14 | **INTERAGENCY_FRAGMENTATION** | Multiple agency approvals, sequential chains | No single point of contact, duplicative approvals |

### Removed:
- **OPTIONS_BECOME_REQUIREMENTS** - 5 hits across entire corpus, not a real pattern
- **has_reporting_requirement** flag - redundant with compliance_issues `mandated_reports` type
- **requires_technical_review** flag - subjective, not decision-driving

### Framework attribution:
Inspired by Jennifer Pahlka ("Recoding America"), Cass Sunstein (sludge), Pamela Herd & Donald Moynihan (administrative burden theory), and Institute for Justice (barriers to business). Not a direct Pahlka taxonomy - she wrote narratively, not as a checklist.

## Architecture

```
Regulatory Sections (from DB, hierarchy_level='section')
    |
    v
[Cache Efficiency Sort] -- group by subchapter for shared context
    |
    v
=== TIER 1: Catalog Context (Batch API) ===
  Section text + hierarchy path + sibling titles/summaries +
  cross-ref summaries + definition terms
  -> LLM identifies potential categories + context_requests
  -> "clean" sections -> DONE_CLEAN
  -> sections with findings -> promote to Tier 2
    |
    v
=== TIER 2: Full Context Confirmation (Batch API) ===
  Tier 1 findings + fetched summaries/full-text from context_requests +
  proactively fetched related content
  -> Confirms/revises/dismisses Tier 1 findings
  -> Discovers NEW categories only apparent with full context
  -> Evaluates: does a waiver exist? Is the waiver itself burdensome?
  -> Final results -> jenai_issues table
```

### Key design principle:
Just because a waiver or alternative exists doesn't automatically dismiss a flag. Evaluate whether the waiver is *actually reasonable and accessible*. A waiver requiring 3 agency approvals and notarized paperwork isn't a real escape valve.

### Promotion logic (Tier 1 -> Tier 2):
- `classification == "clean"` -> DONE_CLEAN (skip Tier 2)
- `classification == "needs_context"` -> always promote
- `classification == "has_issues"` -> promote if any context_requests OR any category has confidence < 0.9

## Database Schema

### Table: `jenai_analyses` (one row per document)

Tier 1 fields: `tier1_categories` (jsonb), `tier1_has_issues`, `tier1_classification`, `tier1_confidence`, `tier1_context_requests` (jsonb), `tier1_batch_id`, `tier1_completed_at`

Tier 2 fields: `tier2_categories` (jsonb), `tier2_has_issues`, `tier2_classification`, `tier2_confidence`, `tier2_new_discoveries` (jsonb), `tier2_context_used` (jsonb), `tier2_batch_id`, `tier2_completed_at`

Final derived: `has_implementation_issues`, `overall_complexity`, `summary`, `max_severity`, `num_categories_found`

Pipeline tracking: `highest_tier_completed`, `pipeline_version`, `model_version`, `run_id`

UNIQUE constraint on `document_id`.

### Table: `jenai_issues` (one row per category finding)

Core: `analysis_id` (FK), `document_id` (FK), `category` (14-value CHECK)

Analysis: `explanation`, `severity` (1-10), `complexity`, `confidence` (0.0-1.0), `matched_phrases[]`, `implementation_approach`, `text_examples[]`

Tier tracking: `discovered_in_tier`, `confirmed_in_tier`, `tier2_revised`

Review/developer fields: same pattern as existing `red_flags` table.

UNIQUE on `(analysis_id, category)`.

## Infrastructure Reuse

The compliance pipeline (`backend/scripts/research_pipeline/`) has context-gathering infrastructure that JenAI imports directly:

| Module | Function |
|--------|----------|
| `context/catalog.py` | `build_context_catalog()`, `group_for_cache_efficiency()` |
| `context/proactive.py` | `build_proactive_context()`, `build_batch_context_for_subchapter()` |
| `context/queries.py` | All SQL queries for siblings, ancestors, definitions, cross-refs |
| `context/fetchers.py` | `fetch_summaries_for_requests()`, `fetch_document_content_batch()` |
| `context_registry.py` | `ContextRegistry` for deduplication and audit trail |
| `cost_tracker.py` | `CostTracker` for per-tier cost breakdown |
| `lib/batch.py` | `format_batch_request()`, `BatchManager` |

## Prompt Design

**3-layer caching** (no issue_block layer - JenAI evaluates all 14 categories simultaneously):

1. **static_core** (cached globally): 14-category framework with examples, detection rules, critical instruction about proportionality and safety-critical requirements
2. **batch_context** (cached per subchapter): ancestor summaries, sibling catalog, definition terms
3. **document_template** (unique per section): citation, title, summary, section text, immediate siblings, cross-ref summaries

## CLI

```bash
python3 -m scripts.jenai_pipeline.cli --state ny --title 18           # dry-run
python3 -m scripts.jenai_pipeline.cli --state ny --title 18 --execute  # run (limit 100)
python3 -m scripts.jenai_pipeline.cli --state ny --execute --max-tier 1 --all-sections  # Tier 1 only
python3 -m scripts.jenai_pipeline.cli --state ny --title 18 --execute --tier2-only      # Tier 2 on existing
```

## Frontend (Minimal)

Add `'jenai'` to `REVIEW_TYPE_VALUES`, add tab to `ReviewTypeTabs`, create repository + server actions + review queue component. Reuse existing `ReviewCard` and `ReviewForm` patterns.

## Separate Effort: New Compliance Issue Types

Based on research, the following should be added to `prompts/compliance_issues.yaml`:

- **FROZEN_FEE_SCHEDULES** (narrowed from STALE_THRESHOLDS): Target fee language + dollar amounts (`"fee.{0,20}\\$"`, `"application fee"`, `"license fee"`). More feasible than detecting all dollar amounts.
- **COST_AND_FEE_BARRIERS**: Non-refundable fees, duplicative fees, disproportionate licensing costs.

Note: Broad "stale thresholds" (all dollar amounts) is too noisy for regex. Better handled as a data analysis task on existing IBR version data.
