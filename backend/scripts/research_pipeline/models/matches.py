"""
Match models for the research pipeline.

These models represent:
1. Individual regex match information
2. Dismissed matches with reasons
3. Processing units (grouped matches for a document/issue pair)
"""

from typing import Optional
from pydantic import BaseModel, ConfigDict, Field

from .context import ContextCatalog, to_camel


class MatchInfo(BaseModel):
    """
    Single regex match within a document.

    When created from existing compliance_issues records, match_id is the DB ID.
    When created from regex search, match_id is a temporary sequential ID (negative or 0-based).
    """
    match_id: Optional[int] = Field(
        default=None,
        description="ID from compliance_issues table (None for new regex matches)"
    )
    matched_text: str = Field(
        description="The regex-matched text"
    )
    position_start: int = Field(
        description="Character offset in document where match starts"
    )
    position_end: int = Field(
        description="Character offset in document where match ends"
    )
    surrounding_context: str = Field(
        description="~100 chars before and after the match"
    )


class DismissedMatch(BaseModel):
    """
    Match that Tier 1 determined is a false positive.
    Used in Tier1Output.dismissed_matches.
    """
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    match_index: int = Field(
        description="0-based index into the input matches list"
    )
    text: str = Field(
        description="The matched text that was dismissed"
    )
    reason: str = Field(
        description="Why this match is a false positive"
    )


class ProcessingUnit(BaseModel):
    """
    The unit of work for the pipeline.
    Groups all matches for a (document_id, issue_type) pair.

    One ProcessingUnit = one row in compliance_issue_analyses table.
    """
    document_id: int
    issue_type: str
    citation: str = Field(
        description="Regulatory citation (e.g., 'N.J.A.C. 13:69D-1.34')"
    )
    title: str = Field(
        description="Document title"
    )
    matches: list[MatchInfo] = Field(
        description="All regex matches for this document/issue pair"
    )
    content: str = Field(
        description="Full document content"
    )
    # Context catalog assembled for Tier 1
    context_catalog: Optional[ContextCatalog] = Field(
        default=None,
        description="Available context catalog for LLM to request from"
    )
    # Additional metadata
    state: str = Field(
        default="",
        description="State code (NJ or NY)"
    )
