# Research Pipeline Pydantic Models

> **Status: CURRENT**
> Pydantic models for the progressive context disclosure pipeline.

## Overview

The pipeline requires multiple model categories:

1. **Context Models** - Context catalog, context requests, context entries
2. **Match Models** - Match grouping and filtering
3. **LLM Output Models** - Schemas injected into prompts for structured output
4. **Database Models** - Full schema for storing results
5. **Input Models** - Data passed into each tier

## Model Hierarchy

```
models/
├── __init__.py
├── context.py          # Context catalog, requests, entries
├── matches.py          # Match grouping and filtering
├── llm_outputs.py      # What LLM returns (for prompts)
├── database.py         # Full DB models
└── inputs.py           # Tier input models
```

---

## 1. Context Models (`context.py`)

### Context Catalog (Tier 1 sees this)

```python
from typing import Literal, Optional
from pydantic import BaseModel, Field

class SiblingEntry(BaseModel):
    """Sibling section metadata (no content)."""
    citation: str
    title: str
    has_compliance_issue: bool = False  # Has its own hit for same issue type
    is_waiver_section: bool = False
    is_exemption_section: bool = False

class CrossRefEntry(BaseModel):
    """Cross-reference metadata (no content)."""
    citation: str
    target_title: Optional[str] = None
    is_definitions_section: bool = False

class AncestorEntry(BaseModel):
    """Ancestor metadata (no content)."""
    citation: str
    title: str
    hierarchy_level: str  # "chapter", "subchapter", "title"

class ContextCatalog(BaseModel):
    """
    What Tier 1 sees - a menu of available context, not the content itself.
    The LLM can request specific items for Tier 2.
    """
    sibling_sections: list[SiblingEntry]
    cross_references: list[CrossRefEntry]
    definition_terms: list[str]  # Just the terms, not definitions
    ancestor_chain: list[AncestorEntry]
```

### Context Request (LLM output)

```python
class ContextRequest(BaseModel):
    """LLM's request for additional context."""
    context_type: Literal["sibling", "cross_reference", "definition", "hierarchy"]
    identifier: str  # Citation for docs, term for definitions
    need_level: Literal["summary", "full_text"]
    reason: str = Field(description="Why this context is needed")
```

### Context Entry (for context_used tracking)

```python
class ContextEntryLLM(BaseModel):
    """What LLM provides when citing context it used."""
    type: Literal["self", "hierarchy", "sibling", "definition", "cross_reference", "statute", "web"]
    identifier: str = Field(description="Term for definitions, citation for docs, URL for web")
    quote: Optional[str] = Field(None, description="Verbatim text from source if applicable")
    relevance: str = Field(description="How this context affected the analysis")
    # Type-specific fields
    is_mandate: Optional[bool] = Field(None, description="For statute/web: does this mandate the requirement?")
    state_discretion: Optional[Literal["none", "partial", "full"]] = None


class ContextEntryDB(BaseModel):
    """Full context entry as stored in database (includes source_id from post-processing)."""
    type: Literal["self", "hierarchy", "sibling", "definition", "cross_reference", "statute", "web"]
    identifier: str
    source_id: Optional[int] = Field(None, description="Post-processed link to source table")
    quote: Optional[str] = None
    summary: Optional[str] = None
    relevance: str
    is_mandate: Optional[bool] = None
    state_discretion: Optional[Literal["none", "partial", "full"]] = None
    # Web-specific (tool-derived, not from LLM)
    url: Optional[str] = None
    title: Optional[str] = None
    source_type: Optional[Literal["advocacy", "journalism", "academic", "government"]] = None
    publication_date: Optional[str] = None  # YYYY-MM-DD
```

---

## 2. Match Models (`matches.py`)

### Match Information

```python
class MatchInfo(BaseModel):
    """Single regex match within a document."""
    match_id: int  # ID from compliance_issues table
    matched_text: str  # The regex-matched text
    position_start: int
    position_end: int
    surrounding_context: str  # ~100 chars before/after


class DismissedMatch(BaseModel):
    """Match that Tier 1 determined is a false positive."""
    match_index: int
    text: str
    reason: str


class ProcessingUnit(BaseModel):
    """
    The unit of work for the pipeline.
    Groups all matches for a (document_id, issue_type) pair.
    """
    document_id: int
    issue_type: str
    citation: str
    title: str
    matches: list[MatchInfo]
    content: str
    # Context catalog assembled for Tier 1
    context_catalog: Optional[ContextCatalog] = None
```

