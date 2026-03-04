"""
State machine for the research pipeline.

Tracks ProcessingUnits through the 3-tier pipeline with state transitions
based on LLM outputs and routing rules.

V5: Merged Tier 4 into Tier 3. Tier 3 is now the web search tier.
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum, auto
from typing import Optional

from .models.matches import ProcessingUnit
from .models.llm_outputs import Tier1Output, Tier2Output, Tier3Output
from .context_registry import ContextRegistry
from .ids import make_custom_id


class ProcessingState(Enum):
    """States a ProcessingUnit can be in during pipeline execution."""

    # Initial state
    PENDING = auto()

    # Tier 1 states
    TIER1_COMPLETE = auto()

    # Tier 2 states
    TIER2_PENDING = auto()  # Waiting for context fetch
    TIER2_COMPLETE = auto()

    # Tier 3 states (V5: web search tier, batch or real-time API)
    TIER3_PENDING = auto()  # Waiting for web search
    TIER3_COMPLETE = auto()

    # Terminal states
    DONE = auto()  # Classification complete
    DONE_FALSE_POSITIVE = auto()  # All matches were false positives
    ERROR = auto()  # Processing failed


@dataclass
class TrackedUnit:
    """
    Wraps a ProcessingUnit with state tracking across tiers.

    Tracks:
    - Current processing state
    - Tier outputs as they complete
    - Timestamps for performance analysis
    - Error tracking for retry logic
    """

    unit: ProcessingUnit
    state: ProcessingState = ProcessingState.PENDING

    # Tier outputs (populated as tiers complete)
    tier1_output: Optional[Tier1Output] = None
    tier2_output: Optional[Tier2Output] = None
    tier3_output: Optional[Tier3Output] = None

    # Timestamps
    created_at: datetime = field(default_factory=datetime.now)
    tier1_completed_at: Optional[datetime] = None
    tier2_completed_at: Optional[datetime] = None
    tier3_completed_at: Optional[datetime] = None

    # Context tracking across tiers
    context_registry: Optional[ContextRegistry] = None

    # Error tracking
    error_message: Optional[str] = None
    retry_count: int = 0

    # V5: Tier 2 re-run tracking
    tier2_rerun_count: int = 0  # Number of re-runs (0 = initial, max 2)
    tier2_accumulated_context: list = field(default_factory=list)  # Context fetched during re-runs
    tier2_context_requests_made: list = field(default_factory=list)  # All context requests made across re-runs
    tier2_forced_classification: bool = False  # True if classification was forced after max re-runs

    # Batch IDs (set after batch submission)
    tier1_batch_id: Optional[str] = None
    tier2_batch_id: Optional[str] = None
    tier3_batch_id: Optional[str] = None

    # V5.1: Tier 3 trigger tracking
    tier3_trigger_reason: Optional[str] = None  # Why this unit was escalated to Tier 3

    @property
    def document_id(self) -> int:
        """Shortcut to unit.document_id."""
        return self.unit.document_id

    @property
    def issue_type(self) -> str:
        """Shortcut to unit.issue_type."""
        return self.unit.issue_type

    @property
    def custom_id(self) -> str:
        """Unique ID for batch API requests."""
        return make_custom_id(self.document_id, self.issue_type, self.unit.source_type)

    @property
    def highest_tier_completed(self) -> int:
        """Return the highest tier that completed successfully."""
        if self.tier3_output is not None:
            return 3
        if self.tier2_output is not None:
            return 2
        if self.tier1_output is not None:
            return 1
        return 0

    def get_final_output(self) -> Optional[Tier2Output | Tier3Output]:
        """Get the final tier output for this unit."""
        if self.tier3_output is not None:
            return self.tier3_output
        if self.tier2_output is not None:
            return self.tier2_output
        return None

    def get_final_classification(self) -> Optional[str]:
        """Get the final classification from highest completed tier."""
        output = self.get_final_output()
        if output is not None:
            return output.classification
        if self.tier1_output is not None:
            return self.tier1_output.classification
        return None

    def get_final_severity(self) -> Optional[int]:
        """
        Compute final severity from highest completed tier.

        V5: Tier 3 now has final_severity directly (web search tier)
        Tier 2: Uses severity directly
        """
        if self.tier3_output is not None:
            # V5: Tier 3 can have either final_severity or severity + adjustment
            if hasattr(self.tier3_output, 'final_severity') and self.tier3_output.final_severity is not None:
                return self.tier3_output.final_severity
            # Fall back to severity adjustment calculation
            tier2_severity = self.tier2_output.severity if self.tier2_output else None
            if tier2_severity is not None:
                adjustment = self.tier3_output.severity_adjustment or 0
                return max(1, min(10, tier2_severity + adjustment))

        tier2_severity = self.tier2_output.severity if self.tier2_output else None
        return tier2_severity


def get_next_state(unit: TrackedUnit) -> ProcessingState:
    """
    Determine the next state based on tier output and routing rules.

    V5 Routing logic (3 tiers):
    - Tier 1: all_false_positives → DONE_FALSE_POSITIVE, needs_research → TIER2
    - Tier 2: Uses canonical Tier 3 triggers for web verification (via routing module)
    - Tier 3: → DONE (final tier with web search)

    V5.1: Also stores the tier3_trigger_reason on the unit when escalating.
    """
    # Import here to avoid circular imports
    from .routing import should_escalate_to_tier3_with_reason

    if unit.state == ProcessingState.TIER1_COMPLETE:
        if unit.tier1_output is None:
            return ProcessingState.ERROR

        if unit.tier1_output.classification == "all_false_positives":
            return ProcessingState.DONE_FALSE_POSITIVE
        return ProcessingState.TIER2_PENDING

    if unit.state == ProcessingState.TIER2_COMPLETE:
        if unit.tier2_output is None:
            return ProcessingState.ERROR

        # Unrelated - always done
        if unit.tier2_output.classification == "unrelated":
            return ProcessingState.DONE

        # Use centralized routing logic for Tier 3 escalation
        # V5.1: Get both the decision and the reason
        should_escalate, reason = should_escalate_to_tier3_with_reason(unit)
        if should_escalate:
            unit.tier3_trigger_reason = reason  # Store the reason
            return ProcessingState.TIER3_PENDING

        # All other cases are done
        return ProcessingState.DONE

    if unit.state == ProcessingState.TIER3_COMPLETE:
        # V5: Tier 3 is the final tier - always goes to DONE
        return ProcessingState.DONE

    # No transition needed for other states
    return unit.state


def is_terminal_state(state: ProcessingState) -> bool:
    """Check if the state is terminal (no more processing needed)."""
    return state in (
        ProcessingState.DONE,
        ProcessingState.DONE_FALSE_POSITIVE,
        ProcessingState.ERROR,
    )


def state_to_tier(state: ProcessingState) -> Optional[int]:
    """Convert a processing state to its tier number, if applicable."""
    tier_map = {
        ProcessingState.TIER1_COMPLETE: 1,
        ProcessingState.TIER2_PENDING: 2,
        ProcessingState.TIER2_COMPLETE: 2,
        ProcessingState.TIER3_PENDING: 3,
        ProcessingState.TIER3_COMPLETE: 3,
    }
    return tier_map.get(state)
