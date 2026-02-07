"""
Tests for dry-run resume simulation logic.

These tests ensure the _simulate_resume() function correctly categorizes
documents into new/skipped/resumed/tier3_pending buckets, mirroring the
logic in pipeline_runner.run_pipeline().
"""

import pytest
from unittest.mock import patch, MagicMock

from tests.research_pipeline.conftest import make_processing_unit


class TestSimulateResume:
    """Tests for _simulate_resume() function."""

    def test_empty_processing_units_returns_empty_results(self):
        """Empty input returns empty results for all categories."""
        from scripts.research_pipeline.cli import _simulate_resume

        result = _simulate_resume(
            processing_units=[],
            issue_types=["mail_only"],
            max_tier=2,
        )

        assert result["new"] == []
        assert result["skipped"] == []
        # Empty input returns empty dict for resumed (early return optimization)
        assert result["resumed"] == {}
        assert result["tier3_pending"] == []

    @patch("scripts.research_pipeline.cli.get_existing_analyses")
    def test_new_documents_no_existing_analysis(self, mock_get_analyses):
        """Documents with no existing analysis are categorized as 'new'."""
        from scripts.research_pipeline.cli import _simulate_resume

        # No existing analyses in DB
        mock_get_analyses.return_value = {}

        units = [
            make_processing_unit(document_id=1, issue_type="mail_only"),
            make_processing_unit(document_id=2, issue_type="mail_only"),
        ]

        result = _simulate_resume(
            processing_units=units,
            issue_types=["mail_only"],
            max_tier=2,
        )

        assert len(result["new"]) == 2
        assert len(result["skipped"]) == 0
        assert sum(len(u) for u in result["resumed"].values()) == 0

    @patch("scripts.research_pipeline.cli.get_existing_analyses")
    def test_skipped_documents_completed_to_max_tier(self, mock_get_analyses):
        """Documents completed to max_tier are categorized as 'skipped'."""
        from scripts.research_pipeline.cli import _simulate_resume

        # All docs completed to tier 2
        mock_get_analyses.return_value = {
            (1, "mail_only"): {"highest_tier_completed": 2},
            (2, "mail_only"): {"highest_tier_completed": 3},
        }

        units = [
            make_processing_unit(document_id=1, issue_type="mail_only"),
            make_processing_unit(document_id=2, issue_type="mail_only"),
        ]

        result = _simulate_resume(
            processing_units=units,
            issue_types=["mail_only"],
            max_tier=2,
        )

        assert len(result["new"]) == 0
        assert len(result["skipped"]) == 2
        # Both should be skipped since tier 2 >= max_tier 2 and tier 3 >= max_tier 2
        skipped_tiers = [tier for _, tier in result["skipped"]]
        assert 2 in skipped_tiers
        assert 3 in skipped_tiers

    @patch("scripts.research_pipeline.cli.get_existing_analyses")
    def test_resumed_tier1_to_tier2(self, mock_get_analyses):
        """Documents at tier 1 resume from tier 2."""
        from scripts.research_pipeline.cli import _simulate_resume

        mock_get_analyses.return_value = {
            (1, "mail_only"): {
                "highest_tier_completed": 1,
                "tier1_classification": "needs_research",
            },
        }

        units = [
            make_processing_unit(document_id=1, issue_type="mail_only"),
        ]

        result = _simulate_resume(
            processing_units=units,
            issue_types=["mail_only"],
            max_tier=2,
        )

        assert len(result["new"]) == 0
        assert len(result["skipped"]) == 0
        assert len(result["resumed"][1]) == 1  # 1 doc at tier 1
        assert len(result["resumed"][2]) == 0

    @patch("scripts.research_pipeline.cli.get_existing_analyses")
    def test_resumed_tier2_to_tier3(self, mock_get_analyses):
        """Documents at tier 2 with web_search needed resume to tier 3."""
        from scripts.research_pipeline.cli import _simulate_resume

        mock_get_analyses.return_value = {
            (1, "mail_only"): {
                "highest_tier_completed": 2,
                "tier2_classification": "burdensome",
                "severity": 6,
                "needs_web_search": True,
            },
        }

        units = [
            make_processing_unit(document_id=1, issue_type="mail_only"),
        ]

        result = _simulate_resume(
            processing_units=units,
            issue_types=["mail_only"],
            max_tier=3,
        )

        assert len(result["new"]) == 0
        assert len(result["skipped"]) == 0
        assert len(result["resumed"][2]) == 1  # 1 doc at tier 2
        assert len(result["tier3_pending"]) == 1

    @patch("scripts.research_pipeline.cli.get_existing_analyses")
    def test_tier3_pending_needs_web_search_flag(self, mock_get_analyses):
        """Documents with needs_web_search=true are marked as tier3_pending."""
        from scripts.research_pipeline.cli import _simulate_resume

        mock_get_analyses.return_value = {
            (1, "mail_only"): {
                "highest_tier_completed": 2,
                "tier2_classification": "justified",
                "severity": 3,
                "needs_web_search": True,
            },
        }

        units = [
            make_processing_unit(document_id=1, issue_type="mail_only"),
        ]

        result = _simulate_resume(
            processing_units=units,
            issue_types=["mail_only"],
            max_tier=3,
        )

        assert len(result["tier3_pending"]) == 1

    @patch("scripts.research_pipeline.cli.get_existing_analyses")
    def test_tier3_pending_cites_federal_statute(self, mock_get_analyses):
        """Documents citing federal statute are marked as tier3_pending."""
        from scripts.research_pipeline.cli import _simulate_resume

        mock_get_analyses.return_value = {
            (1, "mail_only"): {
                "highest_tier_completed": 2,
                "tier2_classification": "burdensome",
                "severity": 5,
                "needs_web_search": False,
                "cites_federal_statute": True,
            },
        }

        units = [
            make_processing_unit(document_id=1, issue_type="mail_only"),
        ]

        result = _simulate_resume(
            processing_units=units,
            issue_types=["mail_only"],
            max_tier=3,
        )

        assert len(result["tier3_pending"]) == 1

    @patch("scripts.research_pipeline.cli.get_existing_analyses")
    def test_tier3_pending_high_severity_burdensome(self, mock_get_analyses):
        """High severity burdensome docs (severity >= 8) are marked as tier3_pending."""
        from scripts.research_pipeline.cli import _simulate_resume

        mock_get_analyses.return_value = {
            (1, "mail_only"): {
                "highest_tier_completed": 2,
                "tier2_classification": "burdensome",
                "severity": 8,
                "needs_web_search": False,
            },
        }

        units = [
            make_processing_unit(document_id=1, issue_type="mail_only"),
        ]

        result = _simulate_resume(
            processing_units=units,
            issue_types=["mail_only"],
            max_tier=3,
        )

        assert len(result["tier3_pending"]) == 1

    @patch("scripts.research_pipeline.cli.get_existing_analyses")
    def test_tier3_not_triggered_for_low_severity(self, mock_get_analyses):
        """Low severity burdensome docs (severity < 8) don't trigger tier3 unless other flags."""
        from scripts.research_pipeline.cli import _simulate_resume

        mock_get_analyses.return_value = {
            (1, "mail_only"): {
                "highest_tier_completed": 2,
                "tier2_classification": "burdensome",
                "severity": 5,
                "needs_web_search": False,
                "cites_federal_statute": False,
                "claims_no_alternative": False,
                "federal_mandate_suspected": False,
            },
        }

        units = [
            make_processing_unit(document_id=1, issue_type="mail_only"),
        ]

        result = _simulate_resume(
            processing_units=units,
            issue_types=["mail_only"],
            max_tier=3,
        )

        assert len(result["tier3_pending"]) == 0

    @patch("scripts.research_pipeline.cli.get_existing_analyses")
    def test_mixed_documents_correct_categorization(self, mock_get_analyses):
        """Mix of new/skipped/resumed docs are correctly categorized."""
        from scripts.research_pipeline.cli import _simulate_resume

        mock_get_analyses.return_value = {
            # Doc 1: Completed tier 3, should be skipped
            (1, "mail_only"): {"highest_tier_completed": 3},
            # Doc 2: Completed tier 1, should resume
            (2, "wet_signature"): {
                "highest_tier_completed": 1,
                "tier1_classification": "needs_research",
            },
            # Doc 3: Completed tier 2 with web search needed
            (3, "notarization"): {
                "highest_tier_completed": 2,
                "tier2_classification": "burdensome",
                "severity": 6,
                "needs_web_search": True,
            },
            # Doc 4 not in DB - new
        }

        units = [
            make_processing_unit(document_id=1, issue_type="mail_only"),
            make_processing_unit(document_id=2, issue_type="wet_signature"),
            make_processing_unit(document_id=3, issue_type="notarization"),
            make_processing_unit(document_id=4, issue_type="mail_only"),
        ]

        result = _simulate_resume(
            processing_units=units,
            issue_types=["mail_only", "wet_signature", "notarization"],
            max_tier=3,
        )

        assert len(result["new"]) == 1  # Doc 4
        assert result["new"][0].document_id == 4

        assert len(result["skipped"]) == 1  # Doc 1
        assert result["skipped"][0][0].document_id == 1

        assert len(result["resumed"][1]) == 1  # Doc 2 at tier 1
        assert result["resumed"][1][0][0].document_id == 2

        assert len(result["resumed"][2]) == 1  # Doc 3 at tier 2
        assert result["resumed"][2][0][0].document_id == 3

        assert len(result["tier3_pending"]) == 1  # Doc 3 needs web search
        assert result["tier3_pending"][0][0].document_id == 3


