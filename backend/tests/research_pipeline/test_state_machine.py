"""
State machine tests for the V5 research pipeline.

Tests the routing logic in state_machine.py:
- Tier 1 → Tier 2 transitions
- Tier 2 → Tier 3 triggers (V5 canonical triggers)
- Tier 3 → Done (final tier)
- Terminal state detection
"""

import pytest

from .conftest import (
    make_tier1_output,
    make_tier2_output,
    make_tier3_output,
    make_tracked_unit,
)


class TestProcessingStates:
    """Test ProcessingState enum and helper functions."""

    def test_processing_states_exist(self):
        """Key states exist in the enum."""
        from scripts.research_pipeline.state_machine import ProcessingState

        assert ProcessingState.PENDING
        assert ProcessingState.TIER1_COMPLETE
        assert ProcessingState.TIER2_COMPLETE
        assert ProcessingState.TIER3_COMPLETE
        assert ProcessingState.DONE
        assert ProcessingState.DONE_FALSE_POSITIVE
        assert ProcessingState.ERROR

    def test_is_terminal_state(self):
        """Terminal states are correctly identified."""
        from scripts.research_pipeline.state_machine import (
            ProcessingState,
            is_terminal_state,
        )

        # Terminal states
        assert is_terminal_state(ProcessingState.DONE) is True
        assert is_terminal_state(ProcessingState.DONE_FALSE_POSITIVE) is True
        assert is_terminal_state(ProcessingState.ERROR) is True

        # Non-terminal states
        assert is_terminal_state(ProcessingState.PENDING) is False
        assert is_terminal_state(ProcessingState.TIER1_COMPLETE) is False
        assert is_terminal_state(ProcessingState.TIER2_COMPLETE) is False
        assert is_terminal_state(ProcessingState.TIER3_COMPLETE) is False

    def test_state_to_tier_mapping(self):
        """States map to correct tier numbers."""
        from scripts.research_pipeline.state_machine import (
            ProcessingState,
            state_to_tier,
        )

        assert state_to_tier(ProcessingState.TIER1_QUEUED) == 1
        assert state_to_tier(ProcessingState.TIER1_COMPLETE) == 1
        assert state_to_tier(ProcessingState.TIER2_QUEUED) == 2
        assert state_to_tier(ProcessingState.TIER2_COMPLETE) == 2
        assert state_to_tier(ProcessingState.TIER3_PENDING) == 3
        assert state_to_tier(ProcessingState.TIER3_COMPLETE) == 3
        assert state_to_tier(ProcessingState.DONE) is None


class TestTrackedUnitCreation:
    """Test TrackedUnit dataclass."""

    def test_tracked_unit_defaults(self):
        """TrackedUnit initializes with correct defaults."""
        from scripts.research_pipeline.state_machine import (
            ProcessingState,
            TrackedUnit,
        )
        from scripts.research_pipeline.models.matches import ProcessingUnit, MatchInfo

        match = MatchInfo(
            match_id=1,
            matched_text="test match",
            position_start=0,
            position_end=10,
            surrounding_context="...test match...",
        )
        pu = ProcessingUnit(
            document_id=123,
            issue_type="mail_only",
            citation="N.J.A.C. 1:1-1.1",
            title="Test Section",
            matches=[match],
            content="Full document content here",
        )

        tracked = TrackedUnit(unit=pu)

        assert tracked.state == ProcessingState.PENDING
        assert tracked.document_id == 123
        assert tracked.issue_type == "mail_only"
        assert tracked.custom_id == "mail_only_123"
        assert tracked.tier1_output is None
        assert tracked.tier2_output is None
        assert tracked.tier3_output is None

    def test_highest_tier_completed(self):
        """highest_tier_completed returns correct tier."""
        unit = make_tracked_unit()
        assert unit.highest_tier_completed == 0

        unit = make_tracked_unit(tier1_output=make_tier1_output())
        assert unit.highest_tier_completed == 1

        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(),
        )
        assert unit.highest_tier_completed == 2

        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(),
            tier3_output=make_tier3_output(),
        )
        assert unit.highest_tier_completed == 3


