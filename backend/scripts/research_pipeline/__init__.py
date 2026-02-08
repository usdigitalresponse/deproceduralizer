"""
Research Pipeline for regulatory compliance analysis.

A 3-tier LLM pipeline with progressive context disclosure:
- Tier 1: Match Filtering (summaries + context catalog)
- Tier 2: Document Analysis (definitions, siblings, cross-refs)
- Tier 3: Web Search Verification (external validation)

Public API:
- run_pipeline, run_tier3_only: Main entry points for running the pipeline
- ProcessingState, TrackedUnit: State machine for tracking document processing
- IssueConfig, load_issue_config: Issue-specific configuration loading
- CostTracker: Cost tracking for LLM usage
- save_*_results: Database persistence functions
- make_custom_id, parse_custom_id: Shared ID generation utilities

Internal modules (import directly if needed):
- context/: Context fetching and catalog building
- context_registry: Deduplication of context items
- tiers/: Batch preparation and real-time execution
- db/: Database operations (read/write)
- result_processor: Response parsing and state transitions
- prompt_loader: Full prompt loading utilities
"""

# =============================================================================
# PUBLIC API - Main orchestration
# =============================================================================

from .pipeline_runner import (
    run_pipeline,
    run_tier3_only,
)

# =============================================================================
# PUBLIC API - State machine
# =============================================================================

from .state_machine import (
    ProcessingState,
    TrackedUnit,
    get_next_state,
    is_terminal_state,
)

# =============================================================================
# PUBLIC API - Configuration
# =============================================================================

from .prompt_loader import (
    IssueConfig,
    load_issue_config,
    list_issue_types,
    get_all_issue_types,
)

# =============================================================================
# PUBLIC API - Cost tracking
# =============================================================================

from .cost_tracker import (
    CostTracker,
)

# =============================================================================
# PUBLIC API - Database persistence
# =============================================================================

from .db import (
    save_tier1_results,
    save_tier2_results,
    save_tier3_results,
    save_final_results,
    save_all_results,
)

# =============================================================================
# PUBLIC API - ID generation utilities
# =============================================================================

from .ids import (
    make_custom_id,
    parse_custom_id,
)

# =============================================================================
# PUBLIC API - Web search (for tests and external validation)
# =============================================================================

from .tiers import (
    WEB_SEARCH_TOOL,
    WebSearchResult,
    WebSearchQuery,
    extract_web_search_results,
    format_web_results_for_prompt,
)

# =============================================================================
# __all__ - Explicit public API
# =============================================================================

__all__ = [
    # Main orchestration
    "run_pipeline",
    "run_tier3_only",
    # State machine
    "ProcessingState",
    "TrackedUnit",
    "get_next_state",
    "is_terminal_state",
    # Configuration
    "IssueConfig",
    "load_issue_config",
    "list_issue_types",
    "get_all_issue_types",
    # Cost tracking
    "CostTracker",
    # Database persistence
    "save_tier1_results",
    "save_tier2_results",
    "save_tier3_results",
    "save_final_results",
    "save_all_results",
    # ID generation
    "make_custom_id",
    "parse_custom_id",
    # Web search
    "WEB_SEARCH_TOOL",
    "WebSearchResult",
    "WebSearchQuery",
    "extract_web_search_results",
    "format_web_results_for_prompt",
]
