"""
Tier 3 runner for the research pipeline.

V5: Tier 3 is the web search tier using real-time API.
Performs web search verification for high-risk or uncertain items.
"""

import asyncio
import json
import re
from datetime import datetime
from typing import Optional, Any

from pydantic import ValidationError

from ..state_machine import TrackedUnit, ProcessingState
from ..prompt_loader import (
    IssueConfig,
    load_tier_configs,
    format_tier_prompt,
)
from ..models.llm_outputs import Tier3Output
from ..config import TIER3_REALTIME_MODEL, TIER3_RATE_LIMIT_DELAY
from ..routing import get_tier3_trigger_reason

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))
from shared_utils import call_llm_beta_async
from ..formatting import format_context_used_summary, format_tier1_argument
from .web_search import (
    get_web_search_tool,
    extract_web_search_response,
    format_citations_for_evidence,
    WebSearchCitation,
)


def _transform_schema_for_anthropic(schema: dict) -> dict:
    """
    Transform Pydantic-generated schema for Anthropic Structured Outputs.

    Anthropic's structured outputs have specific requirements:
    - additionalProperties: false on all object types
    - No numerical constraints (minimum, maximum, multipleOf)
    - No string constraints (minLength, maxLength)
    - No array constraints beyond minItems 0/1

    This function recursively transforms the schema to be compatible.
    """
    # Keys to remove from the schema
    unsupported_keys = {
        "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf",
        "minLength", "maxLength", "minItems", "maxItems", "uniqueItems",
    }

    if isinstance(schema, dict):
        # Remove unsupported constraints
        for key in list(schema.keys()):
            if key in unsupported_keys:
                del schema[key]

        # If this is an object type, add additionalProperties: false
        if schema.get("type") == "object":
            schema["additionalProperties"] = False

        # Recursively process all values
        for key, value in list(schema.items()):
            if isinstance(value, dict):
                _transform_schema_for_anthropic(value)
            elif isinstance(value, list):
                for item in value:
                    if isinstance(item, dict):
                        _transform_schema_for_anthropic(item)

    return schema


def _get_tier3_output_schema() -> dict:
    """
    Get JSON schema for Tier3Output for use with Anthropic Structured Outputs.

    Anthropic's structured outputs requires a JSON schema that describes the
    expected output format. We generate this from the Pydantic model but need
    to extract it properly for the API.

    Returns:
        JSON schema dict suitable for output_format parameter
    """
    # Get the JSON schema from Pydantic model
    schema = Tier3Output.model_json_schema()

    # Transform for Anthropic compatibility (additionalProperties, remove unsupported constraints)
    _transform_schema_for_anthropic(schema)

    return schema


def _extract_statute_citations(context_used: list) -> list[str]:
    """Extract statute citations from context_used for web search."""
    citations = []
    for entry in context_used:
        ctx_type = entry.type if hasattr(entry, 'type') else entry.get('type', 'unknown')
        if ctx_type == 'statute':
            identifier = entry.identifier if hasattr(entry, 'identifier') else entry.get('identifier', '')
            if identifier:
                citations.append(identifier)
    return citations


def _find_json_object(text: str) -> Optional[dict]:
    """
    Find and parse a valid JSON object from text.

    Uses a robust approach: for each '{' found, try to find a matching '}'
    that forms valid JSON. This handles cases where the text contains
    multiple JSON blocks or extra braces.

    Args:
        text: Text that may contain a JSON object

    Returns:
        Parsed dict if found, None otherwise
    """
    # First try ```json blocks (most reliable)
    json_match = re.search(r'```json\s*([\s\S]*?)\s*```', text)
    if json_match:
        try:
            return json.loads(json_match.group(1))
        except json.JSONDecodeError:
            pass  # Fall through to raw JSON search

    # Find each { and try to parse from there
    for i, char in enumerate(text):
        if char == '{':
            # Try progressively shorter substrings from this position
            # Start with longest possible (to end of text) and work backward
            for j in range(len(text), i, -1):
                if text[j - 1] == '}':
                    try:
                        return json.loads(text[i:j])
                    except json.JSONDecodeError:
                        continue
    return None


