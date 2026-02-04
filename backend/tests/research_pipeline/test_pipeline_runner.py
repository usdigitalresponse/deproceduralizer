"""
Tests for the flat pipeline_runner module.

Tests migrated from test_tier_orchestrator.py:
- TestHydrateUnitFromAnalysis — hydration tests (now public function)
- TestHealthCheck — DB health check with retry
- TestResumeLogic — resume filtering
- TestStateTransitions — state after hydration
"""

from datetime import datetime
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock
import pytest

from scripts.research_pipeline.state_machine import ProcessingState, TrackedUnit
from scripts.research_pipeline.models.matches import ProcessingUnit, MatchInfo
from scripts.research_pipeline.models.llm_outputs import Tier1Output, Tier2Output, Tier3Output
from scripts.research_pipeline.pipeline_runner import (
    hydrate_unit_from_analysis,
    _check_db_health,
    _sort_for_cache_efficiency,
)

from tests.research_pipeline.conftest import (
    make_processing_unit,
    make_tier1_output,
    make_tier2_output,
    make_tier3_output,
)


# =============================================================================
# Hydration Tests (public function, no orchestrator needed)
# =============================================================================


class TestHydrateUnitFromAnalysis:
    """Test hydrate_unit_from_analysis function."""

    def test_hydrates_tier1_output(self):
        """Correctly creates Tier1Output from analysis data."""
        unit = TrackedUnit(
            unit=make_processing_unit(document_id=123),
            state=ProcessingState.PENDING,
        )
        analysis = {
            "tier1_classification": "needs_research",
            "tier1_relevant_match_ids": [100, 101],
            "tier1_dismissed_match_ids": [102],
            "tier1_confidence": 0.85,
            "tier1_reasoning": "Found genuine requirement",
            "tier1_context_requests": [],
        }

        hydrate_unit_from_analysis(unit, analysis, highest_completed=1)

        assert unit.tier1_output is not None
        assert unit.tier1_output.classification == "needs_research"
        assert unit.tier1_output.confidence == 0.85
        assert unit.tier1_output.reasoning == "Found genuine requirement"
        assert unit.state == ProcessingState.TIER2_PENDING

    def test_hydrates_tier1_false_positive(self):
        """False positives get DONE_FALSE_POSITIVE state."""
        unit = TrackedUnit(
            unit=make_processing_unit(document_id=123),
            state=ProcessingState.PENDING,
        )
        analysis = {
            "tier1_classification": "all_false_positives",
            "tier1_relevant_match_ids": [],
            "tier1_dismissed_match_ids": [100],
            "tier1_confidence": 0.9,
            "tier1_reasoning": "All matches are false positives",
            "tier1_context_requests": [],
        }

        hydrate_unit_from_analysis(unit, analysis, highest_completed=1)

        assert unit.tier1_output is not None
        assert unit.tier1_output.classification == "all_false_positives"
        assert unit.state == ProcessingState.DONE_FALSE_POSITIVE

    def test_hydrates_tier2_output(self):
        """Correctly creates Tier2Output from analysis data."""
        unit = TrackedUnit(
            unit=make_processing_unit(document_id=123),
            state=ProcessingState.PENDING,
        )
        analysis = {
            "tier1_classification": "needs_research",
            "tier1_relevant_match_ids": [100],
            "tier1_confidence": 0.8,
            "tier1_reasoning": "test",
            "tier1_context_requests": [],
            "tier2_classification": "burdensome",
            "tier2_confidence": 0.9,
            "tier2_reasoning": "This is a burden",
            "severity": 7,
            "verbatim_requirements": ["must submit by mail"],
            "tier2_context_requests_made": [],
            "tier2_full_text_requests": [],
        }

        hydrate_unit_from_analysis(unit, analysis, highest_completed=2)

        assert unit.tier1_output is not None
        assert unit.tier2_output is not None
        assert unit.tier2_output.classification == "burdensome"
        assert unit.tier2_output.severity == 7
        assert unit.tier2_output.verbatim_requirements == ["must submit by mail"]
        # State should be DONE or TIER3_PENDING (routing dependent)
        assert unit.state in (ProcessingState.DONE, ProcessingState.TIER3_PENDING)

    def test_hydrates_tier2_unrelated(self):
        """Unrelated classification goes to DONE state."""
        unit = TrackedUnit(
            unit=make_processing_unit(document_id=123),
            state=ProcessingState.PENDING,
        )
        analysis = {
            "tier1_classification": "needs_research",
            "tier1_context_requests": [],
            "tier2_classification": "unrelated",
            "tier2_confidence": 0.95,
            "tier2_reasoning": "Not related to mail-only requirement",
            "verbatim_requirements": [],
        }

        hydrate_unit_from_analysis(unit, analysis, highest_completed=2)

        assert unit.tier2_output is not None
        assert unit.tier2_output.classification == "unrelated"
        assert unit.state == ProcessingState.DONE

    def test_hydrates_tier3_output(self):
        """Correctly creates Tier3Output from analysis data."""
        unit = TrackedUnit(
            unit=make_processing_unit(document_id=123),
            state=ProcessingState.PENDING,
        )
        analysis = {
            "tier1_classification": "needs_research",
            "tier1_confidence": 0.8,
            "tier1_reasoning": "test",
            "tier1_context_requests": [],
            "tier2_classification": "burdensome",
            "tier2_confidence": 0.8,
            "tier2_reasoning": "test",
            "severity": 7,
            "verbatim_requirements": [],
            "tier3_classification": "justified",
            "tier3_confidence": 0.95,
            "tier3_reasoning": "Federal mandate confirmed",
            "tier3_severity_adjustment": -2,
            "tier3_severity_adjustment_reasoning": "Federal requirement",
        }

        hydrate_unit_from_analysis(unit, analysis, highest_completed=3)

        assert unit.tier3_output is not None
        assert unit.tier3_output.classification == "justified"
        assert unit.tier3_output.severity_adjustment == -2
        assert unit.state == ProcessingState.DONE

    def test_handles_missing_optional_fields(self):
        """Handles None/missing values in analysis data gracefully."""
        unit = TrackedUnit(
            unit=make_processing_unit(document_id=123),
            state=ProcessingState.PENDING,
        )
        analysis = {
            "tier1_classification": "needs_research",
        }

        hydrate_unit_from_analysis(unit, analysis, highest_completed=1)

        assert unit.tier1_output is not None
        assert unit.tier1_output.classification == "needs_research"
        assert unit.tier1_output.confidence == 0.8  # Default
        assert unit.tier1_output.reasoning == "Resumed from database"  # Default

    def test_stores_match_ids(self):
        """Stores relevant/dismissed match IDs on unit for later use."""
        unit = TrackedUnit(
            unit=make_processing_unit(document_id=123),
            state=ProcessingState.PENDING,
        )
        analysis = {
            "tier1_classification": "needs_research",
            "tier1_relevant_match_ids": [100, 101, 102],
            "tier1_dismissed_match_ids": [103],
            "tier1_context_requests": [],
        }

        hydrate_unit_from_analysis(unit, analysis, highest_completed=1)

        assert unit._tier1_relevant_match_ids == [100, 101, 102]
        assert unit._tier1_dismissed_match_ids == [103]


