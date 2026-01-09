"""
Context catalog assembly functions.

This module contains functions for building and organizing context catalogs,
including cache efficiency optimization.
"""

from typing import Optional
import sys
from pathlib import Path

# Add backend to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

# Import Pydantic models
from scripts.research_pipeline.models.context import ContextCatalog

# Import query functions from this package
from .queries import (
    get_sibling_summaries_batch,
    get_crossrefs_batch,
    get_definitions_batch,
    get_ancestor_entries_batch,
    get_subchapter_ids_batch,
)

# Import raw ancestors for optimization
from scripts.local_summarization.db_queries import get_ancestors_batch


# =============================================================================
# Context Catalog Builder
# =============================================================================


def build_context_catalog(
    document_ids: list[int],
) -> dict[int, ContextCatalog]:
    """
    Build complete context catalogs for multiple documents in batch.

    This is the main entry point for Tier 1 context preparation.
    It assembles all the metadata (no full content) that the LLM
    can use to request specific context items.

    Args:
        document_ids: List of document IDs to build catalogs for

    Returns:
        Dict mapping doc_id -> ContextCatalog
    """
    if not document_ids:
        return {}

    # Fetch all context types in parallel-ish (still sequential SQL but batched)
    siblings = get_sibling_summaries_batch(document_ids)
    crossrefs = get_crossrefs_batch(document_ids)

    # OPTIMIZATION: Fetch raw ancestors once, reuse for definitions AND ancestor entries
    raw_ancestors = get_ancestors_batch(document_ids)
    definitions = get_definitions_batch(document_ids, ancestors_map=raw_ancestors)
    ancestors = get_ancestor_entries_batch(document_ids, raw_ancestors_map=raw_ancestors)

    # Assemble catalogs
    result: dict[int, ContextCatalog] = {}
    for doc_id in document_ids:
        result[doc_id] = ContextCatalog(
            sibling_sections=siblings.get(doc_id, []),
            cross_references=crossrefs.get(doc_id, []),
            definition_terms=definitions.get(doc_id, []),
            ancestor_chain=ancestors.get(doc_id, []),
        )

    return result


# =============================================================================
# Cache Batching Strategy
# =============================================================================


def group_for_cache_efficiency(
    processing_units: list,  # list[ProcessingUnit]
    subchapter_map: Optional[dict[int, Optional[int]]] = None,
) -> list:  # list[ProcessingUnit]
    """
    Reorder processing units for maximum Anthropic prompt cache hits.

    Strategy:
    1. Group by issue_type first (same system prompt = cache hits)
    2. Within issue_type, group by subchapter_id (siblings share parent context)
    3. Within subchapter, order by citation for predictability

    This ordering means consecutive API calls are more likely to share
    the cached system prompt and similar context.

    Args:
        processing_units: List of ProcessingUnit objects to reorder
        subchapter_map: Optional pre-computed subchapter map (to avoid redundant queries)

    Returns:
        Reordered list optimized for Anthropic prompt caching
    """
    if not processing_units:
        return []

    # Use provided subchapter map or fetch it
    if subchapter_map is None:
        doc_ids = [pu.document_id for pu in processing_units]
        subchapter_map = get_subchapter_ids_batch(doc_ids)

    # Create lookup for processing units
    pu_by_doc_issue: dict[tuple[int, str], object] = {
        (pu.document_id, pu.issue_type): pu for pu in processing_units
    }

    # Build sort key: (issue_type, subchapter_id, citation)
    def sort_key(pu):
        subchapter_id = subchapter_map.get(pu.document_id) or 0
        return (pu.issue_type, subchapter_id, pu.citation)

    # Sort and return
    return sorted(processing_units, key=sort_key)


def estimate_cache_efficiency(
    processing_units: list,  # list[ProcessingUnit]
) -> dict:
    """
    Estimate cache hit potential for a batch of processing units.

    Useful for logging and optimization.

    Args:
        processing_units: List of ProcessingUnit objects

    Returns:
        Dict with cache efficiency metrics
    """
    if not processing_units:
        return {"total": 0, "unique_issue_types": 0, "unique_subchapters": 0}

    # Count unique issue types and subchapters
    issue_types = set(pu.issue_type for pu in processing_units)

    doc_ids = [pu.document_id for pu in processing_units]
    subchapter_map = get_subchapter_ids_batch(doc_ids)
    subchapters = set(v for v in subchapter_map.values() if v is not None)

    # Estimate cache hits (simplified: same issue_type in sequence = cache hit)
    # OPTIMIZATION: Pass pre-computed subchapter_map to avoid redundant query
    ordered = group_for_cache_efficiency(processing_units, subchapter_map=subchapter_map)
    cache_hits = 0
    prev_issue_type = None
    for pu in ordered:
        if pu.issue_type == prev_issue_type:
            cache_hits += 1
        prev_issue_type = pu.issue_type

    return {
        "total": len(processing_units),
        "unique_issue_types": len(issue_types),
        "unique_subchapters": len(subchapters),
        "estimated_cache_hits": cache_hits,
        "cache_hit_rate": cache_hits / len(processing_units) if processing_units else 0,
    }
