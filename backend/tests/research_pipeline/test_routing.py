"""Tests for research_pipeline/routing.py - Tier 3 escalation logic.

Tests cover:
- is_high_risk_issue_type() - set + prefix matching
- should_escalate_to_tier3() - all escalation triggers
- should_escalate_to_tier3_with_reason() - combined function
- get_tier3_trigger_reason() - reason extraction
- get_all_trigger_reasons() - all triggers enumeration
"""

import pytest
from unittest.mock import patch, MagicMock

# Import the module under test
from scripts.research_pipeline.routing import (
    is_high_risk_issue_type,
    should_escalate_to_tier3,
    should_escalate_to_tier3_with_reason,
    get_tier3_trigger_reason,
    get_all_trigger_reasons,
    HIGH_RISK_ISSUE_TYPES,
    HIGH_RISK_ISSUE_PREFIXES,
    RANDOM_SAMPLE_RATE,
    LOW_CONFIDENCE_THRESHOLD,
    HIGH_RISK_SEVERITY_THRESHOLD,
    BURDENSOME_SEVERITY_THRESHOLD,
    NO_ALTERNATIVE_SEVERITY_THRESHOLD,
)

# Import test helpers
from .conftest import make_tracked_unit, make_tier2_output


class TestIsHighRiskIssueType:
    """Test is_high_risk_issue_type() function."""

    def test_explicit_high_risk_types(self):
        """Issue types in HIGH_RISK_ISSUE_TYPES should return True."""
        for issue_type in HIGH_RISK_ISSUE_TYPES:
            assert is_high_risk_issue_type(issue_type) is True, f"{issue_type} should be high-risk"

    def test_in_person_prefix(self):
        """Issue types starting with 'in_person' should be high-risk."""
        in_person_types = [
            "in_person_submission",
            "in_person_appearance",
            "in_person_pickup",
            "in_person_interview",
        ]
        for issue_type in in_person_types:
            assert is_high_risk_issue_type(issue_type) is True, f"{issue_type} should be high-risk"

    def test_non_high_risk_types(self):
        """Other issue types should not be high-risk."""
        non_high_risk = [
            "mail_only",
            "excessive_documentation",
            "outdated_reference",
            "business_days",
            "arbitrary_deadline",
        ]
        for issue_type in non_high_risk:
            assert is_high_risk_issue_type(issue_type) is False, f"{issue_type} should NOT be high-risk"

    def test_partial_prefix_not_matched(self):
        """Partial prefixes should not match."""
        assert is_high_risk_issue_type("in_") is False
        assert is_high_risk_issue_type("newspaper_ad") is False  # newspaper is exact, not prefix
        assert is_high_risk_issue_type("notary") is False  # notarization is the key, not notary


