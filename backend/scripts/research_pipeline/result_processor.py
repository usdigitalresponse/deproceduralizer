"""
Result processor for the research pipeline.

Handles parsing batch results into Pydantic models,
extracting context requests, and computing derived fields.
"""

import asyncio
import json
from datetime import datetime
from typing import Optional, Type, TypeVar, TYPE_CHECKING

from pydantic import BaseModel

from .state_machine import TrackedUnit, ProcessingState
from .models.llm_outputs import Tier1Output, Tier2Output, Tier3Output
from .models.context import ContextRequest
from .cost_tracker import CostTracker, DEFAULT_BATCH_MODEL

# Import from shared_utils
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from shared_utils import BatchManager, parse_batch_result_tool_use

if TYPE_CHECKING:
    from observability.types import LLMTraceContext

# Langfuse logging (graceful degradation if not configured)
try:
    from observability.langfuse_client import log_generation
    LANGFUSE_AVAILABLE = True
except ImportError:
    LANGFUSE_AVAILABLE = False


T = TypeVar('T', bound=BaseModel)


def process_tier_results(
    batch_id: str,
    units: dict[str, TrackedUnit],
    manager: BatchManager,
    output_model: Type[T],
    tier: int,
    cost_tracker: Optional[CostTracker] = None,
    model: Optional[str] = None,
    trace_context: Optional["LLMTraceContext"] = None,
) -> tuple[list[TrackedUnit], list[TrackedUnit]]:
    """
    Process batch results for any tier.

    Args:
        batch_id: Anthropic batch API ID
        units: Dict mapping custom_id to TrackedUnit
        manager: BatchManager instance
        output_model: Pydantic model class (Tier1Output, Tier2Output, etc.)
        tier: Tier number (1, 2, 3)
        cost_tracker: Optional CostTracker to record token usage
        model: Model name for accurate cost tracking (defaults to DEFAULT_BATCH_MODEL)
        trace_context: Optional LLMTraceContext for Langfuse logging

    Returns:
        (succeeded, failed) - Lists of TrackedUnits
    """
    succeeded = []
    failed = []
    total_input = 0
    total_output = 0
    total_cache_read = 0
    total_cache_write = 0

    # Load original requests for Langfuse logging (graceful degradation if unavailable)
    original_requests = {}
    if LANGFUSE_AVAILABLE and trace_context:
        try:
            if hasattr(manager, 'load_requests'):
                original_requests = manager.load_requests(batch_id)
        except Exception:
            pass  # Langfuse logging will proceed without original request data

    for result in manager.get_batch_results(batch_id):
        custom_id = result.custom_id
        unit = units.get(custom_id)

        if not unit:
            # Unknown custom_id - log and skip
            continue

        # Track token usage
        if result.result.type == 'succeeded':
            usage = result.result.message.usage
            if usage:
                total_input += getattr(usage, 'input_tokens', 0)
                total_output += getattr(usage, 'output_tokens', 0)
                total_cache_read += getattr(usage, 'cache_read_input_tokens', 0)
                total_cache_write += getattr(usage, 'cache_creation_input_tokens', 0)

        # Handle non-success results
        if result.result.type != 'succeeded':
            unit.state = ProcessingState.ERROR
            error_type = result.result.type
            error_msg = ""
            if hasattr(result.result, 'error') and result.result.error:
                error_msg = str(result.result.error)
            unit.error_message = f"Tier {tier} batch {error_type}: {error_msg}"
            failed.append(unit)
            continue

        # Parse output
        try:
            output = parse_batch_result_tool_use(result, output_model)
            if output is None:
                unit.state = ProcessingState.ERROR
                unit.error_message = f"Could not parse Tier {tier} output - no tool_use block"
                failed.append(unit)
                continue

            # Store output on unit
            if tier == 1:
                unit.tier1_output = output
                unit.tier1_completed_at = datetime.now()
                unit.state = ProcessingState.TIER1_COMPLETE
            elif tier == 2:
                unit.tier2_output = output
                unit.tier2_completed_at = datetime.now()
                unit.state = ProcessingState.TIER2_COMPLETE
            elif tier == 3:
                unit.tier3_output = output
                unit.tier3_completed_at = datetime.now()
                unit.state = ProcessingState.TIER3_COMPLETE

            # Mark context items as used based on LLM output
            mark_context_used_in_registry(unit, output)

            # Log to Langfuse with full prompt and response
            if LANGFUSE_AVAILABLE and trace_context and custom_id in original_requests:
                try:
                    original_req = original_requests[custom_id]
                    # Extract prompt from original request
                    messages = original_req.get('params', {}).get('messages', [])
                    input_text = json.dumps(messages, indent=2) if messages else ""
                    # Extract response (the tool_use output)
                    output_text = output.model_dump_json(indent=2)
                    # Get token counts from usage
                    usage = result.result.message.usage
                    input_tokens = getattr(usage, 'input_tokens', 0)
                    output_tokens = getattr(usage, 'output_tokens', 0)
                    cache_read = getattr(usage, 'cache_read_input_tokens', 0)

                    # Update trace context stage for this tier
                    trace_context.stage = f"tier{tier}"

                    log_generation(
                        context=trace_context,
                        name=f"batch_tier{tier}_{custom_id}",
                        model=model or DEFAULT_BATCH_MODEL,
                        input_text=input_text,
                        output_text=output_text,
                        input_tokens=input_tokens,
                        output_tokens=output_tokens,
                        latency_ms=0,  # Batch API doesn't track per-request latency
                        success=True,
                        cache_read_tokens=cache_read,
                    )
                except Exception as log_error:
                    # Don't fail processing if Langfuse logging fails
                    pass

            succeeded.append(unit)

        except Exception as e:
            unit.state = ProcessingState.ERROR
            unit.error_message = f"Tier {tier} parse error: {str(e)}"
            failed.append(unit)

    # Record token usage with explicit model for accurate cost tracking
    if cost_tracker and (total_input > 0 or total_output > 0):
        cost_tracker.record_batch_usage(
            tier=tier,
            input_tokens=total_input,
            output_tokens=total_output,
            cache_read_tokens=total_cache_read,
            cache_write_tokens=total_cache_write,
            request_count=len(succeeded) + len(failed),
            model=model or DEFAULT_BATCH_MODEL,
        )

    return succeeded, failed


