"""
V5 Proactive Context Functions.

This module contains the V5 proactive context building functions that
pre-fetch high-value summaries based on keyword matching instead of
waiting for the LLM to request them.

The core principle: Don't ask the model what it needs. Give it what it
would need if it asked.
"""

from typing import Optional
import sys
from pathlib import Path

# Add backend to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

# Import Pydantic models
from scripts.research_pipeline.models.context import (
    SiblingEntry,
    CrossRefEntry,
    SiblingSummary,
    CrossRefSummary,
    AncestorSummary,
    ProactiveTier1Context,
)

# Import query functions from this package
from .queries import (
    get_sibling_summaries_batch,
    get_immediate_siblings_batch,
    get_crossrefs_batch,
    get_ancestor_entries_batch,
    get_definitions_batch,
    get_subchapter_info,
    get_children_of_parent,
    get_definitions_for_scope,
)

# Import raw ancestors function for optimization
from lib.db import get_ancestors_batch

# Import fetcher (will be created next)
# We need to import it dynamically to avoid circular imports
def _get_fetch_document_content_batch():
    from .fetchers import fetch_document_content_batch
    return fetch_document_content_batch


# =============================================================================
# V5 Proactive Context Configuration
# =============================================================================

# Keyword categories for proactive filtering (ordered by priority)
# When a sibling/cross-ref title contains these keywords, we pre-fetch its summary
SIBLING_KEYWORDS: dict[str, list[str]] = {
    "exemption": [
        "exempt", "exemption", "exemptions",
        "waiver", "waivers",
        "exception", "exceptions",
        "exclusion", "exclusions",
        "not apply", "does not apply",
        "inapplicable",
    ],
    "alternatives": [
        "electronic", "electronically",
        "online",
        "digital", "digitally",
        "remote", "remotely",
        "virtual", "virtually",
        "alternative", "alternatives",
        "substitute", "substitution",
    ],
    "scope": [
        "applicability",
        "scope",
        "general provisions",
        "purpose",
        "application",
    ],
    "enforcement": [
        "enforcement",
        "penalty", "penalties",
        "violation", "violations",
        "fine", "fines",
        "sanction", "sanctions",
        "compliance", "noncompliance",
    ],
}

# Priority order - exemptions first (most likely to be false positive signals)
KEYWORD_PRIORITY: list[str] = ["exemption", "alternatives", "scope", "enforcement"]

# Cross-refs use the same keyword categories
CROSS_REF_KEYWORDS = SIBLING_KEYWORDS

# Sections to EXCLUDE from automatic summary fetching
# These are structural sections that rarely contain actionable context
EXCLUDABLE_PATTERNS: list[str] = [
    "definitions", "defined terms",
    "table of contents", "contents",
    "reserved", "repealed",
    "appendix", "appendices",
]

# Size limits for V5 proactive context
MAX_SUMMARIES = 20  # Siblings + cross-refs combined (ancestors excluded)
MAX_SIBLING_CATALOG = 50
MAX_CROSS_REF_CATALOG = 100
SUMMARY_FALLBACK_LENGTH = 500


# =============================================================================
# V5 Helper Functions
# =============================================================================


def is_excludable(title: Optional[str]) -> bool:
    """
    Check if title matches excludable patterns (definitions, TOC, etc.).

    These sections are structural and rarely contain actionable context
    for regulatory burden analysis, so we skip them in automatic
    summary fetching to save tokens.

    Args:
        title: Section title to check

    Returns:
        True if the section should be excluded from summary fetching
    """
    if not title:
        return True  # Empty/None titles are excludable
    title_lower = title.lower()
    return any(pattern in title_lower for pattern in EXCLUDABLE_PATTERNS)


