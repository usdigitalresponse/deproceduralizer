"""
Shared fixtures for research pipeline tests.

Contains helper functions to create test objects:
- make_tier1_output, make_tier2_output, make_tier3_output
- make_tracked_unit
- make_processing_unit
"""

import pytest
from pathlib import Path
from dotenv import load_dotenv
from typing import TYPE_CHECKING
from unittest.mock import Mock, patch

if TYPE_CHECKING:
    from scripts.research_pipeline.models.llm_outputs import Tier1Output, Tier2Output, Tier3Output
    from scripts.research_pipeline.state_machine import TrackedUnit
    from scripts.research_pipeline.models.matches import ProcessingUnit

# Load .env from project root
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
load_dotenv(PROJECT_ROOT / ".env")


# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
def disable_random_sampling():
    """Disable 10% random sampling in routing logic for deterministic tests.

    The routing module uses random.random() to select 10% of items for
    additional Tier 3 analysis. This fixture mocks that to return 0.5,
    ensuring random sampling never triggers in tests unless explicitly tested.
    """
    with patch("scripts.research_pipeline.routing.random.random", return_value=0.5):
        yield


# =============================================================================
# Helper Functions (used by tests, not fixtures)
# =============================================================================


def make_tier1_output(
    classification: str = "needs_research",
    relevant_match_indices: list[int] = None,
    dismissed_matches: list = None,
    confidence: float = 0.8,
    reasoning: str = "Test reasoning",
    context_requests: list = None,
) -> "Tier1Output":
    """Create a Tier1Output with sensible defaults."""
    from scripts.research_pipeline.models.llm_outputs import Tier1Output

    return Tier1Output(
        classification=classification,
        relevant_match_indices=relevant_match_indices if relevant_match_indices is not None else [0],
        dismissed_matches=dismissed_matches or [],
        confidence=confidence,
        reasoning=reasoning,
        context_requests=context_requests or [],
    )


def make_tier2_output(
    classification: str = "burdensome",
    severity: int = 5,
    confidence: float = 0.8,
    reasoning: str = "Test reasoning",
    argument_for_regulation: str = "Test argument for",
    argument_against_regulation: str = "Test argument against",
    needs_web_search: bool = False,
    potentially_controversial: bool = False,
    federal_mandate_suspected: bool = False,
    ambiguity_type: str = None,
    verbatim_requirements: list = None,
    context_used: list = None,
    full_text_requests: list = None,
    # V5 canonical Tier 3 trigger fields
    cites_federal_statute: bool = False,
    claims_no_alternative: bool = False,
) -> "Tier2Output":
    """Create a Tier2Output with sensible defaults."""
    from scripts.research_pipeline.models.llm_outputs import Tier2Output

    return Tier2Output(
        classification=classification,
        severity=severity if classification in ("burdensome", "justified") else None,
        confidence=confidence,
        reasoning=reasoning,
        argument_for_regulation=argument_for_regulation,
        argument_against_regulation=argument_against_regulation,
        needs_web_search=needs_web_search,
        potentially_controversial=potentially_controversial,
        federal_mandate_suspected=federal_mandate_suspected,
        ambiguity_type=ambiguity_type,
        verbatim_requirements=verbatim_requirements or [],
        context_used=context_used or [],
        full_text_requests=full_text_requests or [],
        # V5 trigger fields
        cites_federal_statute=cites_federal_statute,
        claims_no_alternative=claims_no_alternative,
    )


def make_tier3_output(
    classification: str = "burdensome",
    confidence: float = 0.9,
    reasoning: str = "Test reasoning after full context",
    argument_for_regulation: str = "Updated argument for",
    argument_against_regulation: str = "Updated argument against",
    final_severity: int = None,
    severity_adjustment: int = None,
    severity_adjustment_reasoning: str = None,
    needs_web_search: bool = False,
    potentially_controversial: bool = False,
    federal_mandate_suspected: bool = False,
    federal_mandate_found: bool = False,
    state_has_discretion: bool = True,
    verbatim_requirements: list = None,
    context_used: list = None,
) -> "Tier3Output":
    """Create a Tier3Output with sensible defaults (V5 - final tier with web search)."""
    from scripts.research_pipeline.models.llm_outputs import Tier3Output

    return Tier3Output(
        classification=classification,
        confidence=confidence,
        reasoning=reasoning,
        argument_for_regulation=argument_for_regulation,
        argument_against_regulation=argument_against_regulation,
        final_severity=final_severity,
        severity_adjustment=severity_adjustment,
        severity_adjustment_reasoning=severity_adjustment_reasoning,
        needs_web_search=needs_web_search,
        potentially_controversial=potentially_controversial,
        federal_mandate_suspected=federal_mandate_suspected,
        federal_mandate_found=federal_mandate_found,
        state_has_discretion=state_has_discretion,
        verbatim_requirements=verbatim_requirements or [],
        context_used=context_used or [],
    )