def process_tier1_results(
    batch_id: str,
    units: dict[str, TrackedUnit],
    manager: BatchManager,
    cost_tracker: Optional[CostTracker] = None,
    trace_context: Optional["LLMTraceContext"] = None,
) -> tuple[list[TrackedUnit], list[TrackedUnit]]:
    """Process Tier 1 batch results."""
    return process_tier_results(
        batch_id=batch_id,
        units=units,
        manager=manager,
        output_model=Tier1Output,
        tier=1,
        cost_tracker=cost_tracker,
        model=DEFAULT_BATCH_MODEL,
        trace_context=trace_context,
    )


def process_tier2_results(
    batch_id: str,
    units: dict[str, TrackedUnit],
    manager: BatchManager,
    cost_tracker: Optional[CostTracker] = None,
    trace_context: Optional["LLMTraceContext"] = None,
) -> tuple[list[TrackedUnit], list[TrackedUnit]]:
    """Process Tier 2 batch results."""
    return process_tier_results(
        batch_id=batch_id,
        units=units,
        manager=manager,
        output_model=Tier2Output,
        tier=2,
        cost_tracker=cost_tracker,
        model=DEFAULT_BATCH_MODEL,
        trace_context=trace_context,
    )


def process_tier3_results(
    batch_id: str,
    units: dict[str, TrackedUnit],
    manager: BatchManager,
    cost_tracker: Optional[CostTracker] = None,
    trace_context: Optional["LLMTraceContext"] = None,
) -> tuple[list[TrackedUnit], list[TrackedUnit]]:
    """
    Process Tier 3 batch results (legacy - for tool_use structured output).

    NOTE: For web search batch results, use process_tier3_batch_results() instead.
    """
    return process_tier_results(
        batch_id=batch_id,
        units=units,
        manager=manager,
        output_model=Tier3Output,
        tier=3,
        cost_tracker=cost_tracker,
        model=DEFAULT_BATCH_MODEL,
        trace_context=trace_context,
    )