def _parse_tier3_json_response(
    text: str,
    citations: list[WebSearchCitation],
    json_data: Optional[dict] = None,
) -> Optional[Tier3Output]:
    """
    Parse Tier3Output from Claude's response.

    V5.1: With structured outputs, JSON is returned directly via json_data parameter.
    Falls back to text parsing for backward compatibility or if structured outputs fails.

    Args:
        text: Claude's text response (may contain JSON for backward compat)
        citations: Citations extracted from the response's text blocks
        json_data: V5.1 - Direct JSON from structured outputs (preferred)

    Returns:
        Tier3Output if parsing succeeds, None otherwise
    """
    try:
        # V5.1: Prefer direct JSON from structured outputs
        if json_data is not None:
            data = json_data
            print(f"    Using structured output JSON (direct from API)")
        else:
            # Fallback: Use robust JSON finder for text-based responses
            data = _find_json_object(text)
            if data is None:
                print(f"    Warning: No valid JSON found in response")
                return None
            print(f"    Parsed JSON from text response (legacy mode)")

        # Enrich context_used with actual citations from the response
        if citations:
            web_context = format_citations_for_evidence(citations)
            # Merge with any context_used from the JSON
            existing_context = data.get('context_used', [])
            if isinstance(existing_context, list):
                # Convert ContextEntryLLM to dict for merging
                for entry in web_context:
                    existing_context.append({
                        "type": entry.type,
                        "identifier": entry.identifier,
                        "quote": entry.quote,
                        "relevance": entry.relevance,
                    })
                data['context_used'] = existing_context

        # Normalize/clamp values before validation to handle edge cases
        # where the model returns out-of-range or non-standard values

        # Clamp severity to valid range (1-10)
        if 'final_severity' in data and data['final_severity'] is not None:
            original_severity = data['final_severity']
            data['final_severity'] = max(1, min(10, data['final_severity']))
            if data['final_severity'] != original_severity:
                print(f"    Clamped final_severity: {original_severity} → {data['final_severity']}")

        # Clamp severity_adjustment to valid range (-3 to +3)
        if 'severity_adjustment' in data and data['severity_adjustment'] is not None:
            original_adj = data['severity_adjustment']
            data['severity_adjustment'] = max(-3, min(3, data['severity_adjustment']))
            if data['severity_adjustment'] != original_adj:
                print(f"    Clamped severity_adjustment: {original_adj} → {data['severity_adjustment']}")

        # Map non-standard cleanup_type values to valid enum values
        valid_cleanup_types = {'alternative_in_practice', 'alternative_authorized', 'peer_state_solution'}
        if 'cleanup_type' in data and data['cleanup_type'] is not None:
            if data['cleanup_type'] not in valid_cleanup_types:
                original_type = data['cleanup_type']
                # Map superseded_by_law and similar to alternative_authorized
                data['cleanup_type'] = 'alternative_authorized'
                print(f"    Mapped cleanup_type: '{original_type}' → 'alternative_authorized'")

        # Validate with Pydantic
        result = Tier3Output.model_validate(data)
        return result

    except json.JSONDecodeError as e:
        print(f"    Warning: JSON parse error: {e}")
        return None
    except ValidationError as e:
        print(f"    Warning: Validation error: {e}")
        return None
    except Exception as e:
        print(f"    Warning: Parse error: {e}")
        return None


