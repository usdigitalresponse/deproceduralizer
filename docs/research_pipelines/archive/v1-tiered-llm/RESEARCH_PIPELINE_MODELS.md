# Research Pipeline Pydantic Models

> **Status: HISTORICAL**
> This document describes the original 3-tier design. See `../../` for current architecture.

## Overview

The pipeline requires multiple model categories:

1. **LLM Output Models** - Schemas injected into prompts for structured output
2. **Database Models** - Full schema for storing in compliance_issues table
3. **Context Models** - Shared models for context_used entries
4. **Input Models** - Data passed into each tier

## Model Hierarchy

```
models/
├── __init__.py
├── llm_outputs.py      # What LLM returns (for prompts)
├── context.py          # Context entry models
├── database.py         # Full DB models
└── inputs.py           # Tier input models
```

---

## 1. Context Entry Models (`context.py`)

Context entries are used in both LLM outputs and database storage, but with different fields populated at different stages.

### Base Context Entry (LLM Output)

```python
from typing import Literal, Optional
from pydantic import BaseModel, Field

class ContextEntryBase(BaseModel):
    """Base fields that LLM provides for all context types."""
    type: Literal["self", "hierarchy", "sibling", "definition", "cross_reference", "statute", "web"]
    identifier: str = Field(description="Term for definitions, citation for others, URL for web")
    quote: Optional[str] = Field(None, description="Verbatim text from source")
    relevance: str = Field(description="How this context affected the analysis")


class ContextEntryHierarchy(ContextEntryBase):
    """Hierarchy-type context (ancestors)."""
    type: Literal["hierarchy"] = "hierarchy"
    summary: Optional[str] = Field(None, description="Ancestor's summary text")


class ContextEntryStatute(ContextEntryBase):
    """Statute-type context (state/federal law)."""
    type: Literal["statute"] = "statute"
    is_mandate: Optional[bool] = Field(None, description="Does this statute mandate the requirement?")
    state_discretion: Optional[Literal["none", "partial", "full"]] = Field(
        None, description="State flexibility if is_mandate=true"
    )


class ContextEntryWebLLM(ContextEntryBase):
    """Web-type context - LLM-provided fields only."""
    type: Literal["web"] = "web"
    source_type: Literal["advocacy", "journalism", "academic", "government"]
    is_mandate: Optional[bool] = Field(None, description="Does this source confirm a mandate?")
    state_discretion: Optional[Literal["none", "partial", "full"]] = None
    # NOTE: url, title, publication_date are TOOL-DERIVED, not in this model


# Union type for LLM output (no source_id, no tool-derived fields)
ContextEntryLLM = ContextEntryBase | ContextEntryHierarchy | ContextEntryStatute | ContextEntryWebLLM
```

### Full Context Entry (Database)

```python
class ContextEntryDB(BaseModel):
    """Full context entry as stored in database."""
    type: Literal["self", "hierarchy", "sibling", "definition", "cross_reference", "statute", "web"]
    identifier: str
    source_id: Optional[int] = Field(None, description="Post-processed link to source table")
    quote: Optional[str] = None
    summary: Optional[str] = None
    relevance: str
    is_mandate: Optional[bool] = None
    state_discretion: Optional[Literal["none", "partial", "full"]] = None
    # Web-specific (tool-derived)
    url: Optional[str] = None
    title: Optional[str] = None
    source_type: Optional[Literal["advocacy", "journalism", "academic", "government"]] = None
    publication_date: Optional[str] = None  # YYYY-MM-DD
```

---

## 2. LLM Output Models (`llm_outputs.py`)

These models define what the LLM should return. They are injected into prompts.

### Tier 1 Output

```python
class Tier1Output(BaseModel):
    """Tier 1 triage output - quick classification."""
    classification: Literal["unrelated", "needs_research", "obvious_burden"]
    confidence: float = Field(ge=0.0, le=1.0)
    reasoning: str = Field(description="Explains classification including any signals detected")
```

### Tier 2 Output

```python
class Tier2Output(BaseModel):
    """Tier 2 research output - full context analysis."""
    # Classification
    classification: Literal["unrelated", "justified", "burdensome"]
    confidence: float = Field(ge=0.0, le=1.0)
    reasoning: str = Field(description="Step-by-step analysis applying research procedure")

    # Steelman analysis
    argument_for_regulation: str = Field(description="Why burden might be justified")
    argument_against_regulation: str = Field(description="Why burden is problematic")

    # Severity (required for burdensome/justified)
    severity: Optional[int] = Field(None, ge=1, le=10)
    severity_baseline: Optional[int] = Field(None, description="Issue-type baseline")
    severity_calculation: Optional[str] = Field(None, description="Formula breakdown")

    # Evidence
    context_used: list[ContextEntryLLM] = Field(
        default_factory=list,
        description="Sources consulted during analysis"
    )
    verbatim_supporting_text: list[str] = Field(
        default_factory=list,
        description="Exact quotes showing the burden exists"
    )

    # Web search trigger
    needs_web_search: bool = False
    web_search_topics: list[str] = Field(
        default_factory=list,
        description="Suggested search topics if needs_web_search=true"
    )
```

