# Research Pipeline V5 Data Models

> **Version:** V5
> **Status:** Design Complete

## Table of Contents

1. [Pre-Tier 1 Models](#pre-tier-1-models)
2. [Tier 1 Models](#tier-1-models)
3. [Tier 2 Models](#tier-2-models)
4. [Tier 3 Models](#tier-3-models)
5. [Shared Models](#shared-models)
6. [Model Relationships](#model-relationships)

---

## Pre-Tier 1 Models

### Tier1Context

Context assembled deterministically before Tier 1 LLM call.

```python
from pydantic import BaseModel, Field
from typing import Optional

class SiblingSummary(BaseModel):
    """Summary of a sibling document included by priority rules."""
    doc_id: int
    citation: str
    title: str
    summary: str
    inclusion_reason: str = Field(description="preceding | following | keyword")
    keyword_category: Optional[str] = Field(None, description="exemption | alternatives | scope (if keyword match)")
    keyword_matched: Optional[str] = Field(None, description="The specific keyword that matched")

class CrossRefSummary(BaseModel):
    """Summary of a cross-referenced document matched by keyword."""
    target_id: int
    citation: str
    target_title: Optional[str]
    summary: str
    keyword_category: str
    keyword_matched: str

class AncestorSummary(BaseModel):
    """Summary of an ancestor document (always included)."""
    doc_id: int
    citation: str
    title: str
    document_type: str  # chapter | subchapter | part
    summary: str

class SiblingEntry(BaseModel):
    """Catalog entry for a sibling (title only, no summary)."""
    doc_id: int
    citation: str
    title: str

class CrossRefEntry(BaseModel):
    """Catalog entry for a cross-reference (citation only)."""
    ref_id: int
    citation: str
    target_title: Optional[str]

class Tier1Context(BaseModel):
    """Context assembled before Tier 1 LLM call."""

    # Priority-ordered summaries (max 20 total, deduplicated)
    # Priority: preceding sibling > following sibling > keyword siblings > keyword cross-refs
    sibling_summaries: list[SiblingSummary] = Field(
        description="Sibling summaries (preceding, following, then keyword matches)"
    )
    cross_ref_summaries: list[CrossRefSummary] = Field(
        description="Cross-ref summaries (keyword matches, deduplicated against siblings)"
    )

    # Ancestor summaries (all ancestors, defines scope)
    ancestor_summaries: list[AncestorSummary] = Field(
        description="All ancestors - chapter, subchapter, part"
    )

    # Catalogs for LLM recommendations (with size limits)
    sibling_catalog: list[SiblingEntry] = Field(
        description="Sibling titles (max 50)"
    )
    cross_ref_catalog: list[CrossRefEntry] = Field(
        description="Cross-ref citations (max 100)"
    )

    # Truncation flags
    sibling_catalog_truncated: bool = Field(
        default=False,
        description="True if sibling catalog was truncated to 50"
    )
    cross_ref_catalog_truncated: bool = Field(
        default=False,
        description="True if cross-ref catalog was truncated to 100"
    )

    # Available definitions
    definition_terms: list[str] = Field(
        description="Terms with definitions available in scope"
    )
```

---

## Tier 1 Models

### Tier1Input

```python
class MatchContext(BaseModel):
    """A regex match with surrounding context."""
    index: int
    matched_text: str
    context_before: str = Field(description="~100 chars before match")
    context_after: str = Field(description="~100 chars after match")
    line_number: Optional[int] = None

class Tier1Input(BaseModel):
    """Input to Tier 1 LLM call."""
    document_id: int
    citation: str
    title: str
    document_summary: str = Field(description="Summary or truncated content")

    # Regex matches to evaluate
    matches: list[MatchContext]

    # Pre-assembled context
    context: Tier1Context

    # Issue-type specific guidance
    issue_type: str
    issue_description: str
    positive_indicators: list[str]
    negative_indicators: list[str]
    issue_examples: list[IssueExample] = Field(
        description="Few-shot examples: true positive, false positive, justified"
    )
```

*Note: `IssueExample` is defined in [Shared Models](#shared-models) below.*

### Tier1Output

```python
class DismissedMatch(BaseModel):
    """A match dismissed as false positive."""
    index: int
    reason: str = Field(description="Why this match is not a genuine issue")

class Tier1Output(BaseModel):
    """Tier 1 output - filtering + argument framing + recommendations."""

    # Match filtering
    relevant_match_indices: list[int] = Field(
        description="Indices of matches that are genuine issues"
    )
    dismissed_matches: list[DismissedMatch] = Field(
        description="Matches dismissed with reasons"
    )

    # Overall classification
    classification: Literal["all_false_positives", "needs_research"] = Field(
        description="all_false_positives: no genuine matches; needs_research: proceed to Tier 2"
    )
    confidence: float = Field(ge=0.0, le=1.0)
    reasoning: str = Field(
        description="Analysis of matches and context: what was considered, "
        "key factors in filtering decisions, and why matches were kept or dismissed"
    )

    # Argument framing (ONLY populated if classification == "needs_research")
    # Skipped for all_false_positives to avoid hallucination and wasted tokens
    best_argument_burdensome: Optional[str] = Field(
        None,
        description="Best case for why this IS a genuine regulatory burden"
    )
    best_argument_justified: Optional[str] = Field(
        None,
        description="Best case for why this burden IS justified"
    )
    best_argument_unrelated: Optional[str] = Field(
        None,
        description="Best case for why this is NOT the issue type at all"
    )

    # Context requests for Tier 2 to fetch (empty if all_false_positives)
    context_requests: list[ContextRequest] = Field(
        default_factory=list,
        description="Structured requests for context items Tier 2 should fetch"
    )
    # ContextRequest has: context_type, identifier, need_level, reason
```

---

## Tier 2 Models

### Tier2Input

```python
class Tier2Input(BaseModel):
    """Input to Tier 2 LLM call."""
    document_id: int
    citation: str
    title: str
    content: str = Field(description="Full document content")

    # From Tier 1
    relevant_matches: list[MatchContext]
    tier1_argument_framing: dict = Field(
        description="best_argument_burdensome/justified/unrelated from Tier 1"
    )
    tier1_fetched_context: str = Field(
        description="Fetched content from Tier 1's context_requests, formatted for prompt"
    )

    # Definitions (scope-aware inheritance)
    definitions: list[DefinitionEntry]

    # Issue-type specific guidance
    issue_type: str
    issue_description: str
    positive_indicators: list[str]
    negative_indicators: list[str]
    issue_examples: list[IssueExample]  # Few-shot examples
    severity_baseline: int
    severity_modifiers: list[str]

    # Additional context (from re-runs)
    additional_siblings: list[SiblingFullText] = Field(default_factory=list)
    additional_cross_refs: list[CrossRefFullText] = Field(default_factory=list)
```

*Note: `IssueExample` is defined in [Shared Models](#shared-models).*

```python
class DefinitionEntry(BaseModel):
    """A definition available in scope."""
    term: str
    definition: str
    source_citation: str
    scope_level: str = Field(description="Where definition originates: section|subchapter|chapter")


class SiblingFullText(BaseModel):
    """Full text of a sibling document."""
    doc_id: int
    citation: str
    title: str
    content: str


class CrossRefFullText(BaseModel):
    """Full text of a cross-referenced document."""
    target_id: int
    citation: str
    title: Optional[str]
    content: str
```

### ContextRequest

```python
class ContextRequest(BaseModel):
    """Request for additional context (triggers re-run)."""
    context_type: Literal["sibling", "cross_reference", "definition"]
    identifier: str = Field(description="Citation for docs, term for definitions")
    need_level: Literal["summary", "full_text"]
    reason: str = Field(description="Why this context is needed")
```

### Tier2Output

```python
class ContextEntryLLM(BaseModel):
    """What LLM provides when citing context it used."""
    type: Literal["self", "hierarchy", "sibling", "definition", "cross_reference", "statute", "web"]
    identifier: str = Field(
        description="Term for definitions, citation for docs, URL for web"
    )
    quote: Optional[str] = Field(
        None,
        description="Verbatim text from source that informed analysis"
    )
    relevance: str = Field(
        description="How this context affected the analysis"
    )
    # Type-specific fields
    is_mandate: Optional[bool] = None  # For statute/web sources
    state_discretion: Optional[Literal["none", "partial", "full"]] = None


class Tier2Output(BaseModel):
    """Tier 2 output - full classification with context tracking."""

    # Classification
    classification: Literal["unrelated", "justified", "burdensome", "needs_context"]
    confidence: float = Field(ge=0.0, le=1.0)
    reasoning: str = Field(
        description="Comprehensive analysis: document interpretation, how definitions apply, "
        "evaluation of both arguments (for/against), key factors in classification decision, "
        "and explanation of severity score"
    )

    # Steelman analysis (preserved from V4)
    argument_for_regulation: str = Field(
        description="Best case for why the burden is justified"
    )
    argument_against_regulation: str = Field(
        description="Best case for why the burden is problematic"
    )

    # Severity (required for burdensome/justified)
    severity: Optional[int] = Field(None, ge=1, le=10)
    severity_baseline: Optional[int] = Field(
        None,
        description="Issue-type baseline before modifiers"
    )
    severity_calculation: Optional[str] = Field(
        None,
        description="Formula breakdown: 'baseline 5 + no_alternative +2 + ...' = 7"
    )

    # Verbatim requirements (preserved from V4)
    verbatim_requirements: list[str] = Field(
        description="Exact quotes of requirement language from document"
    )

    # Context used with quotes (preserved from V4)
    context_used: list[ContextEntryLLM] = Field(
        description="Sources consulted with type, identifier, quote, relevance"
    )

    # Re-run tracking (NEW in V5)
    rerun_count: int = Field(
        default=0,
        description="How many times Tier 2 was re-run with additional context"
    )
    context_requests_made: list[dict] = Field(
        default_factory=list,
        description="What context was requested and why (for each re-run)"
    )
    forced_classification: bool = Field(
        default=False,
        description="True if max re-runs (2) exceeded and classification was forced"
    )

    # Routing flags for Tier 3
    cites_federal_statute: bool = Field(
        default=False,
        description="True if document cites federal statute as mandate"
    )
    federal_citation: Optional[str] = Field(
        None,
        description="e.g., '42 CFR 483.24' or '26 U.S.C. 6050I'"
    )
    potentially_controversial: bool = Field(
        default=False,
        description="Escalation flag for human review"
    )
    claims_no_alternative: bool = Field(
        default=False,
        description="True if regulation claims no alternative exists"
    )
```

---

## Tier 3 Models

### Tier3Input

```python
class Tier3Input(BaseModel):
    """Input to Tier 3 external verification."""
    document_id: int
    citation: str
    title: str
    state: str = Field(description="State abbreviation (NJ, NY, etc.)")

    # From Tier 2
    tier2_classification: Literal["burdensome", "justified"]
    tier2_severity: int
    tier2_reasoning: str
    tier2_verbatim_requirements: list[str]

    # Trigger reason
    trigger_reason: str = Field(
        description="Why Tier 3 was triggered: issue_type|federal_citation|high_severity|claims_no_alternative"
    )

    # Issue-type specific
    issue_type: str
    issue_description: str

    # Federal citation if present
    federal_citation: Optional[str] = None
```

### Tier3Output

```python
class WebEvidence(BaseModel):
    """Evidence from web search."""
    url: str
    source_type: Literal["government", "academic", "journalism", "advocacy"]
    quote: str = Field(description="Relevant quote from source")
    relevance: str = Field(description="How this evidence affects assessment")


class EvidencedFlag(BaseModel):
    """A flag with supporting evidence."""
    value: bool
    scope: Literal["reg-specific", "issue-type/domain"] = Field(
        description="reg-specific: about this exact regulation; issue-type/domain: about similar requirements"
    )
    reason: str = Field(description="Why this flag was set")
    evidence: list[WebEvidence] = Field(description="Supporting sources")


class Tier3Output(BaseModel):
    """Tier 3 output - external verification with structured flags."""

    # Classification outcome (may change from Tier 2)
    classification: Literal["burdensome", "justified", "unrelated"]
    severity_adjustment: int = Field(
        ge=-3, le=3,
        description="Delta from Tier 2 severity based on web findings"
    )
    final_severity: int = Field(
        ge=1, le=10,
        description="tier2_severity + severity_adjustment"
    )
    reasoning: str = Field(
        description="Analysis of web search findings: what sources were found, "
        "how they relate to this regulation, impact on classification/severity, "
        "and explanation of any flags set"
    )

    # Structured flags with evidence
    superseded_by_law: Optional[EvidencedFlag] = Field(
        None,
        description="Newer statute explicitly repeals/amends this requirement"
    )
    federal_mandate_confirmed: Optional[EvidencedFlag] = Field(
        None,
        description="Federal law explicitly requires this"
    )
    state_discretion_found: Optional[EvidencedFlag] = Field(
        None,
        description="Federal leaves discretion to states"
    )
    modernized_alternative_found: Optional[EvidencedFlag] = Field(
        None,
        description="Other states or federal government implement same program with modern alternatives"
    )
    advocacy_for_change: Optional[EvidencedFlag] = Field(
        None,
        description="Journalism/advocacy groups calling for this regulation to be changed"
    )

    # Evidence gap indicator
    evidence_gap: bool = Field(
        default=False,
        description="True if web search found nothing relevant (prevents false conclusions)"
    )

    # Context used (web sources)
    context_used: list[ContextEntryLLM] = Field(
        description="Web sources with quotes"
    )

    # Summary
    web_search_summary: str = Field(
        description="Summary of what web search found"
    )
```

---

## Shared Models

### IssueExample

```python
class IssueExample(BaseModel):
    """A few-shot example for issue classification."""
    classification: Literal["burdensome", "justified", "unrelated"]
    citation: str
    matched_text: str
    context: str = Field(description="Surrounding text for context")
    explanation: str = Field(description="Why this is classified this way")
```

### IssueTypeConfig

```python
class IssueTypeConfig(BaseModel):
    """Configuration for an issue type from prompts/compliance_issues.yaml."""
    key: str  # e.g., "wet_signature"
    name: str  # e.g., "Wet Signature Requirements"
    description: str
    patterns: list[str]  # Regex patterns
    positive_indicators: list[str]
    negative_indicators: list[str]
    examples: list[IssueExample]  # Few-shot examples
    severity_baseline: int
    severity_modifiers: dict[str, int]  # e.g., {"no_alternative": +2}
    tier3_triggers: list[str]  # Additional trigger conditions
```

### ResearchResult

```python
class ResearchResult(BaseModel):
    """Final result combining all tiers."""
    document_id: int
    issue_type: str

    # Source tracking
    tier1_completed: bool
    tier2_completed: bool
    tier3_completed: bool

    # Final classification
    classification: Literal["unrelated", "justified", "burdensome"]
    severity: Optional[int]  # Only for justified/burdensome
    confidence: float

    # Evidence trail
    verbatim_requirements: list[str]
    context_used: list[ContextEntryLLM]

    # Arguments (for human review)
    argument_for_regulation: str
    argument_against_regulation: str

    # Tier 3 flags (if ran)
    tier3_flags: Optional[dict] = None

    # Tracking
    tier2_rerun_count: int = 0
    total_tokens_used: int = 0
    total_cost_usd: float = 0.0
```

---

## Model Relationships

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA FLOW                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐                                                           │
│  │ Tier1Context │  Pre-assembled (deterministic)                            │
│  │              │  • sibling_summaries (keyword-filtered)                   │
│  │              │  • cross_ref_summaries (keyword-filtered)                 │
│  │              │  • ancestor_summaries (all)                               │
│  │              │  • sibling_catalog (all titles)                           │
│  │              │  • cross_ref_catalog (all citations)                      │
│  │              │  • definition_terms                                       │
│  └──────┬───────┘                                                           │
│         │                                                                   │
│         ▼                                                                   │
│  ┌──────────────┐                                                           │
│  │  Tier1Input  │ = Tier1Context + document_summary + matches + issue_config│
│  └──────┬───────┘                                                           │
│         │                                                                   │
│         ▼                                                                   │
│  ┌──────────────┐                                                           │
│  │ Tier1Output  │  LLM response                                             │
│  │              │  • relevant_match_indices                                 │
│  │              │  • best_argument_* (3 arguments)                          │
│  │              │  • recommended_* (3 lists)                                │
│  └──────┬───────┘                                                           │
│         │                                                                   │
│         ▼                                                                   │
│  ┌──────────────┐                                                           │
│  │  Tier2Input  │ = full_content + definitions + Tier1Output.framing/recs   │
│  └──────┬───────┘                                                           │
│         │                                                                   │
│         │ ◄──── ContextRequest (may loop back)                              │
│         │                                                                   │
│         ▼                                                                   │
│  ┌──────────────┐                                                           │
│  │ Tier2Output  │  LLM response                                             │
│  │              │  • classification, severity                               │
│  │              │  • verbatim_requirements                                  │
│  │              │  • context_used (with quotes!)                            │
│  │              │  • rerun_count, context_requests_made                     │
│  └──────┬───────┘                                                           │
│         │                                                                   │
│         │ (if triggered)                                                    │
│         ▼                                                                   │
│  ┌──────────────┐                                                           │
│  │  Tier3Input  │ = tier2 results + trigger_reason + state                  │
│  └──────┬───────┘                                                           │
│         │                                                                   │
│         ▼                                                                   │
│  ┌──────────────┐                                                           │
│  │ Tier3Output  │  LLM + web search response                                │
│  │              │  • classification (may change)                            │
│  │              │  • severity_adjustment, final_severity                    │
│  │              │  • EvidencedFlags (with WebEvidence)                      │
│  └──────┬───────┘                                                           │
│         │                                                                   │
│         ▼                                                                   │
│  ┌──────────────┐                                                           │
│  │ResearchResult│  Final combined output for DB storage                     │
│  └──────────────┘                                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Field Preservation from V4

### Fields Preserved in Tier2Output

| Field | Purpose | Notes |
|-------|---------|-------|
| `argument_for_regulation` | Best case for burden being justified | Steelman analysis |
| `argument_against_regulation` | Best case for burden being problematic | Steelman analysis |
| `verbatim_requirements` | Exact quotes of requirement language | Evidence trail |
| `context_used` | Sources with type, identifier, **quote**, relevance | Full audit trail |
| `severity`, `severity_baseline`, `severity_calculation` | Full severity breakdown | Transparency |
| `potentially_controversial` | Escalation flag | Human review trigger |
| `confidence`, `reasoning` | Standard classification fields | - |

### New Fields in V5

| Field | Tier | Purpose |
|-------|------|---------|
| `best_argument_burdensome` | 1 | Prime Tier 2 thinking |
| `best_argument_justified` | 1 | Prime Tier 2 thinking |
| `best_argument_unrelated` | 1 | Prime Tier 2 thinking |
| `context_requests` | 1 | Structured requests for context Tier 2 should fetch |
| `rerun_count` | 2 | Track context request loops |
| `context_requests_made` | 2 | Audit trail for re-runs |
| `EvidencedFlag` | 3 | Structured flag with scope + evidence |

---

## Related Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Full tier specifications and prompts
- [CONTEXT_STRATEGY.md](./CONTEXT_STRATEGY.md) - Proactive context gathering
- [OVERVIEW.md](./OVERVIEW.md) - High-level architecture diagram