# =============================================================================
# Health Check Tests
# =============================================================================


class TestHealthCheck:
    """Test _check_db_health function."""

    def test_returns_true_when_healthy(self):
        """Returns True when database is healthy on first check."""
        out = Mock()
        with patch("scripts.research_pipeline.pipeline_runner.check_db_health") as mock_health:
            mock_health.return_value = True

            result = _check_db_health(out, "Tier 1")

        assert result is True
        mock_health.assert_called_once()

    def test_retries_once_after_failure(self):
        """Retries health check once after initial failure."""
        out = Mock()
        with patch("scripts.research_pipeline.pipeline_runner.check_db_health") as mock_health:
            with patch("scripts.research_pipeline.pipeline_runner.time.sleep"):
                mock_health.side_effect = [False, True]

                result = _check_db_health(out, "Tier 1")

        assert result is True
        assert mock_health.call_count == 2

    def test_returns_false_after_two_failures(self):
        """Returns False after both health checks fail."""
        out = Mock()
        with patch("scripts.research_pipeline.pipeline_runner.check_db_health") as mock_health:
            with patch("scripts.research_pipeline.pipeline_runner.time.sleep"):
                mock_health.return_value = False

                result = _check_db_health(out, "Tier 1")

        assert result is False
        assert mock_health.call_count == 2


# =============================================================================
# Resume Logic Tests
# =============================================================================


