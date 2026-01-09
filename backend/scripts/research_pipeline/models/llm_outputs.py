"""
LLM output models for the research pipeline.

These are the schemas injected into prompts for structured output.
Each tier has a dedicated output model.

V5 Architecture: 3-Tier Pipeline
================================
- Tier 1: Match Filtering (batch API) - identifies false positives
- Tier 2: Summary-Based Research (batch/realtime API) - produces classification
- Tier 3: Web Search Verification (realtime API) - validates via web search

Note: V4 had 4 tiers with "needs_full_context" routing from Tier 2 to Tier 3.
V5 simplified to 3 tiers where Tier 2 must produce a final classification.
"""

import json
from typing import Literal, Optional
from typing_extensions import Self
from pydantic import BaseModel, Field, field_validator, model_validator

from .context import ContextRequest, ContextEntryLLM
from .matches import DismissedMatch


class Tier1Output(BaseModel):
    """
    Tier 1 output - filter matches and request context.
    Evaluates all matches together, identifies false positives.
    """
    # Match filtering
    relevant_match_indices: list[int] = Field(
        description="0-based indices of matches that appear to be genuine instances of this issue type"
    )
    dismissed_matches: list[DismissedMatch] = Field(
        default_factory=list,
        description="Matches identified as false positives with reasons"
    )

    # Overall classification for this (document, issue_type) pair
    classification: Literal["all_false_positives", "needs_research"] = Field(
        description="'all_false_positives' if no genuine matches, 'needs_research' otherwise"
    )
    confidence: float = Field(
        ge=0.0,
        le=1.0,
        description="Confidence in the classification (0.0 to 1.0)"
    )
    reasoning: str = Field(
        description="Brief explanation of classification decision"
    )

    # V5: Argument Framing (ONLY when classification="needs_research")
    best_argument_burdensome: Optional[str] = Field(
        default=None,
        description="Strongest case for burden being genuine. Required if needs_research."
    )
    best_argument_justified: Optional[str] = Field(
        default=None,
        description="Strongest case for burden being necessary. Required if needs_research."
    )
    best_argument_unrelated: Optional[str] = Field(
        default=None,
        description="Strongest case for this being a false positive. Required if needs_research."
    )

    # Context requests for Tier 2 to fetch (replaces recommended_* string fields)
    context_requests: list[ContextRequest] = Field(
        default_factory=list,
        description="Structured requests for context items Tier 2 should fetch"
    )

    @field_validator('dismissed_matches', mode='before')
    @classmethod
    def parse_dismissed_matches(cls, v):
        """Handle LLM sometimes returning as JSON string."""
        if isinstance(v, str):
            return json.loads(v)
        return v

    @field_validator('context_requests', mode='before')
    @classmethod
    def parse_context_requests(cls, v):
        """Handle LLM sometimes returning as JSON string."""
        if isinstance(v, str):
            return json.loads(v)
        return v

    @model_validator(mode='after')
    def validate_argument_framing(self) -> Self:
        """Clear argument framing for false positives, require for needs_research."""
        if self.classification == "all_false_positives":
            # Clear argument framing - not needed for false positives
            self.best_argument_burdensome = None
            self.best_argument_justified = None
            self.best_argument_unrelated = None
        return self