### Tier 3 Output

```python
class Tier3Output(BaseModel):
    """Tier 3 web search output - validation and adjustment."""
    classification: Literal["unchanged", "justified"] = Field(
        description="'justified' if web search warrants reclassification"
    )
    severity_adjustment: int = Field(ge=-3, le=3, description="Adjustment from web findings")
    reasoning: str = Field(description="Explanation of web search findings")
    web_search_summary: str = Field(description="Summary of what was found")

    # Web sources found - LLM provides classification, tool provides URL/title
    # This is handled specially - see Tier3WebSource below
    web_sources: list["Tier3WebSourceLLM"] = Field(default_factory=list)


class Tier3WebSourceLLM(BaseModel):
    """What LLM provides for each web source (url/title come from tool)."""
    source_type: Literal["advocacy", "journalism", "academic", "government"]
    quote: str = Field(description="Key quote from source")
    relevance: str
    is_mandate: Optional[bool] = None
    state_discretion: Optional[Literal["none", "partial", "full"]] = None
```

---

## 3. Database Models (`database.py`)

Full models for database storage including all derived and metadata fields.

### Compliance Issue (Full Record)

```python
from datetime import datetime

class ComplianceIssueCreate(BaseModel):
    """Fields set when creating a new compliance issue (regex detection)."""
    document_id: int
    issue_type: str
    occurrence_number: int = 1
    regex_match_pattern: str
    regex_match_context: str
    url: Optional[str] = None
    state: Literal["NJ", "NY"]


class ComplianceIssueTier1Update(BaseModel):
    """Fields updated after Tier 1 completes."""
    tier1_classification: Literal["unrelated", "needs_research", "obvious_burden"]
    tier1_confidence: float
    tier1_reasoning: str
    tier1_completed_at: datetime
    tier1_batch_id: str
    highest_tier_completed: int = 1
    pipeline_version: str = "research_v1"
    # Derived
    requirement_found: Optional[bool] = None  # Set to False if unrelated with high confidence


class ComplianceIssueTier2Update(BaseModel):
    """Fields updated after Tier 2 completes."""
    tier2_classification: Literal["unrelated", "justified", "burdensome"]
    tier2_confidence: float
    tier2_reasoning: str
    argument_for_regulation: str
    argument_against_regulation: str
    severity: Optional[int]
    severity_baseline: Optional[int]
    severity_calculation: Optional[str]
    context_used: list[ContextEntryDB]  # Full entries with source_id populated
    verbatim_supporting_text: list[str]
    needs_web_search: bool
    web_search_topics: list[str]
    tier2_completed_at: datetime
    tier2_batch_id: str
    highest_tier_completed: int = 2
    classification_tier: int = 2
    # Derived
    requirement_found: bool  # True for burdensome/justified, False for unrelated
    is_justified: bool  # True only for justified
    is_verbatim: Optional[bool]  # Computed by are_all_verbatim()


class ComplianceIssueTier3Update(BaseModel):
    """Fields updated after Tier 3 completes."""
    tier3_classification: Literal["unchanged", "justified"]
    tier3_severity_adjustment: int
    tier3_reasoning: str
    web_search_summary: str
    # context_used gets web entries appended
    tier3_completed_at: datetime
    highest_tier_completed: int = 3
    classification_tier: Optional[int] = None  # Set to 3 if reclassified
    # Derived updates
    severity: int  # tier2_severity + adjustment
    is_justified: Optional[bool] = None  # Set to True if reclassified to justified
```

---

## 4. Input Models (`inputs.py`)

Data assembled and passed into each tier.

### Tier 1 Input

```python
class Tier1Input(BaseModel):
    """Input assembled for Tier 1 triage."""
    # Issue identification
    issue_type: str
    matched_pattern: str
    document_title: str

    # Issue-specific guidance (from prompts/compliance_issues.yaml)
    issue_description: str
    issue_positive_indicators: str
    issue_negative_indicators: str

    # Context
    section_summary: Optional[str]
    hierarchy_summaries: str  # Formatted ancestor summaries
    matched_context: str  # ±300 chars around regex match


class Tier2Input(BaseModel):
    """Input assembled for Tier 2 research."""
    # Issue identification
    issue_type: str
    matched_pattern: str

    # Issue-specific guidance
    issue_description: str
    issue_positive_indicators: str
    issue_negative_indicators: str
    severity_baseline: int

    # Full context (from context_builder.py)
    full_document_text: str
    document_citation: str
    document_title: str
    hierarchy_level: str
    ancestor_chain: str  # Formatted
    inherited_definitions: str  # Formatted
    sibling_sections: str  # Formatted, flags waiver/exemption
    cross_references: str  # Formatted
    statute_references: str  # Formatted


class Tier3Input(BaseModel):
    """Input assembled for Tier 3 web search."""
    # From Tier 2
    issue_type: str
    document_citation: str
    document_title: str
    tier2_classification: str
    tier2_severity: int
    tier2_confidence: float
    argument_for: str
    argument_against: str
    web_search_topics: list[str]

    # Statute citations to verify
    statute_citations: list[str]
```

