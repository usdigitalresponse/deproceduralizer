# Progressive Context Disclosure

> **Status: CURRENT**
> Core innovation of the research pipeline.

## The Problem with Pre-Fetching

The original approach fetched ALL possible context for every document:
- Full ancestor chain content (~35,000 chars)
- All sibling content (~24,000 chars avg)
- All cross-reference content (~6,000 chars each)
- All inherited definitions (~18,000 chars)

**Result:** ~80,000 chars per document, most of which was never used.

## The Solution: Progressive Disclosure

Instead of pre-fetching everything, we:
1. Show the LLM a **catalog** of what's available (metadata only)
2. Let the LLM **request** what it needs
3. Fetch and provide only the requested content

## Tier-by-Tier Context Visibility

### Tier 1: Immediate Context + Context Catalog

Tier 1 sees **summaries of immediate siblings** (previous/next sections) plus a **catalog** of all available context (metadata only). The immediate siblings provide sequential context without requiring explicit requests.

```
## Immediate Context

### Previous Section: N.J.A.C. 13:69D-1.33 - "Fees and payments"
Summary: Specifies application fees, payment methods, and fee schedules.
Fees are non-refundable and must accompany the application submission.

### Next Section: N.J.A.C. 13:69D-1.35 - "Waivers and exemptions"
Summary: Establishes procedures for requesting waivers from licensing
requirements. Waivers may be granted for good cause shown.

## Context Catalog (Available on Request)

### Sibling Sections (14 total)
- N.J.A.C. 13:69D-1.31 - "General provisions"
- N.J.A.C. 13:69D-1.32 - "Application procedures"
- N.J.A.C. 13:69D-1.33 - "Fees and payments"
- N.J.A.C. 13:69D-1.35 - "Waivers and exemptions"  ← likely relevant
- ... (10 more)

### Cross-References (3 total)
- N.J.A.C. 13:69D-1.2 (Definitions) ← will use definitions table instead
- N.J.A.C. 7:13-6.7 (Environmental permits)
- N.J.S.A. 5:12-1 (Casino Control Act)

### Definition Terms Available (from subchapter scope)
- "applicant", "casino", "commission", "department", "license", ...

### Ancestor Chain
- Title 13: Law and Public Safety
- Chapter 69D: Casino Licensing
- Subchapter 1: General Provisions
```

**Immediate Siblings Behavior:**

| Scenario | Behavior |
|----------|----------|
| First section in subchapter | Only show "Next Section" |
| Last section in subchapter | Only show "Previous Section" |
| Only section in subchapter | Omit "Immediate Context" entirely |
| Sibling has no summary | Show: "Summary: (not available)" |

Immediate siblings are ordered by citation (numeric order within parent), so "previous" and "next" follow the regulatory structure.

### Tier 2: Summaries of Requested Items

Based on Tier 1's requests, we fetch summaries:

```
## Requested Context (Summaries)

### Sibling: N.J.A.C. 13:69D-1.35 (Waivers and exemptions)
Summary: This section establishes procedures for requesting waivers from
licensing requirements. Waivers may be granted for good cause shown...

### Cross-Reference: N.J.A.C. 7:13-6.7 (Environmental permits)
Summary: Establishes environmental permit requirements for construction
projects. Applicants must submit certified environmental impact statements...

## Inherited Definitions (always included in Tier 2+)
- "Applicant" means any person who has applied for a casino license...
- "Commission" means the Casino Control Commission...
```

**Definitions Policy:**
- **Tier 1**: Definitions are NOT automatically included (keeping cost low). However, Tier 1 CAN request specific terms if clarification is needed for filtering.
- **Tier 2+**: Definitions are ALWAYS included. They're cheap to fetch and frequently useful for understanding regulatory language.

### Tier 3: Full Text of Specific Items

Based on Tier 2's requests, we fetch full content:

```
## Requested Context (Full Text)

### Cross-Reference: N.J.A.C. 7:13-6.7
[Full 6,255 character content of this section]

### Sibling: N.J.A.C. 13:69D-1.35
[Full content - specifically the waiver procedures]
```

## Context Request Format

Each tier can request additional context:

