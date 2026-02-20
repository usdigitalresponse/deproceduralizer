"""JenAI pipeline state machine — single-pass states."""
from dataclasses import dataclass
from enum import auto, Enum
from typing import Optional

from .models.processing import JenAIUnit
from .models.llm_outputs import AnalysisOutput


class ProcessingState(Enum):
    PENDING = auto()
    DONE = auto()
    ERROR = auto()


@dataclass
class TrackedUnit:
    unit: JenAIUnit
    state: ProcessingState = ProcessingState.PENDING
    analysis_output: Optional[AnalysisOutput] = None
    batch_id: Optional[str] = None
    error: Optional[str] = None

    @property
    def is_terminal(self) -> bool:
        return self.state in (ProcessingState.DONE, ProcessingState.ERROR)