class TestSimulateResumeWithPreloadedAnalyses:
    """Tests for _simulate_resume() with pre-loaded existing_analyses (new fetch behavior)."""

    def test_preloaded_analyses_skips_db_query(self):
        """When existing_analyses is provided, get_existing_analyses is not called."""
        from scripts.research_pipeline.cli import _simulate_resume

        units = [
            make_processing_unit(document_id=1, issue_type="mail_only"),
        ]

        # Provide pre-loaded analyses directly
        existing_analyses = {
            (1, "mail_only"): {"highest_tier_completed": 1, "tier1_classification": "needs_research"},
        }

        # This should not raise - no DB call needed
        result = _simulate_resume(
            processing_units=units,
            issue_types=["mail_only"],
            max_tier=2,
            existing_analyses=existing_analyses,
        )

        # Should find doc 1 as resumed from tier 1
        assert len(result["new"]) == 0
        assert len(result["resumed"][1]) == 1
        # tier3_pending_from_db should be empty since analyses were pre-loaded
        assert result["tier3_pending_from_db"] == []

    def test_preloaded_new_doc_no_analysis(self):
        """Doc not in existing_analyses is categorized as new."""
        from scripts.research_pipeline.cli import _simulate_resume

        units = [
            make_processing_unit(document_id=1, issue_type="mail_only"),
            make_processing_unit(document_id=2, issue_type="mail_only"),
        ]

        # Only doc 1 has analysis
        existing_analyses = {
            (1, "mail_only"): {"highest_tier_completed": 2},
        }

        result = _simulate_resume(
            processing_units=units,
            issue_types=["mail_only"],
            max_tier=2,
            existing_analyses=existing_analyses,
        )

        assert len(result["new"]) == 1
        assert result["new"][0].document_id == 2
        assert len(result["skipped"]) == 1  # doc 1 completed to max tier

    def test_preloaded_tier3_pending_included(self):
        """Tier3-pending docs from pre-loaded analyses are detected."""
        from scripts.research_pipeline.cli import _simulate_resume

        units = [
            make_processing_unit(document_id=1, issue_type="mail_only"),
        ]

        existing_analyses = {
            (1, "mail_only"): {
                "highest_tier_completed": 2,
                "tier2_classification": "burdensome",
                "severity": 8,
                "needs_web_search": True,
            },
        }

        result = _simulate_resume(
            processing_units=units,
            issue_types=["mail_only"],
            max_tier=3,
            existing_analyses=existing_analyses,
        )

        # Should find doc as tier3_pending
        assert len(result["tier3_pending"]) == 1
        # And tier3_pending_from_db should be empty
        assert result["tier3_pending_from_db"] == []

    def test_empty_units_with_preloaded_analyses_returns_empty(self):
        """Empty processing units with pre-loaded analyses returns empty results."""
        from scripts.research_pipeline.cli import _simulate_resume

        result = _simulate_resume(
            processing_units=[],
            issue_types=["mail_only"],
            max_tier=3,
            existing_analyses={},  # Pre-loaded (even if empty)
        )

        assert result["new"] == []
        assert result["skipped"] == []
        assert result["resumed"] == {}
        assert result["tier3_pending"] == []
        assert result["tier3_pending_from_db"] == []  # No DB query since pre-loaded


