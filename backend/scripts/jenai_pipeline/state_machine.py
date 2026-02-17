"""JenAI pipeline state machine - 2 tier states."""
from dataclasses import dataclass
from enum import auto, Enum
from typing import Optional

from .models.processing import JenAIUnit
from .models.llm_outputs import Tier1Output, Tier2Output
from scripts.research_pipeline.context_registry import ContextRegistry


class ProcessingState(Enum):
    PENDING = auto()
    TIER1_COMPLETE = auto()
    DONE_CLEAN = auto()
    TIER2_PENDING = auto()
    TIER2_COMPLETE = auto()
    DONE = auto()
    ERROR = auto()


@dataclass
class TrackedUnit:
    unit: JenAIUnit
    state: ProcessingState = ProcessingState.PENDING
    tier1_output: Optional[Tier1Output] = None
    tier2_output: Optional[Tier2Output] = None
    context_registry: Optional[ContextRegistry] = None
    tier1_batch_id: Optional[str] = None
    tier2_batch_id: Optional[str] = None
    error: Optional[str] = None

    @property
    def is_terminal(self) -> bool:
        return self.state in (
            ProcessingState.DONE_CLEAN,
            ProcessingState.DONE,
            ProcessingState.ERROR,
        )

    @property
    def needs_tier2(self) -> bool:
        return self.state == ProcessingState.TIER2_PENDING


def should_promote_to_tier2(
    tracked: TrackedUnit,
    confidence_threshold: float = 0.9,
) -> bool:
    """Determine if a Tier 1 result should be promoted to Tier 2."""
    if tracked.tier1_output is None:
        return False

    output = tracked.tier1_output

    if output.classification == "clean":
        return False

    if output.classification == "needs_context":
        return True

    # has_issues: promote if context requests or low confidence
    if output.context_requests:
        return True

    for cat in output.categories_found:
        if cat.confidence < confidence_threshold:
            return True

    return False
