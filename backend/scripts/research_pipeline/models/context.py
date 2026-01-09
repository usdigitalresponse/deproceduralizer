"""
Context models for the research pipeline.

These models represent:
1. Context catalog entries (metadata shown to Tier 1)
2. Context requests (LLM output requesting additional context)
3. Context entries (tracking what context was used in analysis)
"""

from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, Field


def to_camel(s: str) -> str:
    """Convert snake_case to camelCase for JSON serialization."""
    parts = s.split('_')
    return parts[0] + ''.join(p.capitalize() for p in parts[1:])


# =============================================================================
# Context Catalog Entries (Tier 1 sees metadata only)
# =============================================================================

class SiblingEntry(BaseModel):
    """Sibling section metadata (no content)."""
    document_id: int = Field(description="Document ID for content lookup")
    citation: str
    title: str
    summary: Optional[str] = Field(
        default=None,
        description="Section summary if available"
    )
    has_compliance_issue: bool = Field(
        default=False,
        description="Has its own hit for the same issue type"
    )
    is_waiver_section: bool = Field(
        default=False,
        description="Title suggests waiver/exemption provisions"
    )
    is_exemption_section: bool = Field(
        default=False,
        description="Title suggests exemption provisions"
    )


class CrossRefEntry(BaseModel):
    """Cross-reference metadata (no content)."""
    target_id: int = Field(description="Target document ID for content lookup")
    citation: str
    target_title: Optional[str] = None
    is_definitions_section: bool = Field(
        default=False,
        description="Cross-ref target is a definitions section"
    )


class AncestorEntry(BaseModel):
    """Ancestor metadata (no content)."""
    document_id: int = Field(description="Document ID for content lookup")
    citation: str
    title: str
    hierarchy_level: str = Field(
        description="One of: 'title', 'chapter', 'subchapter', 'part'"
    )


class ContextCatalog(BaseModel):
    """
    What Tier 1 sees - a menu of available context, not the content itself.
    The LLM can request specific items for Tier 2.
    """
    sibling_sections: list[SiblingEntry] = Field(default_factory=list)
    cross_references: list[CrossRefEntry] = Field(default_factory=list)
    definition_terms: list[str] = Field(
        default_factory=list,
        description="Just the terms available, not their definitions"
    )
    ancestor_chain: list[AncestorEntry] = Field(default_factory=list)


# =============================================================================
# Context Request (LLM output)
# =============================================================================

class ContextRequest(BaseModel):
    """
    LLM's request for additional context.
    Tier 1 requests summaries; Tier 2 can request full text.
    """
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,  # Accept both snake_case and camelCase input
    )

    context_type: Literal["sibling", "cross_reference", "definition", "hierarchy"]
    identifier: str = Field(
        description="Citation for docs, term for definitions"
    )
    need_level: Literal["summary", "full_text"] = Field(
        description="'summary' for Tier 2, 'full_text' for Tier 3"
    )
    reason: str = Field(
        description="Why this context is needed for analysis"
    )
    scope_document_id: Optional[int] = Field(
        default=None,
        description="Document ID for scope-aware definition lookup (set by tier runner, not LLM)"
    )


# =============================================================================
# Context Entry (for tracking what was used)
# =============================================================================

class ContextEntryLLM(BaseModel):
    """
    What LLM provides when citing context it used in analysis.
    This is embedded in tier outputs (Tier2Output.context_used, etc.)
    """
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    type: Literal["self", "hierarchy", "sibling", "definition", "cross_reference", "statute", "web"] = Field(
        description="Source type of the context"
    )
    identifier: str = Field(
        description="Term for definitions, citation for docs, URL for web"
    )
    quote: Optional[str] = Field(
        default=None,
        description="Verbatim text from source if applicable"
    )
    relevance: str = Field(
        description="How this context affected the analysis"
    )
    # Type-specific fields for statute/web sources
    is_mandate: Optional[bool] = Field(
        default=None,
        description="For statute/web: does this mandate the requirement?"
    )
    state_discretion: Optional[Literal["none", "partial", "full"]] = Field(
        default=None,
        description="For statute/web: how much discretion does state have?"
    )


