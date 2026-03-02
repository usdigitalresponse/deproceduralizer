---
name: jenai-pipeline
description: Run the JenAI single-pass regulatory implementation analysis pipeline. Use when analyzing regulatory sections for implementation complexity using the 19-category Pahlka framework.
---

# JenAI Pipeline

Single-pass enriched LLM pipeline analyzing regulatory sections for implementation complexity using a 19-category framework (18 Pahlka problem categories + adversarial WORST_THING).

## Architecture

```
Regulatory Sections (hierarchy_level='section')
    |
    v
[Cache Efficiency Sort] -- group by subchapter for shared context
    |
    v
=== SINGLE PASS: Rich Context Analysis (Batch API) ===
  Section text + ancestor summaries + sibling summaries +
  cross-ref summaries + full definition text
  -> LLM identifies categories + WORST_THING
  -> Results -> jenai_analyses + jenai_issues tables
```

## 19-Category Taxonomy

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
| 10 | WORST_THING | **Adversarial** | Single worst aspect of the section — always required |
| 11 | MISSING_OUTCOMES | Problem | Prescribes what to do but never defines success |
| 12 | UNCLEAR_DELEGATION | Problem | Ambiguous authority, passive voice delegation |
| 13 | ACCESS_ASSUMPTION_BARRIERS | Problem | Assumes specific environments, capabilities, or access |
| 14 | INTERAGENCY_FRAGMENTATION | Problem | Multiple agency approvals, sequential chains |
| 15 | FEE_COST_BURDENS | Problem | Excessive fees, outdated fee schedules, disproportionate costs |
| 16 | STATE_EXCEEDS_FEDERAL | Problem | NY requirements stricter than federal without justification |
| 17 | DEAD_SUPERSEDED_REFERENCES | Problem | References to repealed statutes, dissolved agencies |
| 18 | DUPLICATIVE_REQUIREMENTS | Problem | Overlapping or identical requirements across regulations |
| 19 | MISSING_DIGITAL_AUTHORIZATION | Problem | No explicit digital/electronic submission authorization |

## CLI Commands

```bash
# All commands run from project root

# Dry run (default)
cd backend && python3 -m scripts.jenai_pipeline.cli --state ny --title 18

# Filter by part (e.g., child care Parts 413-419)
cd backend && python3 -m scripts.jenai_pipeline.cli --state ny --title 18 --part 414

# Execute pipeline
cd backend && python3 -m scripts.jenai_pipeline.cli --state ny --title 18 --execute

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

## 3-Layer Prompt Caching

| Layer | Scope | Content |
|-------|-------|---------|
| 1. system | Global (all requests) | 19-category framework, detection rules, anti-false-positive instructions |
| 2. user_cached_prefix | Per subchapter | Ancestor chain + sibling summaries + full definitions + cross-ref summaries |
| 3. prompt | Per section (unique) | Citation, title, summary, cross-refs, section text |

## Context Strategy

All context is gathered upfront in a single batch:

| Context Source | Function | What it provides |
|---------------|----------|-----------------|
| Catalog metadata | `build_context_catalog(doc_ids)` | Sibling/cross-ref/ancestor metadata |
| Proactive context | `build_proactive_context(doc_ids)` | Ancestor summaries, keyword-matched sibling/cross-ref summaries |
| Full definitions | `get_definitions_with_text_batch(doc_ids)` | Full definition text with scope-aware lookup |

## Database Tables

- **`jenai_analyses`** — One row per document. Stores classification, confidence, categories JSONB, worst_thing text.
- **`jenai_issues`** — One row per category finding. Links to analysis + document.

See `.claude/skills/database/schema.md` for full column details.

## Key Files

```
backend/scripts/jenai_pipeline/
    cli.py              — CLI entry point
    config.py           — Constants, categories enum
    pipeline_runner.py  — Single-pass orchestrator
    state_machine.py    — ProcessingState (PENDING/DONE/ERROR), TrackedUnit
    prompt_loader.py    — YAML loader for prompts/jenai.yaml
    formatting.py       — Context catalog + rich context formatters
    models/
        processing.py   — JenAIUnit dataclass
        llm_outputs.py  — IssueFinding, AnalysisOutput Pydantic models
    tiers/
        prepare_batch.py — Single-pass batch preparation with rich context
    db/
        document_queries.py — Fetch sections for analysis
        analysis_writer.py  — Save results to DB
        analysis_reader.py  — Read existing analyses (resume)
prompts/jenai.yaml          — Single-pass prompt template
```

## Cost Estimate

Uses Anthropic Batch API with Sonnet 4.5. Single pass (no Tier 2 follow-up), so cost is lower than the previous 2-tier architecture. ~$15-40 per title depending on section count.

## Dependencies

Requires Steps 5 (cross-references) and 6 (summaries) to have been run for the target state/title. Imports context-building infrastructure from `scripts.research_pipeline.context`.

## Important

- **Always ask user permission** before executing (costs money)
- Default is dry-run — must pass `--execute` to actually run
- WORST_THING is always required — even "clean" sections get a WORST_THING finding (may be low severity)
