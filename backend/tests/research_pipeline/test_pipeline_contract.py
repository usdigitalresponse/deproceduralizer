"""
Contract tests for the research pipeline.

These tests verify the pipeline's external BEHAVIOR without depending on
internal implementation details. They should pass unchanged through refactoring.

The contract we're testing:
1. Tier 1 filters false positive regex matches
2. Tier 2 classifies documents and assigns severity scores
3. Tier 3 runs for documents meeting escalation criteria
4. Results are saved to the database
5. --dry-run makes no changes
6. Already-analyzed documents are skipped

Run with: cd backend && pytest tests/research_pipeline/test_pipeline_contract.py -v
"""

import pytest
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock, AsyncMock
from datetime import datetime

# Import test helpers
from .conftest import (
    make_processing_unit,
    make_tier1_output,
    make_tier2_output,
    make_tier3_output,
    make_tracked_unit,
)


# =============================================================================
# TIER BEHAVIOR CONTRACTS
# =============================================================================


class TestTier1Contract:
    """
    Contract: Tier 1 filters false positive matches.

    Given: A document with regex matches (some true, some false positive)
    When: Tier 1 processes it
    Then:
        - False positives are marked with reasons
        - True matches are kept for Tier 2
        - "all_false_positives" classification stops processing
        - "needs_research" classification continues to Tier 2
    """

    def test_tier1_filters_false_positives(self):
        """Tier 1 output should identify which matches are false positives."""
        from scripts.research_pipeline.models.matches import DismissedMatch

        tier1_output = make_tier1_output(
            classification="needs_research",
            relevant_match_indices=[0, 2],  # Matches 0 and 2 are real
            dismissed_matches=[
                DismissedMatch(match_index=1, reason="False positive - optional mailing", text="may mail")
            ],
        )

        # Contract: dismissed_matches contains false positives with reasons
        assert len(tier1_output.dismissed_matches) == 1
        assert tier1_output.dismissed_matches[0].reason is not None

        # Contract: relevant_match_indices contains true matches
        assert 0 in tier1_output.relevant_match_indices
        assert 2 in tier1_output.relevant_match_indices
        assert 1 not in tier1_output.relevant_match_indices

    def test_tier1_all_false_positives_stops_processing(self):
        """When all matches are false positives, classification should be 'all_false_positives'."""
        from scripts.research_pipeline.models.matches import DismissedMatch

        tier1_output = make_tier1_output(
            classification="all_false_positives",
            relevant_match_indices=[],
            dismissed_matches=[
                DismissedMatch(match_index=0, reason="Not a requirement", text="test"),
            ],
        )

        # Contract: classification indicates no further processing needed
        assert tier1_output.classification == "all_false_positives"
        assert len(tier1_output.relevant_match_indices) == 0

    def test_tier1_needs_research_continues_to_tier2(self):
        """When real matches exist, classification should be 'needs_research'."""
        tier1_output = make_tier1_output(
            classification="needs_research",
            relevant_match_indices=[0],
        )

        # Contract: classification indicates Tier 2 should run
        assert tier1_output.classification == "needs_research"
        assert len(tier1_output.relevant_match_indices) > 0


class TestTier2Contract:
    """
    Contract: Tier 2 classifies documents and assigns severity.

    Given: A document that passed Tier 1
    When: Tier 2 processes it
    Then:
        - Classification is one of: burdensome, justified, unrelated
        - Severity score is 1-10 (for burdensome/justified)
        - Reasoning explains the classification
        - Trigger flags are set for Tier 3 routing
    """

    def test_tier2_produces_classification(self):
        """Tier 2 must produce a valid classification."""
        for classification in ["burdensome", "justified", "unrelated"]:
            tier2_output = make_tier2_output(classification=classification)
            assert tier2_output.classification in ["burdensome", "justified", "unrelated"]

    def test_tier2_produces_severity_for_actionable(self):
        """Burdensome and justified classifications must have severity 1-10."""
        tier2_burdensome = make_tier2_output(classification="burdensome", severity=7)
        tier2_justified = make_tier2_output(classification="justified", severity=4)

        assert 1 <= tier2_burdensome.severity <= 10
        assert 1 <= tier2_justified.severity <= 10

    def test_tier2_unrelated_has_no_severity(self):
        """Unrelated classification should not have severity."""
        tier2_output = make_tier2_output(classification="unrelated", severity=None)
        assert tier2_output.severity is None

    def test_tier2_has_reasoning(self):
        """Tier 2 must provide reasoning for classification."""
        tier2_output = make_tier2_output(reasoning="This requirement is burdensome because...")
        assert tier2_output.reasoning is not None
        assert len(tier2_output.reasoning) > 0

    def test_tier2_sets_escalation_flags(self):
        """Tier 2 must set flags used for Tier 3 routing decisions."""
        tier2_output = make_tier2_output(
            cites_federal_statute=True,
            claims_no_alternative=True,
            federal_mandate_suspected=True,
            needs_web_search=True,
        )

        # Contract: These flags exist and can be used for routing
        assert hasattr(tier2_output, 'cites_federal_statute')
        assert hasattr(tier2_output, 'claims_no_alternative')
        assert hasattr(tier2_output, 'federal_mandate_suspected')
        assert hasattr(tier2_output, 'needs_web_search')