async def run_tier3_realtime(
    units: list[TrackedUnit],
    issue_configs: dict[str, IssueConfig],
    client=None,
    cost_tracker=None,
    trace_context=None,
    state: str = "NJ",
) -> list[TrackedUnit]:
    """
    V5: Run Tier 3 using real-time API with web search.

    Uses a SINGLE-CALL approach where Claude:
    1. Performs web searches using the web_search tool
    2. Analyzes results and generates its response with citations
    3. Outputs structured JSON that we parse from the text response

    The key insight: actual cited text from web sources appears in the
    `citations` array of text blocks (as `cited_text`), NOT in the
    encrypted `web_search_tool_result` blocks.

    STATE MANAGEMENT: This function only sets intermediate states
    (TIER3_PROCESSING) and populates tier3_output/tier3_completed_at.
    The orchestrator is responsible for all terminal state transitions
    (TIER3_COMPLETE, DONE, ERROR).

    Args:
        units: Units requiring Tier 3 processing
        issue_configs: Dict mapping issue_type to IssueConfig
        client: Optional Anthropic client (creates new if not provided)
        cost_tracker: Optional CostTracker for recording token usage
        trace_context: Optional Langfuse trace context for observability
        state: Two-letter state code for localizing searches (default "NJ")

    Returns:
        Processed units with tier3_output populated (or error_message set)
    """
    import anthropic

    if not units:
        return units

    tier_configs = load_tier_configs()
    tier3_config = tier_configs['tier3']

    if client is None:
        # Set timeout to avoid SDK's long-request streaming requirement
        # See: https://github.com/anthropics/anthropic-sdk-python#long-requests
        client = anthropic.AsyncAnthropic(timeout=600.0)

    # Get state-specific web search tool
    web_search_tool = get_web_search_tool(state=state, max_uses=5)

    # Verbose: Show configuration
    print(f"  Model: {TIER3_REALTIME_MODEL}")
    print(f"  State location: {state} ({web_search_tool['user_location']['city']}, {web_search_tool['user_location']['region']})")
    print(f"  Langfuse tracing: {'ENABLED' if trace_context else 'disabled'}")
    print(f"  Cost tracking: {'ENABLED' if cost_tracker else 'disabled'}")

    for i, unit in enumerate(units):
        unit.state = ProcessingState.TIER3_PROCESSING

        # Verbose: Show which document we're processing
        print(f"\n  {'─'*60}")
        print(f"  [{i+1}/{len(units)}] Processing: {unit.unit.citation}")
        print(f"  {'─'*60}")
        print(f"    Document ID: {unit.unit.document_id}")
        print(f"    Issue type: {unit.issue_type}")

        # Get issue config for this unit
        issue_config = issue_configs.get(unit.issue_type)
        if not issue_config:
            # Set error_message; orchestrator will handle state transition
            unit.error_message = f"No issue config for {unit.issue_type}"
            print(f"    ERROR: No issue config for {unit.issue_type}")
            continue

        # V5: Get Tier 2 output (Tier 3 now directly follows Tier 2)
        prev_output = unit.tier2_output
        if not prev_output:
            # Set error_message; orchestrator will handle state transition
            unit.error_message = "No Tier 2 output for Tier 3"
            print(f"    ERROR: No Tier 2 output")
            continue

        # Verbose: Show Tier 2 context being used
        print(f"    Tier 2 Classification: {prev_output.classification}")
        print(f"    Tier 2 Severity: {getattr(prev_output, 'severity', 'N/A')}")
        print(f"    Tier 2 Confidence: {prev_output.confidence:.2f}")
        if prev_output.verbatim_requirements:
            print(f"    Verbatim requirements: {len(prev_output.verbatim_requirements)}")
            for vr in prev_output.verbatim_requirements[:2]:
                print(f"      - \"{vr[:60]}...\"" if len(vr) > 60 else f"      - \"{vr}\"")

        # Build search guidance from Tier 2
        web_search_topics = getattr(prev_output, 'web_search_topics', []) or []
        statute_citations = _extract_statute_citations(prev_output.context_used)

        # Verbose: Show what we're searching for
        print(f"    Web search topics: {web_search_topics if web_search_topics else '(none suggested)'}")
        if statute_citations:
            print(f"    Statute citations to verify: {statute_citations}")

        print(f"\n    Single-call web search + analysis...")
        print(f"       Model: {TIER3_REALTIME_MODEL}")

        try:
            # Extract Tier 1 argument framing (if available)
            t1 = unit.tier1_output
            if t1:
                tier1_argument_burdensome = format_tier1_argument(t1.best_argument_burdensome)
                tier1_argument_justified = format_tier1_argument(t1.best_argument_justified)
                tier1_argument_unrelated = format_tier1_argument(t1.best_argument_unrelated)
            else:
                tier1_argument_burdensome = "(Tier 1 not available)"
                tier1_argument_justified = "(Tier 1 not available)"
                tier1_argument_unrelated = "(Tier 1 not available)"

            # Build the combined prompt for search + analysis
            # V5.2: Extract disambiguation context from Tier 2
            program_context = getattr(prev_output, 'program_context', None) or "(not provided by Tier 2)"
            not_to_confuse_with = getattr(prev_output, 'not_to_confuse_with', []) or []
            search_scope_guidance = getattr(prev_output, 'search_scope_guidance', None) or "(not provided by Tier 2)"

            # Format not_to_confuse_with as bullet list
            if not_to_confuse_with:
                not_to_confuse_formatted = "\n".join(f"- {item}" for item in not_to_confuse_with)
            else:
                not_to_confuse_formatted = "(none specified)"

            tier3_vars = {
                # Tier 1 argument framing (initial perspectives)
                "tier1_argument_burdensome": tier1_argument_burdensome,
                "tier1_argument_justified": tier1_argument_justified,
                "tier1_argument_unrelated": tier1_argument_unrelated,
                # Tier 2 classification and analysis
                "tier2_classification": prev_output.classification,
                "tier2_severity": str(getattr(prev_output, 'severity', None) or "not set"),
                "tier2_severity_calculation": getattr(prev_output, 'severity_calculation', '') or "(not provided)",
                "tier2_confidence": f"{prev_output.confidence:.2f}",
                "tier2_reasoning": prev_output.reasoning,
                "tier2_context_summary": format_context_used_summary(prev_output.context_used),
                # Tier 3 specific
                "tier3_trigger_reason": get_tier3_trigger_reason(unit),
                "verbatim_requirements": "\n".join(f"- {v}" for v in prev_output.verbatim_requirements),
                "argument_for": prev_output.argument_for_regulation,
                "argument_against": prev_output.argument_against_regulation,
                "cites_federal_statute": str(getattr(prev_output, 'cites_federal_statute', False)).lower(),
                "federal_citation": getattr(prev_output, 'federal_citation', None) or "none",
                "claims_no_alternative": str(getattr(prev_output, 'claims_no_alternative', False)).lower(),
                "potentially_controversial": str(getattr(prev_output, 'potentially_controversial', False)).lower(),
                "web_search_topics": ", ".join(web_search_topics) if web_search_topics else "(none suggested)",
                # V5.2: Web search disambiguation context from Tier 2
                "program_context": program_context,
                "not_to_confuse_with": not_to_confuse_formatted,
                "search_scope_guidance": search_scope_guidance,
                # Web search results will be populated by Claude during the call
                "web_search_results": "(Claude will perform searches and analyze results)",
            }

            prompt_parts = format_tier_prompt(
                tier=tier3_config,
                issue=issue_config,
                citation=unit.unit.citation,
                title=unit.unit.title or "",
                issue_type=issue_config.db_issue_type,
                **tier3_vars,
            )

            # Claude performs web search and returns JSON in text response
            # Structured outputs had too many anyOf branches (22 vs limit of 8)
            # So we use simpler approach: JSON in text with web search tool
            full_prompt = prompt_parts["user"]

            # SINGLE CALL: Claude performs web search AND outputs JSON in text
            # Uses call_llm_beta_async for retry logic, max_tokens, and truncation handling
            response, api_usage = await call_llm_beta_async(
                client=client,
                prompt=full_prompt,
                system=prompt_parts["system"],
                tools=[web_search_tool],
                model=TIER3_REALTIME_MODEL,
                max_tokens=64000,
                betas=None,  # No structured outputs - too complex for schema
                output_format=None,
                cache_ttl="1h",
            )

            if response is None:
                raise Exception("API call failed after all retries")

            # Extract the complete response including citations
            web_response = extract_web_search_response(response)

            # Verbose: Show what we got
            print(f"       Response received")
            print(f"       Queries executed: {len(web_response.queries)}")
            for ws in web_response.queries:
                print(f"         - \"{ws.query}\": {len(ws.results)} results")
            print(f"       Citations found: {len(web_response.citations)}")
            for cit in web_response.citations[:3]:
                title_display = f"{cit.title[:40]}..." if len(cit.title) > 40 else cit.title
                text_display = f"{cit.cited_text[:60]}..." if len(cit.cited_text) > 60 else cit.cited_text
                print(f"         - [{title_display}] \"{text_display}\"")
                print(f"           URL: {cit.url}")
            print(f"       Tokens: {web_response.usage.get('input_tokens', 0)} in, {web_response.usage.get('output_tokens', 0)} out")

            # Record costs
            if cost_tracker:
                cost_tracker.record_batch_usage(
                    tier=3,
                    input_tokens=web_response.usage.get("input_tokens", 0),
                    output_tokens=web_response.usage.get("output_tokens", 0),
                    cache_read_tokens=web_response.usage.get("cache_read_tokens", 0),
                    cache_write_tokens=web_response.usage.get("cache_write_tokens", 0),
                    request_count=1,
                    model=TIER3_REALTIME_MODEL,
                )

            # Parse JSON from response (V5.1: prefer structured output, fall back to text)
            result = _parse_tier3_json_response(
                web_response.text,
                web_response.citations,
                json_data=web_response.json_data,  # V5.1: Direct JSON from structured outputs
            )

            if result:
                # Verbose: Show result
                print(f"\n    TIER 3 RESULT:")
                print(f"       Classification: {result.classification}")
                print(f"       Confidence: {result.confidence:.2f}")
                print(f"       Final severity: {result.final_severity}")
                if result.severity_adjustment:
                    print(f"       Severity adjustment: {result.severity_adjustment:+d}")
                if result.federal_mandate_found:
                    print(f"       Federal mandate: FOUND ({'discretion' if result.state_has_discretion else 'no discretion'})")
                if result.evidence_gap:
                    print(f"       Evidence gap: YES")
                if result.web_search_summary:
                    summary = result.web_search_summary[:150]
                    print(f"       Web summary: \"{summary}...\"" if len(result.web_search_summary) > 150 else f"       Web summary: \"{summary}\"")
                print(f"       Reasoning: \"{result.reasoning[:100]}...\"" if len(result.reasoning) > 100 else f"       Reasoning: \"{result.reasoning}\"")

                # Show web sources with URLs
                web_sources = [c for c in result.context_used if c.type == "web"]
                if web_sources:
                    print(f"       Web sources ({len(web_sources)}):")
                    for src in web_sources[:5]:
                        print(f"         - {src.identifier}")

                # Set output; orchestrator will handle state transition
                unit.tier3_output = result
                unit.tier3_completed_at = datetime.now()
            else:
                # Set error_message; orchestrator will handle state transition
                unit.error_message = "Tier 3 returned no parseable result"
                print(f"    ERROR: Could not parse JSON from response")
                print(f"       Response text: {web_response.text[:500]}...")

        except Exception as e:
            # Set error_message; orchestrator will handle state transition
            unit.error_message = f"Tier 3 error: {str(e)}"
            print(f"    ERROR: {str(e)}")
            import traceback
            traceback.print_exc()

        # Rate limiting - pause between requests
        print(f"\n    Rate limiting pause ({TIER3_RATE_LIMIT_DELAY}s)...")
        await asyncio.sleep(TIER3_RATE_LIMIT_DELAY)

    return units
