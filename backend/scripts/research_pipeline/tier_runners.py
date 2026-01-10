"""
Tier runners for the research pipeline.

This module is a thin facade that re-exports from the tiers/ submodule.
The actual implementation has been refactored into:
- tiers/tier1_runner.py - Tier 1 batch preparation
- tiers/tier2_runner.py - Tier 2 batch preparation and re-run support
- tiers/tier3_runner.py - Tier 3 batch/real-time web search execution
- tiers/web_search.py - Web search utilities and response extraction
"""

# Re-export everything from the tiers module
from .tiers import (
    # Protocol
    TierRunner,
    # Tier 1
    prepare_tier1_batch,
    # Tier 2
    prepare_tier2_batch,
    run_tier2_with_reruns,
    collect_context_requests,
    build_context_key,
    map_fetched_to_unit,
    dedupe_context_requests,
    get_definition_scopes_batch,
    # Tier 3
    prepare_tier3_batch,  # V5.2: Batch preparation
    run_tier3_realtime,   # Real-time mode (with --realtime flag)
    # Web search
    get_web_search_tool,
    WEB_SEARCH_TOOL,
    WebSearchCitation,
    WebSearchResult,
    WebSearchQuery,
    WebSearchResponse,
    extract_web_search_response,
    extract_web_search_results,
    format_web_results_for_prompt,
    format_citations_for_evidence,
    # Config (re-exported for convenience)
    BATCH_MODEL,
    TIER3_REALTIME_MODEL,
    MAX_TIER2_RERUNS,
)

# Re-export formatting functions for backward compatibility
# (Tests expect these to be importable from tier_runners)
from .formatting import (
    format_matches_for_tier1,
    format_matches_for_tier2,
    format_definitions,
    format_fetched_context,
    format_tier1_argument,
)

# Alias for backward compatibility (tests use _format_tier1_argument)
_format_tier1_argument = format_tier1_argument

__all__ = [
    # Protocol
    "TierRunner",
    # Tier 1
    "prepare_tier1_batch",
    # Tier 2
    "prepare_tier2_batch",
    "run_tier2_with_reruns",
    "collect_context_requests",
    "build_context_key",
    "map_fetched_to_unit",
    "dedupe_context_requests",
    "get_definition_scopes_batch",
    # Tier 3
    "prepare_tier3_batch",  # V5.2: Batch preparation
    "run_tier3_realtime",   # Real-time mode
    # Web search
    "get_web_search_tool",
    "WEB_SEARCH_TOOL",
    "WebSearchCitation",
    "WebSearchResult",
    "WebSearchQuery",
    "WebSearchResponse",
    "extract_web_search_response",
    "extract_web_search_results",
    "format_web_results_for_prompt",
    "format_citations_for_evidence",
    # Config
    "BATCH_MODEL",
    "TIER3_REALTIME_MODEL",
    "MAX_TIER2_RERUNS",
    # Formatting (re-exported for backward compatibility)
    "format_matches_for_tier1",
    "format_matches_for_tier2",
    "format_definitions",
    "format_fetched_context",
    "format_tier1_argument",
    "_format_tier1_argument",  # Legacy alias
]