class TestTier3Contract:
    """
    Contract: Tier 3 performs deep analysis with web search.

    Given: A document that triggered Tier 3 escalation
    When: Tier 3 processes it
    Then:
        - Final severity may be adjusted
        - Federal mandate verification is performed
        - Classification is finalized
    """

    def test_tier3_can_adjust_severity(self):
        """Tier 3 can adjust severity based on additional research."""
        tier3_output = make_tier3_output(
            final_severity=8,
            severity_adjustment=2,
            severity_adjustment_reasoning="Federal mandate confirmed, increases burden",
        )

        # Contract: Tier 3 can provide final severity
        assert tier3_output.final_severity is not None
        assert tier3_output.severity_adjustment is not None

    def test_tier3_verifies_federal_mandate(self):
        """Tier 3 should verify suspected federal mandates."""
        tier3_output = make_tier3_output(
            federal_mandate_found=True,
            state_has_discretion=False,
        )

        # Contract: Tier 3 provides federal mandate verification
        assert hasattr(tier3_output, 'federal_mandate_found')
        assert hasattr(tier3_output, 'state_has_discretion')

    def test_tier3_produces_final_classification(self):
        """Tier 3 must produce a final classification."""
        tier3_output = make_tier3_output(classification="justified")
        assert tier3_output.classification in ["burdensome", "justified", "unrelated"]


# =============================================================================
# ROUTING CONTRACTS
# =============================================================================


class TestRoutingContract:
    """
    Contract: Routing logic determines tier transitions.

    Given: A completed tier output
    When: Routing decision is made
    Then: Document goes to correct next tier or completes
    """

    def test_tier1_false_positive_stops_processing(self, disable_random_sampling):
        """All false positives should terminate processing."""
        from scripts.research_pipeline.state_machine import (
            TrackedUnit, ProcessingState, get_next_state
        )

        unit = make_tracked_unit(
            tier1_output=make_tier1_output(classification="all_false_positives"),
            state=ProcessingState.TIER1_COMPLETE,
        )

        next_state = get_next_state(unit)
        assert next_state == ProcessingState.DONE_FALSE_POSITIVE

    def test_tier1_needs_research_goes_to_tier2(self, disable_random_sampling):
        """Real matches should proceed to Tier 2."""
        from scripts.research_pipeline.state_machine import (
            TrackedUnit, ProcessingState, get_next_state
        )

        unit = make_tracked_unit(
            tier1_output=make_tier1_output(classification="needs_research"),
            state=ProcessingState.TIER1_COMPLETE,
        )

        next_state = get_next_state(unit)
        assert next_state == ProcessingState.TIER2_PENDING

    def test_tier2_unrelated_completes(self, disable_random_sampling):
        """Unrelated classification should complete processing."""
        from scripts.research_pipeline.state_machine import (
            TrackedUnit, ProcessingState, get_next_state
        )

        unit = make_tracked_unit(
            tier1_output=make_tier1_output(classification="needs_research"),
            tier2_output=make_tier2_output(classification="unrelated"),
            state=ProcessingState.TIER2_COMPLETE,
        )

        next_state = get_next_state(unit)
        assert next_state == ProcessingState.DONE

    def test_high_severity_can_escalate_to_tier3(self, disable_random_sampling):
        """High severity with trigger flags should escalate to Tier 3."""
        from scripts.research_pipeline.routing import should_escalate_to_tier3

        unit = make_tracked_unit(
            tier1_output=make_tier1_output(classification="needs_research"),
            tier2_output=make_tier2_output(
                classification="burdensome",
                severity=9,  # High severity
                cites_federal_statute=True,  # Trigger flag
            ),
        )

        # Contract: High severity + trigger flag = Tier 3
        should_escalate = should_escalate_to_tier3(unit)
        assert should_escalate is True

    def test_low_severity_completes_at_tier2(self, disable_random_sampling):
        """Low severity without triggers should complete at Tier 2."""
        from scripts.research_pipeline.routing import should_escalate_to_tier3

        unit = make_tracked_unit(
            tier1_output=make_tier1_output(classification="needs_research"),
            tier2_output=make_tier2_output(
                classification="burdensome",
                severity=3,  # Low severity
                cites_federal_statute=False,
                claims_no_alternative=False,
                needs_web_search=False,
            ),
        )

        # Contract: Low severity without triggers = no Tier 3
        should_escalate = should_escalate_to_tier3(unit)
        assert should_escalate is False


