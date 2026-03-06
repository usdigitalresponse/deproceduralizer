"""
Cost tracking for the research pipeline.

Tracks token usage and computes costs across tiers.
Uses centralized Anthropic pricing from observability/cost_map.py with batch API discount.
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

from observability.cost_map import calculate_cost, get_model_pricing
from lib.stats import format_time

# Import centralized configuration
from .config import (
    BATCH_MODEL as DEFAULT_BATCH_MODEL,
    TIER3_REALTIME_MODEL as DEFAULT_TIER3_REALTIME_MODEL,
    BATCH_DISCOUNT,
)


@dataclass
class TierCost:
    """Cost breakdown for a single tier."""

    tier: int
    input_tokens: int = 0
    output_tokens: int = 0
    cache_read_tokens: int = 0
    cache_write_tokens: int = 0
    requests: int = 0
    is_batch: bool = True  # V5: Tiers 1-2 use batch, Tier 3 uses real-time
    model: str = DEFAULT_BATCH_MODEL  # Full model name (e.g., "claude-sonnet-4-6")

    @property
    def total_cost(self) -> float:
        """Calculate cost with batch discount if applicable.

        Uses centralized pricing from observability/cost_map.py.
        """
        # Use centralized cost calculation with full model name
        base_cost = calculate_cost(
            model=self.model,
            input_tokens=self.input_tokens,
            output_tokens=self.output_tokens,
            cache_read_tokens=self.cache_read_tokens,
            cache_write_tokens=self.cache_write_tokens,
        )

        # Apply batch discount for tiers 1-3
        if self.is_batch:
            return base_cost * BATCH_DISCOUNT
        return base_cost

    @property
    def cache_hit_rate(self) -> float:
        """Calculate cache hit rate as percentage of input from cache."""
        total_input = self.input_tokens + self.cache_read_tokens
        if total_input == 0:
            return 0.0
        return (self.cache_read_tokens / total_input) * 100

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "tier": self.tier,
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "cache_read_tokens": self.cache_read_tokens,
            "cache_write_tokens": self.cache_write_tokens,
            "requests": self.requests,
            "is_batch": self.is_batch,
            "cost_usd": self.total_cost,
            "cache_hit_rate": self.cache_hit_rate,
        }


@dataclass
class CostTracker:
    """
    Track costs across the pipeline.

    Usage:
        tracker = CostTracker()
        tracker.record_batch_usage(tier=1, input_tokens=50000, output_tokens=2000)
        print(tracker.summary())
    """

    tiers: dict[int, TierCost] = field(default_factory=dict)
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    run_id: str = ""

    def __post_init__(self):
        # V5: Initialize tier costs with explicit model names (3 tiers)
        if not self.tiers:
            self.tiers = {
                1: TierCost(tier=1, is_batch=True, model=DEFAULT_BATCH_MODEL),
                2: TierCost(tier=2, is_batch=True, model=DEFAULT_BATCH_MODEL),
                3: TierCost(tier=3, is_batch=False, model=DEFAULT_TIER3_REALTIME_MODEL),  # V5: real-time
            }
        if self.start_time is None:
            self.start_time = datetime.now()

    def record_batch_usage(
        self,
        tier: int,
        input_tokens: int,
        output_tokens: int,
        cache_read_tokens: int = 0,
        cache_write_tokens: int = 0,
        request_count: int = 1,
        model: Optional[str] = None,
        is_batch: Optional[bool] = None,
    ) -> None:
        """Record token usage from a batch or real-time call.

        Args:
            tier: Tier number (1, 2, or 3)
            input_tokens: Number of input tokens
            output_tokens: Number of output tokens
            cache_read_tokens: Tokens read from cache
            cache_write_tokens: Tokens written to cache
            request_count: Number of API requests
            model: Model name override
            is_batch: Whether this is a batch API call. If None, uses default
                      (True for tiers 1-2, False for tier 3). Set to False for
                      real-time API calls like Tier 2 reruns.
        """
        if tier not in self.tiers:
            # V5: Tier 3 uses real-time API, tiers 1-2 use batch
            default_model = DEFAULT_TIER3_REALTIME_MODEL if tier == 3 else DEFAULT_BATCH_MODEL
            default_is_batch = (tier < 3) if is_batch is None else is_batch
            self.tiers[tier] = TierCost(
                tier=tier,
                is_batch=default_is_batch,
                model=model or default_model,
            )

        cost = self.tiers[tier]
        cost.input_tokens += input_tokens
        cost.output_tokens += output_tokens
        cost.cache_read_tokens += cache_read_tokens
        cost.cache_write_tokens += cache_write_tokens
        cost.requests += request_count
        # Update model if explicitly provided
        if model:
            cost.model = model
        # Update is_batch if explicitly provided (for mixed batch/realtime usage)
        if is_batch is not None:
            cost.is_batch = is_batch

    def record_from_response(
        self,
        tier: int,
        response: dict,
        request_count: int = 1,
    ) -> None:
        """
        Record usage from an Anthropic API response.

        Expected response structure:
        {
            "usage": {
                "input_tokens": int,
                "output_tokens": int,
                "cache_creation_input_tokens": int,  # optional
                "cache_read_input_tokens": int,      # optional
            }
        }
        """
        usage = response.get("usage", {})
        self.record_batch_usage(
            tier=tier,
            input_tokens=usage.get("input_tokens", 0),
            output_tokens=usage.get("output_tokens", 0),
            cache_read_tokens=usage.get("cache_read_input_tokens", 0),
            cache_write_tokens=usage.get("cache_creation_input_tokens", 0),
            request_count=request_count,
        )

    @property
    def total_cost(self) -> float:
        """Total cost across all tiers."""
        return sum(tier.total_cost for tier in self.tiers.values())

    @property
    def total_requests(self) -> int:
        """Total requests across all tiers."""
        return sum(tier.requests for tier in self.tiers.values())

    @property
    def total_input_tokens(self) -> int:
        """Total input tokens across all tiers."""
        return sum(tier.input_tokens + tier.cache_read_tokens for tier in self.tiers.values())

    @property
    def total_output_tokens(self) -> int:
        """Total output tokens across all tiers."""
        return sum(tier.output_tokens for tier in self.tiers.values())

    @property
    def overall_cache_hit_rate(self) -> float:
        """Overall cache hit rate across all tiers."""
        total_input = sum(tier.input_tokens + tier.cache_read_tokens for tier in self.tiers.values())
        total_cache = sum(tier.cache_read_tokens for tier in self.tiers.values())
        if total_input == 0:
            return 0.0
        return (total_cache / total_input) * 100

    def mark_complete(self) -> None:
        """Mark the pipeline run as complete."""
        self.end_time = datetime.now()

    @property
    def elapsed_time(self) -> Optional[float]:
        """Elapsed time in seconds."""
        if self.start_time is None:
            return None
        end = self.end_time or datetime.now()
        return (end - self.start_time).total_seconds()

    def summary(self) -> str:
        """Generate a formatted cost summary."""
        lines = [
            "Cost Summary",
            "-" * 50,
        ]

        for tier_num in sorted(self.tiers.keys()):
            cost = self.tiers[tier_num]
            if cost.requests > 0:
                batch_marker = " (batch)" if cost.is_batch else " (real-time)"
                lines.append(
                    f"  Tier {tier_num}{batch_marker}: "
                    f"{cost.requests:,} requests, "
                    f"{cost.input_tokens + cost.cache_read_tokens:,} in / "
                    f"{cost.output_tokens:,} out, "
                    f"${cost.total_cost:.2f}"
                )
                if cost.cache_hit_rate > 0:
                    lines.append(f"    Cache hit rate: {cost.cache_hit_rate:.1f}%")

        lines.extend([
            "-" * 50,
            f"  Total requests: {self.total_requests:,}",
            f"  Total tokens: {self.total_input_tokens:,} in / {self.total_output_tokens:,} out",
            f"  Overall cache hit rate: {self.overall_cache_hit_rate:.1f}%",
            f"  Total cost: ${self.total_cost:.2f}",
        ])

        if self.elapsed_time is not None:
            elapsed = self.elapsed_time
            if elapsed >= 3600:
                time_str = f"{elapsed / 3600:.1f}h"
            elif elapsed >= 60:
                time_str = f"{elapsed / 60:.1f}m"
            else:
                time_str = f"{elapsed:.1f}s"
            lines.append(f"  Elapsed time: {time_str}")

        return "\n".join(lines)

    def get_tier_stats(self, tier_key: str) -> dict:
        """
        Get stats for a specific tier by key.

        Args:
            tier_key: Tier identifier like "tier1", "tier2", etc.

        Returns:
            Dict with input_tokens, output_tokens, and cost.
        """
        # Parse tier number from key (e.g., "tier1" -> 1)
        tier_num = int(tier_key.replace("tier", ""))
        if tier_num not in self.tiers:
            return {"input_tokens": 0, "output_tokens": 0, "cost": 0.0}

        tier = self.tiers[tier_num]
        return {
            "input_tokens": tier.input_tokens + tier.cache_read_tokens,
            "output_tokens": tier.output_tokens,
            "cost": tier.total_cost,
        }

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "run_id": self.run_id,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "elapsed_seconds": self.elapsed_time,
            "total_cost_usd": self.total_cost,
            "total_requests": self.total_requests,
            "total_input_tokens": self.total_input_tokens,
            "total_output_tokens": self.total_output_tokens,
            "overall_cache_hit_rate": self.overall_cache_hit_rate,
            "tiers": {k: v.to_dict() for k, v in self.tiers.items()},
        }


def estimate_cost(
    document_count: int,
    avg_content_tokens: int = 2000,
    tier1_output_tokens: int = 500,
    tier2_output_tokens: int = 1500,
    tier3_ratio: float = 0.15,  # V5: % going to Tier 3 (web search)
) -> dict:
    """
    V5: Estimate pipeline cost for a given number of documents.

    Returns cost breakdown by tier and total.
    Uses centralized pricing from observability/cost_map.py.

    V5: 3-tier pipeline where Tier 3 is the web search tier (real-time API).
    """
    # Tier 1: All documents (batch, with discount)
    tier1_input = document_count * 1500  # ~1500 tokens for prompt + context
    tier1_output = document_count * tier1_output_tokens
    tier1_cost = calculate_cost(
        model=DEFAULT_BATCH_MODEL,
        input_tokens=tier1_input,
        output_tokens=tier1_output,
    ) * BATCH_DISCOUNT

    # Tier 2: ~80% pass Tier 1 (batch, with discount)
    tier2_count = int(document_count * 0.8)
    tier2_input = tier2_count * (2000 + avg_content_tokens)  # prompt + full content
    tier2_output = tier2_count * tier2_output_tokens
    tier2_cost = calculate_cost(
        model=DEFAULT_BATCH_MODEL,
        input_tokens=tier2_input,
        output_tokens=tier2_output,
    ) * BATCH_DISCOUNT

    # V5: Tier 3 is web search tier (no batch discount, real-time API)
    tier3_count = int(document_count * tier3_ratio)
    tier3_input = tier3_count * 3000
    tier3_output = tier3_count * 1000
    tier3_cost = calculate_cost(
        model=DEFAULT_TIER3_REALTIME_MODEL,
        input_tokens=tier3_input,
        output_tokens=tier3_output,
    )  # No batch discount (real-time API)

    return {
        "tier1": {"count": document_count, "cost": tier1_cost},
        "tier2": {"count": tier2_count, "cost": tier2_cost},
        "tier3": {"count": tier3_count, "cost": tier3_cost},
        "total": tier1_cost + tier2_cost + tier3_cost,
    }