class Tier2Output(BaseModel):
    """
    Tier 2 output - document-level analysis with summary context.
    Produces classification, severity, and verbatim requirements.
    """
    # Classification (V5: no needs_full_context - Tier 2 must produce final classification)
    classification: Literal["unrelated", "justified", "burdensome"] = Field(
        description="Final classification after summary analysis"
    )
    confidence: float = Field(
        ge=0.0,
        le=1.0
    )
    reasoning: str = Field(
        description="Step-by-step analysis applying research procedure"
    )

    # Steelman analysis (required)
    argument_for_regulation: str = Field(
        description="Best case for why burden is justified"
    )
    argument_against_regulation: str = Field(
        description="Best case for why burden is problematic"
    )

    # Severity (required if burdensome or justified)
    severity: Optional[int] = Field(
        default=None,
        ge=1,
        le=10,
        description="Severity score 1-10, required for burdensome/justified"
    )
    severity_baseline: Optional[int] = Field(
        default=None,
        description="Issue-type baseline score"
    )
    severity_calculation: Optional[str] = Field(
        default=None,
        description="Formula breakdown e.g. 'Base 5 + no alternative (+2) = 7'"
    )

    # Document-level output (not per-match)
    verbatim_requirements: list[str] = Field(
        default_factory=list,
        description="Exact quotes of requirement language from document"
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

    # Web search trigger
    needs_web_search: bool = Field(
        default=False,
        description="True if web search needed for validation"
    )
    web_search_topics: list[str] = Field(
        default_factory=list,
        description="Suggested search topics if needs_web_search=true"
    )

    # Escalation flags
    potentially_controversial: bool = Field(
        default=False,
        description="True if affects vulnerable populations, civil rights, or has known advocacy concerns"
    )
    federal_mandate_suspected: bool = Field(
        default=False,
        description="True if federal statute cited but state discretion unclear"
    )

    # V5: Routing flags for Tier 3 trigger
    cites_federal_statute: bool = Field(
        default=False,
        description="True if document explicitly cites a federal statute"
    )
    federal_citation: Optional[str] = Field(
        default=None,
        description="The federal citation if cites_federal_statute is True (e.g., '42 CFR 483.24')"
    )
    claims_no_alternative: bool = Field(
        default=False,
        description="True if claiming no electronic/remote alternative exists"
    )

    # Routing hint for ambiguous cases
    ambiguity_type: Optional[Literal["internal", "external", "both"]] = Field(
        default=None,
        description=(
            "'internal' = more state regulatory context needed, "
            "'external' = federal law/industry verification via web search needed, "
            "'both' = need both internal context and web verification"
        )
    )

    # V5.2: Program Context for Tier 3 Web Search Disambiguation
    # These fields help Tier 3 avoid returning results about similar but different programs
    program_context: Optional[str] = Field(
        default=None,
        description=(
            "Specific program/agency context for web search disambiguation. "
            "E.g., 'NJ Division of Gaming Enforcement casino key employee licensing'"
        )
    )
    not_to_confuse_with: list[str] = Field(
        default_factory=list,
        description=(
            "List of similar-sounding programs/requirements that are NOT relevant. "
            "E.g., ['Federal TSA PreCheck', 'Bank Secrecy Act patron requirements']"
        )
    )
    search_scope_guidance: Optional[str] = Field(
        default=None,
        description=(
            "Guidance for Tier 3 on what to focus on and avoid in web searches. "
            "E.g., 'Focus on state gaming commission regulations, not federal banking requirements'"
        )
    )

    @field_validator('verbatim_requirements', mode='before')
    @classmethod
    def parse_verbatim_requirements(cls, v):
        """Handle LLM sometimes returning as JSON string."""
        if isinstance(v, str):
            return json.loads(v)
        return v

    @field_validator('context_used', mode='before')
    @classmethod
    def parse_context_used(cls, v):
        """Handle LLM sometimes returning as JSON string."""
        if isinstance(v, str):
            return json.loads(v)
        return v

    @field_validator('not_to_confuse_with', mode='before')
    @classmethod
    def parse_not_to_confuse_with(cls, v):
        """Handle LLM sometimes returning as JSON string."""
        if isinstance(v, str):
            return json.loads(v)
        return v

    @field_validator('severity', 'severity_baseline', mode='before')
    @classmethod
    def empty_string_to_none_int(cls, v):
        """Convert empty strings to None for optional int fields.

        LLM structured output sometimes returns '' instead of null
        for optional fields, which fails Pydantic int parsing.
        """
        if v == '':
            return None
        return v

    @field_validator('ambiguity_type', mode='before')
    @classmethod
    def empty_string_to_none_literal(cls, v):
        """Convert empty strings to None for optional Literal fields.

        LLM structured output sometimes returns '' instead of null
        for optional fields, which fails Literal matching.
        """
        if v == '':
            return None
        return v

    @model_validator(mode='after')
    def validate_severity_required(self) -> Self:
        """Severity required when classification is burdensome or justified.

        For 'justified' cases, provide a sensible default (3) if LLM omits it,
        since justified burdens are typically lower severity.
        For 'burdensome' cases, raise an error since severity is critical.
        """
        if self.classification in ('burdensome', 'justified') and self.severity is None:
            if self.classification == 'justified':
                # Default severity for justified cases (minimal severity since burden is justified)
                self.severity = 1
            else:
                # Burdensome requires explicit severity - error if missing
                raise ValueError(
                    f"severity is required when classification is '{self.classification}'"
                )
        return self


class EvidencedFlag(BaseModel):
    """V5: A structured flag with evidence from web search."""
    value: bool = Field(
        description="Whether this flag is true or false"
    )
    scope: Literal["reg-specific", "issue-type/domain"] = Field(
        default="reg-specific",
        description="Whether finding applies to this specific regulation or broadly to issue type"
    )
    reason: str = Field(
        description="Explanation of why flag is set"
    )
    evidence: list[ContextEntryLLM] = Field(
        default_factory=list,
        description="Web sources supporting this flag"
    )


class Tier3Output(BaseModel):
    """
    V5 Tier 3 output - web search verification tier.

    This is the final tier. Performs web search to verify findings
    and can adjust classification and severity based on web results.
    Merges old Tier 3 (full context) and Tier 4 (web search).
    """
    # Final classification (no "needs_full_context" - Tier 3 must decide)
    classification: Literal["unrelated", "justified", "burdensome"] = Field(
        description="Final classification after web search verification"
    )
    confidence: float = Field(
        ge=0.0,
        le=1.0
    )
    reasoning: str = Field(
        description="Explanation of how web search findings affected classification"
    )

    # Severity - V5 uses final_severity directly, but keep adjustment for compatibility
    final_severity: Optional[int] = Field(
        default=None,
        ge=1,
        le=10,
        description="Final severity after web verification (1-10)"
    )
    severity_adjustment: Optional[int] = Field(
        default=None,
        ge=-3,
        le=3,
        description="Adjustment from Tier 2 severity (-3 to +3), for backward compat"
    )
    severity_adjustment_reasoning: Optional[str] = Field(
        default=None,
        description="Explanation of the adjustment"
    )

    # Arguments (refined from Tier 2 based on web findings)
    argument_for_regulation: str = Field(
        description="Best case for why burden is justified (refined from Tier 2)"
    )
    argument_against_regulation: str = Field(
        description="Best case for why burden is problematic (refined from Tier 2)"
    )

    # Web search summary
    web_search_summary: str = Field(
        default="",
        description="Summary of what was found in web search"
    )

    # Document-level output (may refine Tier 2)
    verbatim_requirements: list[str] = Field(
        default_factory=list,
        description="May be refined from Tier 2"
    )

    # Context used (including web sources)
    context_used: list[ContextEntryLLM] = Field(
        default_factory=list,
        description="Sources including web search results with type='web'"
    )

    # V5: Structured flags with evidence from web search
    superseded_by_law: Optional[EvidencedFlag] = Field(
        default=None,
        description="True if web search found law has superseded this requirement"
    )
    federal_mandate_confirmed: Optional[EvidencedFlag] = Field(
        default=None,
        description="True if web search confirmed federal mandate"
    )
    state_discretion_found: Optional[EvidencedFlag] = Field(
        default=None,
        description="True if web search found state has implementation discretion"
    )
    modernized_alternative_found: Optional[EvidencedFlag] = Field(
        default=None,
        description="True if web search found modernized alternatives are used elsewhere"
    )
    evidence_gap: bool = Field(
        default=False,
        description="True if web search found insufficient evidence to verify"
    )

    # V5.1: Easy Cleanup Detection
    # Flags regulations where modern alternatives already exist in practice or are authorized
    easy_cleanup_candidate: bool = Field(
        default=False,
        description="True if this is a low-hanging fruit cleanup opportunity"
    )
    cleanup_type: Optional[Literal[
        "alternative_in_practice",
        "alternative_authorized",
        "peer_state_solution"
    ]] = Field(
        default=None,
        description="Type of easy cleanup opportunity"
    )
    cleanup_evidence: Optional[str] = Field(
        default=None,
        description="URL or citation proving the alternative exists"
    )
    cleanup_recommendation: Optional[str] = Field(
        default=None,
        description="Specific suggested regulation text change"
    )
    cleanup_effort: Optional[Literal["trivial", "easy", "medium"]] = Field(
        default=None,
        description="Effort level: trivial (text change), easy (reference existing auth), medium (new system)"
    )

    # Federal mandate verification (backward compat with old Tier 4)
    federal_mandate_found: bool = Field(
        default=False,
        description="True if web search confirmed federal mandate"
    )
    state_has_discretion: bool = Field(
        default=True,
        description="True if state has discretion in implementation"
    )

    @field_validator('verbatim_requirements', mode='before')
    @classmethod
    def parse_verbatim_requirements(cls, v):
        """Handle LLM sometimes returning as JSON string."""
        if isinstance(v, str):
            return json.loads(v)
        return v

    @field_validator('context_used', mode='before')
    @classmethod
    def parse_context_used(cls, v):
        """Handle LLM sometimes returning as JSON string."""
        if isinstance(v, str):
            return json.loads(v)
        return v

    @field_validator('final_severity', 'severity_adjustment', mode='before')
    @classmethod
    def empty_string_to_none_int(cls, v):
        """Convert empty strings to None for optional int fields.

        LLM structured output sometimes returns '' instead of null
        for optional fields, which fails Pydantic int parsing.
        """
        if v == '':
            return None
        return v

    @model_validator(mode='after')
    def derive_backward_compat_flags(self) -> Self:
        """Derive simple boolean flags from V5 EvidencedFlags for backward compat.

        The V5 prompt uses structured EvidencedFlag objects, but the database
        also stores simple boolean columns for backward compatibility.
        This ensures the booleans are populated from the structured flags.
        """
        if self.federal_mandate_confirmed is not None:
            self.federal_mandate_found = self.federal_mandate_confirmed.value
        if self.state_discretion_found is not None:
            self.state_has_discretion = self.state_discretion_found.value
        return self


# V5: Tier4Output is deleted - web search is now in Tier 3
