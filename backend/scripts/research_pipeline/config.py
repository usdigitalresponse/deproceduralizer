"""Centralized configuration for the research pipeline.

Consolidates batch sizes, model names, keyword lists, and other
configuration that was previously scattered across modules.

This module serves as the single source of truth for pipeline configuration,
making it easier to update settings and ensuring consistency across modules.
"""

import sys
from pathlib import Path

# Add parent directories to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from shared_utils import DEFAULT_MODEL

# =============================================================================
# Pipeline Version
# =============================================================================

# V5: 3-tier pipeline (Tier 3 is web search tier)
PIPELINE_VERSION = "v5"


# =============================================================================
# Model Configuration
# =============================================================================

# Tiers 1-2 use batch API for cost efficiency
BATCH_MODEL = DEFAULT_MODEL  # Currently claude-sonnet-4-5-20250929

# Tier 3 uses real-time API (required for web search tool)
TIER3_REALTIME_MODEL = DEFAULT_MODEL


# =============================================================================
# Tier 2 Re-run Configuration
# =============================================================================

# Maximum number of Tier 2 re-runs when LLM requests additional context
# Total attempts = initial + MAX_TIER2_RERUNS = 3
MAX_TIER2_RERUNS = 2


# =============================================================================
# Batch API Configuration
# =============================================================================

# Default interval (seconds) between batch status polls
DEFAULT_POLL_INTERVAL = 60

# Maximum time (seconds) to wait for a batch to complete (4 hours)
MAX_BATCH_POLL_TIME = 3600 * 4

# Maximum retries for failed batch API calls
MAX_BATCH_RETRIES = 5


# =============================================================================
# Tier 3 Web Search Configuration
# =============================================================================

# Batch size for Tier 3 processing (to avoid rate limits)
TIER3_BATCH_SIZE = 5

# Maximum web searches per request (cost control)
MAX_WEB_SEARCHES_PER_REQUEST = 5

# Rate limiting delay (seconds) between Tier 3 requests
TIER3_RATE_LIMIT_DELAY = 1.0


# =============================================================================
# Cost Tracking
# =============================================================================

# Batch API discount (50% off for batch vs real-time)
BATCH_DISCOUNT = 0.5


# =============================================================================
# State Locations for Web Search
# =============================================================================

# State location mapping - capitals for regulatory searches
# Used to localize web search results
STATE_LOCATIONS = {
    "NJ": {
        "city": "Trenton",
        "region": "New Jersey",
        "country": "US",
        "timezone": "America/New_York",
    },
    "NY": {
        "city": "Albany",
        "region": "New York",
        "country": "US",
        "timezone": "America/New_York",
    },
    # Add more states as needed
}
