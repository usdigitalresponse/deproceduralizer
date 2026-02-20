"""Pydantic models for LLM structured outputs."""
from typing import Optional, Literal
from pydantic import BaseModel, Field

from ..config import JenAICategory


class IssueFinding(BaseModel):
    """A single category finding from the analysis."""
    category: JenAICategory
    confidence: float = Field(ge=0.0, le=1.0)
    severity: int = Field(ge=1, le=10)
    complexity: Literal["HIGH", "MEDIUM", "LOW"]
    explanation: str
    matched_phrases: list[str] = []
    implementation_approach: Optional[str] = None
    effort_estimate: Optional[str] = None
    text_examples: list[str] = []


class AnalysisOutput(BaseModel):
    """Single-pass analysis output."""
    categories: list[IssueFinding] = []
    classification: Literal["has_issues", "clean"]
    overall_confidence: float = Field(ge=0.0, le=1.0)
    overall_complexity: Literal["HIGH", "MEDIUM", "LOW"]
    summary: str
    reasoning: str