class TestTier1Transitions:
    """Test Tier 1 → next state transitions."""

    def test_all_false_positives_to_done(self):
        """all_false_positives → DONE_FALSE_POSITIVE"""
        from scripts.research_pipeline.state_machine import get_next_state, ProcessingState

        unit = make_tracked_unit(
            tier1_output=make_tier1_output(
                classification="all_false_positives",
                relevant_match_indices=[],
            ),
            state=ProcessingState.TIER1_COMPLETE,
        )

        assert get_next_state(unit) == ProcessingState.DONE_FALSE_POSITIVE

    def test_needs_research_to_tier2(self):
        """needs_research → TIER2_PENDING"""
        from scripts.research_pipeline.state_machine import get_next_state, ProcessingState

        unit = make_tracked_unit(
            tier1_output=make_tier1_output(
                classification="needs_research",
                relevant_match_indices=[0, 1],
            ),
            state=ProcessingState.TIER1_COMPLETE,
        )

        assert get_next_state(unit) == ProcessingState.TIER2_PENDING

    def test_no_tier1_output_is_error(self):
        """Tier 1 complete without output → ERROR"""
        from scripts.research_pipeline.state_machine import get_next_state, ProcessingState

        unit = make_tracked_unit(
            tier1_output=None,
            state=ProcessingState.TIER1_COMPLETE,
        )

        assert get_next_state(unit) == ProcessingState.ERROR


class TestTier2RoutingV5:
    """
    V5 Tier 2 routing tests.

    V5 canonical Tier 3 triggers (state_machine.py:186-214):
    1. High-risk issue types (newspaper, notarization, wet_signature, witness, in_person, mandated_reports)
    2. cites_federal_statute=True
    3. claims_no_alternative=True AND severity >= 7
    4. burdensome AND severity >= 8
    5. justified AND potentially_controversial=True
    6. federal_mandate_suspected=True
    """

    # Parametrized test for terminal cases (→ DONE)
    @pytest.mark.parametrize("classification,severity,flags", [
        ("unrelated", None, {}),
        ("justified", 3, {}),
        ("burdensome", 4, {}),
        ("burdensome", 5, {}),
        ("burdensome", 7, {}),  # Below threshold (needs >= 8)
        ("burdensome", 6, {"claims_no_alternative": True}),  # Below threshold (needs sev >= 7)
    ])
    def test_tier2_to_done(self, classification, severity, flags):
        """Tier 2 without triggers → DONE"""
        from scripts.research_pipeline.state_machine import get_next_state, ProcessingState

        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(
                classification=classification,
                severity=severity,
                **flags,
            ),
            state=ProcessingState.TIER2_COMPLETE,
        )

        assert get_next_state(unit) == ProcessingState.DONE

    # Parametrized test for Tier 3 triggers
    @pytest.mark.parametrize("classification,severity,flags,issue_type", [
        # Trigger 1: High-risk issue types (require severity >= 6)
        ("burdensome", 6, {}, "wet_signature"),
        ("burdensome", 6, {}, "notarization"),
        ("burdensome", 6, {}, "newspaper"),
        ("burdensome", 6, {}, "witness"),
        ("burdensome", 6, {}, "in_person"),
        ("burdensome", 6, {}, "mandated_reports"),
        # Trigger 2: cites_federal_statute
        ("burdensome", 5, {"cites_federal_statute": True}, "mail_only"),
        # Trigger 3: claims_no_alternative + severity >= 7
        ("burdensome", 7, {"claims_no_alternative": True}, "mail_only"),
        ("burdensome", 8, {"claims_no_alternative": True}, "mail_only"),
        # Trigger 4: burdensome + severity >= 8
        ("burdensome", 8, {}, "mail_only"),
        ("burdensome", 9, {}, "mail_only"),
        ("burdensome", 10, {}, "mail_only"),
        # Trigger 5: justified + controversial
        ("justified", 3, {"potentially_controversial": True}, "mail_only"),
        ("justified", 1, {"potentially_controversial": True}, "mail_only"),
        # Trigger 6: federal_mandate_suspected
        ("burdensome", 2, {"federal_mandate_suspected": True}, "mail_only"),
        ("burdensome", 5, {"federal_mandate_suspected": True}, "mail_only"),
    ])
    def test_tier2_to_tier3(self, classification, severity, flags, issue_type):
        """Tier 2 with V5 triggers → TIER3_PENDING"""
        from scripts.research_pipeline.state_machine import get_next_state, ProcessingState

        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(
                classification=classification,
                severity=severity,
                **flags,
            ),
            state=ProcessingState.TIER2_COMPLETE,
            issue_type=issue_type,
        )

        assert get_next_state(unit) == ProcessingState.TIER3_PENDING


