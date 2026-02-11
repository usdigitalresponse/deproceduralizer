"""Context building for hierarchical summarization."""

import re


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
