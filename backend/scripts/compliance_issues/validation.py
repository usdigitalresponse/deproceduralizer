"""
Validation utilities for compliance issues.
"""

import re
from typing import Optional


def normalize_text_for_comparison(text: str) -> str:
    """
    Normalize text for verbatim comparison.

    - Converts to lowercase
    - Collapses all whitespace (spaces, newlines, tabs) to single spaces
    - Strips leading/trailing whitespace

    Args:
        text: Raw text to normalize

    Returns:
        Normalized text string
    """
    if not text:
        return ""
    # Collapse all whitespace to single spaces
    normalized = re.sub(r'\s+', ' ', text)
    # Lowercase and strip
    return normalized.lower().strip()


def is_verbatim_match(
    requirement_text: Optional[str],
    source_text: str,
    fallback_context: Optional[str] = None,
) -> Optional[bool]:
    """
    Check if requirement_text is a verbatim substring of the source text.

    Uses case-insensitive matching with whitespace normalization to handle
    formatting differences between the LLM output and the original text.

    Args:
        requirement_text: The text to check (from LLM analysis)
        source_text: The full regulation content to search within
        fallback_context: Optional matched_context to check if source_text fails

    Returns:
        True if verbatim match found
        False if no match (text is paraphrased/summarized)
        None if requirement_text is empty/null
    """
    if not requirement_text:
        return None

    normalized_requirement = normalize_text_for_comparison(requirement_text)

    if not normalized_requirement:
        return None

    # Check against full regulation content
    normalized_source = normalize_text_for_comparison(source_text)
    if normalized_requirement in normalized_source:
        return True

    # Fallback: check against matched_context if provided
    if fallback_context:
        normalized_context = normalize_text_for_comparison(fallback_context)
        if normalized_requirement in normalized_context:
            return True

    return False