```python
class ContextRequest(BaseModel):
    context_type: Literal["sibling", "cross_reference", "definition", "hierarchy"]
    identifier: str  # citation or term
    need_level: Literal["summary", "full_text"]
    reason: str  # for audit trail
```

Example requests from Tier 1:
```json
{
  "context_requests": [
    {
      "context_type": "sibling",
      "identifier": "N.J.A.C. 13:69D-1.35",
      "need_level": "summary",
      "reason": "Title mentions waivers which may apply to this requirement"
    },
    {
      "context_type": "cross_reference",
      "identifier": "N.J.A.C. 7:13-6.7",
      "need_level": "summary",
      "reason": "Referenced in document, need to understand related requirements"
    }
  ]
}
```

## Definition Cross-Reference Optimization

When a cross-reference points to a definitions section:

**DON'T:** Pull in the full 50+ definition section content
**DO:** Use the definitions table to get only relevant terms

```python
def resolve_cross_reference(cross_ref, terms_in_document):
    target_doc = get_document(cross_ref.target_document_id)

    if is_definitions_section(target_doc):
        # Pull only definitions for terms actually used
        relevant_defs = get_definitions_for_terms(
            scope_document_id=target_doc.id,
            terms=terms_in_document
        )
        return ContextItem(
            type="definition",  # Use 'definition' type (not 'definition_crossref')
            identifier=f"via cross-reference to {target_doc.citation}",
            content=format_definitions(relevant_defs),
            note="Definitions section - showing only relevant terms"
        )
    else:
        # Regular cross-ref
        return ContextItem(
            type="cross_reference",
            identifier=target_doc.citation,
            summary=target_doc.summary,
            content=target_doc.content
        )
```

**Note:** Definitions pulled via cross-reference use `type="definition"` with the source
citation noted in the `identifier` field. This keeps context types consistent with the
canonical types: `sibling | cross_reference | definition | hierarchy | self | web`.

## Context Deduplication

A document might appear in multiple roles:
- As an ancestor (parent chapter)
- As a cross-reference target
- As a sibling

**Solution:** Unified `ContextRegistry` that tracks seen documents:

```python
class ContextRegistry:
    def __init__(self):
        self.seen_doc_ids = set()
        self.context_items = []

    def add(self, doc_id, source_type, content, summary):
        if doc_id in self.seen_doc_ids:
            # Already included - just note the dual role
            for item in self.context_items:
                if item.doc_id == doc_id:
                    item.also_appears_as.append(source_type)
            return

        self.seen_doc_ids.add(doc_id)
        self.context_items.append(ContextItem(...))
```

In the prompt:
```
## Context (Deduplicated)
Note: Some documents appear in multiple roles (e.g., both ancestor and cross-reference).
Each is shown once with all roles noted.

### N.J.A.C. 13:69D-1.2 (cross_reference, also: ancestor)
[Content shown once]
```

## Smart Context Ordering

Content is ordered by likely relevance:

```python
def order_siblings(siblings, issue_type):
    scored = []
    for sib in siblings:
        score = 0
        if sib.has_compliance_issue(issue_type):
            score += 100  # Has its own hit
        if sib.cross_refs_to_hit_docs(issue_type):
            score += 50   # References docs with hits
        if sib.title_contains_issue_keywords(issue_type):
            score += 25   # Related keywords
        if 'waiver' in sib.title.lower() or 'exempt' in sib.title.lower():
            score += 30   # Waivers often relevant
        scored.append((score, sib))
    return [sib for _, sib in sorted(scored, reverse=True)]
```

**Cross-reference ordering:**
1. Definitions → first (clarify terms)
2. Procedures → second (related requirements)
3. Exceptions → third (may reduce burden)

## Token Savings

| Context Type | Pre-fetch All | Progressive | Savings |
|--------------|---------------|-------------|---------|
| Siblings | 24,000 chars | 3,000 chars (avg requested) | 87% |
| Cross-refs | 18,000 chars | 6,000 chars (avg requested) | 67% |
| Definitions | 18,000 chars | 5,000 chars (relevant only) | 72% |
| **Total** | **60,000 chars** | **14,000 chars** | **77%** |