def get_keyword_category(title: Optional[str]) -> Optional[str]:
    """
    Return the highest-priority keyword category that matches the title.

    Checks categories in priority order (exemption > alternatives > scope > enforcement)
    and returns the first match. This ensures exemption sections are prioritized
    over alternatives, etc.

    Args:
        title: Section title to check

    Returns:
        Category name ('exemption', 'alternatives', 'scope', 'enforcement') or None
    """
    if not title:
        return None
    title_lower = title.lower()
    for category in KEYWORD_PRIORITY:
        keywords = SIBLING_KEYWORDS.get(category, [])
        if any(kw in title_lower for kw in keywords):
            return category
    return None


def get_summary_or_fallback(
    summary: Optional[str],
    content: Optional[str],
    title: str,
) -> tuple[str, bool]:
    """
    Return (summary_text, is_fallback) using 3-tier fallback strategy.

    Fallback order:
    1. Use summary if exists and substantive (>10 chars)
    2. Use truncated content with sentence boundary detection
    3. Use title only as last resort

    The is_fallback flag lets the LLM know when it's getting an excerpt
    vs a proper summary, which affects interpretation confidence.

    Args:
        summary: Document summary (may be None or empty)
        content: Full document content (may be None or empty)
        title: Document title (always available)

    Returns:
        Tuple of (summary_text, is_fallback)
    """
    # Option 1: Use summary if substantive
    if summary and len(summary.strip()) > 10:
        return summary.strip(), False

    # Option 2: Use truncated content with sentence boundary detection
    if content and len(content.strip()) > 50:
        excerpt = content[:SUMMARY_FALLBACK_LENGTH].strip()
        # Try to break at sentence boundary for cleaner excerpt
        last_period = excerpt.rfind('.')
        if last_period > SUMMARY_FALLBACK_LENGTH // 2:
            excerpt = excerpt[:last_period + 1]
        return f"[Excerpt]: {excerpt}", True

    # Option 3: Title only
    return f"[Title only]: {title}", True


def prioritize_summaries(
    doc_id: int,
    siblings: list[SiblingEntry],
    cross_refs: list[CrossRefEntry],
    immediate_siblings: dict[str, Optional[SiblingEntry]],
) -> list[tuple[str, int, str, Optional[str]]]:
    """
    Select summaries to fetch in priority order for V5 proactive context.

    Priority order:
    1. Preceding sibling (unless excludable)
    2. Following sibling (unless excludable)
    3. Keyword-matched siblings (sorted by category priority)
    4. Keyword-matched cross-refs (deduplicated against siblings)

    Returns list of (item_type, target_id, reason, keyword_category) tuples,
    limited to MAX_SUMMARIES total.

    Args:
        doc_id: The source document ID
        siblings: All sibling entries for the document
        cross_refs: All cross-reference entries for the document
        immediate_siblings: Dict with 'prev' and 'next' sibling entries

    Returns:
        List of (item_type, target_id, reason, keyword_category) tuples
    """
    items: list[tuple[str, int, str, Optional[str]]] = []
    added_ids: set[int] = set()

    def add_if_new(
        item_type: str, target_id: int, reason: str, category: Optional[str]
    ) -> bool:
        """Add item if not duplicate and under limit. Returns True if added."""
        if target_id in added_ids:
            return False
        if len(items) >= MAX_SUMMARIES:
            return False
        items.append((item_type, target_id, reason, category))
        added_ids.add(target_id)
        return True

    # Priority 1: Preceding sibling
    prev_sib = immediate_siblings.get("prev")
    if prev_sib and not is_excludable(prev_sib.title):
        add_if_new("sibling", prev_sib.document_id, "preceding", None)

    # Priority 2: Following sibling
    next_sib = immediate_siblings.get("next")
    if next_sib and not is_excludable(next_sib.title):
        add_if_new("sibling", next_sib.document_id, "following", None)

    # Priority 3: Keyword-matched siblings
    # Build list with (sibling, category, priority_index) then sort
    keyword_siblings: list[tuple[SiblingEntry, str, int]] = []
    for sib in siblings:
        if sib.document_id == doc_id:
            continue  # Skip self
        if is_excludable(sib.title):
            continue
        category = get_keyword_category(sib.title)
        if category:
            priority_idx = KEYWORD_PRIORITY.index(category)
            keyword_siblings.append((sib, category, priority_idx))

    # Sort by priority (lower index = higher priority)
    keyword_siblings.sort(key=lambda x: x[2])
    for sib, category, _ in keyword_siblings:
        add_if_new("sibling", sib.document_id, "keyword", category)

    # Priority 4: Keyword-matched cross-refs (deduplicated against siblings)
    keyword_cross_refs: list[tuple[CrossRefEntry, str, int]] = []
    for cr in cross_refs:
        if is_excludable(cr.target_title):
            continue
        category = get_keyword_category(cr.target_title)
        if category:
            priority_idx = KEYWORD_PRIORITY.index(category)
            keyword_cross_refs.append((cr, category, priority_idx))

    keyword_cross_refs.sort(key=lambda x: x[2])
    for cr, category, _ in keyword_cross_refs:
        add_if_new("cross_ref", cr.target_id, "keyword", category)

    return items