def process_tier3_batch_results(
    batch_id: str,
    units: dict[str, TrackedUnit],
    manager: BatchManager,
    cost_tracker: Optional[CostTracker] = None,
    trace_context: Optional["LLMTraceContext"] = None,
) -> tuple[list[TrackedUnit], list[TrackedUnit]]:
    """
    V5.2: Process Tier 3 batch results with web search citation extraction.

    Unlike Tiers 1-2 which use tool_use structured output, Tier 3 with web search
    returns text responses with embedded JSON. This function:
    1. Extracts web search response including citations
    2. Parses JSON from text using the same logic as real-time mode
    3. Enriches context_used with web citations

    Args:
        batch_id: Anthropic batch API ID
        units: Dict mapping custom_id to TrackedUnit
        manager: BatchManager instance
        cost_tracker: Optional CostTracker for recording token usage
        trace_context: Optional LLMTraceContext for Langfuse logging

    Returns:
        (succeeded, failed) - Lists of TrackedUnits
    """
    from .tiers.web_search import extract_web_search_response
    from .tiers.tier3_runner import _parse_tier3_json_response

    succeeded = []
    failed = []
    total_input = 0
    total_output = 0
    total_cache_read = 0
    total_cache_write = 0

    # Load original requests for Langfuse logging (graceful degradation if unavailable)
    original_requests = {}
    if LANGFUSE_AVAILABLE and trace_context:
        try:
            if hasattr(manager, 'load_requests'):
                original_requests = manager.load_requests(batch_id)
        except Exception:
            pass  # Langfuse logging will proceed without original request data

    print(f"  Processing Tier 3 batch results...")

    for result in manager.get_batch_results(batch_id):
        custom_id = result.custom_id
        unit = units.get(custom_id)

        if not unit:
            # Unknown custom_id - log and skip
            continue

        # Track token usage
        if result.result.type == 'succeeded':
            usage = result.result.message.usage
            if usage:
                total_input += getattr(usage, 'input_tokens', 0)
                total_output += getattr(usage, 'output_tokens', 0)
                total_cache_read += getattr(usage, 'cache_read_input_tokens', 0)
                total_cache_write += getattr(usage, 'cache_creation_input_tokens', 0)

        # Handle non-success results
        if result.result.type != 'succeeded':
            unit.state = ProcessingState.ERROR
            error_type = result.result.type
            error_msg = ""
            if hasattr(result.result, 'error') and result.result.error:
                error_msg = str(result.result.error)
            unit.error_message = f"Tier 3 batch {error_type}: {error_msg}"
            failed.append(unit)
            print(f"    FAILED: {custom_id} - {error_type}: {error_msg}")
            continue

        # Extract web search response (text + citations) from the message
        try:
            web_response = extract_web_search_response(result.result.message)

            # Parse JSON from text response (same as real-time mode)
            output = _parse_tier3_json_response(
                web_response.text,
                web_response.citations,
                json_data=web_response.json_data,
            )

            if output is None and web_response.text:
                # Retry with JSON extraction prompt (same as real-time path)
                from .tiers.tier3_runner import _retry_json_extraction
                import anthropic
                print(f"    Initial JSON parse failed for {custom_id}. Retrying with extraction prompt...")
                try:
                    client = anthropic.AsyncAnthropic()
                    output = asyncio.run(_retry_json_extraction(
                        client=client,
                        original_text=web_response.text,
                        citations=web_response.citations,
                        cost_tracker=cost_tracker,
                    ))
                    if output:
                        print(f"    Retry successful for {custom_id}!")
                    else:
                        print(f"    Retry also failed for {custom_id}.")
                except Exception as retry_err:
                    print(f"    Retry error for {custom_id}: {retry_err}")

            if output is None:
                unit.state = ProcessingState.ERROR
                unit.error_message = "Could not parse Tier 3 JSON from batch response"
                failed.append(unit)
                print(f"    FAILED: {custom_id} - Could not parse JSON")
                continue

            # Store output on unit
            unit.tier3_output = output
            unit.tier3_completed_at = datetime.now()
            unit.state = ProcessingState.TIER3_COMPLETE

            # Mark context items as used
            mark_context_used_in_registry(unit, output)

            # Log to Langfuse
            if LANGFUSE_AVAILABLE and trace_context and custom_id in original_requests:
                try:
                    original_req = original_requests[custom_id]
                    messages = original_req.get('params', {}).get('messages', [])
                    input_text = json.dumps(messages, indent=2) if messages else ""
                    output_text = output.model_dump_json(indent=2)
                    usage = result.result.message.usage
                    input_tokens = getattr(usage, 'input_tokens', 0)
                    output_tokens = getattr(usage, 'output_tokens', 0)
                    cache_read = getattr(usage, 'cache_read_input_tokens', 0)

                    trace_context.stage = "tier3"
                    log_generation(
                        context=trace_context,
                        name=f"batch_tier3_{custom_id}",
                        model=DEFAULT_BATCH_MODEL,
                        input_text=input_text,
                        output_text=output_text,
                        input_tokens=input_tokens,
                        output_tokens=output_tokens,
                        latency_ms=0,
                        success=True,
                        cache_read_tokens=cache_read,
                    )
                except Exception:
                    pass  # Don't fail if Langfuse logging fails

            succeeded.append(unit)
            print(f"    OK: {custom_id} - {output.classification} (conf={output.confidence:.2f})")

        except Exception as e:
            unit.state = ProcessingState.ERROR
            unit.error_message = f"Tier 3 parse error: {str(e)}"
            failed.append(unit)
            print(f"    FAILED: {custom_id} - {str(e)}")

    # Record token usage
    if cost_tracker and (total_input > 0 or total_output > 0):
        cost_tracker.record_batch_usage(
            tier=3,
            input_tokens=total_input,
            output_tokens=total_output,
            cache_read_tokens=total_cache_read,
            cache_write_tokens=total_cache_write,
            request_count=len(succeeded) + len(failed),
            model=DEFAULT_BATCH_MODEL,
        )

    print(f"  Tier 3 batch results: {len(succeeded)} succeeded, {len(failed)} failed")
    return succeeded, failed