def make_tracked_unit(
    tier1_output=None,
    tier2_output=None,
    tier3_output=None,
    state=None,
    issue_type: str = "mail_only",
) -> "TrackedUnit":
    """Create a TrackedUnit with specified tier outputs for testing (V5 - 3 tiers)."""
    from scripts.research_pipeline.state_machine import TrackedUnit, ProcessingState
    from scripts.research_pipeline.models.matches import ProcessingUnit, MatchInfo

    # Create a minimal ProcessingUnit
    match = MatchInfo(
        match_id=1,
        matched_text="test match",
        position_start=0,
        position_end=10,
        surrounding_context="...test match...",
    )
    pu = ProcessingUnit(
        document_id=123,
        issue_type=issue_type,
        citation="N.J.A.C. 1:1-1.1",
        title="Test Section",
        matches=[match],
        content="Full document content here",
    )

    # Determine state based on tier outputs if not specified
    if state is None:
        if tier3_output is not None:
            state = ProcessingState.TIER3_COMPLETE
        elif tier2_output is not None:
            state = ProcessingState.TIER2_COMPLETE
        elif tier1_output is not None:
            state = ProcessingState.TIER1_COMPLETE
        else:
            state = ProcessingState.PENDING

    unit = TrackedUnit(unit=pu, state=state)
    unit.tier1_output = tier1_output
    unit.tier2_output = tier2_output
    unit.tier3_output = tier3_output

    return unit


def make_processing_unit(
    document_id: int = 123,
    issue_type: str = "mail_only",
    citation: str = "N.J.A.C. 1:1-1.1",
    title: str = "Test Section",
    content: str = "Full document content here",
    matches: list = None,
) -> "ProcessingUnit":
    """Create a ProcessingUnit for testing."""
    from scripts.research_pipeline.models.matches import ProcessingUnit, MatchInfo

    if matches is None:
        matches = [
            MatchInfo(
                match_id=1,
                matched_text="test match",
                position_start=0,
                position_end=10,
                surrounding_context="...test match...",
            )
        ]

    return ProcessingUnit(
        document_id=document_id,
        issue_type=issue_type,
        citation=citation,
        title=title,
        matches=matches,
        content=content,
    )


# =============================================================================
# Pytest Fixtures
# =============================================================================


@pytest.fixture
def sample_tier1_llm_response():
    """Real-ish Tier 1 LLM JSON response for testing."""
    return {
        "type": "message",
        "content": [{
            "type": "tool_use",
            "input": {
                "classification": "needs_research",
                "confidence": 0.85,
                "reasoning": "Document contains genuine mail-only requirement...",
                "relevant_match_indices": [0, 2],
                "dismissed_matches": [{"index": 1, "reason": "False positive - refers to optional mailing"}],
                "context_requests": [],
                "best_argument_burdensome": "This requirement forces physical mail submission with no digital alternative",
                "best_argument_justified": "Physical mail ensures proper documentation and chain of custody",
                "best_argument_unrelated": None,
            }
        }]
    }


@pytest.fixture
def sample_tier2_llm_response():
    """Real-ish Tier 2 LLM JSON response for testing."""
    return {
        "type": "message",
        "content": [{
            "type": "tool_use",
            "input": {
                "classification": "burdensome",
                "confidence": 0.82,
                "reasoning": "The requirement mandates physical mail with no electronic alternative...",
                "argument_for_regulation": "Physical documentation provides audit trail",
                "argument_against_regulation": "No legitimate reason to prohibit electronic submission",
                "severity": 6,
                "severity_baseline": 5,
                "severity_calculation": "Base 5 + no alternative (+1) = 6",
                "verbatim_requirements": ["shall be submitted by mail"],
                "context_used": [],
                "cites_federal_statute": False,
                "claims_no_alternative": True,
            }
        }]
    }


@pytest.fixture
def mock_batch_client():
    """Mock anthropic batch API client."""
    with patch('scripts.research_pipeline.pipeline_runner.anthropic', create=True) as mock:
        mock.batches.create.return_value = Mock(id="batch_123")
        mock.batches.retrieve.return_value = Mock(
            status="completed",
            results_url="https://api.anthropic.com/v1/batches/batch_123/results"
        )
        yield mock


