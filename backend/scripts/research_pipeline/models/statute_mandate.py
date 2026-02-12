"""
Pydantic output model for the statute mandate check LLM step.

Used as the structured output schema for the LLM call that determines
whether a cited statute actually mandates the flagged regulatory issue.
"""

from typing import Optional
from pydantic import BaseModel, Field


class StatuteMandateOutput(BaseModel):
    """LLM output for statute mandate analysis."""

    statute_mandated: bool = Field(
        description=(
            "TRUE if the statute clearly requires this specific regulatory provision. "
            "FALSE if the regulation goes beyond what the statute requires, or if the "
            "statute gives the agency discretion in how to implement this area."
        )
    )
    confidence: float = Field(
        ge=0.0,
        le=1.0,
        description="Confidence in the determination (0.0 to 1.0)"
    )
    reasoning: str = Field(
        description="Step-by-step explanation of how the statute does or does not mandate the flagged issue"
    )
    statute_text_excerpt: Optional[str] = Field(
        default=None,
        description="Key excerpt from the statute used in reasoning (if applicable)"
    )