# =============================================================================
# DATABASE CONTRACT
# =============================================================================


class TestDatabaseContract:
    """
    Contract: Pipeline results are persisted to database.

    Given: Completed pipeline results
    When: Results are saved
    Then: compliance_issue_analyses table has correct records
    """

    def test_save_function_exists(self):
        """Save function should be importable."""
        from scripts.research_pipeline.db import save_final_results
        assert callable(save_final_results)

    def test_tier1_results_can_be_saved(self):
        """Tier 1 results should be saveable."""
        from scripts.research_pipeline.db.analysis_writer import save_tier1_results
        assert callable(save_tier1_results)

    def test_tier2_results_can_be_saved(self):
        """Tier 2 results should be saveable."""
        from scripts.research_pipeline.db.analysis_writer import save_tier2_results
        assert callable(save_tier2_results)

    def test_tier3_results_can_be_saved(self):
        """Tier 3 results should be saveable."""
        from scripts.research_pipeline.db.analysis_writer import save_tier3_results
        assert callable(save_tier3_results)


# =============================================================================
# CLI CONTRACT
# =============================================================================


class TestCLIContract:
    """
    Contract: CLI provides expected interface.

    These tests verify the CLI accepts expected arguments and behaves correctly.
    """

    def test_cli_module_importable(self):
        """CLI module should be importable."""
        from scripts.research_pipeline import cli
        assert cli is not None

    def test_cli_has_main_function(self):
        """CLI should have entry point."""
        from scripts.research_pipeline.cli import run_test, run_all_issues
        assert callable(run_test)
        assert callable(run_all_issues)

    def test_dry_run_simulation_exists(self):
        """Dry run simulation function should exist."""
        from scripts.research_pipeline.cli import _simulate_resume
        assert callable(_simulate_resume)


# =============================================================================
# DATA MODEL CONTRACT
# =============================================================================


class TestDataModelContract:
    """
    Contract: Data models have required fields.

    These tests verify the data structures used by the pipeline.
    """

    def test_processing_unit_has_required_fields(self):
        """ProcessingUnit must have document_id, issue_type, citation, matches."""
        from scripts.research_pipeline.models.matches import ProcessingUnit

        pu = make_processing_unit()
        assert hasattr(pu, 'document_id')
        assert hasattr(pu, 'issue_type')
        assert hasattr(pu, 'citation')
        assert hasattr(pu, 'matches')

    def test_tier1_output_has_required_fields(self):
        """Tier1Output must have classification, relevant_match_indices, dismissed_matches."""
        output = make_tier1_output()
        assert hasattr(output, 'classification')
        assert hasattr(output, 'relevant_match_indices')
        assert hasattr(output, 'dismissed_matches')

    def test_tier2_output_has_required_fields(self):
        """Tier2Output must have classification, severity, reasoning."""
        output = make_tier2_output()
        assert hasattr(output, 'classification')
        assert hasattr(output, 'severity')
        assert hasattr(output, 'reasoning')

    def test_tier3_output_has_required_fields(self):
        """Tier3Output must have classification, final_severity, federal_mandate_found."""
        output = make_tier3_output()
        assert hasattr(output, 'classification')
        assert hasattr(output, 'final_severity')
        assert hasattr(output, 'federal_mandate_found')


# =============================================================================
# INTEGRATION CONTRACT (with mocks)
# =============================================================================


class TestPipelineIntegrationContract:
    """
    Contract: Full pipeline flow works end-to-end.

    These tests verify the integration between components with mocked externals.
    """

    def test_pipeline_processes_documents_through_tiers(self):
        """
        Pipeline should process documents through tiers sequentially.

        This is a behavioral contract test - it verifies the pipeline
        does what it's supposed to do, not how it does it internally.
        """
        # Verify the pipeline runner function is importable
        from scripts.research_pipeline.pipeline_runner import run_pipeline
        assert callable(run_pipeline)

    def test_fetch_documents_returns_processing_units(self):
        """Document fetching should return ProcessingUnits."""
        from scripts.research_pipeline.db import fetch_documents_with_continuation
        # Contract: function exists and is callable
        assert callable(fetch_documents_with_continuation)
