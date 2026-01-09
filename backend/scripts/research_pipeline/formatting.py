"""
Centralized formatting functions for research pipeline prompts.

Consolidates similar formatting patterns from tier_runners.py into
reusable, generic formatters that reduce code duplication.

This module provides:
1. Generic list formatting (format_item_list)
2. Keyed/grouped summary formatting (format_keyed_summaries)
3. Match formatting for prompts (format_matches_for_tier1, format_matches_for_tier2)
4. Proactive context formatting (format_proactive_context)
5. Fetched context formatting (format_fetched_context)

All functions return strings suitable for prompt injection.
"""

from typing import TypeVar, Callable, Any, Optional

from .models.context import (
    ContextRequest,
    ProactiveTier1Context,
    SiblingSummary,
    CrossRefSummary,
    AncestorSummary,
    SiblingEntry,
    CrossRefEntry,
    AncestorEntry,
)
from .models.matches import MatchInfo


T = TypeVar('T')


# =============================================================================
# GENERIC LIST FORMATTERS
# =============================================================================


def format_item_list(
    items: list[T],
    extract_fn: Callable[[T], str],
    prefix: str = "- ",
    empty_message: str = "None",
    limit: int | None = None,
    overflow_message: str = "  ... and {count} more",
) -> str:
    """
    Generic list formatter for any list of items.

    Replaces:
    - format_sibling_titles()
    - format_crossref_citations()
    - format_ancestor_chain()
    - format_definition_terms() (partially)

    Args:
        items: List of items to format
        extract_fn: Function to extract display string from each item
        prefix: Prefix for each line (default "- ")
        empty_message: Message when list is empty
        limit: Max items to show (None for all)
        overflow_message: Message when list is truncated (use {count} for remaining)

    Returns:
        Formatted string with one item per line

    Examples:
        >>> siblings = [SiblingEntry(citation="1.1", title="First")]
        >>> format_item_list(siblings, lambda s: f"{s.citation}: {s.title}")
        '- 1.1: First'
    """
    if not items:
        return empty_message

    effective_limit = limit if limit is not None else len(items)
    lines = [f"{prefix}{extract_fn(item)}" for item in items[:effective_limit]]

    if limit is not None and len(items) > limit:
        lines.append(overflow_message.format(count=len(items) - limit))

    return "\n".join(lines)


def format_definition_terms(terms: list[str], limit: int = 15) -> str:
    """
    Format definition terms list as comma-separated string.

    Definitions are shown compactly (comma-separated) rather than as a list.

    Args:
        terms: List of definition terms
        limit: Max terms before truncation

    Returns:
        Comma-separated terms with overflow indicator
    """
    if not terms:
        return "(no applicable definitions)"

    if len(terms) <= limit:
        return ", ".join(terms)

    return ", ".join(terms[:limit]) + f" ... and {len(terms) - limit} more"


# =============================================================================
# CATALOG FORMATTERS (for Tier 1 context catalogs)
# =============================================================================


def format_sibling_titles(siblings: list[SiblingEntry], limit: int = 10) -> str:
    """
    Format sibling section titles for Tier 1 context catalog.

    Args:
        siblings: List of SiblingEntry objects
        limit: Max items to show

    Returns:
        Formatted list of citations and titles
    """
    if not siblings:
        return "(none)"

    return format_item_list(
        items=siblings,
        extract_fn=lambda s: f"{s.citation}: {s.title or '(untitled)'}",
        limit=limit,
    )


def format_crossref_citations(crossrefs: list[CrossRefEntry], limit: int = 10) -> str:
    """
    Format cross-reference citations for Tier 1 context catalog.

    Args:
        crossrefs: List of CrossRefEntry objects
        limit: Max items to show

    Returns:
        Formatted list with [definitions] markers where applicable
    """
    if not crossrefs:
        return "(none)"

    def format_xref(xref: CrossRefEntry) -> str:
        is_def = " [definitions]" if xref.is_definitions_section else ""
        title = xref.target_title or ""
        return f"{xref.citation}{is_def}: {title}"

    return format_item_list(
        items=crossrefs,
        extract_fn=format_xref,
        limit=limit,
    )


def format_ancestor_chain(ancestors: list[AncestorEntry]) -> str:
    """
    Format ancestor chain for hierarchy context.

    Shows the full ancestry from title down to parent section.

    Args:
        ancestors: List of AncestorEntry objects

    Returns:
        Formatted list with hierarchy levels
    """
    if not ancestors:
        return "(no ancestors)"

    return format_item_list(
        items=ancestors,
        extract_fn=lambda a: f"[{a.hierarchy_level or ''}] {a.citation}: {a.title or ''}",
    )