class ContextEntryDB(BaseModel):
    """
    Full context entry as stored in database.
    Includes source_id from post-processing (links to source table).
    """
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    type: Literal["self", "hierarchy", "sibling", "definition", "cross_reference", "statute", "web"]
    identifier: str
    source_id: Optional[int] = Field(
        default=None,
        description="Post-processed link to source table (regulatory_documents.id, definitions.id, etc.)"
    )
    quote: Optional[str] = None
    summary: Optional[str] = Field(
        default=None,
        description="Summary text when need_level was 'summary'"
    )
    relevance: str
    is_mandate: Optional[bool] = None
    state_discretion: Optional[Literal["none", "partial", "full"]] = None
    # Web-specific fields (populated from web search tool, not LLM)
    url: Optional[str] = None
    title: Optional[str] = None
    source_type: Optional[Literal["advocacy", "journalism", "academic", "government"]] = None
    publication_date: Optional[str] = Field(
        default=None,
        description="YYYY-MM-DD format"
    )


# =============================================================================
# V5 Proactive Context (Pre-fetched summaries for Tier 1)
# =============================================================================

class SiblingSummary(BaseModel):
    """
    Pre-fetched sibling summary for V5 Tier 1.

    Unlike SiblingEntry (metadata only), this includes the actual summary text
    with fallback to content excerpt or title if summary is unavailable.
    """
    document_id: int = Field(description="Document ID for content lookup")
    citation: str
    title: str
    summary: str = Field(
        description="Summary text (always populated via fallback strategy)"
    )
    is_fallback: bool = Field(
        default=False,
        description="True if using content excerpt or title-only (no proper summary)"
    )
    reason: Literal["preceding", "following", "keyword"] = Field(
        description="Why this summary was selected for pre-fetching"
    )
    keyword_category: Optional[str] = Field(
        default=None,
        description="If reason='keyword', which category matched (exemption, alternatives, scope, enforcement)"
    )


class CrossRefSummary(BaseModel):
    """
    Pre-fetched cross-reference summary for V5 Tier 1.

    Unlike CrossRefEntry (metadata only), this includes the actual summary text.
    """
    target_id: int = Field(description="Target document ID")
    citation: str
    target_title: Optional[str] = None
    summary: str = Field(
        description="Summary text (always populated via fallback strategy)"
    )
    is_fallback: bool = Field(
        default=False,
        description="True if using content excerpt or title-only"
    )
    keyword_category: Optional[str] = Field(
        default=None,
        description="Which keyword category matched (exemption, alternatives, scope, enforcement)"
    )


class AncestorSummary(BaseModel):
    """
    Ancestor with summary for V5 Tier 1.

    Ancestors provide scope context and are NOT counted toward the
    MAX_SUMMARIES limit (typically only 2-4 ancestors per document).
    """
    document_id: int = Field(description="Document ID")
    citation: str
    title: str
    hierarchy_level: str = Field(
        description="One of: 'title', 'chapter', 'subchapter', 'part'"
    )
    summary: str = Field(
        description="Summary text (always populated via fallback strategy)"
    )
    is_fallback: bool = Field(
        default=False,
        description="True if using content excerpt or title-only"
    )


class ProactiveTier1Context(BaseModel):
    """
    V5 proactive context for Tier 1.

    This replaces the reactive ContextCatalog approach in V4. Instead of
    giving Tier 1 just metadata and waiting for it to request context,
    we proactively pre-fetch high-value summaries based on keyword matching.

    Summary selection priority:
    1. Preceding sibling (unless excludable)
    2. Following sibling (unless excludable)
    3. Keyword-matched siblings (exemption > alternatives > scope > enforcement)
    4. Keyword-matched cross-refs (deduplicated against siblings)

    Limits:
    - sibling_summaries + cross_ref_summaries: max 20 combined
    - ancestor_summaries: unlimited (typically 2-4)
    - sibling_catalog: max 50
    - cross_ref_catalog: max 100
    """
    # Pre-fetched summaries (siblings + cross-refs limited to 20 total)
    sibling_summaries: list[SiblingSummary] = Field(default_factory=list)
    cross_ref_summaries: list[CrossRefSummary] = Field(default_factory=list)

    # Ancestor summaries (NOT counted toward 20 limit)
    ancestor_summaries: list[AncestorSummary] = Field(default_factory=list)

    # Full catalogs for LLM to recommend additional items for Tier 2
    sibling_catalog: list[SiblingEntry] = Field(default_factory=list)
    cross_ref_catalog: list[CrossRefEntry] = Field(default_factory=list)
    definition_terms: list[str] = Field(default_factory=list)

    # Truncation flags (so LLM knows if catalog is incomplete)
    sibling_catalog_truncated: bool = Field(
        default=False,
        description="True if >50 siblings exist (catalog was truncated)"
    )
    cross_ref_catalog_truncated: bool = Field(
        default=False,
        description="True if >100 cross-refs exist (catalog was truncated)"
    )
