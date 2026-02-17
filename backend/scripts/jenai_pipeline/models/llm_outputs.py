"""Pydantic models for LLM structured outputs."""
from typing import Optional, Literal
from pydantic import BaseModel, Field

from scripts.research_pipeline.models.context import ContextRequest
from ..config import JenAICategory


class Tier1CategoryFinding(BaseModel):
    """A category identified in Tier 1."""
    category: JenAICategory
    confidence: float = Field(ge=0.0, le=1.0)
    severity: int = Field(ge=1, le=10)
    complexity: Literal["HIGH", "MEDIUM", "LOW"]
    reasoning: str
    matched_phrases: list[str] = []


class Tier1Output(BaseModel):
    """Tier 1: Catalog context analysis output."""
    categories_found: list[Tier1CategoryFinding] = []
    classification: Literal["has_issues", "clean", "needs_context"]
    overall_confidence: float = Field(ge=0.0, le=1.0)
    overall_complexity: Literal["HIGH", "MEDIUM", "LOW"]
    context_requests: list[ContextRequest] = []
    reasoning: str


class Tier2CategoryResult(BaseModel):
    """A category result from Tier 2 (confirmed, revised, or new)."""
    category: JenAICategory
    status: Literal[
        "confirmed", "revised_up", "revised_down",
        "dismissed", "new_discovery"
    ]
    confidence: float = Field(ge=0.0, le=1.0)
    severity: int = Field(ge=0, le=10)
    complexity: Literal["HIGH", "MEDIUM", "LOW"]
    explanation: str
    matched_phrases: list[str] = []
    implementation_approach: Optional[str] = None
    effort_estimate: Optional[str] = None
    text_examples: list[str] = []
    revision_reasoning: Optional[str] = None
    context_used: list[str] = []


class Tier2Output(BaseModel):
    """Tier 2: Full context confirmation output."""
    categories: list[Tier2CategoryResult] = []
    classification: Literal["confirmed", "revised", "dismissed", "has_issues"]
    overall_confidence: float = Field(ge=0.0, le=1.0)
    overall_complexity: Literal["HIGH", "MEDIUM", "LOW"]
    summary: str
    context_audit: list[dict] = []
