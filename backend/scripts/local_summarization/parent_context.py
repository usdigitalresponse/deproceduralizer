"""Context building for hierarchical summarization."""

import re
from typing import Optional

from hierarchy import get_context_limits


def extract_intro_text(content: str, max_chars: int = 500) -> str:
    """
    Extract intro/purpose paragraph from document content.

    Skip: TOC listings, historical notes, authority citations.
    Keep: First substantive paragraph explaining purpose.

    Args:
        content: Full document content
        max_chars: Maximum characters to return

    Returns:
        Extracted intro text, or empty string if no good intro found
    """
    if not content:
        return ""

    # Skip patterns that indicate non-intro content
    skip_patterns = [
        r"^Table of Contents",
        r"^Subchapter \d+",
        r"^Chapter \d+",
        r"^Part \d+",
        r"^\d+\.\d+",  # Section numbers at start
        r"^History:",
        r"^Authority:",
        r"^Source:",
        r"^Amended:",
        r"^Effective:",
        r"^See:",
        r"^Note:",
        r"^\[Reserved\]",
        r"^Reserved",
    ]

    # Split into paragraphs
    paragraphs = content.split("\n\n")

    intro_parts = []
    chars_used = 0

    for para in paragraphs:
        para = para.strip()

        # Skip empty or very short paragraphs
        if len(para) < 20:
            continue

        # Check if this paragraph matches skip patterns
        should_skip = False
        for pattern in skip_patterns:
            if re.match(pattern, para, re.IGNORECASE):
                should_skip = True
                break

        if should_skip:
            continue

        # Skip paragraphs that look like TOC entries (many short lines)
        lines = para.split("\n")
        if len(lines) > 5 and all(len(line.strip()) < 60 for line in lines):
            continue

        # This looks like substantive content
        remaining = max_chars - chars_used
        if remaining <= 0:
            break

        if len(para) <= remaining:
            intro_parts.append(para)
            chars_used += len(para) + 2  # +2 for separator
        else:
            # Truncate at sentence boundary if possible
            truncated = para[:remaining]
            last_period = truncated.rfind(". ")
            if last_period > remaining // 2:
                truncated = truncated[: last_period + 1]
            intro_parts.append(truncated + "...")
            break

        # Usually one good paragraph is enough
        if chars_used > max_chars // 2:
            break

    return " ".join(intro_parts)


def build_ancestor_context(ancestors: list[dict]) -> str:
    """
    Build hierarchy breadcrumb string from ancestors list.

    Args:
        ancestors: List of ancestor dicts, ordered from immediate parent to root

    Returns:
        Formatted hierarchy string like:
        HIERARCHY:
        - Title 8: Health
          - Part 3: Health Facilities
            - Chapter 5: Long-Term Care Facilities
    """
    if not ancestors:
        return ""

    # Reverse to go from root to immediate parent
    ancestors_reversed = list(reversed(ancestors))

    lines = ["HIERARCHY:"]
    for i, ancestor in enumerate(ancestors_reversed):
        indent = "  " * i
        level = ancestor.get("hierarchy_level", "unknown")
        title = ancestor.get("title", "Untitled")

        # Use short_title if available and shorter
        short_title = ancestor.get("short_title")
        if short_title and len(short_title) < len(title):
            title = short_title

        # Truncate very long titles
        if len(title) > 60:
            title = title[:57] + "..."

        # Capitalize level name
        level_display = level.capitalize()

        lines.append(f"{indent}- {level_display}: {title}")

    return "\n".join(lines)


