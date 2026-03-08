---
name: jenai-pipeline
description: Run the JenAI single-pass regulatory implementation analysis pipeline. Use when analyzing regulatory sections for implementation complexity using the 18-category Pahlka framework.
---

# JenAI Pipeline

Single-pass enriched LLM pipeline analyzing regulatory sections for implementation complexity using an 18-category framework (15 Pahlka + 2 structural + OTHER catch-all).

## Architecture

```
Regulatory Sections (hierarchy_level='section')     Guidance Documents (guidance_documents table)
    |                                                   |
    v                                                   v
[Cache Efficiency Sort]                        [Flat — no hierarchy]
    |                                                   |
    v                                                   v
=== SINGLE PASS: Rich Context Analysis (Batch API) ===
  Regulations: section text + ancestor summaries + sibling summaries +
               cross-ref summaries + full definition text
  Guidance: document content + cited regulation summaries + metadata preamble
  -> LLM identifies categories + OTHER
  -> Results -> jenai_analyses + jenai_issues tables
```

## 18-Category Taxonomy

| # | Category | Type | Description |
|---|----------|------|-------------|
| 1 | REGULATORY_COMPLEXITY | Pahlka | Text so convoluted meaning is genuinely unclear |
| 2 | POLICY_IMPLEMENTATION_SEPARATION | Pahlka | Authority structures separating policy from implementation |
| 3 | CASCADE_OF_RIGIDITY | Pahlka | Conflicting absolute goals without prioritization |
| 4 | MANDATED_STEPS_NOT_OUTCOMES | Pahlka | Prescribes procedures without stated goals |
| 5 | ADMINISTRATIVE_BURDENS | Pahlka | Physical friction: notaries, wet signatures, in-person |
| 6 | NO_FEEDBACK_LOOPS | Pahlka | One-shot design, no iteration authority |
| 7 | PROCESS_WORSHIP_OVERSIGHT | Pahlka | Compliance-only audits, punish any deviation |
| 8 | ZERO_RISK_LANGUAGE | Pahlka | Impossible absolutes |
| 9 | FROZEN_TECHNOLOGY | Pahlka | Hard-coded architectures, formats, platforms |
| 10 | OTHER | **Catch-all** | Issues not fitting named categories; also use alongside named categories for severe novel issues |
| 11 | MISSING_OUTCOMES | Pahlka | Prescribes what to do but never defines success |
| 12 | UNCLEAR_DELEGATION | Pahlka | Ambiguous authority, passive voice delegation |
| 13 | ACCESS_ASSUMPTION_BARRIERS | Pahlka | Assumes specific environments, capabilities, or access |
| 14 | FEE_COST_BURDENS | Pahlka | Excessive fees, outdated fee schedules, disproportionate costs |
| 15 | DEAD_SUPERSEDED_REFERENCES | Pahlka | References to repealed statutes, dissolved agencies |
| 16 | MISSING_DIGITAL_AUTHORIZATION | Pahlka | No explicit digital/electronic submission authorization |
| 17 | ONE_SIZE_FITS_ALL | Structural | Uniform standards ignoring program diversity |
| 18 | UNFUNDED_MANDATE | Structural | Requirements imposed without funding mechanism |

**Removed (multi-document, can't work per-section):** STATE_EXCEEDS_FEDERAL, DUPLICATIVE_REQUIREMENTS, INTERAGENCY_FRAGMENTATION — these require cross-document context to detect properly.

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

# === Guidance Documents ===

# Dry run guidance docs
cd backend && python3 -m scripts.jenai_pipeline.cli --state ny --source guidance --agency OCFS --limit 5

# Execute guidance analysis
cd backend && python3 -m scripts.jenai_pipeline.cli --state ny --source guidance --agency OCFS --doc-type ADM --execute

# Guidance with realtime mode
cd backend && python3 -m scripts.jenai_pipeline.cli --state ny --source guidance --agency OCFS --limit 3 --execute --realtime
```

## Default Section Filtering

By default, the pipeline excludes low-value section types to save cost:
- **Section types excluded:** `reserved`, `definitions`, `scope`

Use `--include-all-types` to override and include all section types. Use `--force` to re-analyze sections with existing JenAI analyses.

## 3-Layer Prompt Caching

| Layer | Scope | Content |
|-------|-------|---------|
| 1. system | Global (all requests) | 18-category framework, detection rules, anti-false-positive instructions |
| 2. user_cached_prefix | Per subchapter | Ancestor chain + sibling summaries (incl. self) + full definitions + ancestor summaries |
| 3. prompt | Per section (unique) | Citation, title, summary, cross-refs with summaries, section text |

For detailed caching rules, see `.claude/skills/pipeline-caching/SKILL.md`.

## Context Strategy

All context is gathered upfront in a single batch:

| Context Source | Function | What it provides |
|---------------|----------|-----------------|
| Catalog metadata | `build_context_catalog(doc_ids)` | Sibling/cross-ref/ancestor metadata |
| Proactive context | `build_proactive_context(doc_ids)` | Ancestor summaries, keyword-matched sibling/cross-ref summaries |
| Full definitions | `get_definitions_with_text_batch(doc_ids)` | Full definition text with scope-aware lookup |

## Database Tables

- **`jenai_analyses`** — One row per document. Has `document_id` (regulations) or `guidance_document_id` (guidance) — exactly one set. Stores classification, confidence, categories JSONB.
- **`jenai_issues`** — One row per category finding. Links to analysis + document (or guidance document).

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
- At least one finding is always required. Use OTHER for issues that don't fit named categories — including alongside named category findings when something severe falls outside them
- `jenai_issues` includes `tags` (2-3 kebab-case labels per finding) and `is_verbatim` (whether matched_phrases are verbatim from source text)
