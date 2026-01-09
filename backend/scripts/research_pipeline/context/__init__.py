"""
Context module for the research pipeline.

This module provides batch SQL queries and context assembly functions
for building the context catalogs used by the 3-tier research pipeline.

Submodules:
- queries: SQL query functions for batch data fetching
- catalog: Context catalog assembly functions
- proactive: V5 proactive context building functions
- fetchers: Content fetching for summaries and full text
- requests: Shared context request helpers

The main entry points are:
- build_context_catalog(): Build context catalogs for multiple documents
- build_proactive_context(): Build V5 proactive context with pre-fetched summaries
- fetch_summaries_for_requests(): Fetch summaries for LLM context requests
- fetch_full_text_for_requests(): Fetch full text for Tier 3 context requests
"""

# Import from submodules for public API
from .queries import (
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
)

from .catalog import (
    build_context_catalog,
    group_for_cache_efficiency,
    estimate_cache_efficiency,
)

from .proactive import (
    # V5 Configuration constants
    SIBLING_KEYWORDS,
    KEYWORD_PRIORITY,
    CROSS_REF_KEYWORDS,
    EXCLUDABLE_PATTERNS,
    MAX_SUMMARIES,
    MAX_SIBLING_CATALOG,
    MAX_CROSS_REF_CATALOG,
    SUMMARY_FALLBACK_LENGTH,
    # V5 Helper functions
    is_excludable,
    get_keyword_category,
    get_summary_or_fallback,
    prioritize_summaries,
    # V5 Entry points
    build_proactive_context,
    build_batch_context_for_subchapter,
)

from .fetchers import (
    fetch_document_content_batch,
    fetch_document_summaries_batch,
    fetch_summaries_for_requests,
    fetch_full_text_for_requests,
)

# Re-export get_ancestors_batch from db_queries (used by multiple modules)
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))
from scripts.local_summarization.db_queries import get_ancestors_batch

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