def build_section_prompt(
    section_doc: dict,
    ancestors: list[dict],
    sibling_summaries: list[tuple[str, str]],
    content: str,
) -> str:
    """
    Build prompt for section summarization with hierarchy and sibling context.

    Args:
        section_doc: The section document dict
        ancestors: List of ancestor documents
        sibling_summaries: List of (citation, summary) tuples for preceding siblings
        content: The section's content to summarize

    Returns:
        Formatted prompt string
    """
    parts = []

    # Add hierarchy context
    hierarchy_context = build_ancestor_context(ancestors)
    if hierarchy_context:
        parts.append(hierarchy_context)
        parts.append("")

    # Add sibling context if any
    if sibling_summaries:
        parts.append("PRECEDING SECTIONS IN THIS GROUP:")
        for citation, summary in sibling_summaries:
            # Truncate long summaries
            if len(summary) > 150:
                summary = summary[:147] + "..."
            parts.append(f"- {citation}: {summary}")
        parts.append("")

    # Add the current section
    citation = section_doc.get("citation", "")
    title = section_doc.get("title", "Untitled")

    if citation:
        parts.append(f"THIS SECTION ({citation}): {title}")
    else:
        parts.append(f"THIS SECTION: {title}")

    parts.append(content)

    return "\n".join(parts)


def build_parent_prompt(
    parent_doc: dict,
    ancestors: list[dict],
    child_summaries: list[tuple[str, str]],
    intro_text: str,
) -> str:
    """
    Build prompt for parent summarization with hierarchy and child context.

    Args:
        parent_doc: The parent document dict
        ancestors: List of ancestor documents (parent's ancestors)
        child_summaries: List of (citation, summary) tuples for children
        intro_text: Extracted intro text from parent's content

    Returns:
        Formatted prompt string
    """
    parts = []

    # Add hierarchy context
    hierarchy_context = build_ancestor_context(ancestors)
    if hierarchy_context:
        parts.append(hierarchy_context)
        parts.append("")

    # Add document info
    level = parent_doc.get("hierarchy_level", "document")
    citation = parent_doc.get("citation", "")
    title = parent_doc.get("title", "Untitled")

    if citation:
        parts.append(f"THIS {level.upper()} ({citation}): {title}")
    else:
        parts.append(f"THIS {level.upper()}: {title}")
    parts.append("")

    # Add intro text if available
    if intro_text:
        parts.append("DOCUMENT OVERVIEW:")
        parts.append(intro_text)
        parts.append("")

    # Add child summaries
    if child_summaries:
        parts.append("CHILD SECTION SUMMARIES:")
        for citation, summary in child_summaries:
            # Truncate long summaries
            if len(summary) > 150:
                summary = summary[:147] + "..."
            parts.append(f"- {citation}: {summary}")
        parts.append("")

    parts.append(f"Summarize this {level} based on its purpose and the requirements in its child sections.")

    return "\n".join(parts)


def should_skip_content(content: str, title: str = "") -> tuple[bool, Optional[str]]:
    """
    Check if content should be skipped (unparseable).

    Args:
        content: Document content
        title: Document title

    Returns:
        Tuple of (should_skip, reason)
        reason is one of: 'image_only', 'reserved', 'empty', None
    """
    if not content:
        return True, "empty"

    content_lower = content.lower().strip()
    title_lower = title.lower() if title else ""

    # Check for image-only content
    if "data in image" in content_lower:
        return True, "image_only"

    # Check for reserved sections
    if len(content) < 50:
        if "reserved" in content_lower or "[reserved]" in content_lower:
            return True, "reserved"

    # Check for effectively empty content
    if len(content) < 20:
        return True, "empty"

    # Check for just whitespace and punctuation
    stripped = content_lower.replace("\n", "").replace(" ", "")
    if stripped in ["", "reserved", "[reserved]"]:
        return True, "reserved"

    return False, None


def get_standard_summary(reason: str) -> str:
    """
    Get standard summary text for unparseable content.

    Args:
        reason: The unparseable reason ('image_only', 'reserved', 'empty')

    Returns:
        Standard summary text
    """
    summaries = {
        "image_only": "Contains tabular data or images not available as text.",
        "reserved": "Reserved section - no current requirements.",
        "empty": "No parseable content available.",
    }
    return summaries.get(reason, "No parseable content available.")