class TestWouldEscalateToTier3:
    """Tests for _would_escalate_to_tier3() helper function."""

    def test_needs_web_search_triggers_escalation(self):
        """needs_web_search=True triggers escalation."""
        from scripts.research_pipeline.cli import _would_escalate_to_tier3

        analysis = {"needs_web_search": True}
        assert _would_escalate_to_tier3(analysis) is True

    def test_cites_federal_triggers_escalation(self):
        """cites_federal_statute=True triggers escalation."""
        from scripts.research_pipeline.cli import _would_escalate_to_tier3

        analysis = {"cites_federal_statute": True}
        assert _would_escalate_to_tier3(analysis) is True

    def test_claims_no_alternative_high_severity_triggers(self):
        """claims_no_alternative with severity >= 7 triggers escalation."""
        from scripts.research_pipeline.cli import _would_escalate_to_tier3

        analysis = {"claims_no_alternative": True, "severity": 7}
        assert _would_escalate_to_tier3(analysis) is True

        # Severity 6 should not trigger
        analysis = {"claims_no_alternative": True, "severity": 6}
        assert _would_escalate_to_tier3(analysis) is False

    def test_burdensome_high_severity_triggers(self):
        """burdensome with severity >= 8 triggers escalation."""
        from scripts.research_pipeline.cli import _would_escalate_to_tier3

        analysis = {"tier2_classification": "burdensome", "severity": 8}
        assert _would_escalate_to_tier3(analysis) is True

        # Severity 7 should not trigger for burdensome alone
        analysis = {"tier2_classification": "burdensome", "severity": 7}
        assert _would_escalate_to_tier3(analysis) is False

    def test_federal_mandate_suspected_triggers(self):
        """federal_mandate_suspected=True triggers escalation."""
        from scripts.research_pipeline.cli import _would_escalate_to_tier3

        analysis = {"federal_mandate_suspected": True}
        assert _would_escalate_to_tier3(analysis) is True

    def test_no_triggers_returns_false(self):
        """Document without any triggers does not escalate."""
        from scripts.research_pipeline.cli import _would_escalate_to_tier3

        analysis = {
            "tier2_classification": "justified",
            "severity": 3,
            "needs_web_search": False,
            "cites_federal_statute": False,
            "claims_no_alternative": False,
            "federal_mandate_suspected": False,
        }
        assert _would_escalate_to_tier3(analysis) is False


