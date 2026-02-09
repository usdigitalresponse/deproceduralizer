# Definitions - Remaining Work

> **Status: PARTIALLY IMPLEMENTED**
>
> - Phases 1-5: ✅ Complete (NY definitions extracted and linked)
> - Phase 6 (NJ expansion): 📋 Planned
> - Phase 7 (Quality assurance): 📋 Backlogged
>
> For completed phases (1-5), see `docs/archive/DEFINITIONS_FUTURE_ENHANCEMENTS.md`.

## Current State (Updated Dec 22, 2025)

- **28,544** definitions extracted (all from NY)
- **26,161** have scope_level populated
- **25,724** have scope_document_id linked (89%)
- **3,146** definitions unlinked - see [GitHub Issue #31](../../issues/31) for investigation
- **5,719** are cross-references
- **18,312** unique terms (normalized)

---

## Phase 6: State Expansion

**Status**: 📋 Infrastructure Ready

**Goal**: Extend to New Jersey and enable cross-state comparison.

### 6.1 NJ Definition Extraction

**Infrastructure** (ready in `batch_definitions.py`):
- Script accepts `--state NJ` parameter
- State-aware database queries with `njac_*` prefix handling
- Same Pydantic models work for both NY and NJ

**Action needed**: Run extraction on NJ sections
- Extract definitions from NJAC regulations
- Handle NJAC-specific citation formats
- Use same improved prompt and schema
- Run document_id migration after import

### 6.2 Cross-State Comparison (Not Implemented)

- Same term, different state definitions
- Identify common vs unique terminology
- Multi-state regulation comparison view

---

## Phase 7: Quality Assurance (Optional)

**Status**: 📋 Backlogged

**Goal**: Add review workflows and conflict detection to ensure data quality.

### 7.1 Review Pipeline

Add review status tracking (similar to red flags and compliance issues). Review statuses: unreviewed, confirmed, incorrect, needs_context.

### 7.2 Conflict Detection

Detect when definitions conflict within overlapping scopes:
- `duplicate` - Same term defined twice in same document
- `scope_overlap` - Part definition conflicts with Title definition
- `scope_shadow` - Narrower scope overrides broader (may be intentional)

### 7.3 Performance Optimization

Add materialized view for glossary if performance becomes an issue with large dataset.

---

## Backlogged Features

### Full-Text Search

Add GIN index for fuzzy matching, phrase search, and relevance ranking. **Status**: Backlogged - current trigram indexes provide adequate search performance for ILIKE queries.

### Cross-Chapter Definition Incorporation

Handle regulations that incorporate definitions from other chapters by reference (e.g., "The definitions in N.J.A.C. 10:122B are hereby incorporated into this chapter by reference."). **Status**: Backlogged - needs investigation of how common this pattern is and citation resolution logic.

### Potential Truncation in High-Definition Sections

The original extraction used `max_tokens=4096`, which may have truncated responses for sections with many definitions. This has been fixed to `max_tokens=64000` (Claude 4.5's limit). **982 sections** with >8 definitions each may need re-extraction.
