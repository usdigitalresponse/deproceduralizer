"""
Tier runners for the research pipeline.

This module contains the tier-specific runners.
Each tier has its own module with batch preparation and/or realtime execution.

Tiers:
- Tier 1: Match Filtering (batch API)
- Tier 2: Summary-Based Research (batch or realtime with re-runs)
- Tier 3: Web Search Verification (batch API default, realtime with --realtime flag)
"""

from .base import TierRunner

# Tier 1
from .tier1_runner import (
    prepare_tier1_batch,
)

# Tier 2
from .tier2_runner import (
    prepare_tier2_batch,
    run_tier2_with_reruns,
    # Context request utilities
    collect_context_requests,
    build_context_key,
    map_fetched_to_unit,
    dedupe_context_requests,
    get_definition_scopes_batch,
)

# Tier 3
from .tier3_runner import (
    prepare_tier3_batch,  # V5.2: Batch preparation (default mode)
    run_tier3_realtime,   # Real-time mode (with --realtime flag)
)

# Web search utilities
from .web_search import (
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
)

# Re-export config values for convenience
from ..config import (
    BATCH_MODEL,
    TIER3_REALTIME_MODEL,
    MAX_TIER2_RERUNS,
)

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
    # Config (re-exported for convenience)
    "BATCH_MODEL",
    "TIER3_REALTIME_MODEL",
    "MAX_TIER2_RERUNS",
]