# =============================================================================
# V5 Proactive Context Builder
# =============================================================================


def build_proactive_context(
    document_ids: list[int],
) -> dict[int, ProactiveTier1Context]:
    """
    Build V5 proactive context for Tier 1.

    This is the V5 entry point - proactively fetches high-value summaries
    based on keyword matching instead of waiting for LLM to request them.

    The core principle: Don't ask the model what it needs. Give it what it
    would need if it asked.

    4-phase process:
    1. Batch fetch all metadata (siblings, cross-refs, ancestors, definitions)
    2. Priority selection for each doc (max 20 summaries per doc)
    3. Batch fetch content for all selected docs
    4. Assemble ProactiveTier1Context for each doc

    Summary selection priority:
    1. Preceding sibling (unless excludable)
    2. Following sibling (unless excludable)
    3. Keyword-matched siblings (exemption > alternatives > scope > enforcement)
    4. Keyword-matched cross-refs (deduplicated against siblings)

    Ancestors are NOT counted toward the 20-summary limit.

    Args:
        document_ids: List of document IDs to build context for

    Returns:
        Dict mapping doc_id -> ProactiveTier1Context
    """
    if not document_ids:
        return {}

    # Get the fetcher function (deferred import to avoid circular dependency)
    fetch_document_content_batch = _get_fetch_document_content_batch()

    # =========================================================================
    # PHASE 1: METADATA COLLECTION
    # =========================================================================
    # Batch fetch all metadata types in parallel-ish (sequential SQL but batched)
    siblings_map = get_sibling_summaries_batch(document_ids)
    immediate_map = get_immediate_siblings_batch(document_ids)
    crossrefs_map = get_crossrefs_batch(document_ids)

    # OPTIMIZATION: Fetch raw ancestors once, reuse for ancestor entries AND definitions
    raw_ancestors = get_ancestors_batch(document_ids)
    ancestors_map = get_ancestor_entries_batch(document_ids, raw_ancestors_map=raw_ancestors)
    definitions_map = get_definitions_batch(document_ids, ancestors_map=raw_ancestors)

    # =========================================================================
    # PHASE 2: PRIORITY SELECTION
    # =========================================================================
    # For each document, select which items need content fetching
    docs_needing_content: set[int] = set()
    priority_selections: dict[int, list[tuple[str, int, str, Optional[str]]]] = {}

    for doc_id in document_ids:
        siblings = siblings_map.get(doc_id, [])
        immediate = immediate_map.get(doc_id, {"prev": None, "next": None})
        cross_refs = crossrefs_map.get(doc_id, [])
        ancestors = ancestors_map.get(doc_id, [])

        # Select priority items (max 20)
        selections = prioritize_summaries(doc_id, siblings, cross_refs, immediate)
        priority_selections[doc_id] = selections

        # Collect all doc IDs that need content fetching
        for _, target_id, _, _ in selections:
            docs_needing_content.add(target_id)

        # Also need ancestor content (not counted toward 20 limit)
        for ancestor in ancestors:
            docs_needing_content.add(ancestor.document_id)

    # =========================================================================
    # PHASE 3: CONTENT FETCH (single batch query)
    # =========================================================================
    # Fetch content/summary for all needed documents in one query
    content_map = fetch_document_content_batch(list(docs_needing_content))

    # =========================================================================
    # PHASE 4: ASSEMBLY
    # =========================================================================
    result: dict[int, ProactiveTier1Context] = {}

    for doc_id in document_ids:
        siblings = siblings_map.get(doc_id, [])
        cross_refs = crossrefs_map.get(doc_id, [])
        ancestors = ancestors_map.get(doc_id, [])
        definitions = definitions_map.get(doc_id, [])
        selections = priority_selections.get(doc_id, [])

        # Build sibling and cross-ref summaries from selections
        sibling_summaries: list[SiblingSummary] = []
        cross_ref_summaries: list[CrossRefSummary] = []

        for item_type, target_id, reason, category in selections:
            data = content_map.get(target_id, {})
            summary_text, is_fallback = get_summary_or_fallback(
                data.get("summary"),
                data.get("content"),
                data.get("title", "Unknown"),
            )

            if item_type == "sibling":
                sibling_summaries.append(SiblingSummary(
                    document_id=target_id,
                    citation=data.get("citation", ""),
                    title=data.get("title", ""),
                    summary=summary_text,
                    is_fallback=is_fallback,
                    reason=reason,  # type: ignore - Literal type mismatch OK
                    keyword_category=category,
                ))
            else:  # cross_ref
                cross_ref_summaries.append(CrossRefSummary(
                    target_id=target_id,
                    citation=data.get("citation", ""),
                    target_title=data.get("title"),
                    summary=summary_text,
                    is_fallback=is_fallback,
                    keyword_category=category,
                ))

        # Build ancestor summaries (no limit)
        ancestor_summaries: list[AncestorSummary] = []
        for ancestor in ancestors:
            data = content_map.get(ancestor.document_id, {})
            summary_text, is_fallback = get_summary_or_fallback(
                data.get("summary"),
                data.get("content"),
                ancestor.title,
            )
            ancestor_summaries.append(AncestorSummary(
                document_id=ancestor.document_id,
                citation=ancestor.citation,
                title=ancestor.title,
                hierarchy_level=ancestor.hierarchy_level,
                summary=summary_text,
                is_fallback=is_fallback,
            ))

        # Build catalogs with size limits
        sibling_catalog = siblings[:MAX_SIBLING_CATALOG]
        cross_ref_catalog = cross_refs[:MAX_CROSS_REF_CATALOG]

        result[doc_id] = ProactiveTier1Context(
            sibling_summaries=sibling_summaries,
            cross_ref_summaries=cross_ref_summaries,
            ancestor_summaries=ancestor_summaries,
            sibling_catalog=sibling_catalog,
            cross_ref_catalog=cross_ref_catalog,
            definition_terms=definitions,
            sibling_catalog_truncated=len(siblings) > MAX_SIBLING_CATALOG,
            cross_ref_catalog_truncated=len(cross_refs) > MAX_CROSS_REF_CATALOG,
        )

    return result


