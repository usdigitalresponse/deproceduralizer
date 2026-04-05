"""
Tests for the review summary generator.

Tests the prompt assembly, tier block construction, and flag formatting
without making actual API calls.

Run with: cd backend && pytest tests/research_pipeline/test_summary_generator.py -v
"""

import pytest
from scripts.research_pipeline.summary_generator import (
    _build_tier2_block,
    _build_tier3_block,
    _format_flag,
    _build_issue_type_block,
    _row_to_analysis_dict,
)


class TestFormatFlag:
    """Tests for _format_flag — handles both EvidencedFlag objects and dicts."""

    def test_none_returns_na(self):
        val, reason = _format_flag(None)
        assert val == "N/A"
        assert reason == "N/A"

    def test_dict_flag(self):
        flag = {"value": True, "reason": "Federal law requires this"}
        val, reason = _format_flag(flag)
        assert val == "True"
        assert reason == "Federal law requires this"

    def test_dict_flag_false(self):
        flag = {"value": False, "reason": "No federal mandate found"}
        val, reason = _format_flag(flag)
        assert val == "False"
        assert reason == "No federal mandate found"

    def test_empty_dict(self):
        val, reason = _format_flag({})
        assert val == "N/A"
        assert reason == "N/A"


class TestBuildTier2Block:
    """Tests for conditional Tier 2 block assembly."""

    def test_returns_empty_when_no_classification(self):
        analysis = {"tier2_classification": None}
        assert _build_tier2_block(analysis) == ""

    def test_returns_block_with_classification(self):
        analysis = {
            "tier2_classification": "burdensome",
            "tier2_reasoning": "The requirement is outdated",
            "severity_calculation": "Base 5 + no alt (+2) = 7",
            "federal_citation": "None",
        }
        block = _build_tier2_block(analysis)
        assert "TIER 2 ANALYSIS" in block
        assert "burdensome" in block
        assert "The requirement is outdated" in block
        assert "Base 5" in block

    def test_handles_missing_fields_gracefully(self):
        analysis = {"tier2_classification": "justified"}
        block = _build_tier2_block(analysis)
        assert "justified" in block
        assert "N/A" in block  # missing fields default to N/A


class TestBuildTier3Block:
    """Tests for conditional Tier 3 block assembly with evidence flags."""

    def test_returns_empty_when_no_classification(self):
        analysis = {"tier3_classification": None}
        assert _build_tier3_block(analysis) == ""

    def test_includes_evidence_flags(self):
        analysis = {
            "tier3_classification": "burdensome",
            "tier3_reasoning": "Web search confirmed",
            "web_search_summary": "Found alternatives in peer states",
            "tier3_severity_adjustment": "+1",
            "tier3_severity_adjustment_reasoning": "Higher impact",
            "federal_mandate_confirmed": {"value": False, "reason": "No federal requirement"},
            "state_discretion_found": {"value": True, "reason": "State can modernize"},
            "modernized_alternative_found": {"value": True, "reason": "FL and TX use e-signatures"},
            "superseded_by_law": None,
            "advocacy_for_change": None,
            "context_used": [],
            "cleanup_recommendation": "Accept electronic signatures",
        }
        block = _build_tier3_block(analysis)
        assert "TIER 3 ANALYSIS" in block
        assert "Web search confirmed" in block
        assert "Federal Mandate: False" in block
        assert "State Has Discretion: True" in block
        assert "Peer State Alternative: True" in block
        assert "FL and TX use e-signatures" in block
        assert "Accept electronic signatures" in block

    def test_extracts_web_quotes_from_context_used(self):
        analysis = {
            "tier3_classification": "burdensome",
            "tier3_reasoning": "Confirmed",
            "web_search_summary": "Found evidence",
            "tier3_severity_adjustment": None,
            "tier3_severity_adjustment_reasoning": None,
            "federal_mandate_confirmed": None,
            "state_discretion_found": None,
            "modernized_alternative_found": None,
            "superseded_by_law": None,
            "advocacy_for_change": None,
            "context_used": [
                {"type": "web", "identifier": "https://example.com", "quote": "States may accept e-sigs", "relevance": "Proves discretion"},
                {"type": "statute", "identifier": "N.J.S.A. 1:1", "quote": "Not a web source"},
            ],
            "cleanup_recommendation": None,
        }
        block = _build_tier3_block(analysis)
        assert "https://example.com" in block
        assert "States may accept e-sigs" in block
        # Statute entries should not appear in web quotes
        assert "N.J.S.A." not in block


