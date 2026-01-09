"""
Context builder for the research pipeline.

This module is a FACADE that re-exports functions from the context/ subpackage.
The actual implementation has been refactored into:
- context/queries.py - SQL query functions
- context/catalog.py - Context catalog assembly
- context/proactive.py - V5 proactive context building
- context/fetchers.py - Content fetching functions

This file is kept for backward compatibility with existing imports.
"""

# Re-export everything from the context subpackage
from .context import (
    # Queries
    get_sibling_summaries_batch,
    get_immediate_siblings_batch,
    get_crossrefs_batch,
    get_definitions_batch,
    get_definitions_with_text_batch,
    get_ancestor_entries_batch,
    get_subchapter_ids_batch,
    get_subchapter_info,
    get_children_of_parent,
    get_definitions_for_scope,
    get_ancestors_batch,
    # Catalog
    build_context_catalog,
    group_for_cache_efficiency,
    estimate_cache_efficiency,
    # Proactive
    SIBLING_KEYWORDS,
    KEYWORD_PRIORITY,
    CROSS_REF_KEYWORDS,
    EXCLUDABLE_PATTERNS,
    MAX_SUMMARIES,
    MAX_SIBLING_CATALOG,
    MAX_CROSS_REF_CATALOG,
    SUMMARY_FALLBACK_LENGTH,
    is_excludable,
    get_keyword_category,
    get_summary_or_fallback,
    prioritize_summaries,
    build_proactive_context,
    build_batch_context_for_subchapter,
    # Fetchers
    fetch_document_content_batch,
    fetch_document_summaries_batch,
    fetch_summaries_for_requests,
    fetch_full_text_for_requests,
)

# Keep all exports available for backward compatibility
__all__ = [
    # Queries
    "get_sibling_summaries_batch",
    "get_immediate_siblings_batch",
    "get_crossrefs_batch",
    "get_definitions_batch",
    "get_definitions_with_text_batch",
    "get_ancestor_entries_batch",
    "get_subchapter_ids_batch",
    "get_subchapter_info",
    "get_children_of_parent",
    "get_definitions_for_scope",
    "get_ancestors_batch",
    # Catalog
    "build_context_catalog",
    "group_for_cache_efficiency",
    "estimate_cache_efficiency",
    # Proactive
    "SIBLING_KEYWORDS",
    "KEYWORD_PRIORITY",
    "CROSS_REF_KEYWORDS",
    "EXCLUDABLE_PATTERNS",
    "MAX_SUMMARIES",
    "MAX_SIBLING_CATALOG",
    "MAX_CROSS_REF_CATALOG",
    "SUMMARY_FALLBACK_LENGTH",
    "is_excludable",
    "get_keyword_category",
    "get_summary_or_fallback",
    "prioritize_summaries",
    "build_proactive_context",
    "build_batch_context_for_subchapter",
    # Fetchers
    "fetch_document_content_batch",
    "fetch_document_summaries_batch",
    "fetch_summaries_for_requests",
    "fetch_full_text_for_requests",
]