def format_catalog(items: list[Any], limit: int = 15) -> str:
    """
    Generic catalog formatter for sibling or cross-ref catalogs.

    This is a generic version used in batch context building.

    Args:
        items: List of SiblingEntry or CrossRefEntry objects
        limit: Max items to show

    Returns:
        Formatted catalog list
    """
    if not items:
        return "(none)"

    lines = []
    for item in items[:limit]:
        citation = getattr(item, 'citation', '')
        title = getattr(item, 'title', getattr(item, 'target_title', ''))
        lines.append(f"- {citation}: {title}")

    if len(items) > limit:
        lines.append(f"  ... and {len(items) - limit} more")

    return "\n".join(lines)


# =============================================================================
# SUMMARY FORMATTERS (for pre-fetched content)
# =============================================================================


def format_keyed_summaries(
    groups: dict[str, list[T]],
    format_fn: Callable[[T], str],
    key_label: str = "Category",
    empty_message: str = "(none)",
) -> str:
    """
    Format keyword-grouped summaries.

    Replaces:
    - _format_keyword_sibling_summaries()
    - _format_keyword_crossref_summaries()

    Args:
        groups: Dict mapping category -> list of items
        format_fn: Function to format each item
        key_label: Label for the grouping (for headers)
        empty_message: Message when no groups

    Returns:
        Formatted string with items grouped by key

    Example output:
        **Category: exemption**
        [formatted item 1]
        [formatted item 2]

        **Category: waiver**
        [formatted item 3]
    """
    if not groups:
        return empty_message

    parts = []
    for key, items in groups.items():
        if items:
            parts.append(f"**{key_label}: {key}**")
            for item in items:
                parts.append(format_fn(item))
            parts.append("")

    return "\n".join(parts) if parts else empty_message


def format_sibling_summaries(summaries: list[SiblingSummary], filter_reason: str | None = None) -> str:
    """
    Format sibling summaries for prompt injection.

    Args:
        summaries: List of SiblingSummary objects
        filter_reason: If provided, only include summaries with this reason

    Returns:
        Formatted string with citations, categories, and summaries
    """
    if filter_reason:
        summaries = [s for s in summaries if s.reason == filter_reason]

    if not summaries:
        return "(none pre-fetched)"

    lines = []
    for sib in summaries:
        fallback_note = " [excerpt]" if sib.is_fallback else ""
        # Match original format: [keyword: category] for keyword matches, [reason] otherwise
        reason_note = f"[{sib.reason}]"
        if sib.keyword_category:
            reason_note = f"[keyword: {sib.keyword_category}]"
        lines.append(f"**{sib.citation}** {reason_note}: {sib.title}")
        lines.append(f"Summary{fallback_note}: {sib.summary}")
        lines.append("")

    return "\n".join(lines)


def format_crossref_summaries(summaries: list[CrossRefSummary]) -> str:
    """
    Format cross-reference summaries for prompt injection.

    Args:
        summaries: List of CrossRefSummary objects

    Returns:
        Formatted string with citations and summaries
    """
    if not summaries:
        return "(none pre-fetched)"

    lines = []
    for cr in summaries:
        fallback_note = " [excerpt]" if cr.is_fallback else ""
        kw_note = f"[{cr.keyword_category}]" if cr.keyword_category else ""
        lines.append(f"**{cr.citation}** {kw_note}: {cr.target_title or ''}")
        lines.append(f"Summary{fallback_note}: {cr.summary}")
        lines.append("")

    return "\n".join(lines)


def format_ancestor_summaries(summaries: list[AncestorSummary]) -> str:
    """
    Format ancestor summaries for hierarchy context.

    Args:
        summaries: List of AncestorSummary objects

    Returns:
        Formatted string with hierarchy levels and summaries
    """
    if not summaries:
        return "(no ancestors)"

    lines = []
    for anc in summaries:
        fallback_note = " [excerpt]" if anc.is_fallback else ""
        lines.append(f"**[{anc.hierarchy_level}] {anc.citation}**: {anc.title}")
        lines.append(f"Summary{fallback_note}: {anc.summary}")
        lines.append("")

    return "\n".join(lines)


# =============================================================================
# MATCH FORMATTERS
# =============================================================================


