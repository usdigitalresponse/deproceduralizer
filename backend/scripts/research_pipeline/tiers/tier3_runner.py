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

from lib.llm import call_llm_beta_async, DEFAULT_MODEL
from lib.batch import format_batch_request
from ..formatting import format_context_used_summary, format_tier1_argument
from .web_search import (
    get_web_search_tool,
    extract_web_search_response,
    format_citations_for_evidence,
    WebSearchCitation,
)

def _build_submit_analysis_tool() -> dict:
    """
    Build the submit_analysis tool definition for Tier 3 structured output.

    Instead of asking the LLM to output JSON in free text (which often fails),
    we define a tool that the LLM calls to submit its structured analysis.
    This guarantees valid JSON via the tool_use mechanism.
    """
    return {
        "name": "submit_analysis",
        "description": (
            "Submit your structured analysis after completing web research. "
            "You MUST call this tool to submit your findings."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "classification": {
                    "type": "string",
                    "enum": ["burdensome", "justified", "unrelated"],
                    "description": "Final classification after web search verification",
                },
                "confidence": {
                    "type": "number",
                    "description": "Confidence score 0.0-1.0",
                },
                "reasoning": {
                    "type": "string",
                    "description": "How web search findings affected classification",
                },
                "final_severity": {
                    "type": "integer",
                    "description": "Final severity 1-10",
                },
                "severity_adjustment": {
                    "type": "integer",
                    "description": "Adjustment from Tier 2 severity (-3 to +3)",
                },
                "severity_adjustment_reasoning": {
                    "type": "string",
                    "description": "Explanation of the adjustment",
                },
                "argument_for_regulation": {
                    "type": "string",
                    "description": "Best case for why burden is justified",
                },
                "argument_against_regulation": {
                    "type": "string",
                    "description": "Best case for why burden is problematic",
                },
                "web_search_summary": {
                    "type": "string",
                    "description": "Summary of web search findings",
                },
                "verbatim_requirements": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Verbatim requirement text from regulation",
                },
                "federal_mandate_confirmed": {
                    "type": "object",
                    "properties": {
                        "value": {"type": "boolean"},
                        "scope": {"type": "string", "enum": ["reg-specific", "issue-type/domain"]},
                        "reason": {"type": "string"},
                    },
                    "required": ["value", "scope", "reason"],
                    "description": "Whether federal mandate was confirmed by web search",
                },
                "state_discretion_found": {
                    "type": "object",
                    "properties": {
                        "value": {"type": "boolean"},
                        "scope": {"type": "string", "enum": ["reg-specific", "issue-type/domain"]},
                        "reason": {"type": "string"},
                    },
                    "required": ["value", "scope", "reason"],
                    "description": "Whether state has discretion in implementation",
                },
                "modernized_alternative_found": {
                    "type": "object",
                    "properties": {
                        "value": {"type": "boolean"},
                        "scope": {"type": "string", "enum": ["reg-specific", "issue-type/domain"]},
                        "reason": {"type": "string"},
                    },
                    "required": ["value", "scope", "reason"],
                    "description": "Whether modern alternatives exist",
                },
                "superseded_by_law": {
                    "type": "object",
                    "properties": {
                        "value": {"type": "boolean"},
                        "scope": {"type": "string", "enum": ["reg-specific", "issue-type/domain"]},
                        "reason": {"type": "string"},
                    },
                    "required": ["value", "scope", "reason"],
                    "description": "Whether requirement has been superseded by law",
                },
                "advocacy_for_change": {
                    "type": "object",
                    "properties": {
                        "value": {"type": "boolean"},
                        "scope": {"type": "string", "enum": ["reg-specific", "issue-type/domain"]},
                        "reason": {"type": "string"},
                    },
                    "required": ["value", "scope", "reason"],
                    "description": "Whether advocacy groups call for change",
                },
                "evidence_gap": {
                    "type": "boolean",
                    "description": "True if insufficient evidence found",
                },
                "federal_mandate_found": {
                    "type": "boolean",
                    "description": "Simple boolean: federal mandate found?",
                },
                "state_has_discretion": {
                    "type": "boolean",
                    "description": "Simple boolean: state has discretion?",
                },
                "easy_cleanup_candidate": {
                    "type": "boolean",
                    "description": "True if this is a low-hanging fruit cleanup",
                },
                "cleanup_type": {
                    "type": "string",
                    "enum": ["alternative_in_practice", "alternative_authorized", "peer_state_solution"],
                    "description": "Type of easy cleanup (if applicable)",
                },
                "cleanup_evidence": {
                    "type": "string",
                    "description": "URL or citation proving alternative exists",
                },
                "cleanup_recommendation": {
                    "type": "string",
                    "description": "Suggested regulation text change",
                },
                "cleanup_effort": {
                    "type": "string",
                    "enum": ["trivial", "easy", "medium"],
                    "description": "Effort level for cleanup",
                },
            },
            "required": [
                "classification", "confidence", "reasoning",
                "argument_for_regulation", "argument_against_regulation",
                "web_search_summary",
                "federal_mandate_confirmed", "state_discretion_found",
                "federal_mandate_found", "state_has_discretion",
                "evidence_gap",
            ],
        },
    }


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
    Find and parse a valid JSON object from text (fallback for legacy responses).

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

    Prefers json_data from submit_analysis tool call (primary path).
    Falls back to text parsing for backward compatibility.

    Args:
        text: Claude's text response (fallback for legacy responses)
        citations: Citations extracted from the response's text blocks
        json_data: Direct JSON from submit_analysis tool call (preferred)

    Returns:
        Tier3Output if parsing succeeds, None otherwise
    """
    try:
        # Primary path: JSON from submit_analysis tool call
        if json_data is not None:
            data = json_data
            print(f"    Using submit_analysis tool call (structured)")
        else:
            # Fallback: parse JSON from text (legacy)
            data = _find_json_object(text)
            if data is None:
                print(f"    Warning: No valid JSON found in response")
                return None
            print(f"    Parsed JSON from text response (fallback)")

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

        # Normalize string "null" to None for optional fields.
        # Tool-call schema uses string types, so the LLM sometimes returns
        # the literal string "null" instead of omitting the field.
        for key in ('cleanup_type', 'cleanup_effort', 'cleanup_evidence',
                     'cleanup_recommendation', 'severity_adjustment_reasoning'):
            if data.get(key) == 'null':
                data[key] = None

        # Normalize/clamp values before validation to handle edge cases
        # where the model returns out-of-range or non-standard values

        # Coerce to int and clamp severity to valid range (1-10)
        if 'final_severity' in data and data['final_severity'] is not None:
            original_severity = data['final_severity']
            data['final_severity'] = max(1, min(10, int(data['final_severity'])))
            if data['final_severity'] != original_severity:
                print(f"    Clamped final_severity: {original_severity} → {data['final_severity']}")

        # Coerce to int and clamp severity_adjustment to valid range (-3 to +3)
        if 'severity_adjustment' in data and data['severity_adjustment'] is not None:
            original_adj = data['severity_adjustment']
            data['severity_adjustment'] = max(-3, min(3, int(data['severity_adjustment'])))
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
    Run Tier 3 using real-time API with web search.

    Uses a SINGLE-CALL approach where Claude:
    1. Performs web searches using the web_search tool
    2. Submits structured results via the submit_analysis tool call
    3. We extract JSON directly from the tool_use block (no text parsing)

    STATE MANAGEMENT: This function populates tier3_output/tier3_completed_at.
    The pipeline runner is responsible for all state transitions
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

            full_prompt = prompt_parts["user"]
            submit_tool = _build_submit_analysis_tool()

            # SINGLE CALL: Claude performs web search AND submits structured
            # results via the submit_analysis tool call. This eliminates
            # unreliable JSON-from-text parsing.
            response, api_usage = await call_llm_beta_async(
                client=client,
                prompt=full_prompt,
                system=prompt_parts["system"],
                tools=[web_search_tool, submit_tool],
                model=TIER3_REALTIME_MODEL,
                max_tokens=64000,
                cache_ttl="1h",
            )

            if response is None:
                raise Exception("API call failed after all retries")

            # Extract the complete response including citations and tool_use data
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

            # Parse from submit_analysis tool call (json_data) or fall back to text
            result = _parse_tier3_json_response(
                web_response.text,
                web_response.citations,
                json_data=web_response.json_data,
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
                unit.error_message = "Tier 3: no submit_analysis tool call or unparseable result"
                print(f"    ERROR: No submit_analysis tool call found in response")
                print(f"       Stop reason: {response.stop_reason}")
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


def prepare_tier3_batch(
    units: list[TrackedUnit],
    issue_configs: dict[str, IssueConfig],
    state: str = "NJ",
) -> list[dict]:
    """
    V5.2: Prepare batch requests for Tier 3 Web Search verification.

    Uses the same prompt logic as run_tier3_realtime() but formats for Batch API.
    Web search tool is included in the batch request - Claude performs searches
    and returns results with citations just like in real-time mode.

    Args:
        units: Units requiring Tier 3 processing
        issue_configs: Dict mapping issue_type to IssueConfig
        state: Two-letter state code for localizing searches (default "NJ")

    Returns:
        List of batch request dicts formatted for BatchManager.submit_batch()
    """
    if not units:
        return []

    tier_configs = load_tier_configs()
    tier3_config = tier_configs['tier3']

    # Get state-specific web search tool (same as real-time)
    web_search_tool = get_web_search_tool(state=state, max_uses=5)

    print(f"  Preparing Tier 3 batch requests...")
    print(f"  State location: {state} ({web_search_tool['user_location']['city']}, {web_search_tool['user_location']['region']})")

    requests = []
    skipped = 0

    for unit in units:
        # Get issue config for this unit
        issue_config = issue_configs.get(unit.issue_type)
        if not issue_config:
            print(f"    SKIP: No issue config for {unit.issue_type}")
            skipped += 1
            continue

        # V5: Get Tier 2 output (Tier 3 now directly follows Tier 2)
        prev_output = unit.tier2_output
        if not prev_output:
            print(f"    SKIP: No Tier 2 output for doc {unit.document_id}")
            skipped += 1
            continue

        # Build search guidance from Tier 2
        web_search_topics = getattr(prev_output, 'web_search_topics', []) or []

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

        # V5.2: Extract disambiguation context from Tier 2
        program_context = getattr(prev_output, 'program_context', None) or "(not provided by Tier 2)"
        not_to_confuse_with = getattr(prev_output, 'not_to_confuse_with', []) or []
        search_scope_guidance = getattr(prev_output, 'search_scope_guidance', None) or "(not provided by Tier 2)"

        # Format not_to_confuse_with as bullet list
        if not_to_confuse_with:
            not_to_confuse_formatted = "\n".join(f"- {item}" for item in not_to_confuse_with)
        else:
            not_to_confuse_formatted = "(none specified)"

        # Build tier3 variables (same as real-time)
        from ..routing import get_tier3_trigger_reason
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

        # Format batch request with web search + submit_analysis tools
        submit_tool = _build_submit_analysis_tool()
        request = format_batch_request(
            custom_id=unit.custom_id,
            prompt=prompt_parts["user"],
            system=prompt_parts["system"],
            model=DEFAULT_MODEL,
            max_tokens=64000,
            tools=[web_search_tool, submit_tool],
        )
        requests.append(request)

    print(f"  Prepared {len(requests)} requests ({skipped} skipped)")
    return requests
