---
name: jenai-pipeline
description: Run the JenAI two-tier regulatory implementation analysis pipeline. Use when analyzing regulatory sections for implementation complexity using the 14-category Pahlka framework.
---

# JenAI Pipeline

Two-tier LLM pipeline analyzing regulatory sections for implementation complexity using a 14-category Pahlka framework.

## Architecture

```
Regulatory Sections (hierarchy_level='section')
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
  Tier 1 findings + fetched summaries from context_requests +
  proactively fetched related content
  -> Confirms/revises/dismisses Tier 1 findings
  -> Discovers NEW categories only apparent with full context
  -> Final results -> jenai_issues table
```

## 14-Category Taxonomy

| # | Category | Type | Description |
|---|----------|------|-------------|
| 1 | REGULATORY_COMPLEXITY | Problem | Text so convoluted meaning is genuinely unclear |
| 2 | POLICY_IMPLEMENTATION_SEPARATION | Problem | Authority structures separating policy from implementation |
| 3 | CASCADE_OF_RIGIDITY | Problem | Conflicting absolute goals without prioritization |
| 4 | MANDATED_STEPS_NOT_OUTCOMES | Problem | Prescribes procedures without stated goals |
| 5 | ADMINISTRATIVE_BURDENS | Problem | Physical friction: notaries, wet signatures, in-person |
| 6 | NO_FEEDBACK_LOOPS | Problem | One-shot design, no iteration authority |
| 7 | PROCESS_WORSHIP_OVERSIGHT | Problem | Compliance-only audits, punish any deviation |
| 8 | ZERO_RISK_LANGUAGE | Problem | Impossible absolutes |
| 9 | FROZEN_TECHNOLOGY | Problem | Hard-coded architectures, formats, platforms |
| 10 | IMPLEMENTATION_OPPORTUNITY | **Positive** | Good patterns: metrics, burden reduction, pilot authority |
| 11 | MISSING_OUTCOMES | Problem | Prescribes what to do but never defines success |
| 12 | UNCLEAR_DELEGATION | Problem | Ambiguous authority, passive voice delegation |
| 13 | ACCESS_ASSUMPTION_BARRIERS | Problem | Assumes specific environments, capabilities, or access |
| 14 | INTERAGENCY_FRAGMENTATION | Problem | Multiple agency approvals, sequential chains |

## CLI Commands

```bash
# All commands run from project root

# Dry run (default)
cd backend && python3 -m scripts.jenai_pipeline.cli --state ny --title 18

# Filter by part (e.g., child care Parts 413-419)
cd backend && python3 -m scripts.jenai_pipeline.cli --state ny --title 18 --part 414

# Execute Tier 1 only
cd backend && python3 -m scripts.jenai_pipeline.cli --state ny --title 18 --execute --max-tier 1

# Execute full pipeline
cd backend && python3 -m scripts.jenai_pipeline.cli --state ny --title 18 --execute

# Tier 2 on existing results
cd backend && python3 -m scripts.jenai_pipeline.cli --state ny --title 18 --execute --tier2-only

# Limit sections
cd backend && python3 -m scripts.jenai_pipeline.cli --state ny --execute --limit 20

# Include reserved/definitions/scope sections (excluded by default)
cd backend && python3 -m scripts.jenai_pipeline.cli --state ny --title 18 --include-all-types

# Re-analyze sections that already have results
cd backend && python3 -m scripts.jenai_pipeline.cli --state ny --title 18 --execute --force

# Realtime mode (faster, 2x cost, no batch discount)
cd backend && python3 -m scripts.jenai_pipeline.cli --state ny --title 18 --part 414 --execute --realtime

# Re-run specific document(s) by ID (auto-disables exclude_analyzed)
cd backend && python3 -m scripts.jenai_pipeline.cli --state ny --document-id 81899 --execute --realtime
```

## Default Section Filtering

By default, the pipeline excludes low-value section types to save cost:
- **Section types excluded:** `reserved`, `definitions`, `scope`

Use `--include-all-types` to override and include all section types. Use `--force` to re-analyze sections with existing JenAI analyses.

## Promotion Logic (Tier 1 -> Tier 2)

- `classification == "clean"` -> DONE_CLEAN (skip Tier 2)
- `classification == "needs_context"` -> always promote
- `classification == "has_issues"` -> promote if any context_requests OR any category confidence < 0.9

## 3-Layer Prompt Caching

| Layer | Scope | Content |
|-------|-------|---------|
| 1. system | Global (all requests) | 14-category framework, detection rules, anti-false-positive instructions |
| 2. user_cached_prefix | Per subchapter | Ancestor chain, sibling catalog, definition terms |
| 3. prompt | Per section (unique) | Citation, title, summary, cross-refs, section text |

## Context Strategy

| Tier | Context Source | Function |
|------|---------------|----------|
| Tier 1 | Catalog metadata | `build_context_catalog(doc_ids)` |
| Tier 2 | Explicit requests | `fetch_summaries_for_requests(context_requests)` |
| Tier 2 | Proactive context | `build_proactive_context(doc_ids)` |

## Database Tables

- **`jenai_analyses`** — One row per document. Stores Tier 1/2 results, derived fields.
- **`jenai_issues`** — One row per category finding. Links to analysis + document.

See `.claude/skills/database/schema.md` for full column details.

## Key Files

```
backend/scripts/jenai_pipeline/
    cli.py              — CLI entry point
    config.py           — Constants, categories enum
    pipeline_runner.py  — Two-tier orchestrator
    state_machine.py    — ProcessingState, TrackedUnit, promotion logic
    prompt_loader.py    — YAML loader for prompts/jenai.yaml
    formatting.py       — Context catalog formatters
    models/
        processing.py   — JenAIUnit dataclass
        llm_outputs.py  — Tier1Output, Tier2Output Pydantic models
    tiers/
        tier1_runner.py — Tier 1 batch preparation
        tier2_runner.py — Tier 2 batch preparation
    db/
        document_queries.py — Fetch sections for analysis
        analysis_writer.py  — Save results to DB
        analysis_reader.py  — Read existing analyses (resume)
prompts/jenai.yaml          — Tier 1 + Tier 2 prompt templates
```

## Cost Estimate

Uses Anthropic Batch API with Sonnet 4.5. ~$30-60 per title depending on section count and Tier 2 promotion rate.

## Dependencies

Requires Steps 5 (cross-references) and 6 (summaries) to have been run for the target state/title. Imports context-building infrastructure from `scripts.research_pipeline.context`.

## Important

- **Always ask user permission** before executing (costs money)
- Default is dry-run — must pass `--execute` to actually run
- IMPLEMENTATION_OPPORTUNITY is a positive finding, not a problem