def format_matches_for_tier1(matches: list[MatchInfo]) -> str:
    """
    Format matches for Tier 1 prompt.

    Shows numbered list with matched text and surrounding context.

    Args:
        matches: List of MatchInfo objects

    Returns:
        Formatted string with match details
    """
    if not matches:
        return "(no matches)"

    lines = []
    for i, match in enumerate(matches):
        lines.append(f"**Match {i}:**")
        lines.append(f"  Matched text: \"{match.matched_text}\"")
        lines.append(f"  Context: ...{match.surrounding_context}...")
        lines.append("")

    return "\n".join(lines)


def format_matches_for_tier2(matches: list[MatchInfo]) -> str:
    """
    Format relevant matches for Tier 2 prompt.

    Shows compact list of matches that passed Tier 1 filtering.

    Args:
        matches: List of MatchInfo objects (filtered by Tier 1)

    Returns:
        Formatted compact list of matches
    """
    if not matches:
        return "(no relevant matches)"

    lines = []
    for match in matches:
        lines.append(f"- \"{match.matched_text}\" (at position {match.position_start})")

    return "\n".join(lines)


# =============================================================================
# IMMEDIATE SIBLINGS FORMATTER
# =============================================================================


def format_immediate_siblings(siblings: dict) -> str:
    """
    Format immediate siblings (prev/next) for Tier 1.

    Args:
        siblings: Dict with 'prev' and 'next' SiblingEntry objects

    Returns:
        Formatted string showing previous and next sections
    """
    lines = []

    prev = siblings.get('prev')
    if prev:
        lines.append(f"**Previous Section:** {prev.citation}")
        if prev.title:
            lines.append(f"  Title: {prev.title}")
        if prev.summary:
            lines.append(f"  Summary: {prev.summary}")
        lines.append("")

    next_sib = siblings.get('next')
    if next_sib:
        lines.append(f"**Next Section:** {next_sib.citation}")
        if next_sib.title:
            lines.append(f"  Title: {next_sib.title}")
        if next_sib.summary:
            lines.append(f"  Summary: {next_sib.summary}")

    if not lines:
        return "(no immediate siblings found)"

    return "\n".join(lines)


# =============================================================================
# DEFINITIONS FORMATTER
# =============================================================================


def format_definitions(definitions: list[dict]) -> str:
    """
    Format definitions with text for Tier 2/3.

    Definitions come from context_builder.get_definitions_with_text_batch()
    which returns 'verbatim_text' and 'rephrased_definition' fields.
    Uses rephrased_definition if available, falls back to verbatim_text.

    Args:
        definitions: List of definition dicts with term and text

    Returns:
        Formatted string with term and definition pairs
    """
    if not definitions:
        return "(no applicable definitions)"

    lines = []
    for defn in definitions:
        term = defn.get('term', '')
        # Use rephrased_definition if available, fall back to verbatim_text
        definition = defn.get('rephrased_definition') or defn.get('verbatim_text', '')
        lines.append(f"**{term}**: {definition}")

    return "\n\n".join(lines)


# =============================================================================
# PROACTIVE CONTEXT FORMATTER (V5)
# =============================================================================


def format_proactive_context(ctx: ProactiveTier1Context) -> str:
    """
    Format V5 proactive context for Tier 1 prompt injection.

    This formats the pre-fetched summaries and catalogs into a structured
    text block that helps Tier 1 understand the document's regulatory context.

    Args:
        ctx: ProactiveTier1Context with pre-fetched summaries and catalogs

    Returns:
        Formatted string for prompt injection
    """
    parts: list[str] = []

    # Ancestor summaries (scope context)
    if ctx.ancestor_summaries:
        parts.append("## Hierarchy Context (Scope)")
        parts.append("")
        parts.append(format_ancestor_summaries(ctx.ancestor_summaries))

    # Pre-fetched sibling summaries
    if ctx.sibling_summaries:
        parts.append("## Pre-Fetched Sibling Summaries")
        parts.append("")
        parts.append(format_sibling_summaries(ctx.sibling_summaries))

    # Pre-fetched cross-ref summaries
    if ctx.cross_ref_summaries:
        parts.append("## Pre-Fetched Cross-Reference Summaries")
        parts.append("")
        parts.append(format_crossref_summaries(ctx.cross_ref_summaries))

    # Sibling catalog for recommendations (show first 15, indicate more)
    if ctx.sibling_catalog:
        parts.append("## Available Siblings (for recommendations)")
        truncated = " (truncated)" if ctx.sibling_catalog_truncated else ""
        parts.append(f"*{len(ctx.sibling_catalog)} siblings available{truncated}*")
        parts.append("")
        parts.append(format_catalog(ctx.sibling_catalog, limit=15))
        parts.append("")

    # Cross-ref catalog for recommendations (show first 15, indicate more)
    if ctx.cross_ref_catalog:
        parts.append("## Available Cross-References (for recommendations)")
        truncated = " (truncated)" if ctx.cross_ref_catalog_truncated else ""
        parts.append(f"*{len(ctx.cross_ref_catalog)} cross-refs available{truncated}*")
        parts.append("")
        parts.append(format_catalog(ctx.cross_ref_catalog, limit=15))
        parts.append("")

    # Definition terms (compact display)
    if ctx.definition_terms:
        parts.append("## Available Definitions")
        parts.append(format_definition_terms(ctx.definition_terms, limit=20))
        parts.append("")

    return "\n".join(parts)