def mark_context_used_in_registry(unit: TrackedUnit, output: BaseModel) -> None:
    """
    Mark context items as used in the registry based on LLM output.

    The LLM reports which context items it used via context_used field.
    This function marks those items in the unit's context_registry.

    Args:
        unit: TrackedUnit with context_registry
        output: Tier output model with context_used field
    """
    if unit.context_registry is None:
        return

    # Get context_used from output if available
    context_used = getattr(output, 'context_used', None)
    if not context_used:
        return

    for ctx in context_used:
        # ContextEntryLLM has: type, identifier, relevance, quote, etc.
        identifier = getattr(ctx, 'identifier', None)
        relevance = getattr(ctx, 'relevance', '') or ''
        quote = getattr(ctx, 'quote', None)
        is_mandate = getattr(ctx, 'is_mandate', None)
        state_discretion = getattr(ctx, 'state_discretion', None)

        if identifier:
            unit.context_registry.mark_used(
                identifier=identifier,
                relevance=relevance,
                quote=quote,
                is_mandate=is_mandate,
                state_discretion=state_discretion,
            )


def extract_context_requests(
    output: Tier1Output | Tier2Output,
) -> list[ContextRequest]:
    """
    Extract context requests from tier output.

    Tier 1: Returns context_requests (summaries for Tier 2)
    Tier 2: Returns full_text_requests (full text for Tier 3)
    """
    if isinstance(output, Tier1Output):
        return output.context_requests
    elif isinstance(output, Tier2Output):
        return output.full_text_requests
    return []


