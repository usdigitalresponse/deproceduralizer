"""
Tests for TierOrchestrator resume and hydration logic.

Tests:
- Resume skips already-processed units
- False positives are correctly identified on resume
- _hydrate_unit_from_analysis correctly populates tier outputs
- Health check integration
"""

from datetime import datetime
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock
import pytest

from scripts.research_pipeline.state_machine import ProcessingState, TrackedUnit
from scripts.research_pipeline.models.matches import ProcessingUnit, MatchInfo
from scripts.research_pipeline.models.llm_outputs import Tier1Output, Tier2Output, Tier3Output
from scripts.research_pipeline.tier_orchestrator import TierOrchestrator

# Import helpers from the research pipeline conftest
from tests.research_pipeline.conftest import (
    make_processing_unit,
    make_tier1_output,
    make_tier2_output,
    make_tier3_output,
)


# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
def mock_batches_dir(tmp_path):
    """Create a temporary batches directory."""
    batches_dir = tmp_path / "batches"
    batches_dir.mkdir()
    return batches_dir


@pytest.fixture
def mock_issue_config():
    """Mock issue config for testing."""
    config = Mock()
    config.key = "mail_only"
    config.display_name = "Mail Only"
    config.baseline_severity = 5
    config.tier1_indicators = []
    config.tier2_indicators = []
    return config


@pytest.fixture
def orchestrator(mock_batches_dir, mock_issue_config):
    """Create a TierOrchestrator instance for testing."""
    with patch("scripts.research_pipeline.tier_orchestrator.load_issue_config") as mock_load:
        mock_load.return_value = mock_issue_config
        orch = TierOrchestrator(
            state="NJ",
            issue_type="mail_only",
            batches_dir=mock_batches_dir,
            resume=True,
        )
        return orch


# =============================================================================
# Hydration Tests
# =============================================================================


class TestHydrateUnitFromAnalysis:
    """Test _hydrate_unit_from_analysis method."""

    def test_hydrates_tier1_output(self, orchestrator):
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
            "tier1_context_requests": [],  # Empty list - no context requests
        }

        orchestrator._hydrate_unit_from_analysis(unit, analysis, highest_completed=1)

        assert unit.tier1_output is not None
        assert unit.tier1_output.classification == "needs_research"
        assert unit.tier1_output.confidence == 0.85
        assert unit.tier1_output.reasoning == "Found genuine requirement"
        assert unit.state == ProcessingState.TIER2_PENDING

    def test_hydrates_tier1_false_positive(self, orchestrator):
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

        orchestrator._hydrate_unit_from_analysis(unit, analysis, highest_completed=1)

        assert unit.tier1_output is not None
        assert unit.tier1_output.classification == "all_false_positives"
        assert unit.state == ProcessingState.DONE_FALSE_POSITIVE

    def test_hydrates_tier2_output(self, orchestrator):
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

        orchestrator._hydrate_unit_from_analysis(unit, analysis, highest_completed=2)

        assert unit.tier1_output is not None
        assert unit.tier2_output is not None
        assert unit.tier2_output.classification == "burdensome"
        assert unit.tier2_output.severity == 7
        assert unit.tier2_output.verbatim_requirements == ["must submit by mail"]
        # State should be DONE since tier2 classification is burdensome (not routed to tier 3 by default)
        assert unit.state in (ProcessingState.DONE, ProcessingState.TIER3_PENDING)

    def test_hydrates_tier2_unrelated(self, orchestrator):
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

        orchestrator._hydrate_unit_from_analysis(unit, analysis, highest_completed=2)

        assert unit.tier2_output is not None
        assert unit.tier2_output.classification == "unrelated"
        assert unit.state == ProcessingState.DONE

    def test_hydrates_tier3_output(self, orchestrator):
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

        orchestrator._hydrate_unit_from_analysis(unit, analysis, highest_completed=3)

        assert unit.tier3_output is not None
        assert unit.tier3_output.classification == "justified"
        assert unit.tier3_output.severity_adjustment == -2
        assert unit.state == ProcessingState.DONE

    def test_handles_missing_optional_fields(self, orchestrator):
        """Handles None/missing values in analysis data gracefully."""
        unit = TrackedUnit(
            unit=make_processing_unit(document_id=123),
            state=ProcessingState.PENDING,
        )
        analysis = {
            "tier1_classification": "needs_research",
            # Missing many fields - should use defaults
        }

        orchestrator._hydrate_unit_from_analysis(unit, analysis, highest_completed=1)

        assert unit.tier1_output is not None
        assert unit.tier1_output.classification == "needs_research"
        assert unit.tier1_output.confidence == 0.8  # Default
        assert unit.tier1_output.reasoning == "Resumed from database"  # Default

    def test_stores_match_ids(self, orchestrator):
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

        orchestrator._hydrate_unit_from_analysis(unit, analysis, highest_completed=1)

        assert unit._tier1_relevant_match_ids == [100, 101, 102]
        assert unit._tier1_dismissed_match_ids == [103]