---

## 5. Prompt Integration

### How to inject output schema into prompts

```python
from pydantic import BaseModel
import json

def get_output_schema_for_prompt(model: type[BaseModel]) -> str:
    """Generate JSON schema description for prompt injection."""
    schema = model.model_json_schema()
    # Simplify for prompt - just show structure with descriptions
    return json.dumps(schema, indent=2)

# In prompt template:
TIER2_TEMPLATE = """
...

Respond with JSON matching this schema:
{output_schema}
"""

# Usage:
prompt = TIER2_TEMPLATE.format(
    output_schema=get_output_schema_for_prompt(Tier2Output),
    ...
)
```

### Parsing LLM responses

```python
def parse_tier2_response(response_text: str) -> Tier2Output:
    """Parse and validate LLM response."""
    data = json.loads(response_text)
    return Tier2Output.model_validate(data)
```

---

## 6. Post-Processing Pipeline

### Deriving fields after LLM returns

```python
def process_tier2_output(
    llm_output: Tier2Output,
    document_content: str,
    batch_id: str,
) -> ComplianceIssueTier2Update:
    """Convert LLM output to database update with derived fields."""

    # Derive is_verbatim
    is_verbatim = are_all_verbatim(
        llm_output.verbatim_supporting_text,
        document_content
    )

    # Derive requirement_found and is_justified
    requirement_found = llm_output.classification in ("burdensome", "justified")
    is_justified = llm_output.classification == "justified"

    # Post-process context_used to populate source_ids
    context_with_ids = post_process_context_entries(llm_output.context_used)

    return ComplianceIssueTier2Update(
        tier2_classification=llm_output.classification,
        tier2_confidence=llm_output.confidence,
        tier2_reasoning=llm_output.reasoning,
        argument_for_regulation=llm_output.argument_for_regulation,
        argument_against_regulation=llm_output.argument_against_regulation,
        severity=llm_output.severity,
        severity_baseline=llm_output.severity_baseline,
        severity_calculation=llm_output.severity_calculation,
        context_used=context_with_ids,
        verbatim_supporting_text=llm_output.verbatim_supporting_text,
        needs_web_search=llm_output.needs_web_search,
        web_search_topics=llm_output.web_search_topics,
        tier2_completed_at=datetime.utcnow(),
        tier2_batch_id=batch_id,
        highest_tier_completed=2,
        classification_tier=2,
        requirement_found=requirement_found,
        is_justified=is_justified,
        is_verbatim=is_verbatim,
    )
```

### Post-processing context entries

```python
def post_process_context_entries(
    entries: list[ContextEntryLLM],
) -> list[ContextEntryDB]:
    """Match identifiers to source_ids in database."""
    result = []
    for entry in entries:
        source_id = None

        if entry.type == "definition":
            # Match term to definitions.id
            source_id = lookup_definition_id(entry.identifier)
        elif entry.type in ("cross_reference", "sibling", "hierarchy", "self"):
            # Match citation to regulatory_documents.id
            source_id = lookup_document_id(entry.identifier)
        # statute and web types don't have source_id

        result.append(ContextEntryDB(
            **entry.model_dump(),
            source_id=source_id,
        ))

    return result
```

---

## 7. Tier 3 Web Source Handling

Tier 3 is special because web search tool provides URL/title, but LLM provides classification.

```python
def process_tier3_web_search(
    search_results: list[WebSearchResult],  # From tool
    llm_output: Tier3Output,
) -> list[ContextEntryDB]:
    """Combine tool results with LLM classifications into context entries."""
    web_entries = []

    for tool_result, llm_source in zip(search_results, llm_output.web_sources):
        web_entries.append(ContextEntryDB(
            type="web",
            identifier=tool_result.url,  # URL as identifier
            # Tool-derived
            url=tool_result.url,
            title=tool_result.title,
            publication_date=tool_result.date,
            # LLM-provided
            source_type=llm_source.source_type,
            quote=llm_source.quote,
            relevance=llm_source.relevance,
            is_mandate=llm_source.is_mandate,
            state_discretion=llm_source.state_discretion,
        ))

    return web_entries
```

---

## Summary

| Model | Purpose | Used In |
|-------|---------|---------|
| `Tier1Output` | LLM schema | Tier 1 prompt |
| `Tier2Output` | LLM schema | Tier 2 prompt |
| `Tier3Output` | LLM schema | Tier 3 prompt |
| `ContextEntryLLM` | LLM schema | Nested in Tier2/3 outputs |
| `ContextEntryDB` | Database | Stored in context_used JSONB |
| `ComplianceIssueTier*Update` | Database | Applied after each tier |
| `Tier*Input` | Pipeline | Assembled by context_builder |