---

## 3. LLM Output Models (`llm_outputs.py`)

### Tier 1 Output (Match Filtering)

```python
class Tier1Output(BaseModel):
    """
    Tier 1 output - filter matches and request context.
    Evaluates all matches together, identifies false positives.
    """
    # Match filtering
    relevant_match_indices: list[int] = Field(
        description="Indices of matches that appear to be genuine instances of this issue type"
    )
    dismissed_matches: list[DismissedMatch] = Field(
        default_factory=list,
        description="Matches identified as false positives with reasons"
    )

    # Overall classification for this (document, issue_type) pair
    classification: Literal["all_false_positives", "needs_research"]
    confidence: float = Field(ge=0.0, le=1.0)
    reasoning: str = Field(description="Brief explanation of classification")

    # Context requests for Tier 2
    context_requests: list[ContextRequest] = Field(
        default_factory=list,
        description="Context items to fetch for Tier 2 analysis"
    )
```

### Tier 2 Output (Summary-Based Research)

```python
class Tier2Output(BaseModel):
    """
    Tier 2 output - document-level analysis with summary context.
    Produces classification, severity, and verbatim requirements.
    """
    # Classification
    classification: Literal["unrelated", "justified", "burdensome", "needs_full_context"]
    confidence: float = Field(ge=0.0, le=1.0)
    reasoning: str = Field(description="Step-by-step analysis applying research procedure")

    # Steelman analysis
    argument_for_regulation: str = Field(description="Best case for why burden is justified")
    argument_against_regulation: str = Field(description="Best case for why burden is problematic")

    # Severity (required if burdensome or justified)
    severity: Optional[int] = Field(None, ge=1, le=10)
    severity_baseline: Optional[int] = Field(None, description="Issue-type baseline")
    severity_calculation: Optional[str] = Field(None, description="Formula breakdown")

    # Document-level output (not per-match)
    verbatim_requirements: list[str] = Field(
        default_factory=list,
        description="Exact quotes of requirement language extracted from document"
    )

    # Context used in analysis
    context_used: list[ContextEntryLLM] = Field(
        default_factory=list,
        description="Sources consulted during analysis"
    )

    # Full text requests for Tier 3 (if classification is "needs_full_context")
    full_text_requests: list[ContextRequest] = Field(
        default_factory=list,
        description="Context items needing full text for Tier 3"
    )

    # Web search trigger (for high-severity items)
    needs_web_search: bool = False
    web_search_topics: list[str] = Field(
        default_factory=list,
        description="Suggested search topics if needs_web_search=true"
    )

    # Escalation flags for web search
    potentially_controversial: bool = Field(
        default=False,
        description="True if affects vulnerable populations, civil rights, or has known advocacy concerns"
    )
    federal_mandate_suspected: bool = Field(
        default=False,
        description="True if federal statute cited but state discretion unclear"
    )

    # Routing hint for ambiguous cases (NEW)
    ambiguity_type: Optional[Literal["internal", "external", "both"]] = Field(
        None,
        description="When needs_full_context or uncertain: 'internal' = more state regulatory context needed (→ Tier 3), 'external' = federal law/industry standard verification needed (→ Tier 4 directly), 'both' = need both (→ Tier 3 then Tier 4)"
    )
```

### Tier 3 Output (Full Context Deep Dive)

```python
class Tier3Output(BaseModel):
    """
    Tier 3 output - analysis with full text of requested items.
    Resolves uncertain cases from Tier 2.
    """
    # Final classification
    classification: Literal["unrelated", "justified", "burdensome"]
    confidence: float = Field(ge=0.0, le=1.0)
    reasoning: str

    # Severity adjustment (delta from Tier 2)
    severity_adjustment: Optional[int] = Field(None, ge=-3, le=3)
    severity_adjustment_reasoning: Optional[str] = None

    # Document-level output
    verbatim_requirements: list[str] = Field(default_factory=list)

    # Context used (including full-text items)
    context_used: list[ContextEntryLLM] = Field(default_factory=list)

    # Arguments (may be refined from Tier 2)
    argument_for_regulation: str
    argument_against_regulation: str

    # Web search trigger
    needs_web_search: bool = False
    web_search_topics: list[str] = Field(default_factory=list)

    # Escalation flags for web search
    potentially_controversial: bool = Field(
        default=False,
        description="True if affects vulnerable populations, civil rights, or has known advocacy concerns"
    )
    federal_mandate_suspected: bool = Field(
        default=False,
        description="True if federal statute cited but state discretion unclear"
    )
```

