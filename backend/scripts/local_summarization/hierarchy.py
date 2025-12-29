"""Hierarchy traversal and sibling grouping for bottom-up summarization."""

from typing import Optional

from db_queries import (
    get_documents_by_level,
    get_hierarchy_levels,
    get_document_counts_by_level,
    get_sections_grouped_by_parent,
    get_child_ids,
)

# Standard hierarchy order for bottom-up processing
# Process from most specific (sections) to most general (titles)
HIERARCHY_ORDER = [
    "section",
    "subchapter",
    "chapter",
    "subpart",
    "part",
    "subtitle",
    "title",
]


def get_processing_order(
    state: str,
    title: Optional[str] = None,
) -> list[tuple[str, list[dict]]]:
    """
    Get documents grouped by level, in bottom-up order for processing.

    Returns list of (level_name, documents) tuples, starting with sections
    and moving up to titles.

    Args:
        state: State code
        title: Optional title number filter

    Returns:
        List of (level, docs) tuples in bottom-up order
    """
    # Get what levels actually exist in the data
    existing_levels = set(get_hierarchy_levels(state, title))

    # Build ordered list of levels that exist
    processing_order = []
    for level in HIERARCHY_ORDER:
        if level in existing_levels:
            docs = get_documents_by_level(state, level, title)
            if docs:
                processing_order.append((level, docs))

    return processing_order


def get_phase_info(
    state: str,
    title: Optional[str] = None,
) -> list[dict]:
    """
    Get information about each phase for progress display.

    Returns:
        List of dicts with level, count, and phase number
    """
    counts = get_document_counts_by_level(state, title)
    existing_levels = set(counts.keys())

    phases = []
    phase_num = 1
    for level in HIERARCHY_ORDER:
        if level in existing_levels:
            phases.append({
                "phase": phase_num,
                "level": level,
                "count": counts[level],
            })
            phase_num += 1

    return phases


def get_sibling_context(
    current_doc: dict,
    siblings: list[dict],
    summaries_cache: dict[int, str],
    max_chars: int = 800,
) -> list[tuple[str, str]]:
    """
    Get summaries of preceding siblings (same parent, earlier in citation order).

    Args:
        current_doc: The document being processed
        siblings: All siblings (same parent), ordered by citation
        summaries_cache: Dict mapping document_id to summary text
        max_chars: Maximum total characters for sibling summaries

    Returns:
        List of (citation, summary) tuples for preceding siblings
    """
    current_id = current_doc["id"]

    preceding = []
    total_chars = 0

    for sibling in siblings:
        # Stop when we reach the current document
        if sibling["id"] == current_id:
            break

        sibling_id = sibling["id"]
        sibling_citation = sibling.get("citation") or f"ID:{sibling_id}"

        # Check if we have a summary for this sibling
        if sibling_id in summaries_cache:
            summary = summaries_cache[sibling_id]
            if summary is None:
                continue

            # Check if adding this would exceed limit
            entry_len = len(sibling_citation) + len(summary) + 10  # overhead
            if total_chars + entry_len > max_chars:
                break

            preceding.append((sibling_citation, summary))
            total_chars += entry_len

    return preceding


def get_children_context(
    parent_id: int,
    children_docs: list[dict],
    summaries_cache: dict[int, str],
    max_chars: int = 1500,
) -> list[tuple[str, str]]:
    """
    Get summaries of all children from the cache.

    Prioritizes substantive summaries over "reserved" ones.

    Args:
        parent_id: The parent document's ID
        children_docs: List of child documents (for citation info)
        summaries_cache: Dict mapping document_id to summary text
        max_chars: Maximum total characters for child summaries

    Returns:
        List of (citation, summary) tuples for children
    """
    # Separate substantive vs reserved summaries
    substantive = []
    reserved = []

    for child in children_docs:
        child_id = child["id"]
        child_citation = child.get("citation") or f"ID:{child_id}"

        if child_id in summaries_cache:
            summary = summaries_cache[child_id]
            if summary is None:
                continue

            # Check if this is a "reserved" or empty summary
            summary_lower = summary.lower()
            is_reserved = (
                "reserved section" in summary_lower
                or "no current requirements" in summary_lower
                or "no parseable content" in summary_lower
            )

            if is_reserved:
                reserved.append((child_citation, summary))
            else:
                substantive.append((child_citation, summary))

    # Prioritize substantive summaries, then add reserved if space
    children = []
    total_chars = 0

    # First add all substantive summaries
    for citation, summary in substantive:
        entry_len = len(citation) + len(summary) + 10
        if total_chars + entry_len > max_chars:
            remaining = len(substantive) + len(reserved) - len(children)
            if remaining > 0:
                children.append(("...", f"[{remaining} more sections truncated]"))
            break
        children.append((citation, summary))
        total_chars += entry_len

    # Then add reserved summaries if there's space and we have few substantive
    if len(substantive) < 2 and reserved:
        for citation, summary in reserved:
            entry_len = len(citation) + len(summary) + 10
            if total_chars + entry_len > max_chars:
                break
            children.append((citation, summary))
            total_chars += entry_len

    # If ALL children are reserved, note that
    if not substantive and reserved:
        # Just include a summary note instead of listing all reserved
        children = [("Note", f"All {len(reserved)} child sections are reserved or have no current requirements.")]

    return children


def determine_leaf_level(state: str, title: Optional[str] = None) -> str:
    """
    Determine which hierarchy level is the leaf (most granular) for this data.

    Usually 'section', but some titles might have different structures.
    """
    counts = get_document_counts_by_level(state, title)

    for level in HIERARCHY_ORDER:
        if level in counts and counts[level] > 0:
            return level

    return "section"  # Default


def is_parent_level(level: str) -> bool:
    """Check if this level typically has children (is not a leaf)."""
    # Sections are typically leaves, everything else is a parent
    return level != "section"


def get_context_limits(level: str) -> dict:
    """
    Get character limits for context at each level.

    Returns dict with:
        - intro_chars: Max chars for parent's intro text
        - children_chars: Max chars for child summaries
        - siblings_chars: Max chars for sibling summaries (sections only)
    """
    limits = {
        "section": {
            "intro_chars": 0,  # Sections don't use intro
            "children_chars": 0,  # Sections don't have children summaries
            "siblings_chars": 800,  # But they do get sibling context
        },
        "subchapter": {
            "intro_chars": 300,
            "children_chars": 1000,
            "siblings_chars": 0,
        },
        "chapter": {
            "intro_chars": 500,
            "children_chars": 1500,
            "siblings_chars": 0,
        },
        "subpart": {
            "intro_chars": 500,
            "children_chars": 1500,
            "siblings_chars": 0,
        },
        "part": {
            "intro_chars": 500,
            "children_chars": 2000,
            "siblings_chars": 0,
        },
        "subtitle": {
            "intro_chars": 400,
            "children_chars": 2000,
            "siblings_chars": 0,
        },
        "title": {
            "intro_chars": 300,
            "children_chars": 2500,
            "siblings_chars": 0,
        },
    }

    return limits.get(level, {
        "intro_chars": 500,
        "children_chars": 1500,
        "siblings_chars": 0,
    })
