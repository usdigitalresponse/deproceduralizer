"""Base protocol for tier runners."""

from typing import Protocol, Type, Union, Any

from ..models.llm_outputs import Tier1Output, Tier2Output, Tier3Output
from ..state_machine import TrackedUnit


class TierRunner(Protocol):
    """Protocol for tier-specific runners."""

    tier_num: int
    output_type: Type[Union[Tier1Output, Tier2Output, Tier3Output]]

    def prepare_batch(
        self,
        units: list[TrackedUnit],
        issue_config: Any,  # IssueConfig - avoid circular import
    ) -> list[dict]:
        """Prepare batch API requests for this tier."""
        ...

    async def run_realtime(
        self,
        unit: TrackedUnit,
        issue_config: Any,  # IssueConfig
        client: Any,  # Anthropic client
    ) -> bool:
        """Run single unit in realtime mode. Returns success."""
        ...