### Tier 4 Output (Web Search Validation)

```python
class Tier4WebSourceLLM(BaseModel):
    """LLM's classification of a web search result (URL/title from tool)."""
    source_type: Literal["advocacy", "journalism", "academic", "government"]
    quote: str = Field(description="Key quote from source")
    relevance: str
    is_mandate: Optional[bool] = None
    state_discretion: Optional[Literal["none", "partial", "full"]] = None


class Tier4Output(BaseModel):
    """
    Tier 4 output - web search validation.
    Can adjust severity or reclassify in any direction based on web findings.
    """
    # Classification outcome (full range - web search can change assessment)
    classification: Literal["burdensome", "justified", "unrelated"] = Field(
        description="Final classification after web search validation"
    )

    # Severity adjustment
    severity_adjustment: int = Field(ge=-3, le=3, description="Adjustment from web findings")
    final_severity: int = Field(ge=1, le=10)

    # Web search summary
    web_search_summary: str = Field(description="Summary of what was found")
    reasoning: str = Field(description="Explanation of how findings affect assessment")

    # Web sources as context entries (consistent with other tiers)
    # Note: url, title, publication_date come from web search tool, not LLM
    context_used: list[ContextEntryLLM] = Field(
        default_factory=list,
        description="Web sources with type='web'. LLM provides source_type, quote, relevance, is_mandate, state_discretion"
    )

    # Federal mandate verification
    federal_mandate_found: bool = False
    state_has_discretion: bool = True
```

---

## 4. Database Models (`database.py`)

### Tier 1 Update

```python
from datetime import datetime

class ComplianceIssueTier1Update(BaseModel):
    """Fields updated after Tier 1 completes."""
    tier1_classification: Literal["all_false_positives", "needs_research"]
    tier1_confidence: float
    tier1_reasoning: str
    tier1_relevant_match_ids: list[int]  # IDs of matches that passed filter
    tier1_context_requests: list[dict]  # Serialized ContextRequest objects
    tier1_completed_at: datetime
    tier1_batch_id: str
    highest_tier_completed: int = 1
    pipeline_version: str = "v4"
    grouped_match_count: int  # How many matches were evaluated together
```

### Tier 2 Update

```python
class ComplianceIssueTier2Update(BaseModel):
    """Fields updated after Tier 2 completes."""
    tier2_classification: Literal["unrelated", "justified", "burdensome", "needs_full_context"]
    tier2_confidence: float
    tier2_reasoning: str
    argument_for_regulation: str
    argument_against_regulation: str
    severity: Optional[int]
    severity_baseline: Optional[int]
    severity_calculation: Optional[str]
    verbatim_requirements: list[str]  # Document-level requirement quotes
    context_used: list[dict]  # Serialized ContextEntryDB objects
    tier2_full_text_requests: list[dict]  # Full text requests for Tier 3
    needs_web_search: bool
    web_search_topics: list[str]
    # Escalation flags
    potentially_controversial: bool
    federal_mandate_suspected: bool
    # Routing hint
    ambiguity_type: Optional[str]  # "internal", "external", "both", or None
    tier2_completed_at: datetime
    tier2_batch_id: str
    highest_tier_completed: int = 2
    classification_tier: int = 2
    # Derived
    requirement_found: bool  # True for burdensome/justified
    is_justified: bool  # True only for justified
    is_verbatim: Optional[bool]  # Computed by are_all_verbatim()
```

### Tier 3 Update

```python
class ComplianceIssueTier3Update(BaseModel):
    """Fields updated after Tier 3 completes."""
    tier3_classification: Literal["unrelated", "justified", "burdensome"]
    tier3_confidence: float
    tier3_reasoning: str
    tier3_severity_adjustment: Optional[int]  # Delta from Tier 2 severity
    tier3_severity_adjustment_reasoning: Optional[str]
    verbatim_requirements: list[str]  # May be refined
    # context_used gets additional entries appended
    needs_web_search: bool
    web_search_topics: list[str]
    # Escalation flags
    potentially_controversial: bool
    federal_mandate_suspected: bool
    tier3_completed_at: datetime
    highest_tier_completed: int = 3
    classification_tier: int = 3  # Final classification came from Tier 3
    # Derived
    requirement_found: bool
    is_justified: bool
    final_severity: Optional[int]  # tier2_severity + tier3_severity_adjustment
```

### Tier 4 Update