class TestShouldEscalateToTier3:
    """Test should_escalate_to_tier3() function with all trigger conditions."""

    def test_no_tier2_output_returns_false(self):
        """Unit without tier2_output should not escalate."""
        unit = make_tracked_unit(tier1_output=MagicMock())
        unit.tier2_output = None
        assert should_escalate_to_tier3(unit) is False

    def test_unrelated_never_escalates(self):
        """Unrelated classification should never escalate."""
        unit = make_tracked_unit(
            tier2_output=make_tier2_output(classification="unrelated", severity=10)
        )
        assert should_escalate_to_tier3(unit) is False

    def test_high_risk_justified_always_escalates(self):
        """High-risk issue type with justified classification always escalates."""
        for issue_type in ["wet_signature", "notarization", "in_person_submission"]:
            unit = make_tracked_unit(
                tier2_output=make_tier2_output(classification="justified", severity=3),
                issue_type=issue_type,
            )
            assert should_escalate_to_tier3(unit) is True, f"{issue_type} justified should escalate"

    def test_high_risk_burdensome_with_severity_escalates(self):
        """High-risk issue type with burdensome + severity >= 7 escalates."""
        unit = make_tracked_unit(
            tier2_output=make_tier2_output(classification="burdensome", severity=7),
            issue_type="wet_signature",
        )
        assert should_escalate_to_tier3(unit) is True

    def test_high_risk_burdensome_low_severity_no_escalate(self):
        """High-risk issue type with severity < 7 should not escalate (without other triggers)."""
        unit = make_tracked_unit(
            tier2_output=make_tier2_output(classification="burdensome", severity=5, confidence=0.9),
            issue_type="wet_signature",
        )
        # Mock random to ensure no random sampling
        with patch('scripts.research_pipeline.routing.random.random', return_value=0.5):
            assert should_escalate_to_tier3(unit) is False

    def test_cites_federal_statute_escalates(self):
        """Citing federal statute should escalate."""
        unit = make_tracked_unit(
            tier2_output=make_tier2_output(
                classification="burdensome",
                severity=5,
                cites_federal_statute=True,
            ),
            issue_type="mail_only",
        )
        assert should_escalate_to_tier3(unit) is True

    def test_claims_no_alternative_high_severity_escalates(self):
        """Claims no alternative with severity >= 7 should escalate (when not skipped)."""
        # Note: High confidence + burdensome + high severity triggers the skip logic,
        # so we use lower confidence to test the claims_no_alternative trigger
        output = make_tier2_output(
            classification="burdensome",
            severity=7,
            claims_no_alternative=True,
        )
        output.confidence = 0.80  # Low confidence bypasses the skip logic
        unit = make_tracked_unit(tier2_output=output, issue_type="mail_only")
        assert should_escalate_to_tier3(unit) is True

    def test_low_confidence_high_severity_escalates(self):
        """Low confidence (<0.85) with severity >= 7 should escalate."""
        output = make_tier2_output(classification="burdensome", severity=7)
        output.confidence = 0.80
        unit = make_tracked_unit(tier2_output=output, issue_type="mail_only")
        assert should_escalate_to_tier3(unit) is True

    def test_controversial_justified_escalates(self):
        """Controversial justified classification should escalate."""
        output = make_tier2_output(classification="justified", severity=5)
        output.potentially_controversial = True
        unit = make_tracked_unit(tier2_output=output, issue_type="mail_only")
        assert should_escalate_to_tier3(unit) is True

    def test_federal_mandate_suspected_escalates(self):
        """Federal mandate suspected should escalate."""
        output = make_tier2_output(classification="burdensome", severity=5, confidence=0.9)
        output.federal_mandate_suspected = True
        unit = make_tracked_unit(tier2_output=output, issue_type="mail_only")
        assert should_escalate_to_tier3(unit) is True

    @patch('scripts.research_pipeline.routing.random.random')
    def test_random_sample_escalates(self, mock_random):
        """10% random sample should escalate."""
        mock_random.return_value = 0.05  # Below 0.10 threshold
        output = make_tier2_output(classification="burdensome", severity=4, confidence=0.9)
        unit = make_tracked_unit(tier2_output=output, issue_type="mail_only")
        assert should_escalate_to_tier3(unit) is True

    @patch('scripts.research_pipeline.routing.random.random')
    def test_no_random_sample_no_escalate(self, mock_random):
        """Non-sampled items without other triggers should not escalate."""
        mock_random.return_value = 0.5  # Above 0.10 threshold
        output = make_tier2_output(classification="burdensome", severity=4, confidence=0.9)
        unit = make_tracked_unit(tier2_output=output, issue_type="mail_only")
        assert should_escalate_to_tier3(unit) is False

    @patch('scripts.research_pipeline.routing.random.random')
    def test_skip_high_conf_burdensome_high_severity(self, mock_random):
        """High confidence burdensome with high severity should be skipped (low value)."""
        mock_random.return_value = 0.5  # No random sample
        output = make_tier2_output(classification="burdensome", severity=8, confidence=0.90)
        unit = make_tracked_unit(tier2_output=output, issue_type="mail_only")
        assert should_escalate_to_tier3(unit) is False


class TestShouldEscalateWithReason:
    """Test should_escalate_to_tier3_with_reason() function."""

    def test_returns_tuple(self):
        """Should return a tuple of (bool, str)."""
        unit = make_tracked_unit(
            tier2_output=make_tier2_output(classification="unrelated")
        )
        result = should_escalate_to_tier3_with_reason(unit)
        assert isinstance(result, tuple)
        assert len(result) == 2
        assert isinstance(result[0], bool)
        assert isinstance(result[1], str)

    def test_no_tier2_output(self):
        """No tier2_output should return False with explanation."""
        unit = make_tracked_unit()
        unit.tier2_output = None
        escalate, reason = should_escalate_to_tier3_with_reason(unit)
        assert escalate is False
        assert "No Tier 2 output" in reason

    def test_high_risk_justified_reason(self):
        """High-risk justified should include issue type in reason."""
        unit = make_tracked_unit(
            tier2_output=make_tier2_output(classification="justified"),
            issue_type="wet_signature",
        )
        escalate, reason = should_escalate_to_tier3_with_reason(unit)
        assert escalate is True
        assert "wet_signature" in reason
        assert "justified" in reason

    def test_federal_statute_reason(self):
        """Federal statute should be mentioned in reason."""
        output = make_tier2_output(classification="burdensome", cites_federal_statute=True)
        output.federal_citation = "42 U.S.C. 1983"
        unit = make_tracked_unit(tier2_output=output)
        escalate, reason = should_escalate_to_tier3_with_reason(unit)
        assert escalate is True
        assert "Federal" in reason or "federal" in reason


