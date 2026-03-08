---
name: pipeline-caching
description: 3-layer prompt caching architecture for batch LLM pipelines. Use when editing pipeline context formatting, sibling/cross-ref queries, or batch preparation code.
---

# Pipeline Prompt Caching Architecture

Both the JenAI and research pipelines use Anthropic's batch API with prompt caching. The 3-layer structure ensures cache hits across sections within the same subchapter.

## 3-Layer Cache Structure

| Layer | Scope | Caching | Content |
|-------|-------|---------|---------|
| 1. system | Global | Cached across all requests | Framework rules, detection instructions, anti-false-positive guidance |
| 2. user_cached_prefix | Per subchapter | Cached across sibling sections | Ancestor chain, sibling catalog (with summaries), definitions, ancestor summaries |
| 3. prompt | Per section | Never cached (unique) | Citation, title, summary, cross-refs with summaries, section text |

## Layer Assignment Rules

### Layer 2 MUST produce identical output for ALL sections in a subchapter

Everything in Layer 2 must be deterministic and shared. If content varies per document, it breaks caching.

**Belongs in Layer 2:**
- Ancestor chain (shared by all children of same parent)
- Sibling catalog including self (identical list for all sections)
- Merged sibling summaries (proactive keyword-matched enrichment)
- Full definitions with text (scope-inherited, shared at subchapter level)
- Ancestor summaries from proactive context

**MUST NOT go in Layer 2:**
- Cross-reference summaries (each section has different outbound references)
- Document-specific metadata (citation, title, summary)
- Section text

### Layer 3 is per-document, never cached

This is where document-specific content goes. Cost of uniqueness is acceptable since it's typically smaller than Layer 2.

## Key Rules

### Sibling Self-Inclusion

The `get_sibling_summaries_batch()` query in `backend/scripts/research_pipeline/context/queries.py` includes the current section in the sibling list. This is **intentional**:

- All sections in a subchapter produce identical sibling lists -> cache hits
- Filtering self out would make each section's list unique -> cache misses
- The proactive summary prioritizer (`proactive.py`) already filters self for keyword matching
- Both JenAI and research pipelines benefit from this

**Do NOT add `WHERE rd.id != dp.id`** to the sibling query.

The frontend has two functions for this:
- `getSiblingDocuments()` — excludes self (for UI display in `SiblingSectionsView`)
- `getSiblingDocumentsForPrompt()` — includes self (for prompt composers)

### Cross-Reference Placement

Cross-reference summaries MUST go in Layer 3 only:

- Each section has different outbound cross-references
- Putting them in Layer 2 breaks cache (different content per document)
- The JenAI pipeline merges catalog entries with proactive summaries in `format_crossrefs(catalog, proactive_ctx)`
- The frontend prompt composer fetches summaries from the target document via the repository

**Do NOT add cross-ref summaries to `format_rich_context_cached()` or `formatRichContextBlock()`.**

## Key Files

| Pipeline | Layer 2 Builder | Layer 3 Builder |
|----------|----------------|-----------------|
| JenAI (backend) | `format_rich_context_cached()` in `backend/scripts/jenai_pipeline/formatting.py` | `format_analysis_context()` + `format_crossrefs()` in same file |
| Research (backend) | `build_batch_context_for_subchapters()` in `backend/scripts/research_pipeline/context/proactive.py` | `_prepare_tier1_request()` in `backend/scripts/research_pipeline/tiers/tier1_runner.py` |
| JenAI (frontend) | `formatRichContextBlock()` in `frontend/apps/web/src/lib/actions/jenai-prompt-composer.ts` | Template substitution in `composeJenAIPrompt()` |

### Shared Infrastructure

| File | What it provides |
|------|-----------------|
| `backend/scripts/research_pipeline/context/queries.py` | `get_sibling_summaries_batch()`, `get_crossrefs_batch()` — shared by both pipelines |
| `backend/scripts/research_pipeline/context/catalog.py` | `build_context_catalog()` — assembles ContextCatalog from batch queries |
| `backend/scripts/research_pipeline/context/proactive.py` | `build_proactive_context()` — keyword-matched summaries for enrichment |

## Frontend Prompt Composer Sync

The frontend prompt composer (`jenai-prompt-composer.ts`) must mirror the backend formatting. When changing backend formatting functions:
1. Check if the frontend composer has a corresponding formatter
2. Update the frontend to match the same output format
3. Ensure repository queries fetch the same fields the backend uses