class TestResumeLogic:
    """Test resume filtering logic."""

    def test_units_dict_initialized_correctly(self):
        """ProcessingUnits are correctly converted to TrackedUnits."""
        units = {}
        for pu in [make_processing_unit(document_id=123), make_processing_unit(document_id=456)]:
            tracked = TrackedUnit(unit=pu, state=ProcessingState.PENDING)
            units[tracked.custom_id] = tracked

        assert len(units) == 2
        assert all(u.state == ProcessingState.PENDING for u in units.values())

    def test_resume_removes_completed_units(self):
        """Units completed to max_tier are removed from units dict."""
        existing = {
            (123, "mail_only"): {"highest_tier_completed": 2},
        }

        pu = make_processing_unit(document_id=123)
        tracked = TrackedUnit(unit=pu, state=ProcessingState.PENDING)
        units = {tracked.custom_id: tracked}

        units_to_remove = []
        for custom_id, unit in units.items():
            key = (unit.unit.document_id, unit.unit.issue_type)
            if key in existing:
                highest = existing[key].get("highest_tier_completed", 0) or 0
                if highest >= 2:
                    units_to_remove.append(custom_id)

        for cid in units_to_remove:
            del units[cid]

        assert len(units) == 0

    def test_resume_hydrates_partial_progress(self):
        """Units with partial progress are hydrated, not removed."""
        existing = {
            (123, "mail_only"): {
                "highest_tier_completed": 1,
                "tier1_classification": "needs_research",
                "tier1_context_requests": [],
            },
        }

        pu = make_processing_unit(document_id=123)
        tracked = TrackedUnit(unit=pu, state=ProcessingState.PENDING)
        units = {tracked.custom_id: tracked}

        for custom_id, unit in units.items():
            key = (unit.unit.document_id, unit.unit.issue_type)
            if key in existing:
                analysis = existing[key]
                highest = analysis.get("highest_tier_completed", 0) or 0
                if highest >= 2:
                    pass
                elif highest > 0:
                    hydrate_unit_from_analysis(unit, analysis, highest)

        assert len(units) == 1
        unit = list(units.values())[0]
        assert unit.tier1_output is not None
        assert unit.state == ProcessingState.TIER2_PENDING


# =============================================================================
# State Transition Tests
# =============================================================================


class TestStateTransitions:
    """Test that hydrated units have correct states for tier routing."""

    def test_tier1_needs_research_goes_to_tier2_pending(self):
        """Units with tier1 'needs_research' go to TIER2_PENDING."""
        unit = TrackedUnit(
            unit=make_processing_unit(document_id=123),
            state=ProcessingState.PENDING,
        )
        analysis = {
            "tier1_classification": "needs_research",
            "tier1_context_requests": [],
        }

        hydrate_unit_from_analysis(unit, analysis, highest_completed=1)
        assert unit.state == ProcessingState.TIER2_PENDING

    def test_tier1_false_positive_goes_to_done(self):
        """Units with tier1 'all_false_positives' go to DONE_FALSE_POSITIVE."""
        unit = TrackedUnit(
            unit=make_processing_unit(document_id=123),
            state=ProcessingState.PENDING,
        )
        analysis = {
            "tier1_classification": "all_false_positives",
            "tier1_context_requests": [],
        }

        hydrate_unit_from_analysis(unit, analysis, highest_completed=1)
        assert unit.state == ProcessingState.DONE_FALSE_POSITIVE

    def test_tier2_unrelated_goes_to_done(self):
        """Units with tier2 'unrelated' go to DONE."""
        unit = TrackedUnit(
            unit=make_processing_unit(document_id=123),
            state=ProcessingState.PENDING,
        )
        analysis = {
            "tier1_classification": "needs_research",
            "tier1_context_requests": [],
            "tier2_classification": "unrelated",
            "tier2_confidence": 0.9,
        }

        hydrate_unit_from_analysis(unit, analysis, highest_completed=2)
        assert unit.state == ProcessingState.DONE

    def test_tier3_always_goes_to_done(self):
        """Units with tier3 output always go to DONE."""
        unit = TrackedUnit(
            unit=make_processing_unit(document_id=123),
            state=ProcessingState.PENDING,
        )
        analysis = {
            "tier1_classification": "needs_research",
            "tier1_context_requests": [],
            "tier2_classification": "burdensome",
            "tier2_confidence": 0.8,
            "severity": 6,
            "verbatim_requirements": [],
            "tier3_classification": "burdensome",
            "tier3_confidence": 0.95,
        }

        hydrate_unit_from_analysis(unit, analysis, highest_completed=3)
        assert unit.state == ProcessingState.DONE


# =============================================================================
# Sort for Cache Efficiency Tests
# =============================================================================


class TestSortForCacheEfficiency:
    """Test _sort_for_cache_efficiency function."""

    def test_returns_dict(self):
        """Should return a dict of TrackedUnits."""
        pu1 = make_processing_unit(document_id=1)
        pu2 = make_processing_unit(document_id=2)
        units = {}
        for pu in [pu1, pu2]:
            tracked = TrackedUnit(unit=pu, state=ProcessingState.PENDING)
            units[tracked.custom_id] = tracked

        result = _sort_for_cache_efficiency(units)
        assert isinstance(result, dict)
        assert len(result) == 2

    def test_preserves_all_units(self):
        """All units should be preserved after sorting."""
        pu1 = make_processing_unit(document_id=10)
        pu2 = make_processing_unit(document_id=20)
        pu3 = make_processing_unit(document_id=30)
        units = {}
        for pu in [pu1, pu2, pu3]:
            tracked = TrackedUnit(unit=pu, state=ProcessingState.PENDING)
            units[tracked.custom_id] = tracked

        result = _sort_for_cache_efficiency(units)
        assert set(result.keys()) == set(units.keys())