class TestPrintResumeSimulation:
    """Tests for _print_resume_simulation() output formatting."""

    def test_prints_without_error_empty_results(self, capsys):
        """Function doesn't crash on empty results."""
        from scripts.research_pipeline.cli import _print_resume_simulation

        simulation = {"new": [], "skipped": [], "resumed": {1: [], 2: []}, "tier3_pending": []}
        _print_resume_simulation(simulation, max_tier=2)

        captured = capsys.readouterr()
        assert "RESUME SIMULATION" in captured.out
        assert "New documents" in captured.out
        assert "Skipped" in captured.out

    def test_prints_new_documents_by_issue(self, capsys):
        """New documents are grouped by issue type in output."""
        from scripts.research_pipeline.cli import _print_resume_simulation

        units = [
            make_processing_unit(document_id=1, issue_type="mail_only"),
            make_processing_unit(document_id=2, issue_type="mail_only"),
            make_processing_unit(document_id=3, issue_type="wet_signature"),
        ]

        simulation = {"new": units, "skipped": [], "resumed": {1: [], 2: []}, "tier3_pending": []}
        _print_resume_simulation(simulation, max_tier=2)

        captured = capsys.readouterr()
        assert "New documents (no existing analysis): 3" in captured.out
        assert "mail_only: 2" in captured.out
        assert "wet_signature: 1" in captured.out

    def test_prints_tier3_candidates_with_reasons(self, capsys):
        """Tier 3 candidates show escalation reasons."""
        from scripts.research_pipeline.cli import _print_resume_simulation

        unit = make_processing_unit(document_id=1, issue_type="mail_only", citation="N.J.A.C. 1:1-1.1")
        analysis = {
            "tier2_classification": "burdensome",
            "severity": 8,
            "needs_web_search": True,
        }

        simulation = {
            "new": [],
            "skipped": [],
            "resumed": {1: [], 2: [(unit, analysis)]},
            "tier3_pending": [(unit, analysis)],
        }
        _print_resume_simulation(simulation, max_tier=3)

        captured = capsys.readouterr()
        assert "Web search (Tier 3) candidates from current fetch: 1" in captured.out
        assert "N.J.A.C. 1:1-1.1" in captured.out
        assert "needs_web_search" in captured.out