# =============================================================================
# FETCHED CONTEXT FORMATTER (Tier 2/3)
# =============================================================================


def format_fetched_context(
    context: dict[str, str],
    requests: list[ContextRequest],
) -> str:
    """
    Format fetched context for injection into Tier 2 prompt.

    Groups content by context_type and includes the reason for each request.

    Args:
        context: Dict mapping identifiers to fetched content
        requests: Original ContextRequest objects (for metadata)

    Returns:
        Formatted string for prompt injection
    """
    if not context:
        return "(no additional context fetched)"

    # Build request map for metadata lookup
    req_map = {r.identifier: r for r in requests}

    # Group by context_type for readability
    by_type: dict[str, list[tuple[str, str, str, str]]] = {}

    for identifier, content in context.items():
        req = req_map.get(identifier)
        ctx_type = req.context_type if req else "unknown"
        reason = req.reason if req else ""
        need_level = req.need_level if req else "summary"

        if ctx_type not in by_type:
            by_type[ctx_type] = []
        by_type[ctx_type].append((identifier, content, reason, need_level))

    # Format output grouped by type
    lines = []
    type_order = ["sibling", "cross_reference", "definition", "hierarchy", "unknown"]
    for ctx_type in type_order:
        if ctx_type not in by_type:
            continue
        items = by_type[ctx_type]

        # Format section header
        type_label = ctx_type.replace("_", " ").title()
        if not type_label.endswith("s"):
            type_label += "s"
        lines.append(f"### {type_label}")

        for identifier, content, reason, need_level in items:
            level_tag = "[full text]" if need_level == "full_text" else "[summary]"
            lines.append(f"\n**{identifier}** {level_tag}")
            if reason:
                lines.append(f"*Reason: {reason}*")
            lines.append(content)

        lines.append("")

    return "\n".join(lines)


# =============================================================================
# TIER 1 ARGUMENT FORMATTER
# =============================================================================


def format_tier1_argument(argument: Optional[str]) -> str:
    """Format a single Tier 1 argument for Tier 2 prompt."""
    if not argument:
        return "(not provided)"
    return argument


# =============================================================================
# TIER 2 CONTEXT SUMMARY FORMATTER (for Tier 3)
# =============================================================================


def format_context_used_summary(context_used: list) -> str:
    """
    Format Tier 2's context_used list as a readable summary for Tier 3.

    Converts the list of ContextEntryLLM objects (or dicts) into a formatted
    summary that helps Tier 3 understand what context informed Tier 2's decision.

    Args:
        context_used: List of ContextEntryLLM from Tier 2 output (or dicts)

    Returns:
        Formatted string summarizing the context that informed Tier 2's decision
    """
    if not context_used:
        return "(no context was cited)"

    sections = []
    for entry in context_used:
        # Handle both Pydantic models and dicts
        ctx_type = entry.type if hasattr(entry, 'type') else entry.get('type', 'unknown')
        identifier = entry.identifier if hasattr(entry, 'identifier') else entry.get('identifier', '')
        quote = entry.quote if hasattr(entry, 'quote') else entry.get('quote', '')
        relevance = entry.relevance if hasattr(entry, 'relevance') else entry.get('relevance', '')

        section = f"- **{ctx_type}**: {identifier}"
        if quote:
            # Truncate long quotes
            truncated = quote[:100] + '...' if len(quote) > 100 else quote
            section += f"\n  > \"{truncated}\""
        if relevance:
            section += f"\n  Relevance: {relevance}"
        sections.append(section)

    return "\n".join(sections)
