# Research Pipeline V5 Architecture

> **Version:** V5 (Proactive Context + Argument Framing)
> **Status:** Design Complete

## Table of Contents

1. [Pre-Tier 1: Context Gathering](#pre-tier-1-context-gathering)
2. [Tier 1: Triage + Argument Framing](#tier-1-triage--argument-framing)
3. [Tier 2: Full Classification](#tier-2-full-classification)
4. [Tier 3: External Verification](#tier-3-external-verification)
5. [Prompt Specifications](#prompt-specifications)
6. [Example Walkthrough](#example-walkthrough)

---

## Pre-Tier 1: Context Gathering

**Purpose:** Deterministically gather relevant context before any LLM call.

**Problem solved:** V4 relied on models to request context, but validation study showed models don't ask for help (43.5% error rate despite full document access).

### Keyword Filtering

```python
SIBLING_KEYWORDS = {
    "exemption": ["exempt", "waiver", "exception", "exclusion", "not apply"],
    "alternatives": ["electronic", "online", "digital", "remote", "virtual", "alternative"],
    "scope": ["applicability", "scope", "general provisions"],
    "enforcement": ["enforcement", "penalty", "penalties", "violation", "violations",
                    "fine", "fines", "sanction", "sanctions", "compliance", "noncompliance"],
}

CROSS_REF_KEYWORDS = {
    # Same keywords - cross-refs with these in title get summaries
}

# Sections to exclude from automatic summary fetching
EXCLUDABLE_PATTERNS = [
    "definitions", "defined terms",
    "table of contents", "contents",
    "reserved", "repealed",
    "appendix", "appendices",
]

MAX_SUMMARIES = 20  # Total across siblings + cross-refs
MAX_SIBLING_CATALOG = 50  # Max siblings in catalog (rare to exceed)
MAX_CROSS_REF_CATALOG = 100  # Max cross-refs in catalog
```

### Summary Priority Order

1. **Preceding sibling** - Immediate context before (unless excludable)
2. **Following sibling** - Immediate context after (unless excludable)
3. **Keyword-matched siblings** - Exemptions > alternatives > scope
4. **Keyword-matched cross-refs** - Same priority order

Definition sections are excluded because terms are handled separately via the `definitions` table with scope-aware inheritance.

### Context Assembly Logic

```python
def is_excludable(title: str) -> bool:
    """Check if section should be excluded from automatic summary fetching."""
    title_lower = title.lower()
    return any(pattern in title_lower for pattern in EXCLUDABLE_PATTERNS)

def gather_tier1_context(doc_id: int) -> Tier1Context:
    # 1. Get all siblings (ordered by citation) and cross-refs
    siblings = get_siblings(doc_id)  # Ordered by citation
    cross_refs = get_cross_references(doc_id)
    ancestors = get_ancestors(doc_id)

    # 2. Find current doc's position among siblings
    current_index = next(i for i, s in enumerate(siblings) if s.id == doc_id)

    # 3. Build priority list for summaries
    priority_items = []

    # Priority 1: Preceding sibling (unless excludable)
    if current_index > 0:
        prev_sibling = siblings[current_index - 1]
        if not is_excludable(prev_sibling.title):
            priority_items.append(("sibling", prev_sibling.id, "preceding"))

    # Priority 2: Following sibling (unless excludable)
    if current_index < len(siblings) - 1:
        next_sibling = siblings[current_index + 1]
        if not is_excludable(next_sibling.title):
            priority_items.append(("sibling", next_sibling.id, "following"))

    # Priority 3: Keyword-matched siblings (exemptions > alternatives > scope)
    keyword_siblings = [
        s for s in siblings
        if s.id != doc_id
        and not is_excludable(s.title)
        and any(kw in s.title.lower() for keywords in SIBLING_KEYWORDS.values() for kw in keywords)
    ]
    keyword_siblings = prioritize_by_keyword_category(keyword_siblings)
    already_added = {item[1] for item in priority_items}
    for s in keyword_siblings:
        if s.id not in already_added:
            priority_items.append(("sibling", s.id, "keyword"))

    # Priority 4: Keyword-matched cross-refs (dedup against siblings already added)
    sibling_ids_added = {item[1] for item in priority_items if item[0] == "sibling"}
    keyword_cross_refs = [
        cr for cr in cross_refs
        if cr.target_id not in sibling_ids_added  # Dedup: skip if already a sibling
        and not is_excludable(cr.target_title or "")
        and any(kw in (cr.target_title or "").lower() for keywords in CROSS_REF_KEYWORDS.values() for kw in keywords)
    ]
    keyword_cross_refs = prioritize_by_keyword_category(keyword_cross_refs)
    for cr in keyword_cross_refs:
        priority_items.append(("cross_ref", cr.target_id, "keyword"))

    # 4. Limit to max 20 summaries
    priority_items = priority_items[:MAX_SUMMARIES]

    # 5. Deduplicate: collect unique doc IDs to fetch
    seen_ids = set()
    deduped_items = []
    for item in priority_items:
        if item[1] not in seen_ids:
            seen_ids.add(item[1])
            deduped_items.append(item)

    # 6. Fetch summaries for deduped items
    sibling_ids = [doc_id for typ, doc_id, _ in deduped_items if typ == "sibling"]
    cross_ref_ids = [doc_id for typ, doc_id, _ in deduped_items if typ == "cross_ref"]

    sibling_summaries = fetch_summaries(sibling_ids)
    cross_ref_summaries = fetch_summaries(cross_ref_ids)

    # 7. Fetch ALL ancestor summaries (they define scope)
    ancestor_summaries = fetch_summaries([a.id for a in ancestors])

    # 8. Build catalogs with size limits
    sibling_catalog = [
        SiblingEntry(citation=s.citation, title=s.title, ...)
        for s in siblings[:MAX_SIBLING_CATALOG]
    ]
    cross_ref_catalog = [
        CrossRefEntry(citation=cr.citation, ...)
        for cr in cross_refs[:MAX_CROSS_REF_CATALOG]
    ]

    return Tier1Context(
        sibling_summaries=sibling_summaries,
        cross_ref_summaries=cross_ref_summaries,
        ancestor_summaries=ancestor_summaries,
        sibling_catalog=sibling_catalog,
        cross_ref_catalog=cross_ref_catalog,
        definition_terms=get_definition_terms(doc_id),
        # Flags for truncation
        sibling_catalog_truncated=len(siblings) > MAX_SIBLING_CATALOG,
        cross_ref_catalog_truncated=len(cross_refs) > MAX_CROSS_REF_CATALOG,
    )
```

### Summary Fallback Strategy

~52% of sections and ~86% of subchapters have summaries. For documents without summaries:

```python
def get_summary_or_fallback(doc: Document) -> str:
    """Get summary with fallback for missing summaries."""
    if doc.summary:
        return doc.summary
    if doc.content and len(doc.content) > 50:
        return f"[No summary - excerpt]: {doc.content[:500]}..."
    return f"[Title only]: {doc.title}"
```

**Fallback Order:**
1. Use `summary` if exists (preferred)
2. Use truncated `content` (first 500 chars) if no summary
3. Use `title` only if content is empty or too short

---

## Tier 1: Triage + Argument Framing

**Purpose:** Filter false positive matches and prime Tier 2 with argument framing.

### Inputs

| Input | Source | Description |
|-------|--------|-------------|
| `document_summary` | DB | Summary of target document (or truncated content) |
| `matches` | Regex | All regex matches with surrounding context |
| `sibling_summaries` | Pre-Tier 1 | Keyword-filtered sibling summaries (max 20) |
| `cross_ref_summaries` | Pre-Tier 1 | Keyword-filtered cross-ref summaries |
| `ancestor_summaries` | Pre-Tier 1 | All ancestor summaries |
| `sibling_catalog` | Pre-Tier 1 | All sibling titles (for recommendations) |
| `cross_ref_catalog` | Pre-Tier 1 | All cross-ref citations |
| `definition_terms` | DB | Available definition terms |
| `issue_description` | Config | Issue-type specific guidance |
| `positive_indicators` | Config | Signals of genuine issue |
| `negative_indicators` | Config | Signals of false positive |
| `issue_examples` | Config | Few-shot examples (true positive, false positive, justified) |

### Outputs

| Output | Type | Description |
|--------|------|-------------|
| `relevant_match_indices` | list[int] | Indices of genuine matches |
| `dismissed_matches` | list[DismissedMatch] | False positives with reasons |
| `classification` | Literal | "all_false_positives" or "needs_research" |
| `confidence` | float | 0.0-1.0 |
| `reasoning` | str | Analysis of matches/context, key factors, why matches kept/dismissed |
| `best_argument_burdensome` | Optional[str] | Best case for burden *(only if needs_research)* |
| `best_argument_justified` | Optional[str] | Best case for justification *(only if needs_research)* |
| `best_argument_unrelated` | Optional[str] | Best case for false positive *(only if needs_research)* |
| `context_requests` | list[ContextRequest] | Items Tier 2 should fetch: `{context_type, identifier, need_level, reason}` *(empty if all_false_positives)* |

### Conditional Argument Framing

Argument framing is **only generated when `classification == "needs_research"`**:

```python
# If all matches are false positives:
# - Skip argument framing (wastes tokens, produces noise)
# - Skip recommendations (nothing to research)

# If any match is genuine:
# - Generate all three best_argument_* fields
# - Generate recommendations for Tier 2
```

**Rationale:** Forcing argument framing for `all_false_positives` produces hallucinated content and wastes tokens.

### Argument Framing Examples

For a `wet_signature` match in a casino licensing regulation:

```json
{
  "best_argument_burdensome": "The regulation requires original signatures on all application forms with no electronic alternative mentioned, creating unnecessary paperwork burden when e-signatures are widely accepted.",
  "best_argument_justified": "Casino licensing involves significant financial interests and fraud risk; physical signatures provide a clear audit trail and deter identity fraud in high-stakes applications.",
  "best_argument_unrelated": "The 'signature' reference appears in context of verifying authenticity of supporting documents, not requiring wet ink on the application itself."
}
```

---

## Tier 2: Full Classification

**Purpose:** Analyze full document with definitions and Tier 1 framing.

### Inputs

| Input | Source | Description |
|-------|--------|-------------|
| `content` | DB | Full document content |
| `definitions` | DB | Inherited definitions (scope-aware) |
| `relevant_matches` | Tier 1 | Matches that passed filtering |
| `tier1_argument_framing` | Tier 1 | Best arguments for each classification |
| `tier1_recommendations` | Tier 1 | Suggested siblings/cross-refs/definitions |
| `issue_description` | Config | Issue-type guidance |
| `positive_indicators` | Config | Signals of genuine issue |
| `negative_indicators` | Config | Signals of false positive |
| `issue_examples` | Config | Few-shot examples (true positive, false positive, justified) |
| `severity_baseline` | Config | Starting severity for this issue type |
| `severity_modifiers` | Config | Adjustment rules |

### Context Request Mechanism

Tier 2 can request additional context:

```python
class ContextRequest(BaseModel):
    context_type: Literal["sibling", "cross_reference", "definition"]
    identifier: str  # Citation or term
    need_level: Literal["summary", "full_text"]
    reason: str  # Why this context is needed

# If Tier 2 requests context:
# 1. Fetch requested items
# 2. Increment rerun_count
# 3. Append to context_requests_made
# 4. Re-run Tier 2 with additional context
```

### Re-run Mechanics

**API Strategy:**
- Initial Tier 2: Batch API (50% cost savings, 24hr latency OK)
- Re-runs: Real-time API (cannot wait 24hr between context requests)

**Max Re-runs:** `max_reruns = 2` (hard limit)

```python
async def run_tier2_with_reruns(
    doc_id: int,
    initial_context: Tier2Context,
    max_reruns: int = 2,
) -> Tier2Output:
    """Run Tier 2 with automatic context fetching and re-runs."""

    context = initial_context
    rerun_count = 0

    while rerun_count <= max_reruns:
        output = await call_tier2_llm(context)

        if output.classification != "needs_context":
            # Final answer
            output.rerun_count = rerun_count
            output.forced_classification = False
            return output

        # Fetch requested context
        for request in output.context_requests:
            logger.info(
                f"Tier 2 re-run #{rerun_count + 1}: "
                f"requested {request.context_type} '{request.identifier}' "
                f"because: {request.reason}"
            )
            context = add_context(context, request)

        rerun_count += 1

    # Max reruns exceeded - force final classification
    logger.warning("Max re-runs exceeded, forcing classification with available context")
    output = await call_tier2_llm(context, force_classification=True)
    output.rerun_count = rerun_count
    output.forced_classification = True
    return output
```

**When max re-runs exceeded:**
1. Log warning: "Max re-runs exceeded, forcing classification with available context"
2. LLM is prompted to make best classification with available context
3. Output includes `forced_classification: true` flag

### Re-run Logging

Each re-run is logged with:

```python
{
    "rerun_number": 1,
    "context_type": "sibling",
    "identifier": "N.J.A.C. 7:14-2.4",
    "need_level": "full_text",  # or "summary"
    "reason": "Need to check if waiver applies to in-person requirement",
    "timestamp": "2024-01-15T10:30:00Z"
}
```

### Outputs

| Output | Type | Description |
|--------|------|-------------|
| `classification` | Literal | "burdensome", "justified", or "unrelated" |
| `confidence` | float | 0.0-1.0 |
| `reasoning` | str | Comprehensive analysis: interpretation, definitions, both arguments, severity explanation |
| `severity` | int (1-10) | Required for burdensome/justified |
| `severity_baseline` | int | Issue-type baseline |
| `severity_calculation` | str | Formula breakdown |
| `argument_for_regulation` | str | Tier 2's refined argument |
| `argument_against_regulation` | str | Tier 2's refined argument |
| `verbatim_requirements` | list[str] | Exact quotes from document |
| `context_used` | list[ContextEntryLLM] | Sources with quotes |
| `rerun_count` | int | How many times re-run |
| `context_requests_made` | list[ContextRequest] | All requests made |
| `forced_classification` | bool | True if max re-runs exceeded |
| `cites_federal_statute` | bool | Triggers Tier 3 |
| `federal_citation` | str | e.g., "42 CFR 483.24" |
| `potentially_controversial` | bool | Escalation flag |
| `claims_no_alternative` | bool | Triggers Tier 3 if severity≥7 |

---

## Tier 3: External Verification

**Purpose:** Validate claims with web search when external context matters.

### Triggers

```python
def should_run_tier3(tier2_output: Tier2Output, issue_type: str) -> bool:
    # Issue types with known legal evolution
    if issue_type in ("newspaper", "notarization", "wet_signature", "witness", "in_person","mandated_reports"):
        return True

    # Federal mandate claims need verification
    if tier2_output.cites_federal_statute:
        return True

    # "No alternative" claims for high-severity items
    if tier2_output.claims_no_alternative and tier2_output.severity >= 7:
        return True

    # High-severity burdensome items
    if tier2_output.classification == "burdensome" and tier2_output.severity >= 8:
        return True

    return False
```

### Two-Pass Search Strategy

1. **Reg-specific pass** (citation + agency + requirement terms)
   - Can trigger: `superseded_by_law`, `federal_mandate_confirmed`, `state_discretion_found`
   - Scope: Must cite the same regulation or section

2. **Issue-type pass** (issue type + state + domain)
   - Can trigger: `modernized_alternative_found`, `controversy_signal`, `burden_impact_evidence`
   - Scope: Same issue type, preferably same state

### Structured Flags

```python
class EvidencedFlag(BaseModel):
    value: bool
    scope: Literal["reg-specific", "issue-type/domain"]
    reason: str
    evidence: list[WebEvidence]

class WebEvidence(BaseModel):
    url: str
    source_type: Literal["government", "academic", "journalism", "advocacy"]
    quote: str
    relevance: str
```

### Flag Definitions

| Flag | Scenario | Effect |
|------|----------|--------|
| `superseded_by_law` | Newer statute explicitly repeals/amends | Reform priority signal |
| `federal_mandate_confirmed` | Federal law explicitly requires this | Justification strengthened |
| `state_discretion_found` | Federal leaves discretion to states | Can push toward burdensome |
| `modernized_alternative_found` | Other states implement same program with modern alternatives | Severity upshift |
| `advocacy_for_change` | Journalism/advocacy groups calling for change | Severity +1 if credible |
| `evidence_gap` | Search found nothing relevant | Neutral (prevents false conclusions) |

### Outputs

| Output | Type | Description |
|--------|------|-------------|
| `classification` | Literal | May change from Tier 2 |
| `severity_adjustment` | int (-3 to +3) | Delta from Tier 2 |
| `final_severity` | int (1-10) | tier2_severity + adjustment |
| `reasoning` | str | Analysis of web findings: sources found, relevance, impact on classification/severity, flags explanation |
| `superseded_by_law` | EvidencedFlag | With evidence |
| `federal_mandate_confirmed` | EvidencedFlag | With evidence |
| `state_discretion_found` | EvidencedFlag | With evidence |
| `modernized_alternative_found` | EvidencedFlag | With evidence |
| `advocacy_for_change` | EvidencedFlag | With evidence |
| `evidence_gap` | bool | True if search inconclusive |
| `context_used` | list[ContextEntryLLM] | Web sources with quotes |
| `web_search_summary` | str | Summary of findings |

---

## Prompt Specifications

### Tier 1 System Prompt (Key Sections)

```markdown
# Tier 1: Triage + Argument Framing

You are analyzing regex matches for potential regulatory burden issues.

## Your Task

1. **Filter matches**: Identify genuine issues vs false positives
2. **Frame arguments**: For each possible classification, provide the best argument
3. **Recommend context**: Identify siblings/cross-refs Tier 2 should request

## Argument Framing (REQUIRED)

You MUST provide three arguments:
- best_argument_burdensome: Why this IS a genuine burden
- best_argument_justified: Why this burden IS justified
- best_argument_unrelated: Why this is NOT the issue type at all

These arguments prime the next tier's analysis. Be thorough.

## Context Recommendations

Review the full catalogs. Recommend items that:
- Define exemptions/waivers (even if not in pre-filtered summaries)
- Provide alternative compliance paths
- Clarify scope or applicability
```

### Tier 2 System Prompt (Key Sections)

```markdown
# Tier 2: Full Classification

You have the full document, definitions, and argument framing from Tier 1.

## Tier 1's Argument Framing

Consider these perspectives as you analyze:
- Burdensome: {best_argument_burdensome}
- Justified: {best_argument_justified}
- Unrelated: {best_argument_unrelated}

## Your Task

1. Read the full document carefully
2. Apply definitions to interpret terms
3. Consider BOTH sides (argument for AND against)
4. Classify: burdensome | justified | unrelated
5. Extract verbatim requirement quotes
6. Document what context you used (with quotes)

## Context Requests

If you need additional context:
- Set classification = "needs_context"
- Specify what you need and why

You will be re-run with the requested context.
```

### Tier 3 System Prompt (Key Sections)

```markdown
# Tier 3: External Verification

Validate the Tier 2 classification with web search.

## Search Strategy

1. Reg-specific search: [citation] [agency] [requirement]
2. Issue-type search: [issue_type] [state] [domain]

## Structured Flags

Set these flags with evidence:
- superseded_by_law: Has newer law repealed this?
- federal_mandate_confirmed: Does federal law require this?
- state_discretion_found: Can state choose differently?
- modernized_alternative_found: Do other states allow alternatives?

## Evidence Requirements

Each flag must include:
- value: true/false
- scope: "reg-specific" or "issue-type/domain"
- reason: Why you set this flag
- evidence: List of sources with quotes
```

---

## Example Walkthrough

### Input: wet_signature match in N.J.A.C. 13:69D-1.34

**Pre-Tier 1 gathers:**
- Sibling summary: "N.J.A.C. 13:69D-1.35 Waivers and modifications" (keyword: waiver)
- Cross-ref summary: "N.J.A.C. 13:69B-1.1 Electronic submission procedures" (keyword: electronic)
- Ancestor: "N.J.A.C. 13:69D Casino Licensing" (scope)

**Tier 1 outputs:**
```json
{
  "relevant_match_indices": [0],
  "classification": "needs_research",
  "best_argument_burdensome": "Section (c)(2) requires 'original signatures' on all application forms with no mention of electronic alternatives",
  "best_argument_justified": "Casino licensing involves significant fraud risk; physical signatures provide audit trail",
  "best_argument_unrelated": "The 'signature' reference may be for witness attestation, not applicant signature",
  "context_requests": [
    {"context_type": "sibling", "identifier": "N.J.A.C. 13:69D-1.35", "need_level": "full_text", "reason": "May contain waiver provisions"},
    {"context_type": "cross_reference", "identifier": "N.J.A.C. 13:69B-1.1", "need_level": "summary", "reason": "Electronic submission procedures"}
  ]
}
```

**Tier 2 receives argument framing, requests waiver section full text:**
```json
{
  "context_requests": [{
    "context_type": "sibling",
    "identifier": "N.J.A.C. 13:69D-1.35",
    "need_level": "full_text",
    "reason": "Summary mentions waivers but need to see if signature requirement can be waived"
  }]
}
```

**Tier 2 re-runs with waiver full text, outputs:**
```json
{
  "classification": "burdensome",
  "severity": 6,
  "reasoning": "Waiver section (b)(1) explicitly lists 'original signature requirements' as non-waivable...",
  "verbatim_requirements": ["applicant shall provide original signatures on all application forms"],
  "context_used": [{
    "type": "sibling",
    "identifier": "N.J.A.C. 13:69D-1.35(b)(1)",
    "quote": "The following requirements shall not be subject to waiver: (1) Original signature requirements",
    "relevance": "Confirms no waiver available for signature requirement"
  }],
  "rerun_count": 1,
  "cites_federal_statute": false
}
```

**Tier 3 not triggered** (no federal citation, severity < 7, not in trigger issue types)

**Final result:** Burdensome, severity 6, with verbatim quote and waiver section evidence.