```python
class ComplianceIssueTier4Update(BaseModel):
    """Fields updated after Tier 4 completes."""
    tier4_classification: Literal["burdensome", "justified", "unrelated"]
    tier4_severity_adjustment: int
    tier4_reasoning: str
    web_search_summary: str
    federal_mandate_found: bool
    state_has_discretion: bool
    # context_used gets web entries appended
    tier4_completed_at: datetime
    highest_tier_completed: int = 4
    classification_tier: int = 4  # Tier 4 is always the final classification
    # Derived updates
    final_severity: int  # Previous severity + tier4_adjustment
    requirement_found: bool  # True for burdensome/justified
    is_justified: bool  # True if classification is 'justified'
```

---

## 5. Input Models (`inputs.py`)

### Tier 1 Input

```python
class Tier1Input(BaseModel):
    """Input assembled for Tier 1 match filtering."""
    # Processing unit info
    document_id: int
    citation: str
    title: str
    issue_type: str

    # All matches to evaluate
    matches: list[MatchInfo]

    # Issue-specific guidance (from prompts/compliance_issues.yaml)
    issue_description: str
    issue_positive_indicators: str
    issue_negative_indicators: str

    # Immediate siblings (previous/next sections with summaries)
    # Formatted as "### Previous Section: ...\nSummary: ..."
    # Empty string if only section in subchapter
    immediate_siblings: str

    # Context catalog (metadata only, not content)
    context_catalog: ContextCatalog
```

### Tier 2 Input

```python
class Tier2Input(BaseModel):
    """Input assembled for Tier 2 summary-based research."""
    # From Tier 1
    document_id: int
    citation: str
    title: str
    issue_type: str

    # Relevant matches (formatted, not just IDs)
    relevant_matches: list[MatchInfo]  # Matches that passed Tier 1 filtering
    tier1_dismissed_count: int  # How many were filtered out (for context)

    # Issue-specific guidance
    issue_description: str
    issue_positive_indicators: str
    issue_negative_indicators: str
    severity_baseline: int
    severity_modifiers: str  # "+1: no alternative, -1: statutory" etc.

    # Full document content
    content: str

    # Inherited definitions
    definition_scope: str  # Citation of scope document (e.g., "N.J.A.C. 13:69D-1")
    definitions: str  # Formatted definitions text

    # Requested context (summaries from Tier 1 context_requests)
    requested_summaries: str  # Formatted summaries of items requested by Tier 1
```

### Tier 3 Input

```python
class Tier3Input(BaseModel):
    """Input assembled for Tier 3 full context deep dive."""
    # Document info
    document_id: int
    citation: str
    title: str
    issue_type: str
    issue_description: str  # For system prompt

    # From Tier 2
    tier2_classification: str
    tier2_severity: Optional[int]
    tier2_confidence: float
    tier2_reasoning: str

    # Tier 2 analysis to potentially refine
    tier2_verbatim_requirements: list[str]
    tier2_argument_for: str
    tier2_argument_against: str

    # Issue-specific guidance
    severity_baseline: int
    severity_modifiers: str

    # Document content
    content: str
    definitions: str

    # Full text of specifically requested items
    requested_full_text: str  # Formatted full content of items requested by Tier 2
```

### Tier 4 Input

```python
class Tier4Input(BaseModel):
    """Input assembled for Tier 4 web search validation."""
    # From Tier 3
    document_id: int
    citation: str
    title: str
    issue_type: str
    issue_description: str  # For system prompt

    # Previous analysis
    previous_classification: str  # tier3_classification
    previous_severity: int  # tier3_severity
    previous_confidence: float  # tier3_confidence
    previous_reasoning: str  # tier3_reasoning

    # Analysis from Tier 3 (may be refined from Tier 2)
    verbatim_requirements: list[str]
    argument_for: str
    argument_against: str

    # Context already consulted (summary for LLM awareness)
    db_context_summary: str  # Brief summary of what DB context was used in Tiers 2-3

    # Web search guidance
    web_search_topics: list[str]

    # Statute citations to verify (extracted from context_used)
    statute_citations: list[str]

    # Web search results (populated by tool)
    web_search_results: str  # Formatted results from web search tool
```

---

## 6. Context Registry (Deduplication)

