# Proactive Context Strategy

> **Version:** V5
> **Status:** Design Complete

## Table of Contents

1. [The Problem: Reactive Escalation Fails](#the-problem-reactive-escalation-fails)
2. [The Solution: Proactive Keyword Filtering](#the-solution-proactive-keyword-filtering)
3. [Keyword Categories](#keyword-categories)
4. [Context Flow](#context-flow)
5. [Token Budget Analysis](#token-budget-analysis)
6. [Implementation Details](#implementation-details)

---

## The Problem: Reactive Escalation Fails

### V4 Approach (Reactive)

In V4, we relied on the LLM to request additional context when needed:

```
Tier 2: "You can request siblings, cross-refs, or definitions if needed"
        → Model rarely requested anything
        → 43.5% error rate despite full document access
```

### Validation Study Findings

The validation study revealed a critical insight:

| Finding | Implication |
|---------|-------------|
| 98% of improvements were prompt-based | Models had the information but misinterpreted it |
| Models don't ask for help | Reactive "request context" approach doesn't work |
| Errors clustered around exemptions, alternatives | Specific context types would have helped |

### Why Models Don't Request Context

1. **Confidence bias**: Models tend to commit to an answer rather than admit uncertainty
2. **Prompt framing**: "You can request..." feels optional, not required
3. **Token efficiency**: Models may avoid expanding context to stay concise
4. **Training bias**: RLHF rewards confident, complete answers

---

## The Solution: Proactive Keyword Filtering

### Core Principle

**Don't ask the model what it needs. Give it what it would need if it asked.**

### V5 Approach (Proactive)

```
Pre-Tier 1: Deterministically gather relevant context
            → Keyword filter sibling/cross-ref titles
            → Fetch summaries for matches (max 20)
            → Pass everything to Tier 1

Tier 1:     Analyze with context already present
            → Recommend additional items for Tier 2

Tier 2:     Can request more context if needed
            → Re-run with fetched context (logged)
```

### Why This Works

1. **Removes decision burden**: Model doesn't decide what to request
2. **Targets high-value context**: Keywords identify exemptions, alternatives, scope
3. **Bounded cost**: Max 20 summaries keeps token budget predictable
4. **Fallback mechanism**: Tier 2 can still request more if needed

---

## Summary Priority Order

The max 20 summaries are selected in this priority order:

1. **Preceding sibling** - Immediate context before the target document
2. **Following sibling** - Immediate context after the target document
3. **Keyword-matched siblings** - Exemptions > alternatives > scope
4. **Keyword-matched cross-refs** - Same keyword priority

### Excludable Sections

These section types are excluded from automatic summary fetching:
- **Definitions** - Handled separately via the `definitions` table
- **Table of Contents** - No analytical value
- **Reserved/Repealed** - Empty or obsolete sections
- **Appendices** - Usually reference material

```python
EXCLUDABLE_PATTERNS = [
    "definitions", "defined terms",
    "table of contents", "contents",
    "reserved", "repealed",
    "appendix", "appendices",
]

# Size limits
MAX_SUMMARIES = 20
MAX_SIBLING_CATALOG = 50
MAX_CROSS_REF_CATALOG = 100
```

### Deduplication

Summaries are deduplicated to avoid fetching the same document twice:
- Cross-refs that point to siblings already in the summary list are skipped
- If the same doc appears multiple times (e.g., as both preceding and keyword match), it's fetched once

## Keyword Categories

### Keyword Priority (within keyword matches)

1. **Exemptions** (highest) - Direct false positive signals
2. **Alternatives** - Electronic/remote options that affect burden
3. **Scope** - Applicability provisions that bound the requirement
4. **Enforcement** - Penalties/consequences that define burden severity

### Keyword Lists

```python
SIBLING_KEYWORDS = {
    "exemption": [
        "exempt", "exemption", "exemptions",
        "waiver", "waivers",
        "exception", "exceptions",
        "exclusion", "exclusions",
        "not apply", "does not apply",
        "inapplicable"
    ],
    "alternatives": [
        "electronic", "electronically",
        "online",
        "digital", "digitally",
        "remote", "remotely",
        "virtual", "virtually",
        "alternative", "alternatives",
        "substitute", "substitution"
    ],
    "scope": [
        "applicability",
        "scope",
        "general provisions",
        "purpose",
        "application"
    ],
    "enforcement": [
        "enforcement",
        "penalty", "penalties",
        "violation", "violations",
        "fine", "fines",
        "sanction", "sanctions",
        "compliance", "noncompliance"
    ],
}

CROSS_REF_KEYWORDS = {
    # Same categories - cross-refs with these keywords in title get summaries
    "exemption": [...],  # Same as above
    "alternatives": [...],
    "scope": [...],
    "enforcement": [...],
}
```

### Why Definitions Are Excluded

Definition sections are excluded from sibling summary fetching because:
1. Terms are already available via the `definitions` table
2. The `definitions` table provides scope-aware inheritance (definitions apply to descendants)
3. Tier 1 receives `definition_terms` list showing what terms are available
4. Tier 2 receives full definition text for relevant terms

---

## Context Flow

### Pre-Tier 1 Assembly

```
┌─────────────────────────────────────────────────────────────────┐
│  Document: N.J.A.C. 13:69D-1.34 (Casino License Application)    │
│  Position: 5th of 15 siblings                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. Fetch ALL siblings (ordered by citation)                    │
│     → 15 siblings found                                         │
│                                                                 │
│  2. Priority 1-2: Preceding and following siblings              │
│     → "13:69D-1.33 Application requirements" (preceding)        │
│     → "13:69D-1.35 Waivers and modifications" (following)       │
│     → 2 summaries queued                                        │
│                                                                 │
│  3. Priority 3: Keyword-matched siblings (not already added)    │
│     → "13:69D-1.40 Electronic submission" ← "electronic"        │
│     → 1 additional summary queued                               │
│                                                                 │
│  4. Priority 4: Keyword-matched cross-references                │
│     → "N.J.A.C. 13:69B-1.1 Electronic procedures" ← "electronic"│
│     → 1 summary queued                                          │
│                                                                 │
│  5. Total: 4 summaries (under limit of 20)                      │
│                                                                 │
│  6. Fetch ALL ancestor summaries                                │
│     → Chapter: "Casino Control Commission"                      │
│     → Subchapter: "Licensing Requirements"                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Tier1Context:                                                  │
│    sibling_summaries: [3 summaries - preceding, following,      │
│                        + 1 keyword match]                       │
│    cross_ref_summaries: [1 summary with "electronic"]           │
│    ancestor_summaries: [2 summaries - chapter, subchapter]      │
│    sibling_catalog: [15 titles - all siblings]                  │
│    cross_ref_catalog: [8 citations - all cross-refs]            │
│    definition_terms: ["applicant", "license", ...]              │
└─────────────────────────────────────────────────────────────────┘
```

### Tier 1 → Tier 2 Flow

```
Tier 1 analyzes with pre-fetched context
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│  Tier 1 Output:                                                 │
│    classification: "needs_research"                             │
│    best_argument_burdensome: "Section (c)(2) requires..."       │
│    best_argument_justified: "Casino licensing involves..."      │
│    best_argument_unrelated: "The 'signature' reference may..."  │
│                                                                 │
│    context_requests: [                                         │
│      {type: "sibling", id: "N.J.A.C. 13:69D-1.35", ...}       │
│      {type: "definition", id: "original signature", ...}      │
│    ]                                                           │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│  Tier 2 receives:                                               │
│    - Full document content                                      │
│    - Definitions (scope-aware inheritance)                      │
│    - Tier 1 argument framing                                    │
│    - Fetched context (from Tier 1 context_requests)             │
│                                                                 │
│  Tier 2 CAN request:                                            │
│    - Full text of recommended siblings                          │
│    - Full text of recommended cross-refs                        │
│    - Additional items beyond recommendations                    │
│    → Each request triggers re-run (logged)                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Token Budget Analysis

### Assumptions

| Component | Average Tokens | Count | Total |
|-----------|----------------|-------|-------|
| Summary | ~150 tokens | max 20 | 3,000 |
| Sibling title | ~15 tokens | ~30 avg | 450 |
| Cross-ref citation | ~20 tokens | ~15 avg | 300 |
| Definition term | ~5 tokens | ~20 avg | 100 |
| Ancestor summaries | ~150 tokens | ~3 avg | 450 |
| **Pre-Tier 1 Total** | | | **~4,300** |

### Tier 1 Token Budget

```
Document summary:        ~500 tokens
Matches with context:    ~300 tokens
Pre-Tier 1 context:    ~4,300 tokens
Issue-specific prompt:   ~500 tokens
─────────────────────────────────────
Tier 1 Input:          ~5,600 tokens
Tier 1 Output:           ~800 tokens
```

### Tier 2 Token Budget (without re-runs)

```
Full document:         ~3,000 tokens (avg)
Definitions:             ~800 tokens
Tier 1 framing:          ~400 tokens
Issue-specific prompt:   ~500 tokens
─────────────────────────────────────
Tier 2 Input:          ~4,700 tokens
Tier 2 Output:         ~1,200 tokens
```

### Cost Comparison

| Component | V4 (Reactive) | V5 (Proactive) |
|-----------|---------------|----------------|
| Pre-processing | None | ~4,300 tokens |
| Tier 1 input | ~2,000 tokens | ~5,600 tokens |
| Tier 2 input | ~6,000 tokens | ~4,700 tokens |
| Re-runs | N/A | ~10% of items |
| **Total tokens** | ~8,000 | ~10,300 (+re-runs) |
| **Error rate** | 43.5% | Target: <15% |

The slight token increase is justified by the significant error reduction.

---

## Implementation Details

### Summary Limit Enforcement

```python
MAX_SUMMARIES = 20  # Total across siblings + cross-refs

def prioritize_summaries(
    doc_id: int,
    siblings: list[Sibling],
    cross_refs: list[CrossRef],
) -> list[tuple[str, int, str]]:
    """Return (type, doc_id, reason) tuples for summaries to fetch."""

    priority_items = []

    # Find current position
    current_idx = next(i for i, s in enumerate(siblings) if s.id == doc_id)

    # Priority 1: Preceding sibling (unless excludable)
    if current_idx > 0:
        prev = siblings[current_idx - 1]
        if not is_excludable(prev.title):
            priority_items.append(("sibling", prev.id, "preceding"))

    # Priority 2: Following sibling (unless excludable)
    if current_idx < len(siblings) - 1:
        next_sib = siblings[current_idx + 1]
        if not is_excludable(next_sib.title):
            priority_items.append(("sibling", next_sib.id, "following"))

    # Priority 3: Keyword-matched siblings
    already_added = {item[1] for item in priority_items}
    keyword_siblings = [
        s for s in siblings
        if s.id != doc_id
        and s.id not in already_added
        and not is_excludable(s.title)
        and matches_keyword(s.title)
    ]
    # Sort by keyword priority: exemption > alternatives > scope
    keyword_siblings = prioritize_by_keyword_category(keyword_siblings)
    for s in keyword_siblings:
        priority_items.append(("sibling", s.id, "keyword"))

    # Priority 4: Keyword-matched cross-refs (dedup against siblings)
    sibling_ids = {item[1] for item in priority_items}
    keyword_cross_refs = [
        cr for cr in cross_refs
        if cr.target_id not in sibling_ids  # Dedup
        and not is_excludable(cr.target_title or "")
        and matches_keyword(cr.target_title or "")
    ]
    keyword_cross_refs = prioritize_by_keyword_category(keyword_cross_refs)
    for cr in keyword_cross_refs:
        priority_items.append(("cross_ref", cr.target_id, "keyword"))

    # Limit to MAX_SUMMARIES and deduplicate by doc_id
    seen = set()
    deduped = []
    for item in priority_items[:MAX_SUMMARIES]:
        if item[1] not in seen:
            seen.add(item[1])
            deduped.append(item)

    return deduped
```

### Catalog Assembly

Catalogs are passed to Tier 1 for LLM recommendations, with size limits:

```python
def assemble_catalogs(doc_id: int) -> tuple[list[dict], list[dict], bool, bool]:
    """Return sibling and cross-ref catalogs with truncation flags."""

    # All siblings (regardless of keyword match)
    siblings = db.execute("""
        SELECT id, citation, title
        FROM regulatory_documents
        WHERE parent_id = (SELECT parent_id FROM regulatory_documents WHERE id = %s)
          AND id != %s
        ORDER BY citation
    """, [doc_id, doc_id])

    # All cross-references (regardless of keyword match)
    cross_refs = db.execute("""
        SELECT cr.id, cr.citation, rd.title
        FROM cross_references cr
        LEFT JOIN regulatory_documents rd ON rd.id = cr.target_document_id
        WHERE cr.source_document_id = %s
        ORDER BY cr.citation
    """, [doc_id])

    # Apply size limits
    sibling_catalog = siblings[:MAX_SIBLING_CATALOG]
    cross_ref_catalog = cross_refs[:MAX_CROSS_REF_CATALOG]

    # Return with truncation flags
    return (
        sibling_catalog,
        cross_ref_catalog,
        len(siblings) > MAX_SIBLING_CATALOG,
        len(cross_refs) > MAX_CROSS_REF_CATALOG,
    )
```

Truncation is rare in practice (most sections have <50 siblings and <100 cross-refs), but the flags allow the LLM to know if the catalog is incomplete.

### Re-run Logging

When Tier 2 requests additional context:

```python
async def run_tier2_with_reruns(
    doc_id: int,
    initial_context: Tier2Context,
    max_reruns: int = 2,
) -> Tier2Output:
    """Run Tier 2 with automatic context fetching and re-runs."""

    context = initial_context
    rerun_count = 0
    context_requests_made = []

    while rerun_count <= max_reruns:
        output = await call_tier2_llm(context)

        if output.classification != "needs_context":
            # Final answer
            output.rerun_count = rerun_count
            output.context_requests_made = context_requests_made
            return output

        # Process context requests
        for request in output.context_requests:
            logger.info(
                f"Tier 2 re-run #{rerun_count + 1}: "
                f"requested {request.context_type} '{request.identifier}' "
                f"because: {request.reason}"
            )
            context_requests_made.append({
                "context_type": request.context_type,
                "identifier": request.identifier,
                "need_level": request.need_level,
                "reason": request.reason,
                "timestamp": datetime.utcnow().isoformat(),
            })

            # Fetch requested context
            if request.need_level == "summary":
                context = add_summary(context, request.identifier)
            else:  # full_text
                context = add_full_text(context, request.identifier)

        rerun_count += 1

    # Max reruns exceeded - return last output
    output.rerun_count = rerun_count
    output.context_requests_made = context_requests_made
    return output
```

---

## Related Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Full tier specifications
- [DATA_MODELS.md](./DATA_MODELS.md) - Pydantic model definitions
- [OVERVIEW.md](./OVERVIEW.md) - High-level architecture diagram
