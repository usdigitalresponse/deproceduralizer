"""Prompts for Haiku batch summarization.

Separates system prompt (cached across batch) from user prompts (per-document).
"""

from typing import Optional

# System prompt - cached across all batch requests via Anthropic's prompt caching
SUMMARIZATION_SYSTEM = """You are a regulatory document analyzer. For each section, provide:

1. **summary** (3-5 sentences, 80-120 words):
   - START WITH THE ACTION OR EFFECT, not "This regulation" or "This section"
     Examples: "Limits...", "Requires...", "Establishes...", "Prohibits..."
   - Capture the PURPOSE, specific requirements/standards, and who must comply
   - Include specific numbers, deadlines, or thresholds when present
   - For RESERVED sections: "Reserved - no current requirements."
   - For image-only content: "Contains tabular data not available as text."

2. **section_type** (one of):
   - definitions: Defines terms for the chapter
   - requirements: Mandatory obligations ("shall", "must") - what must be done
   - procedures: Step-by-step processes (filing, hearings, appeals, how to apply)
   - prohibitions: Things not allowed ("shall not", unfair practices)
   - standards: Technical specifications, acceptable methods/items, equipment requirements
   - eligibility: Who qualifies (age, experience, licensing requirements)
   - penalties: Fines, sanctions, disqualifications
   - fees: Fee schedules, payment amounts
   - forms: Form templates or form requirements
   - reporting: Reporting obligations and deadlines
   - purpose: Why the regulation exists, legislative intent, goals
   - scope: Applicability, who/what rules apply to, what's covered
   - exemptions: Exceptions, waivers, exclusions
   - reserved: Empty placeholder, repealed, or recodified
   - other: Use when none of the above categories fit

3. **keywords** (3-5 searchable terms): Key concepts, programs, or subjects covered

4. **applies_to** (list): Who must comply - e.g., "licensees", "employers", "facilities", "applicants", "municipalities", "contractors"

5. **has_form**: true if the section references or contains a specific form

6. **has_incorporation_by_reference**: true ONLY if the section incorporates external non-governmental standards by reference. Examples that ARE incorporation by reference:
   - International Building Code, International Fire Code
   - ASTM, ANSI, NFPA, UL, ISO standards
   - ASHRAE standards, Uniform Plumbing Code
   - Industry compacts, professional association standards (AICPA, AMA)

   Examples that are NOT incorporation by reference (these are just citations):
   - Federal regulations (CFR, USC)
   - State statutes (N.J.S.A.)
   - Other state regulations (N.J.A.C.)
"""


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


def build_section_user_prompt(
    section_doc: dict,
    ancestors: list[dict],
    sibling_summaries: list[tuple[str, str]],
    content: str,
) -> str:
    """
    Build user prompt for section summarization.

    Args:
        section_doc: The section document dict
        ancestors: List of ancestor documents
        sibling_summaries: List of (citation, summary) tuples for preceding siblings
        content: The section's content to summarize

    Returns:
        Formatted user prompt string (system prompt is separate)
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

    parts.append("")
    parts.append(content)
    parts.append("")
    parts.append("Summarize this section.")

    return "\n".join(parts)


def build_parent_user_prompt(
    parent_doc: dict,
    ancestors: list[dict],
    child_summaries: list[tuple[str, str]],
    intro_text: str,
) -> str:
    """
    Build user prompt for parent summarization.

    Args:
        parent_doc: The parent document dict
        ancestors: List of ancestor documents (parent's ancestors)
        child_summaries: List of (citation, summary) tuples for children
        intro_text: Extracted intro text from parent's content

    Returns:
        Formatted user prompt string (system prompt is separate)
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
        reason is one of: 'image_only', 'reserved', 'repealed', 'empty', None
    """
    if not content:
        return True, "empty"

    content_lower = content.lower().strip()

    # Check for image-only content
    if "data in image" in content_lower:
        return True, "image_only"

    # Check for reserved/repealed sections by title pattern + short content
    # These are placeholder sections with no substantive content
    if len(content) < 200:
        if title.endswith(" - Reserved"):
            return True, "reserved"
        if title.endswith(" - Repealed"):
            return True, "repealed"

    # Check for reserved sections by content
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


# Standard summaries for skipped content (no LLM call needed)
STANDARD_SUMMARIES = {
    "image_only": "Contains tabular data not available as text.",
    "reserved": "Reserved - no current requirements.",
    "repealed": "Repealed - no longer in effect.",
    "empty": "No parseable content available.",
}


def get_standard_summary(reason: str) -> str:
    """Get standard summary text for unparseable content."""
    return STANDARD_SUMMARIES.get(reason, "No parseable content available.")