def check_verbatim(
    quotes: list[str],
    source_text: str,
) -> tuple[bool, list[dict]]:
    """
    Check if quotes are actually verbatim from source text.

    Uses exact matching and whitespace-normalized matching.

    Args:
        quotes: List of quoted strings from LLM
        source_text: The source document text

    Returns:
        (all_verbatim, details) where details has info per quote
    """
    if not quotes:
        return True, []

    source_lower = source_text.lower()
    details = []
    all_verbatim = True

    for quote in quotes:
        quote_lower = quote.lower().strip()

        # Exact match check
        if quote_lower in source_lower:
            details.append({
                "quote": quote,
                "is_verbatim": True,
                "match_type": "exact",
            })
            continue

        # Try with normalized whitespace
        import re
        quote_normalized = re.sub(r'\s+', ' ', quote_lower)
        source_normalized = re.sub(r'\s+', ' ', source_lower)

        if quote_normalized in source_normalized:
            details.append({
                "quote": quote,
                "is_verbatim": True,
                "match_type": "normalized",
            })
            continue

        # No match found
        details.append({
            "quote": quote,
            "is_verbatim": False,
            "match_type": "none",
        })
        all_verbatim = False

    return all_verbatim, details


def compute_final_classification(unit: TrackedUnit) -> Optional[str]:
    """
    V5: Compute the final classification from highest completed tier.

    Returns one of: 'burdensome', 'justified', 'unrelated', 'all_false_positives', None
    """
    # V5: Tier 3 is now the highest tier (web search)
    if unit.tier3_output is not None:
        return unit.tier3_output.classification

    # Tier 2 next
    if unit.tier2_output is not None:
        classification = unit.tier2_output.classification
        # needs_full_context means Tier 2 didn't decide - shouldn't happen if pipeline ran correctly
        if classification == "needs_full_context":
            return None
        return classification

    # Tier 1 only returns all_false_positives or needs_research
    if unit.tier1_output is not None:
        if unit.tier1_output.classification == "all_false_positives":
            return "all_false_positives"
        # needs_research means Tier 2 should have run
        return None

    return None


def compute_final_severity(unit: TrackedUnit) -> Optional[int]:
    """
    V5: Compute the final severity from highest completed tier.

    Tier 3: Uses final_severity directly, or Tier 2 severity + adjustment
    Tier 2: Uses severity directly
    """
    # Get Tier 2 baseline
    tier2_severity = None
    if unit.tier2_output is not None:
        tier2_severity = unit.tier2_output.severity

    # V5: Tier 3 has final_severity or applies adjustment to Tier 2
    if unit.tier3_output is not None:
        # Prefer final_severity if set
        if unit.tier3_output.final_severity is not None:
            return unit.tier3_output.final_severity
        # Fall back to adjustment calculation
        if tier2_severity is not None:
            adjustment = unit.tier3_output.severity_adjustment or 0
            return max(1, min(10, tier2_severity + adjustment))

    return tier2_severity


def compute_requirement_found(unit: TrackedUnit) -> Optional[bool]:
    """
    Compute requirement_found from final classification.

    True if burdensome or justified
    False if unrelated or all_false_positives
    """
    classification = compute_final_classification(unit)
    if classification is None:
        return None
    return classification in ("burdensome", "justified")


def compute_is_justified(unit: TrackedUnit) -> Optional[bool]:
    """
    Compute is_justified from final classification.
    """
    classification = compute_final_classification(unit)
    if classification is None:
        return None
    return classification == "justified"


def get_classification_tier(unit: TrackedUnit) -> int:
    """
    V5: Get the tier number that produced the final classification.
    """
    # V5: Tier 3 is the highest tier
    if unit.tier3_output is not None:
        return 3
    if unit.tier2_output is not None:
        # Even if needs_full_context, Tier 2 made the decision
        if unit.tier2_output.classification != "needs_full_context":
            return 2
    if unit.tier1_output is not None:
        if unit.tier1_output.classification == "all_false_positives":
            return 1
    return 0


def format_result_summary(units: list[TrackedUnit]) -> str:
    """
    Format a summary of processing results.
    """
    from collections import Counter

    states = Counter(u.state.name for u in units)
    classifications = Counter(compute_final_classification(u) or "unknown" for u in units)

    lines = [
        "Processing Summary",
        "-" * 40,
        "States:",
    ]
    for state, count in sorted(states.items()):
        lines.append(f"  {state}: {count}")

    lines.extend([
        "",
        "Classifications:",
    ])
    for classification, count in sorted(classifications.items()):
        lines.append(f"  {classification}: {count}")

    return "\n".join(lines)
