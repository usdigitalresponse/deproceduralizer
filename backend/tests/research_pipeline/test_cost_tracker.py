"""Tests for cost_tracker module."""

import pytest
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
load_dotenv(PROJECT_ROOT / ".env")


class TestCostTracker:
    """Test cost tracking functionality."""

    def test_import(self):
        from scripts.research_pipeline.cost_tracker import (
            CostTracker,
            TierCost,
            format_time,
        )

        assert CostTracker is not None
        assert TierCost is not None

    def test_record_usage(self):
        from scripts.research_pipeline.cost_tracker import CostTracker

        tracker = CostTracker()

        tracker.record_batch_usage(
            tier=1,
            input_tokens=10000,
            output_tokens=1000,
            cache_read_tokens=5000,
            request_count=10,
        )

        assert tracker.tiers[1].input_tokens == 10000
        assert tracker.tiers[1].output_tokens == 1000
        assert tracker.tiers[1].cache_read_tokens == 5000
        assert tracker.tiers[1].requests == 10

    def test_total_cost(self):
        from scripts.research_pipeline.cost_tracker import CostTracker

        tracker = CostTracker()

        # Add usage for tier 1 (batch)
        tracker.record_batch_usage(tier=1, input_tokens=1000000, output_tokens=100000)

        # Cost should be > 0
        assert tracker.total_cost > 0

        # Batch should have 50% discount
        tier1_cost = tracker.tiers[1].total_cost
        assert tier1_cost > 0

    def test_summary(self):
        from scripts.research_pipeline.cost_tracker import CostTracker

        tracker = CostTracker()
        tracker.record_batch_usage(tier=1, input_tokens=1000, output_tokens=500)

        summary = tracker.summary()

        assert "Cost Summary" in summary
        assert "Tier 1" in summary
        assert "$" in summary

    def test_format_time(self):
        from scripts.research_pipeline.cost_tracker import format_time

        assert format_time(30) == "30s"
        assert format_time(90) == "1.5m"
        assert format_time(7200) == "2.0h"


class TestCostTrackerIntegration:
    """Test CostTracker methods used by Langfuse integration."""

    def test_get_tier_stats(self):
        """Test get_tier_stats method."""
        from scripts.research_pipeline.cost_tracker import CostTracker

        tracker = CostTracker(run_id="test")

        # Record some usage
        tracker.record_batch_usage(
            tier=1,
            input_tokens=1000,
            output_tokens=500,
            cache_read_tokens=200,
            request_count=5,
        )

        stats = tracker.get_tier_stats("tier1")

        assert stats["input_tokens"] == 1200  # 1000 + 200 cache
        assert stats["output_tokens"] == 500
        assert stats["cost"] > 0

    def test_get_tier_stats_missing_tier(self):
        """Test get_tier_stats for a tier with no data."""
        from scripts.research_pipeline.cost_tracker import CostTracker

        tracker = CostTracker(run_id="test")
        stats = tracker.get_tier_stats("tier99")

        assert stats["input_tokens"] == 0
        assert stats["output_tokens"] == 0
        assert stats["cost"] == 0.0
