"""
Database update models for the research pipeline.

These models represent the fields updated in compliance_issue_analyses
after each tier completes. They map LLM outputs to database columns.
"""

from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field


class ComplianceIssueTier1Update(BaseModel):
    """Fields updated after Tier 1 completes."""
    # Tier 1 results
    tier1_classification: Literal["all_false_positives", "needs_research"]
    tier1_confidence: float = Field(ge=0.0, le=1.0)
    tier1_reasoning: str
    tier1_relevant_match_ids: list[int] = Field(
        description="IDs from compliance_issues that passed filtering"
    )
    tier1_dismissed_match_ids: list[int] = Field(
        default_factory=list,
        description="IDs from compliance_issues that were filtered out"
    )
    tier1_dismissed_reasons: list[dict] = Field(
        default_factory=list,
        description="Array of {match_id, text, reason}"
    )
    tier1_context_requests: list[dict] = Field(
        default_factory=list,
        description="Serialized ContextRequest objects"
    )

    # V5: Argument framing (only if classification=needs_research)
    tier1_argument_framing: Optional[dict] = Field(
        default=None,
        description="Contains best_argument_burdensome, best_argument_justified, best_argument_unrelated"
    )

    # Context requests for Tier 2 to fetch
    tier1_recommendations: Optional[dict] = Field(
        default=None,
        description="Contains context_requests: [{context_type, identifier, need_level, reason}, ...]"
    )

    # Pipeline metadata
    tier1_batch_id: str
    tier1_completed_at: datetime
    highest_tier_completed: int = 1
    pipeline_version: str = "v5"
    grouped_match_count: int = Field(
        description="How many matches were evaluated together"
    )


class ComplianceIssueTier2Update(BaseModel):
    """Fields updated after Tier 2 completes.

    V5 Note: The pipeline is now 3-tier (not 4-tier):
    - Tier 1: Match Filtering (batch API)
    - Tier 2: Summary-Based Research (batch/realtime API)
    - Tier 3: Web Search Verification (realtime API)

    Tier 2 must produce a final classification (no "needs_full_context" routing).
    """
    # Tier 2 results
    tier2_classification: Literal["unrelated", "justified", "burdensome"]
    tier2_confidence: float = Field(ge=0.0, le=1.0)
    tier2_reasoning: str

    # Analysis outputs
    argument_for_regulation: str
    argument_against_regulation: str
    severity: Optional[int] = Field(default=None, ge=1, le=10)
    severity_baseline: Optional[int] = None
    severity_calculation: Optional[str] = None
    verbatim_requirements: list[str] = Field(default_factory=list)

    # Context tracking
    context_used: list[dict] = Field(
        default_factory=list,
        description="Serialized ContextEntryDB objects"
    )
    tier2_full_text_requests: list[dict] = Field(
        default_factory=list,
        description="Full text requests for Tier 3"
    )

    # Web search flags
    needs_web_search: bool = False
    web_search_topics: list[str] = Field(default_factory=list)

    # Escalation flags
    potentially_controversial: bool = False
    federal_mandate_suspected: bool = False

    # V5: Routing flags for Tier 3 trigger
    cites_federal_statute: bool = False
    federal_citation: Optional[str] = None
    claims_no_alternative: bool = False

    # V5: Re-run tracking
    tier2_rerun_count: int = Field(
        default=0,
        ge=0,
        le=2,
        description="Number of re-runs with additional context (max 2)"
    )
    tier2_context_requests_made: list[dict] = Field(
        default_factory=list,
        description="Context requests made during re-runs"
    )
    tier2_forced_classification: bool = Field(
        default=False,
        description="True if classification was forced after max re-runs"
    )

    # Routing hint
    ambiguity_type: Optional[str] = Field(
        default=None,
        description="'internal', 'external', 'both', or None"
    )

    # Pipeline metadata
    tier2_batch_id: str
    tier2_completed_at: datetime
    highest_tier_completed: int = 2
    classification_tier: int = Field(
        default=2,
        description="Which tier made the classification"
    )

    # Derived fields
    requirement_found: Optional[bool] = Field(
        default=None,
        description="True for burdensome/justified, None for needs_full_context"
    )
    is_justified: Optional[bool] = Field(
        default=None,
        description="True only for 'justified' classification"
    )
    is_verbatim: Optional[bool] = Field(
        default=None,
        description="Computed by are_all_verbatim()"
    )


class ComplianceIssueTier3Update(BaseModel):
    """Fields updated after Tier 3 completes."""
    # Tier 3 results
    tier3_classification: Literal["unrelated", "justified", "burdensome"]
    tier3_confidence: float = Field(ge=0.0, le=1.0)
    tier3_reasoning: str

    # Severity adjustment
    tier3_severity_adjustment: Optional[int] = Field(
        default=None,
        ge=-3,
        le=3,
        description="Delta from Tier 2 severity"
    )
    tier3_severity_adjustment_reasoning: Optional[str] = None

    # May update verbatim_requirements from Tier 2
    verbatim_requirements: Optional[list[str]] = Field(
        default=None,
        description="If provided, replaces Tier 2 verbatim_requirements"
    )

    # Arguments (may refine from Tier 2)
    argument_for_regulation: Optional[str] = Field(
        default=None,
        description="If provided, replaces Tier 2 argument"
    )
    argument_against_regulation: Optional[str] = Field(
        default=None,
        description="If provided, replaces Tier 2 argument"
    )

    # Web search flags (may be set by Tier 3)
    needs_web_search: bool = False
    web_search_topics: list[str] = Field(default_factory=list)

    # Escalation flags
    potentially_controversial: bool = False
    federal_mandate_suspected: bool = False

    # Pipeline metadata
    tier3_batch_id: str
    tier3_completed_at: datetime
    highest_tier_completed: int = 3
    classification_tier: int = Field(
        default=3,
        description="Tier 3 made the final classification"
    )

    # Derived fields
    requirement_found: bool = Field(
        description="True for burdensome/justified"
    )
    is_justified: bool = Field(
        description="True only for 'justified' classification"
    )
    final_severity: Optional[int] = Field(
        default=None,
        ge=1,
        le=10,
        description="tier2_severity + tier3_severity_adjustment"
    )