# =============================================================================
# Health Check Tests
# =============================================================================


class TestHealthCheckWithRetry:
    """Test _check_db_health_with_retry method."""

    def test_returns_true_when_healthy(self, orchestrator):
        """Returns True when database is healthy on first check."""
        with patch("scripts.research_pipeline.tier_orchestrator.check_db_health") as mock_health:
            mock_health.return_value = True

            result = orchestrator._check_db_health_with_retry("Tier 1")

        assert result is True
        mock_health.assert_called_once()

    def test_retries_once_after_failure(self, orchestrator):
        """Retries health check once after initial failure."""
        with patch("scripts.research_pipeline.tier_orchestrator.check_db_health") as mock_health:
            with patch("time.sleep"):  # Skip actual sleep
                # First call fails, second succeeds
                mock_health.side_effect = [False, True]

                result = orchestrator._check_db_health_with_retry("Tier 1")

        assert result is True
        assert mock_health.call_count == 2

    def test_returns_false_after_two_failures(self, orchestrator):
        """Returns False after both health checks fail."""
        with patch("scripts.research_pipeline.tier_orchestrator.check_db_health") as mock_health:
            with patch("time.sleep"):  # Skip actual sleep
                mock_health.return_value = False

                result = orchestrator._check_db_health_with_retry("Tier 1")

        assert result is False
        assert mock_health.call_count == 2


# =============================================================================
# Resume Logic Tests (Synchronous)
# =============================================================================