class TestRowToAnalysisDict:
    """Tests for DB row parsing including tier3_flags extraction."""

    def _make_row(self, tier3_flags=None):
        """Create a minimal DB row tuple matching the SELECT column order."""
        return (
            12345,        # document_id
            None,         # guidance_document_id
            "mail_only",  # issue_type
            2,            # highest_tier_completed
            "needs_research",  # tier1_classification
            "Tier 1 reasoning",  # tier1_reasoning
            None,         # tier1_dismissed_reasons
            "burdensome",  # tier2_classification
            "Tier 2 reasoning",  # tier2_reasoning
            5,            # severity
            "Base 5",     # severity_calculation
            5,            # final_severity
            "Argument for",  # argument_for_regulation
            "Argument against",  # argument_against_regulation
            None,         # federal_citation
            "small_businesses",  # primary_affected_population
            ["must be mailed"],  # verbatim_requirements
            [],           # context_used
            None,         # tier3_classification
            None,         # tier3_reasoning
            None,         # tier3_severity_adjustment
            None,         # tier3_severity_adjustment_reasoning
            None,         # web_search_summary
            None,         # cleanup_recommendation
            "18 NYCRR 505.14",  # citation
            "Some regulation",  # title
            "A summary",  # summary
            "regulation",  # source_type
            tier3_flags,  # tier3_flags
        )

    def test_basic_fields(self):
        row = self._make_row()
        result = _row_to_analysis_dict(row)
        assert result["document_id"] == 12345
        assert result["issue_type"] == "mail_only"
        assert result["tier2_classification"] == "burdensome"
        assert result["citation"] == "18 NYCRR 505.14"
        assert result["verbatim_requirements"] == ["must be mailed"]

    def test_tier3_flags_extracted_as_dicts(self):
        flags = {
            "federal_mandate_confirmed": {"value": True, "reason": "42 CFR requires it", "evidence": []},
            "state_discretion_found": {"value": False, "reason": "Federal preemption", "evidence": []},
        }
        row = self._make_row(tier3_flags=flags)
        result = _row_to_analysis_dict(row)
        assert result["federal_mandate_confirmed"]["value"] is True
        assert result["federal_mandate_confirmed"]["reason"] == "42 CFR requires it"
        assert result["state_discretion_found"]["value"] is False

    def test_tier3_flags_none_handled(self):
        row = self._make_row(tier3_flags=None)
        result = _row_to_analysis_dict(row)
        assert result["federal_mandate_confirmed"] is None
        assert result["state_discretion_found"] is None

    def test_tier3_flags_empty_dict(self):
        row = self._make_row(tier3_flags={})
        result = _row_to_analysis_dict(row)
        assert result["federal_mandate_confirmed"] is None


class TestBuildIssueTypeBlock:
    """Tests for issue type context block assembly."""

    def test_returns_block_with_context(self):
        block = _build_issue_type_block("mail_only")
        assert "ISSUE TYPE CONTEXT" in block
        assert "mail_only" in block.lower() or "Mail" in block

    def test_unknown_issue_type_doesnt_crash(self):
        block = _build_issue_type_block("nonexistent_issue_type_xyz")
        assert "ISSUE TYPE CONTEXT" in block
        assert "nonexistent_issue_type_xyz" in block