class TestGetTier3TriggerReason:
    """Test get_tier3_trigger_reason() function."""

    def test_no_tier2_output(self):
        """No tier2_output should return unknown trigger message."""
        unit = make_tracked_unit()
        unit.tier2_output = None
        reason = get_tier3_trigger_reason(unit)
        assert "Unknown" in reason or "no Tier 2" in reason

    def test_unrelated_not_escalated(self):
        """Unrelated should return 'not escalated'."""
        unit = make_tracked_unit(
            tier2_output=make_tier2_output(classification="unrelated")
        )
        reason = get_tier3_trigger_reason(unit)
        assert "Not escalated" in reason

    def test_random_sample_flag(self):
        """Random sample flag should be reflected in reason."""
        unit = make_tracked_unit(
            tier2_output=make_tier2_output(classification="burdensome", severity=4, confidence=0.9)
        )
        reason = get_tier3_trigger_reason(unit, is_random_sample=True)
        assert "Random" in reason or "sample" in reason

    def test_federal_statute_with_citation(self):
        """Federal statute with citation should include it."""
        output = make_tier2_output(classification="burdensome", cites_federal_statute=True)
        output.federal_citation = "29 CFR 1910"
        unit = make_tracked_unit(tier2_output=output)
        reason = get_tier3_trigger_reason(unit)
        assert "29 CFR 1910" in reason or "Federal" in reason


class TestGetAllTriggerReasons:
    """Test get_all_trigger_reasons() function."""

    def test_no_tier2_output_returns_empty(self):
        """No tier2_output should return empty list."""
        unit = make_tracked_unit()
        unit.tier2_output = None
        reasons = get_all_trigger_reasons(unit)
        assert reasons == []

    def test_unrelated_returns_empty(self):
        """Unrelated classification should return empty list."""
        unit = make_tracked_unit(
            tier2_output=make_tier2_output(classification="unrelated")
        )
        reasons = get_all_trigger_reasons(unit)
        assert reasons == []

    def test_multiple_triggers(self):
        """Unit with multiple triggers should return all of them."""
        output = make_tier2_output(
            classification="justified",
            severity=9,
            cites_federal_statute=True,
        )
        output.potentially_controversial = True
        output.federal_mandate_suspected = True
        unit = make_tracked_unit(tier2_output=output, issue_type="wet_signature")

        reasons = get_all_trigger_reasons(unit)
        assert len(reasons) >= 2  # At least high-risk + federal statute

    def test_high_severity_burdensome_trigger(self):
        """High severity burdensome should be in reasons."""
        output = make_tier2_output(classification="burdensome", severity=9)
        unit = make_tracked_unit(tier2_output=output, issue_type="mail_only")
        reasons = get_all_trigger_reasons(unit)
        assert any("severity" in r.lower() for r in reasons)


class TestConstants:
    """Verify routing constants are correct."""

    def test_random_sample_rate(self):
        """Random sample rate should be 10%."""
        assert RANDOM_SAMPLE_RATE == 0.10

    def test_confidence_threshold(self):
        """Low confidence threshold should be 0.85."""
        assert LOW_CONFIDENCE_THRESHOLD == 0.85

    def test_high_risk_severity_threshold(self):
        """High risk severity threshold should be 7."""
        assert HIGH_RISK_SEVERITY_THRESHOLD == 7

    def test_burdensome_severity_threshold(self):
        """Burdensome severity threshold should be 8."""
        assert BURDENSOME_SEVERITY_THRESHOLD == 8

    def test_no_alternative_severity_threshold(self):
        """No alternative severity threshold should be 7."""
        assert NO_ALTERNATIVE_SEVERITY_THRESHOLD == 7

    def test_high_risk_issue_types_frozen(self):
        """HIGH_RISK_ISSUE_TYPES should be a frozenset."""
        assert isinstance(HIGH_RISK_ISSUE_TYPES, frozenset)

    def test_high_risk_prefixes_tuple(self):
        """HIGH_RISK_ISSUE_PREFIXES should be a tuple."""
        assert isinstance(HIGH_RISK_ISSUE_PREFIXES, tuple)