class TestJustifiedTrapGuard:
    """Justified + controversial escalates at ANY severity."""

    @pytest.mark.parametrize("severity", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    def test_controversial_escalates_at_any_severity(self, severity):
        """Justified + controversial escalates regardless of severity."""
        from scripts.research_pipeline.state_machine import get_next_state, ProcessingState

        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(
                classification="justified",
                severity=severity,
                potentially_controversial=True,
            ),
            state=ProcessingState.TIER2_COMPLETE,
        )

        assert get_next_state(unit) == ProcessingState.TIER3_PENDING


class TestTier3FinalTransitions:
    """V5: Tier 3 is the final tier - always transitions to DONE."""

    def test_tier3_complete_to_done(self):
        """Tier 3 complete → DONE (always)"""
        from scripts.research_pipeline.state_machine import get_next_state, ProcessingState

        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(),
            tier3_output=make_tier3_output(),
            state=ProcessingState.TIER3_COMPLETE,
        )

        assert get_next_state(unit) == ProcessingState.DONE

    def test_tier3_with_federal_mandate_to_done(self):
        """Tier 3 + federal_mandate_found → DONE (no Tier 4 in V5)"""
        from scripts.research_pipeline.state_machine import get_next_state, ProcessingState

        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(
                classification="burdensome",
                severity=7,
                federal_mandate_suspected=True,
            ),
            tier3_output=make_tier3_output(
                classification="burdensome",
                federal_mandate_found=True,
            ),
            state=ProcessingState.TIER3_COMPLETE,
        )

        assert get_next_state(unit) == ProcessingState.DONE

    def test_tier3_justified_to_done(self):
        """Tier 3 justified → DONE"""
        from scripts.research_pipeline.state_machine import get_next_state, ProcessingState

        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(),
            tier3_output=make_tier3_output(classification="justified"),
            state=ProcessingState.TIER3_COMPLETE,
        )

        assert get_next_state(unit) == ProcessingState.DONE

    def test_tier3_unrelated_to_done(self):
        """Tier 3 unrelated → DONE"""
        from scripts.research_pipeline.state_machine import get_next_state, ProcessingState

        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(),
            tier3_output=make_tier3_output(classification="unrelated"),
            state=ProcessingState.TIER3_COMPLETE,
        )

        assert get_next_state(unit) == ProcessingState.DONE


class TestFinalSeverityCalculation:
    """Test final severity computation with tier adjustments."""

    def test_tier2_only_returns_tier2_severity(self):
        """With only Tier 2, returns tier2 severity directly."""
        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(classification="burdensome", severity=5),
        )

        assert unit.get_final_severity() == 5

    def test_tier3_final_severity_used(self):
        """Tier 3 final_severity takes precedence."""
        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(classification="burdensome", severity=5),
            tier3_output=make_tier3_output(
                classification="burdensome",
                final_severity=7,
            ),
        )

        assert unit.get_final_severity() == 7

    def test_tier3_adjustment_applied(self):
        """Tier 3 adjustment applied to Tier 2 severity."""
        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(classification="burdensome", severity=5),
            tier3_output=make_tier3_output(
                classification="burdensome",
                severity_adjustment=-1,
            ),
        )

        assert unit.get_final_severity() == 4

    def test_severity_clamped_at_10(self):
        """Severity clamped at maximum of 10."""
        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(classification="burdensome", severity=9),
            tier3_output=make_tier3_output(
                classification="burdensome",
                severity_adjustment=3,
            ),
        )

        assert unit.get_final_severity() == 10

    def test_severity_clamped_at_1(self):
        """Severity clamped at minimum of 1."""
        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(classification="burdensome", severity=2),
            tier3_output=make_tier3_output(
                classification="burdensome",
                severity_adjustment=-3,
            ),
        )

        assert unit.get_final_severity() == 1


class TestFinalClassification:
    """Test final classification from highest completed tier."""

    def test_uses_tier3_when_available(self):
        """Uses Tier 3 classification when available."""
        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(classification="burdensome"),
            tier3_output=make_tier3_output(classification="justified"),
        )

        assert unit.get_final_classification() == "justified"

    def test_uses_tier2_when_tier3_missing(self):
        """Uses Tier 2 classification when Tier 3 missing."""
        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(classification="burdensome"),
        )

        assert unit.get_final_classification() == "burdensome"

    def test_uses_tier1_when_only_tier1(self):
        """Uses Tier 1 classification when only tier."""
        unit = make_tracked_unit(
            tier1_output=make_tier1_output(classification="all_false_positives"),
        )

        assert unit.get_final_classification() == "all_false_positives"
