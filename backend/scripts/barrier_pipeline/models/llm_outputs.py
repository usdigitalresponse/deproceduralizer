"""Pydantic models for LLM structured outputs."""
import json
from typing import Optional, Literal
from pydantic import BaseModel, Field, field_validator

from ..config import BarrierCategory


class IssueFinding(BaseModel):
    """A single category finding from the analysis."""
    category: BarrierCategory
    confidence: float = Field(ge=0.0, le=1.0)
    severity: int = Field(ge=1, le=10)
    complexity: Literal["HIGH", "MEDIUM", "LOW"]
    explanation: str
    matched_phrases: list[str] = []
    tags: list[str] = []
    implementation_approach: Optional[str] = None
    effort_estimate: Optional[str] = None
    text_examples: list[str] = []


class AnalysisOutput(BaseModel):
    """Single-pass analysis output."""
    categories: list[IssueFinding] = []

    @field_validator('categories', mode='before')
    @classmethod
    def parse_stringified_categories(cls, v):
        """Handle batch API returning categories as a JSON string.

        Normally handled by the pre-parse in parse_batch_result_tool_use(),
        but this is a safety net for cached responses or other code paths.
        """
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError as e:
                raise ValueError(f"categories field is not valid JSON: {v[:200]}") from e
        return v
    classification: Literal["has_issues", "clean"]
    overall_confidence: float = Field(ge=0.0, le=1.0)
    overall_complexity: Literal["HIGH", "MEDIUM", "LOW"]
    summary: str
    reasoning: str