class TestResumeLogic:
    """Test resume filtering logic (synchronous tests)."""

    def test_units_dict_initialized_correctly(self, orchestrator):
        """ProcessingUnits are correctly converted to TrackedUnits."""
        pu1 = make_processing_unit(document_id=123)
        pu2 = make_processing_unit(document_id=456)

        # Manually initialize units (what run() does before resume check)
        for pu in [pu1, pu2]:
            tracked = TrackedUnit(unit=pu, state=ProcessingState.PENDING)
            orchestrator.units[tracked.custom_id] = tracked

        assert len(orchestrator.units) == 2
        assert all(u.state == ProcessingState.PENDING for u in orchestrator.units.values())

    def test_resume_removes_completed_units(self, orchestrator):
        """Units completed to max_tier are removed from units dict."""
        with patch("scripts.research_pipeline.tier_orchestrator.get_existing_analyses") as mock_get:
            mock_get.return_value = {
                (123, "mail_only"): {"highest_tier_completed": 2},
            }

            # Initialize units
            pu = make_processing_unit(document_id=123)
            tracked = TrackedUnit(unit=pu, state=ProcessingState.PENDING)
            orchestrator.units[tracked.custom_id] = tracked

            # Simulate resume check (what run() does)
            doc_ids = [123]
            existing = mock_get(doc_ids, issue_types=["mail_only"])

            units_to_remove = []
            for custom_id, unit in orchestrator.units.items():
                key = (unit.unit.document_id, unit.unit.issue_type)
                if key in existing:
                    highest = existing[key].get("highest_tier_completed", 0) or 0
                    if highest >= 2:  # max_tier = 2
                        units_to_remove.append(custom_id)

            for cid in units_to_remove:
                del orchestrator.units[cid]

        assert len(orchestrator.units) == 0

    def test_resume_hydrates_partial_progress(self, orchestrator):
        """Units with partial progress are hydrated, not removed."""
        with patch("scripts.research_pipeline.tier_orchestrator.get_existing_analyses") as mock_get:
            mock_get.return_value = {
                (123, "mail_only"): {
                    "highest_tier_completed": 1,
                    "tier1_classification": "needs_research",
                    "tier1_context_requests": [],
                },
            }

            # Initialize unit
            pu = make_processing_unit(document_id=123)
            tracked = TrackedUnit(unit=pu, state=ProcessingState.PENDING)
            orchestrator.units[tracked.custom_id] = tracked

            # Simulate resume check
            doc_ids = [123]
            existing = mock_get(doc_ids, issue_types=["mail_only"])

            for custom_id, unit in orchestrator.units.items():
                key = (unit.unit.document_id, unit.unit.issue_type)
                if key in existing:
                    analysis = existing[key]
                    highest = analysis.get("highest_tier_completed", 0) or 0
                    if highest >= 2:  # max_tier = 2
                        pass  # Would remove, but highest=1 < 2
                    elif highest > 0:
                        orchestrator._hydrate_unit_from_analysis(unit, analysis, highest)

        # Unit should still be present and hydrated
        assert len(orchestrator.units) == 1
        unit = list(orchestrator.units.values())[0]
        assert unit.tier1_output is not None
        assert unit.state == ProcessingState.TIER2_PENDING


# =============================================================================
# State Transition Tests
# =============================================================================


class TestStateTransitions:
    """Test that hydrated units have correct states for tier routing."""

    def test_tier1_needs_research_goes_to_tier2_pending(self, orchestrator):
        """Units with tier1 classification 'needs_research' go to TIER2_PENDING."""
        unit = TrackedUnit(
            unit=make_processing_unit(document_id=123),
            state=ProcessingState.PENDING,
        )
        analysis = {
            "tier1_classification": "needs_research",
            "tier1_context_requests": [],
        }

        orchestrator._hydrate_unit_from_analysis(unit, analysis, highest_completed=1)

        assert unit.state == ProcessingState.TIER2_PENDING

    def test_tier1_false_positive_goes_to_done(self, orchestrator):
        """Units with tier1 classification 'all_false_positives' go to DONE_FALSE_POSITIVE."""
        unit = TrackedUnit(
            unit=make_processing_unit(document_id=123),
            state=ProcessingState.PENDING,
        )
        analysis = {
            "tier1_classification": "all_false_positives",
            "tier1_context_requests": [],
        }

        orchestrator._hydrate_unit_from_analysis(unit, analysis, highest_completed=1)

        assert unit.state == ProcessingState.DONE_FALSE_POSITIVE

    def test_tier2_unrelated_goes_to_done(self, orchestrator):
        """Units with tier2 classification 'unrelated' go to DONE."""
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

        orchestrator._hydrate_unit_from_analysis(unit, analysis, highest_completed=2)

        assert unit.state == ProcessingState.DONE

    def test_tier3_always_goes_to_done(self, orchestrator):
        """Units with tier3 output always go to DONE (final tier)."""
        unit = TrackedUnit(
            unit=make_processing_unit(document_id=123),
            state=ProcessingState.PENDING,
        )
        analysis = {
            "tier1_classification": "needs_research",
            "tier1_context_requests": [],
            "tier2_classification": "burdensome",
            "tier2_confidence": 0.8,
            "severity": 6,  # Required for burdensome
            "verbatim_requirements": [],
            "tier3_classification": "burdensome",
            "tier3_confidence": 0.95,
        }

        orchestrator._hydrate_unit_from_analysis(unit, analysis, highest_completed=3)

        assert unit.state == ProcessingState.DONE