```python
class ContextRegistry:
    """
    Tracks all context items to prevent including the same document
    multiple times (e.g., if it's both an ancestor and a cross-reference).
    """

    def __init__(self):
        self.seen_doc_ids: set[int] = set()
        self.items: list[ContextItem] = []

    def add(
        self,
        doc_id: int,
        source_type: str,
        citation: str,
        content: str,
        summary: Optional[str]
    ):
        if doc_id in self.seen_doc_ids:
            # Already included - note the dual role
            for item in self.items:
                if item.doc_id == doc_id:
                    item.also_appears_as.append(source_type)
            return

        self.seen_doc_ids.add(doc_id)
        self.items.append(ContextItem(
            doc_id=doc_id,
            source_type=source_type,
            citation=citation,
            content=content,
            summary=summary,
            also_appears_as=[]
        ))

    def render_for_tier(self, tier: int) -> str:
        """Render context appropriate for tier level."""
        sections = []
        for item in self.items:
            label = item.source_type
            if item.also_appears_as:
                label += f" (also: {', '.join(item.also_appears_as)})"

            if tier == 2:  # Summaries only
                sections.append(f"## {label}: {item.citation}\n{item.summary}")
            else:  # Tier 3: Full text
                sections.append(f"## {label}: {item.citation}\n{item.content}")

        return "\n\n".join(sections)


@dataclass
class ContextItem:
    doc_id: int
    source_type: str
    citation: str
    content: str
    summary: Optional[str]
    also_appears_as: list[str]
```

---

## 7. Post-Processing Pipeline

### Processing Tier 2 Output

```python
def process_tier2_output(
    llm_output: Tier2Output,
    document_content: str,
    batch_id: str,
    grouped_match_count: int,
) -> ComplianceIssueTier2Update:
    """Convert LLM output to database update with derived fields."""

    # Derive is_verbatim
    is_verbatim = are_all_verbatim(
        llm_output.verbatim_requirements,
        document_content
    )

    # Derive requirement_found and is_justified
    classification = llm_output.classification
    if classification == "needs_full_context":
        # Will be updated in Tier 3
        requirement_found = None
        is_justified = None
    else:
        requirement_found = classification in ("burdensome", "justified")
        is_justified = classification == "justified"

    # Post-process context_used to populate source_ids
    context_with_ids = post_process_context_entries(llm_output.context_used)

    return ComplianceIssueTier2Update(
        tier2_classification=classification,
        tier2_confidence=llm_output.confidence,
        tier2_reasoning=llm_output.reasoning,
        argument_for_regulation=llm_output.argument_for_regulation,
        argument_against_regulation=llm_output.argument_against_regulation,
        severity=llm_output.severity,
        severity_baseline=llm_output.severity_baseline,
        severity_calculation=llm_output.severity_calculation,
        verbatim_requirements=llm_output.verbatim_requirements,
        context_used=[c.model_dump() for c in context_with_ids],
        tier2_full_text_requests=[r.model_dump() for r in llm_output.full_text_requests],
        needs_web_search=llm_output.needs_web_search,
        web_search_topics=llm_output.web_search_topics,
        potentially_controversial=llm_output.potentially_controversial,
        federal_mandate_suspected=llm_output.federal_mandate_suspected,
        tier2_completed_at=datetime.utcnow(),
        tier2_batch_id=batch_id,
        highest_tier_completed=2,
        classification_tier=2,
        requirement_found=requirement_found,
        is_justified=is_justified,
        is_verbatim=is_verbatim,
    )
```

---

## Summary

| Model | Purpose | Used In |
|-------|---------|---------|
| `ContextCatalog` | Available context menu | Tier 1 input |
| `ContextRequest` | LLM's request for context | Tier 1/2 output |
| `ProcessingUnit` | Grouped matches | Pipeline orchestration |
| `Tier1Output` | Match filtering | Tier 1 prompt |
| `Tier2Output` | Summary research | Tier 2 prompt |
| `Tier3Output` | Full context | Tier 3 prompt |
| `Tier4Output` | Web validation | Tier 4 prompt |
| `ContextEntryLLM` | Context citation | Nested in outputs |
| `ContextEntryDB` | Stored context | Database JSONB |
| `ComplianceIssueTier*Update` | DB updates | After each tier |
| `Tier*Input` | Assembled context | Tier inputs |
| `ContextRegistry` | Deduplication | Context assembly |

---