# =============================================================================
# V5 Batch Context Builder (for 4-layer caching)
# =============================================================================


def build_batch_context_for_subchapter(
    subchapter_id: int,
    issue_type: Optional[str] = None,
) -> dict[str, str]:
    """
    Build the batch context variables shared by all documents in a subchapter.

    This is used for 4-layer prompt caching. All documents in the same subchapter
    share the same:
    - Ancestor summaries (title -> chapter -> subchapter)
    - Sibling catalog (all sections in the subchapter)
    - Keyword-matched sibling summaries
    - Definition terms

    The returned dict has keys matching batch_context template placeholders:
    - subchapter_citation
    - ancestor_summaries
    - sibling_catalog, sibling_count, sibling_catalog_truncated
    - keyword_sibling_summaries
    - definition_terms

    Args:
        subchapter_id: The subchapter (or chapter) document ID
        issue_type: Optional issue type for keyword filtering

    Returns:
        Dict with formatted string values for batch_context placeholders
    """
    # Get the fetcher function (deferred import to avoid circular dependency)
    fetch_document_content_batch = _get_fetch_document_content_batch()

    # Get subchapter info
    subchapter_info = get_subchapter_info(subchapter_id)

    # Get ancestors
    ancestors_map = get_ancestor_entries_batch([subchapter_id])
    ancestors = ancestors_map.get(subchapter_id, [])

    # Format ancestor summaries
    if ancestors:
        content_map = fetch_document_content_batch([a.document_id for a in ancestors])
        ancestor_lines: list[str] = []
        for ancestor in ancestors:
            data = content_map.get(ancestor.document_id, {})
            summary_text, _ = get_summary_or_fallback(
                data.get("summary"),
                data.get("content"),
                ancestor.title,
            )
            ancestor_lines.append(
                f"**{ancestor.hierarchy_level.title()}**: {ancestor.citation}\n"
                f"  {ancestor.title}\n"
                f"  {summary_text}"
            )
        ancestor_summaries = "\n\n".join(ancestor_lines)
    else:
        ancestor_summaries = "(No ancestors)"

    # Get all siblings (children of subchapter)
    siblings = get_children_of_parent(subchapter_id)

    # Format sibling catalog
    sibling_count = len(siblings)
    truncated = sibling_count > MAX_SIBLING_CATALOG
    catalog_siblings = siblings[:MAX_SIBLING_CATALOG]

    if catalog_siblings:
        sibling_lines = [
            f"- {s.citation}: {s.title}"
            for s in catalog_siblings
        ]
        sibling_catalog = "\n".join(sibling_lines)
    else:
        sibling_catalog = "(No siblings)"

    # Get keyword-matched sibling summaries
    # Build list with (sibling, category, priority_index)
    keyword_siblings: list[tuple[SiblingEntry, str, int]] = []
    for sib in siblings:
        if is_excludable(sib.title):
            continue
        category = get_keyword_category(sib.title)
        if category:
            priority_idx = KEYWORD_PRIORITY.index(category)
            keyword_siblings.append((sib, category, priority_idx))

    # Sort by priority and limit
    keyword_siblings.sort(key=lambda x: x[2])
    keyword_siblings = keyword_siblings[:MAX_SUMMARIES]

    # Fetch summaries for keyword-matched siblings
    if keyword_siblings:
        keyword_ids = [s[0].document_id for s in keyword_siblings]
        content_map = fetch_document_content_batch(keyword_ids)

        keyword_lines: list[str] = []
        for sib, category, _ in keyword_siblings:
            data = content_map.get(sib.document_id, {})
            summary_text, is_fallback = get_summary_or_fallback(
                data.get("summary"),
                data.get("content"),
                sib.title,
            )
            fallback_note = " [excerpt]" if is_fallback else ""
            keyword_lines.append(
                f"**{sib.citation}** ({category}){fallback_note}\n"
                f"  {sib.title}\n"
                f"  {summary_text}"
            )
        keyword_sibling_summaries = "\n\n".join(keyword_lines)
    else:
        keyword_sibling_summaries = "(No keyword matches)"

    # Get definition terms
    definition_terms_list = get_definitions_for_scope(subchapter_id)
    if definition_terms_list:
        definition_terms = ", ".join(definition_terms_list)
    else:
        definition_terms = "(No definitions in scope)"

    return {
        "subchapter_citation": subchapter_info.get("citation", ""),
        "ancestor_summaries": ancestor_summaries,
        "sibling_catalog": sibling_catalog,
        "sibling_count": str(sibling_count),
        "sibling_catalog_truncated": " (truncated)" if truncated else "",
        "keyword_sibling_summaries": keyword_sibling_summaries,
        "definition_terms": definition_terms,
    }
