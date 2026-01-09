"""
V5: Pydantic models for the research pipeline.

Organized by purpose:
- context.py: Context catalog, requests, and entries
- matches.py: Match info and processing units
- llm_outputs.py: Tier 1-3 output schemas (V5: Tier 3 is web search tier)
- database.py: Database update models
"""

from .context import (
    SiblingEntry,
    CrossRefEntry,
    AncestorEntry,
    ContextCatalog,
    ContextRequest,
    ContextEntryLLM,
    ContextEntryDB,
    # V5 proactive context models
    SiblingSummary,
    CrossRefSummary,
    AncestorSummary,
    ProactiveTier1Context,
)
from .matches import (
    MatchInfo,
    DismissedMatch,
    ProcessingUnit,
)
from .llm_outputs import (
    Tier1Output,
    Tier2Output,
    Tier3Output,
    EvidencedFlag,  # V5: structured flag with evidence
)
from .database import (
    ComplianceIssueTier1Update,
    ComplianceIssueTier2Update,
    ComplianceIssueTier3Update,
)

__all__ = [
    # Context (catalog entries)
    "SiblingEntry",
    "CrossRefEntry",
    "AncestorEntry",
    "ContextCatalog",
    "ContextRequest",
    "ContextEntryLLM",
    "ContextEntryDB",
    # Context (V5 proactive summaries)
    "SiblingSummary",
    "CrossRefSummary",
    "AncestorSummary",
    "ProactiveTier1Context",
    # Matches
    "MatchInfo",
    "DismissedMatch",
    "ProcessingUnit",
    # V5: LLM outputs (3 tiers)
    "Tier1Output",
    "Tier2Output",
    "Tier3Output",
    "EvidencedFlag",
    # Database
    "ComplianceIssueTier1Update",
    "ComplianceIssueTier2Update",
    "ComplianceIssueTier3Update",
]