## Data Flow Between Tiers

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           TIER DATA FLOW                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  TIER 1 OUTPUT                    TIER 2 INPUT                              │
│  ─────────────                    ───────────                               │
│  relevant_match_indices ────────► relevant_matches (with MatchInfo)         │
│  dismissed_matches ─────────────► tier1_dismissed_count                     │
│  context_requests ──────────────► requested_summaries (fetched & formatted) │
│                                                                             │
│  TIER 2 OUTPUT                    TIER 3 INPUT                              │
│  ─────────────                    ───────────                               │
│  classification ────────────────► tier2_classification                      │
│  severity ──────────────────────► tier2_severity                            │
│  confidence ────────────────────► tier2_confidence                          │
│  reasoning ─────────────────────► tier2_reasoning                           │
│  verbatim_requirements ─────────► tier2_verbatim_requirements               │
│  argument_for_regulation ───────► tier2_argument_for                        │
│  argument_against_regulation ───► tier2_argument_against                    │
│  full_text_requests ────────────► requested_full_text (fetched & formatted) │
│                                                                             │
│  TIER 3 OUTPUT                    TIER 4 INPUT                              │
│  ─────────────                    ───────────                               │
│  classification ────────────────► previous_classification                   │
│  severity ──────────────────────► previous_severity                         │
│  confidence ────────────────────► previous_confidence                       │
│  reasoning ─────────────────────► previous_reasoning                        │
│  verbatim_requirements ─────────► verbatim_requirements                     │
│  argument_for_regulation ───────► argument_for                              │
│  argument_against_regulation ───► argument_against                          │
│  context_used ──────────────────► db_context_summary (summarized)           │
│  web_search_topics ─────────────► web_search_topics                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Issue-Specific Guidance (Passed to All Tiers)

| Field | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|-------|--------|--------|--------|--------|
| `issue_type` | ✅ | ✅ | ✅ | ✅ |
| `issue_description` | ✅ | ✅ | ✅ | ✅ |
| `positive_indicators` | ✅ | ✅ | - | - |
| `negative_indicators` | ✅ | ✅ | - | - |
| `severity_baseline` | - | ✅ | ✅ | - |
| `severity_modifiers` | - | ✅ | ✅ | - |

### Escalation Flags (Output from Tier 2/3)

| Field | Description | Triggers Web Search |
|-------|-------------|---------------------|
| `potentially_controversial` | Affects vulnerable populations, civil rights, or has known advocacy concerns | Yes, if classification == 'justified' |
| `federal_mandate_suspected` | Federal statute cited but state discretion unclear | Yes, always |

**Escalation Logic:**
```
needs_web_search = true when ANY of:
  - severity >= 5 AND uncertain about federal mandate
  - confidence < 0.7
  - classification == 'justified' AND potentially_controversial == true
  - federal_mandate_suspected == true
```

---

## Field Lifecycle Notes

### `need_level` (summary vs full_text)
- **Set by:** Tier 1 LLM in `ContextRequest`
- **Used by:** Context fetcher to determine what to retrieve
- **Stored in:** Not stored in DB; transient during processing
- **Inherited by:** Tier 2/3 receive the fetched content, not the level flag

### `summary` in ContextEntryDB
- **Set by:** Post-processor, not LLM
- **Source:** Pre-computed document summaries from `regulatory_documents.summary` column
- **When:** Populated when `need_level=summary` was requested

### `ambiguity_type` Routing
- **Set by:** Tier 2 LLM when classification is `needs_full_context` or confidence is low
- **Values:**
  - `internal`: Missing definitions, scope questions, cross-reference clarification → **Route to Tier 3**
  - `external`: Federal mandate verification, industry standard confirmation → **Skip Tier 3, go directly to Tier 4**
  - `both`: Need internal context AND external verification → **Tier 3, then Tier 4**
  - `None`: Standard flow based on classification

---

## Match Index Conventions

- **LLM Input:** Matches provided as `List[MatchInfo]` with **0-based indexing**
- **LLM Output:** `relevant_match_indices` uses **0-based indices** into input list
- **Post-Processing:** Convert indices to `match_id` values:
  ```python
  match_ids = [input_matches[i].match_id for i in tier1_output.relevant_match_indices]
  ```
- **DB Storage:** Store `match_id` values (not indices) in `tier1_relevant_match_ids`

Example:
```python
# Input to Tier 1
input_matches = [
    MatchInfo(match_id=427, ...),  # index 0
    MatchInfo(match_id=511, ...),  # index 1
    MatchInfo(match_id=389, ...),  # index 2
]

# LLM output
tier1_output.relevant_match_indices = [0, 2]  # 0-based

# Post-processing
tier1_relevant_match_ids = [427, 389]  # Converted to IDs for DB storage
```
