"""
Tier 2 runner for the research pipeline.

Handles batch preparation for Tier 2: Summary-Based Research.
Also includes re-run support for real-time API execution.
"""

import asyncio
from datetime import datetime
from typing import Optional

from pydantic import ValidationError

from ..state_machine import TrackedUnit, ProcessingState
from ..prompt_loader import (
    IssueConfig,
    load_tier_configs,
    format_tier_prompt,
)
from ..models.llm_outputs import Tier2Output
from ..models.context import ContextRequest
from ..formatting import (
    format_definitions,
    format_matches_for_tier2,
    format_fetched_context,
    format_tier1_argument,
)
from ..context import (
    fetch_summaries_for_requests,
    fetch_full_text_for_requests,
    fetch_document_content_batch,
    get_definitions_with_text_batch,
    get_ancestors_batch,
    # V5 4-layer caching
    get_subchapter_ids_batch,
    build_batch_context_for_subchapters,
    # Guidance context
    fetch_cited_document_summaries,
    build_guidance_batch_context,
    fetch_guidance_content_batch,
    format_guidance_preamble,
    GUIDANCE_BATCH_CONTEXT_VARS,
)
from ..config import BATCH_MODEL, MAX_TIER2_RERUNS

from lib.db import get_db_connection
from lib.llm import DEFAULT_MODEL
from lib.batch import format_batch_request


# =============================================================================
# TIER 1 OUTPUT HELPERS
# =============================================================================


def _extract_tier1_arguments(t1) -> tuple[str, str, str]:
    """Extract Tier 1 argument framing strings from a Tier1Output.

    Returns (burdensome, justified, unrelated) formatted strings,
    or fallback placeholders if t1 is None.
    """
    if t1:
        return (
            format_tier1_argument(t1.best_argument_burdensome),
            format_tier1_argument(t1.best_argument_justified),
            format_tier1_argument(t1.best_argument_unrelated),
        )
    return (
        "(Tier 1 not available)",
        "(Tier 1 not available)",
        "(Tier 1 not available)",
    )


def _filter_relevant_matches(unit: TrackedUnit) -> tuple[list, int]:
    """Filter matches by Tier 1 output.

    Returns (relevant_matches, dismissed_count).
    """
    relevant_matches = []
    dismissed_count = 0
    t1 = unit.tier1_output
    if t1:
        for i in t1.relevant_match_indices:
            if i < len(unit.unit.matches):
                relevant_matches.append(unit.unit.matches[i])
        dismissed_count = len(t1.dismissed_matches)
    return relevant_matches, dismissed_count


# =============================================================================
# CONTEXT REQUEST UTILITIES
# =============================================================================


def collect_context_requests(
    units: list[TrackedUnit],
    source_attr: str,
    request_attr: str,
) -> list[ContextRequest]:
    """
    Collect context requests from previous tier outputs with scope handling.

    For definition requests, sets scope_document_id to the requesting document's ID
    so definitions can be looked up with proper scope inheritance.

    Args:
        units: List of TrackedUnits to collect requests from
        source_attr: Attribute name on TrackedUnit (e.g., 'tier1_output', 'tier2_output')
        request_attr: Attribute name on output (e.g., 'context_requests', 'full_text_requests')

    Returns:
        List of ContextRequest objects with scope_document_id set for definitions
    """
    all_requests = []
    for unit in units:
        output = getattr(unit, source_attr, None)
        if output:
            requests = getattr(output, request_attr, [])
            for req in requests:
                if req.context_type == "definition":
                    # Create a copy with scope_document_id set for scope-aware lookup
                    req = req.model_copy(update={"scope_document_id": unit.document_id})
                all_requests.append(req)
    return all_requests


def build_context_key(req: ContextRequest, document_id: int) -> str:
    """
    Build a composite key for looking up fetched context.

    Definitions use composite keys (def:{scope_document_id}:{term}) because
    the same term can have different definitions depending on scope.

    Args:
        req: The context request
        document_id: The requesting document's ID (for definition scope)

    Returns:
        Key string for lookup in fetched content dict
    """
    if req.context_type == "definition":
        return f"def:{document_id}:{req.identifier.lower()}"
    # Include context_type to avoid collision when same identifier appears
    # under different types (e.g., "7:26" as sibling vs cross_reference)
    return f"{req.context_type}:{req.identifier}"


def map_fetched_to_unit(
    unit: TrackedUnit,
    source_attr: str,
    request_attr: str,
    fetched: dict[str, str],
    content_level: str,
    include_summary: bool = False,
) -> dict[str, str]:
    """
    Map fetched content to a unit's context requests and upgrade registry.

    Args:
        unit: The TrackedUnit to process
        source_attr: Attribute name on TrackedUnit (e.g., 'tier1_output')
        request_attr: Attribute name on output (e.g., 'context_requests')
        fetched: Dict mapping keys to fetched content
        content_level: Content level for registry ('summary' or 'full_text')
        include_summary: If True, include summary in registry upgrade (for Tier 2)

    Returns:
        Dict mapping request identifiers to fetched content for this unit
    """
    unit_content = {}
    output = getattr(unit, source_attr, None)
    if not output:
        return unit_content

    requests = getattr(output, request_attr, [])
    for req in requests:
        key = build_context_key(req, unit.document_id)
        if key in fetched:
            content = fetched[key]
            unit_content[req.identifier] = content
            # Upgrade registry content level
            if unit.context_registry:
                if include_summary:
                    unit.context_registry.upgrade_content(
                        identifier=req.identifier,
                        content=content,
                        content_level=content_level,
                        summary=content,
                    )
                else:
                    unit.context_registry.upgrade_content(
                        identifier=req.identifier,
                        content=content,
                        content_level=content_level,
                    )

    return unit_content


def dedupe_context_requests(requests: list[ContextRequest]) -> list[ContextRequest]:
    """
    Dedupe context requests by composite key, preferring full_text over summary.

    When multiple requests target the same context item, keeps the one requesting
    the highest fidelity (full_text > summary).

    Args:
        requests: List of ContextRequest objects (may have duplicates)

    Returns:
        Deduplicated list of ContextRequest objects
    """
    seen: dict[str, ContextRequest] = {}
    for req in requests:
        # Build key based on type and identifier
        if req.context_type == "definition" and req.scope_document_id:
            key = f"def:{req.scope_document_id}:{req.identifier.lower()}"
        else:
            key = f"{req.context_type}:{req.identifier}"

        if key not in seen:
            seen[key] = req
        elif req.need_level == "full_text" and seen[key].need_level == "summary":
            # Upgrade to full_text if any request wants it
            seen[key] = req

    return list(seen.values())


def get_definition_scopes_batch(document_ids: list[int]) -> dict[int, str]:
    """
    Get scope descriptions for multiple documents in a single batch query.

    Queries the database to find which scope documents have definitions
    that apply to each document (itself and all ancestors in hierarchy).

    Returns a dict mapping document_id -> scope description string.
    """
    if not document_ids:
        return {}

    # Get ancestors for all documents in one batch query
    ancestors_map = get_ancestors_batch(document_ids)

    # Build scope IDs for each document: self + all ancestors
    doc_to_scope_ids: dict[int, list[int]] = {}
    all_scope_ids: set[int] = set()

    for doc_id in document_ids:
        ancestors = ancestors_map.get(doc_id, [])
        scope_ids = [doc_id] + [a["id"] for a in ancestors]
        doc_to_scope_ids[doc_id] = scope_ids
        all_scope_ids.update(scope_ids)

    # Query for all scope documents that have definitions in one query
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT DISTINCT d.scope_document_id, rd.citation
                FROM definitions d
                JOIN regulatory_documents rd ON d.scope_document_id = rd.id
                WHERE d.scope_document_id = ANY(%s)
            """, [list(all_scope_ids)])
            rows = cur.fetchall()
    finally:
        conn.close()

    # Map scope_document_id -> citation
    scope_to_citation: dict[int, str] = {r[0]: r[1] for r in rows if r[1]}

    # Build result for each document
    result: dict[int, str] = {}
    for doc_id in document_ids:
        scope_ids = doc_to_scope_ids[doc_id]
        citations = sorted([scope_to_citation[sid] for sid in scope_ids if sid in scope_to_citation])

        if not citations:
            result[doc_id] = "(no definitions in scope)"
        elif len(citations) == 1:
            result[doc_id] = f"(definitions from {citations[0]})"
        else:
            result[doc_id] = f"(definitions from: {', '.join(citations[:3])}" + \
                           (f" and {len(citations) - 3} more)" if len(citations) > 3 else ")")

    return result


# =============================================================================
# TIER 2 BATCH PREPARATION
# =============================================================================


def prepare_tier2_batch(
    units: list[TrackedUnit],
    issue_config: IssueConfig,
) -> list[dict]:
    """
    Prepare batch requests for Tier 2.

    Splits regulation vs guidance units and routes to appropriate paths.
    """
    # Split regulation vs guidance units
    regulation_units = [u for u in units if u.unit.source_type == "regulation"]
    guidance_units = [u for u in units if u.unit.source_type == "guidance"]

    requests = []

    if regulation_units:
        requests.extend(_prepare_tier2_regulation_batch(regulation_units, issue_config))

    if guidance_units:
        requests.extend(_prepare_tier2_guidance_batch(guidance_units, issue_config))

    return requests


def _prepare_tier2_regulation_batch(
    units: list[TrackedUnit],
    issue_config: IssueConfig,
) -> list[dict]:
    """
    Prepare Tier 2 batch requests for regulation units (existing logic).

    V5 4-layer caching approach:
    - Layer 1 (static_core): Global cache for all requests
    - Layer 2 (issue_block): Per issue type cache
    - Layer 3 (batch_context): Per subchapter cache
    - Layer 4 (document_template): Per document
    """
    tier_configs = load_tier_configs()
    tier2_config = tier_configs['tier2']

    # Batch fetch documents, definitions, and definition scopes
    doc_ids = [u.document_id for u in units]
    documents = fetch_document_content_batch(doc_ids)
    definitions = get_definitions_with_text_batch(doc_ids)
    definition_scopes = get_definition_scopes_batch(doc_ids)

    # V5 4-layer caching: Get subchapter IDs for grouping
    subchapter_ids = get_subchapter_ids_batch(doc_ids)

    # Group units by subchapter for batch context caching
    subchapter_groups: dict[int, list[TrackedUnit]] = {}
    no_subchapter_units: list[TrackedUnit] = []
    for unit in units:
        subchapter_id = subchapter_ids.get(unit.document_id)
        if subchapter_id:
            if subchapter_id not in subchapter_groups:
                subchapter_groups[subchapter_id] = []
            subchapter_groups[subchapter_id].append(unit)
        else:
            no_subchapter_units.append(unit)

    # Build batch context for all subchapters at once
    subchapter_list = list(subchapter_groups.keys())
    batch_contexts = build_batch_context_for_subchapters(
        subchapter_ids=subchapter_list,
        issue_type=issue_config.name,
    ) if subchapter_list else {}
    if subchapter_list:
        print(f"    Built context for {len(subchapter_list)} subchapters (batch)" + " " * 20)

    # Collect context requests from all Tier 1 outputs
    all_context_requests = collect_context_requests(
        units=units,
        source_attr='tier1_output',
        request_attr='context_requests',
    )

    # Dedupe requests (prefer full_text over summary when both requested)
    deduped_requests = dedupe_context_requests(all_context_requests)

    # Split by need_level for appropriate fetching
    summary_requests = [r for r in deduped_requests if r.need_level == "summary"]
    full_text_requests = [r for r in deduped_requests if r.need_level == "full_text"]

    # Batch fetch each type
    fetched_summaries = fetch_summaries_for_requests(summary_requests) if summary_requests else {}
    fetched_full_text = fetch_full_text_for_requests(full_text_requests) if full_text_requests else {}

    # Merge fetched content
    all_fetched_context = {**fetched_summaries, **fetched_full_text}

    requests = []

    # Process units grouped by subchapter (enables cache hits)
    for subchapter_id, group_units in subchapter_groups.items():
        batch_context_vars = batch_contexts[subchapter_id]

        for unit in group_units:
            request = _prepare_tier2_request(
                unit=unit,
                tier2_config=tier2_config,
                issue_config=issue_config,
                batch_context_vars=batch_context_vars,
                documents=documents,
                definitions=definitions,
                definition_scopes=definition_scopes,
                all_fetched_context=all_fetched_context,
            )
            requests.append(request)

    # Process units without a subchapter (no batch context caching)
    for unit in no_subchapter_units:
        # Build fallback batch_context_vars
        batch_context_vars = {
            "subchapter_citation": "(no subchapter)",
            "ancestor_summaries": "(no ancestors available)",
            "sibling_catalog": "(no siblings available)",
            "sibling_count": "0",
            "sibling_catalog_truncated": "",
            "keyword_sibling_summaries": "(none available)",
        }

        request = _prepare_tier2_request(
            unit=unit,
            tier2_config=tier2_config,
            issue_config=issue_config,
            batch_context_vars=batch_context_vars,
            documents=documents,
            definitions=definitions,
            definition_scopes=definition_scopes,
            all_fetched_context=all_fetched_context,
        )
        requests.append(request)

    return requests


def _prepare_tier2_request(
    unit: TrackedUnit,
    tier2_config,
    issue_config: IssueConfig,
    batch_context_vars: dict[str, str],
    documents: dict,
    definitions: dict,
    definition_scopes: dict,
    all_fetched_context: dict,
) -> dict:
    """
    Prepare a single Tier 2 batch request.

    Separated from prepare_tier2_batch to support 4-layer caching with
    shared batch_context_vars for subchapter groups.

    Args:
        unit: The TrackedUnit to process
        tier2_config: Tier 2 prompt config
        issue_config: Issue type config
        batch_context_vars: Subchapter-level context vars (Layer 3)
        documents: Pre-fetched document content by doc_id
        definitions: Pre-fetched definitions by doc_id
        definition_scopes: Pre-fetched definition scope descriptions by doc_id
        all_fetched_context: Context items fetched per Tier 1 requests

    Returns:
        Formatted batch request dict
    """
    doc_id = unit.document_id
    doc = documents.get(doc_id, {})
    defs = definitions.get(doc_id, [])

    relevant_matches, dismissed_count = _filter_relevant_matches(unit)
    t1 = unit.tier1_output
    tier1_argument_burdensome, tier1_argument_justified, tier1_argument_unrelated = _extract_tier1_arguments(t1)

    # Map fetched context to this unit's requests
    unit_context = map_fetched_to_unit(
        unit=unit,
        source_attr='tier1_output',
        request_attr='context_requests',
        fetched=all_fetched_context,
        content_level='summary',  # Registry tracking level
        include_summary=True,
    )

    # Get this unit's context requests for formatting
    unit_requests = t1.context_requests if t1 else []

    # Format fetched context for prompt injection
    tier1_fetched_context = format_fetched_context(unit_context, unit_requests)

    # Format prompt with 4-layer structure
    # batch_context_vars contains: subchapter_citation, ancestor_summaries,
    # sibling_catalog, sibling_count, sibling_catalog_truncated,
    # keyword_sibling_summaries
    prompt_parts = format_tier_prompt(
        tier=tier2_config,
        issue=issue_config,
        batch_context_vars=batch_context_vars,
        # Document-specific variables (Layer 4)
        citation=unit.unit.citation,
        title=unit.unit.title or "",
        content=doc.get("content", unit.unit.content),
        definition_scope=definition_scopes.get(doc_id, "(no definitions in scope)"),
        definitions=format_definitions(defs),
        relevant_matches=format_matches_for_tier2(relevant_matches),
        tier1_dismissed_count=str(dismissed_count),
        # Tier 1 handoff - argument framing
        tier1_argument_burdensome=tier1_argument_burdensome,
        tier1_argument_justified=tier1_argument_justified,
        tier1_argument_unrelated=tier1_argument_unrelated,
        # Tier 1 fetched context (replaces recommended_* fields)
        tier1_fetched_context=tier1_fetched_context,
    )

    # V5 4-layer caching: Use multi-block user message
    # issue_block + batch_context are cacheable (shared across subchapter)
    # document_template is unique per document
    user_cached_prefix = prompt_parts["issue_block"] + prompt_parts["batch_context"]

    request = format_batch_request(
        custom_id=unit.custom_id,
        prompt=prompt_parts["document_template"],
        response_format=Tier2Output,
        model=BATCH_MODEL,
        system=prompt_parts["system"],
        user_cached_prefix=user_cached_prefix if user_cached_prefix.strip() else None,
    )

    return request


def _prepare_tier2_guidance_batch(
    units: list[TrackedUnit],
    issue_config: IssueConfig,
) -> list[dict]:
    """
    Prepare Tier 2 batch requests for guidance units.

    Guidance documents have no hierarchy. Context comes from cited regulation
    summaries and the guidance document's own content.
    """
    tier_configs = load_tier_configs()
    tier2_config = tier_configs['tier2']

    doc_ids = [u.document_id for u in units]

    # Fetch guidance content and cited regulation summaries
    guidance_content = fetch_guidance_content_batch(doc_ids)
    cited_summaries = fetch_cited_document_summaries(doc_ids)

    # Collect and fetch context requests from Tier 1 outputs
    all_context_requests = collect_context_requests(
        units=units,
        source_attr='tier1_output',
        request_attr='context_requests',
    )
    deduped_requests = dedupe_context_requests(all_context_requests)
    summary_requests = [r for r in deduped_requests if r.need_level == "summary"]
    full_text_requests = [r for r in deduped_requests if r.need_level == "full_text"]
    fetched_summaries = fetch_summaries_for_requests(summary_requests) if summary_requests else {}
    fetched_full_text = fetch_full_text_for_requests(full_text_requests) if full_text_requests else {}
    all_fetched_context = {**fetched_summaries, **fetched_full_text}

    requests = []
    for unit in units:
        doc_id = unit.document_id
        metadata = guidance_content.get(doc_id, {})
        unit_cited = cited_summaries.get(doc_id, [])

        # Build batch_context_vars (no hierarchy for guidance)
        cited_context = build_guidance_batch_context(doc_id, unit_cited, metadata)
        batch_context_vars = GUIDANCE_BATCH_CONTEXT_VARS

        # Build guidance preamble
        preamble = format_guidance_preamble(metadata)

        relevant_matches, dismissed_count = _filter_relevant_matches(unit)
        t1 = unit.tier1_output
        tier1_argument_burdensome, tier1_argument_justified, tier1_argument_unrelated = _extract_tier1_arguments(t1)

        # Map fetched context to this unit's requests
        unit_context = map_fetched_to_unit(
            unit=unit,
            source_attr='tier1_output',
            request_attr='context_requests',
            fetched=all_fetched_context,
            content_level='summary',
            include_summary=True,
        )

        # Format fetched context
        unit_requests = t1.context_requests if t1 else []
        tier1_fetched_context = format_fetched_context(unit_context, unit_requests)

        # Add cited regulation context to tier1_fetched_context
        if cited_context and cited_context != "(no cited documents resolved)":
            tier1_fetched_context += "\n\n=== CITED DOCUMENTS ===\n" + cited_context

        # Format prompt
        prompt_parts = format_tier_prompt(
            tier=tier2_config,
            issue=issue_config,
            batch_context_vars=batch_context_vars,
            citation=metadata.get("citation", unit.unit.citation),
            title=metadata.get("title", unit.unit.title or ""),
            content=metadata.get("content", unit.unit.content),
            definition_scope="(guidance documents — definitions not scoped)",
            definitions="(not applicable for guidance documents)",
            relevant_matches=format_matches_for_tier2(relevant_matches),
            tier1_dismissed_count=str(dismissed_count),
            tier1_argument_burdensome=tier1_argument_burdensome,
            tier1_argument_justified=tier1_argument_justified,
            tier1_argument_unrelated=tier1_argument_unrelated,
            tier1_fetched_context=tier1_fetched_context,
        )

        # Prepend guidance preamble to issue_block
        issue_block_with_preamble = preamble + "\n\n" + prompt_parts["issue_block"]
        user_cached_prefix = issue_block_with_preamble + prompt_parts["batch_context"]

        request = format_batch_request(
            custom_id=unit.custom_id,
            prompt=prompt_parts["document_template"],
            response_format=Tier2Output,
            model=BATCH_MODEL,
            system=prompt_parts["system"],
            user_cached_prefix=user_cached_prefix if user_cached_prefix.strip() else None,
        )

        requests.append(request)

    return requests


# =============================================================================
# TIER 2 WITH RE-RUNS (REAL-TIME API)
# =============================================================================


async def run_tier2_with_reruns(
    units: list[TrackedUnit],
    issue_configs: dict[str, IssueConfig],
    client=None,
    cost_tracker=None,
    trace_context=None,
    cache=None,
) -> tuple[list[TrackedUnit], list[dict]]:
    """
    Run Tier 2 using real-time API with re-run support.

    V5 re-run mechanics:
    - If LLM returns full_text_requests, fetch the requested context
    - Re-run with accumulated context (max MAX_TIER2_RERUNS re-runs)
    - On final attempt, add note that no further context can be requested

    Runs Tier 2 via real-time API with iterative context refinement.

    STATE MANAGEMENT: This function populates tier2_output/tier2_completed_at.
    The pipeline runner is responsible for all state transitions
    (TIER2_COMPLETE, DONE, ERROR).

    Args:
        units: Units requiring Tier 2 processing (already filtered by state)
        issue_configs: Dict mapping issue_type to IssueConfig
        client: Optional Anthropic client (creates new if not provided)
        cost_tracker: Optional CostTracker for recording token usage
        trace_context: Optional Langfuse trace context for observability

    Returns:
        Tuple of (processed units with tier2_output populated, list of batch-formatted request dicts for prompt observability)
    """
    import anthropic
    from lib.llm import call_llm_parse_async

    if not units:
        return units, []

    tier_configs = load_tier_configs()
    tier2_config = tier_configs['tier2']

    if client is None:
        client = anthropic.AsyncAnthropic()

    # Split regulation vs guidance for pre-fetching
    regulation_units = [u for u in units if u.unit.source_type == "regulation"]
    guidance_units_list = [u for u in units if u.unit.source_type == "guidance"]

    # Pre-fetch regulation data
    reg_doc_ids = [u.document_id for u in regulation_units]
    documents = fetch_document_content_batch(reg_doc_ids) if reg_doc_ids else {}
    definitions = get_definitions_with_text_batch(reg_doc_ids) if reg_doc_ids else {}
    definition_scopes = get_definition_scopes_batch(reg_doc_ids) if reg_doc_ids else {}

    # Pre-fetch guidance data
    guidance_doc_ids = [u.document_id for u in guidance_units_list]
    guidance_content = fetch_guidance_content_batch(guidance_doc_ids) if guidance_doc_ids else {}
    cited_summaries = fetch_cited_document_summaries(guidance_doc_ids) if guidance_doc_ids else {}

    # V5 4-layer caching: Get subchapter IDs and pre-batch context (regulation only)
    subchapter_ids = get_subchapter_ids_batch(reg_doc_ids) if reg_doc_ids else {}
    unique_subchapter_ids = list({sid for sid in subchapter_ids.values() if sid})
    batch_contexts = build_batch_context_for_subchapters(
        subchapter_ids=unique_subchapter_ids,
    ) if unique_subchapter_ids else {}

    # Collect context requests from all Tier 1 outputs
    all_context_requests = collect_context_requests(
        units=units,
        source_attr='tier1_output',
        request_attr='context_requests',
    )

    # Dedupe requests (prefer full_text over summary when both requested)
    deduped_requests = dedupe_context_requests(all_context_requests)

    # Split by need_level for appropriate fetching
    summary_requests = [r for r in deduped_requests if r.need_level == "summary"]
    full_text_requests = [r for r in deduped_requests if r.need_level == "full_text"]

    # Batch fetch each type
    fetched_summaries = fetch_summaries_for_requests(summary_requests) if summary_requests else {}
    fetched_full_text = fetch_full_text_for_requests(full_text_requests) if full_text_requests else {}

    # Merge fetched content
    all_fetched_context = {**fetched_summaries, **fetched_full_text}

    # Collect batch-formatted requests for prompt observability
    all_prompt_requests: list[dict] = []

    for unit in units:
        # Get issue config for this unit
        issue_config = issue_configs.get(unit.issue_type)
        if not issue_config:
            # Set error_message; orchestrator will handle state transition
            unit.error_message = f"No issue config for {unit.issue_type}"
            continue

        doc_id = unit.document_id
        is_guidance = unit.unit.source_type == "guidance"

        if is_guidance:
            metadata = guidance_content.get(doc_id, {})
            doc = {"content": metadata.get("content", unit.unit.content)}
            defs = []
        else:
            doc = documents.get(doc_id, {})
            defs = definitions.get(doc_id, [])

        relevant_matches, dismissed_count = _filter_relevant_matches(unit)
        t1 = unit.tier1_output
        tier1_argument_burdensome, tier1_argument_justified, tier1_argument_unrelated = _extract_tier1_arguments(t1)

        # Map fetched context to this unit's requests
        unit_context = map_fetched_to_unit(
            unit=unit,
            source_attr='tier1_output',
            request_attr='context_requests',
            fetched=all_fetched_context,
            content_level='summary',
            include_summary=True,
        )

        # Get this unit's context requests for formatting
        unit_requests = t1.context_requests if t1 else []

        # Format fetched context for prompt injection
        tier1_fetched_context = format_fetched_context(unit_context, unit_requests)

        # Build batch_context_vars based on source type
        if is_guidance:
            unit_cited = cited_summaries.get(doc_id, [])
            metadata = guidance_content.get(doc_id, {})
            cited_context = build_guidance_batch_context(doc_id, unit_cited, metadata)
            if cited_context and cited_context != "(no cited documents resolved)":
                tier1_fetched_context += "\n\n=== CITED DOCUMENTS ===\n" + cited_context
            batch_context_vars = GUIDANCE_BATCH_CONTEXT_VARS
        else:
            # V5 4-layer caching: use pre-fetched batch context for this unit's subchapter
            subchapter_id = subchapter_ids.get(doc_id)
            if subchapter_id:
                batch_context_vars = batch_contexts.get(subchapter_id, {})
            else:
                batch_context_vars = {
                    "subchapter_citation": "(no subchapter)",
                    "ancestor_summaries": "(no ancestors available)",
                    "sibling_catalog": "(no siblings available)",
                    "sibling_count": "0",
                    "sibling_catalog_truncated": "",
                    "keyword_sibling_summaries": "(none available)",
                }

        # Re-run loop: accumulate context and retry if LLM requests more
        rerun_count = 0
        accumulated_full_text: dict[str, str] = {}  # Additional context from re-runs
        all_tier2_requests: list[ContextRequest] = []  # Track all Tier 2 context requests

        while rerun_count <= MAX_TIER2_RERUNS:
            # Merge Tier 1 context with any accumulated full text from re-runs
            combined_context = {**unit_context, **accumulated_full_text}

            # On final attempt, add note to prompt
            is_final_attempt = rerun_count == MAX_TIER2_RERUNS
            final_attempt_note = ""
            if is_final_attempt and rerun_count > 0:
                final_attempt_note = (
                    "\n\n[FINAL ATTEMPT: You must provide a classification. "
                    "No further context can be requested.]"
                )

            # Format all accumulated context for prompt (includes Tier 1 + Tier 2 requests)
            all_unit_requests = (t1.context_requests if t1 else []) + all_tier2_requests
            tier1_fetched_context = format_fetched_context(combined_context, all_unit_requests)
            if final_attempt_note:
                tier1_fetched_context += final_attempt_note

            # Build citation and definition vars based on source type
            if is_guidance:
                prompt_citation = metadata.get("citation", unit.unit.citation)
                prompt_title = metadata.get("title", unit.unit.title or "")
                prompt_def_scope = "(guidance documents — definitions not scoped)"
                prompt_defs = "(not applicable for guidance documents)"
            else:
                prompt_citation = unit.unit.citation
                prompt_title = unit.unit.title or ""
                prompt_def_scope = definition_scopes.get(doc_id, "(no definitions in scope)")
                prompt_defs = format_definitions(defs)

            prompt_parts = format_tier_prompt(
                tier=tier2_config,
                issue=issue_config,
                batch_context_vars=batch_context_vars,
                citation=prompt_citation,
                title=prompt_title,
                content=doc.get("content", unit.unit.content),
                definition_scope=prompt_def_scope,
                definitions=prompt_defs,
                relevant_matches=format_matches_for_tier2(relevant_matches),
                tier1_dismissed_count=str(dismissed_count),
                tier1_argument_burdensome=tier1_argument_burdensome,
                tier1_argument_justified=tier1_argument_justified,
                tier1_argument_unrelated=tier1_argument_unrelated,
                tier1_fetched_context=tier1_fetched_context,
            )

            # Prepend guidance preamble for guidance units
            if is_guidance:
                preamble = format_guidance_preamble(metadata)
                user_prompt = preamble + "\n\n" + prompt_parts["user"]
            else:
                user_prompt = prompt_parts["user"]

            # Capture the initial request in batch format for prompt observability
            if rerun_count == 0:
                all_prompt_requests.append(format_batch_request(
                    custom_id=unit.custom_id,
                    prompt=user_prompt,
                    response_format=Tier2Output,
                    model=DEFAULT_MODEL,
                    system=prompt_parts["system"],
                ))

            try:
                result, usage = await call_llm_parse_async(
                    client=client,
                    prompt=user_prompt,
                    response_format=Tier2Output,
                    system=prompt_parts["system"],
                    model=DEFAULT_MODEL,
                    trace_context=trace_context,
                    cache=cache,
                    cache_metadata={"pipeline": "research", "tier": 2, "document_id": doc_id},
                )

                # Record costs using actual usage from API response
                if cost_tracker:
                    cost_tracker.record_batch_usage(
                        tier=2,
                        input_tokens=usage.get("input_tokens", 0),
                        output_tokens=usage.get("output_tokens", 0),
                        cache_read_tokens=usage.get("cache_read_tokens", 0),
                        cache_write_tokens=usage.get("cache_write_tokens", 0),
                        request_count=1,
                        model=DEFAULT_MODEL,
                        is_batch=False,  # Real-time API, no batch discount
                    )

                if result:
                    # Check if LLM requested more context and we can re-run
                    if result.full_text_requests and not is_final_attempt:
                        # Set scope_document_id on definition requests (LLM doesn't set this)
                        for req in result.full_text_requests:
                            if req.context_type == "definition" and req.scope_document_id is None:
                                req.scope_document_id = unit.document_id
                        # Track all requests for audit trail
                        all_tier2_requests.extend(result.full_text_requests)
                        # Fetch requested full text
                        new_context = fetch_full_text_for_requests(result.full_text_requests)
                        if new_context:
                            # Make re-runs highly visible in console
                            print(f"\n  {'='*60}")
                            print(f"  RE-RUN #{rerun_count + 1} for {unit.unit.citation}")
                            print(f"  LLM requested {len(result.full_text_requests)} full text item(s)")
                            print(f"  Fetched: {list(new_context.keys())[:3]}{'...' if len(new_context) > 3 else ''}")
                            print(f"  {'='*60}\n")
                            accumulated_full_text.update(new_context)
                            rerun_count += 1
                            await asyncio.sleep(0.2)  # Rate limit between re-runs
                            continue  # Loop back for another LLM call

                    # Final result - accept classification
                    unit.tier2_output = result
                    unit.tier2_rerun_count = rerun_count
                    unit.tier2_completed_at = datetime.now()
                    # Populate audit trail fields
                    unit.tier2_context_requests_made = all_tier2_requests
                    unit.tier2_accumulated_context = list(accumulated_full_text.keys())
                    if rerun_count > 0:
                        print(f"  [Completed after {rerun_count} re-run(s): {unit.unit.citation}]")
                    break  # Exit re-run loop
                else:
                    # Set error_message; orchestrator will handle state transition
                    unit.error_message = "Tier 2 returned no result"
                    break

            except ValidationError as e:
                # Handle invalid classification from LLM
                error_str = str(e)
                if "classification" in error_str:
                    print(f"    Warning: Invalid classification for {unit.unit.citation}, defaulting to 'unrelated'")
                    unit.tier2_output = Tier2Output(
                        classification="unrelated",
                        confidence=0.5,
                        reasoning=f"Classification forced to 'unrelated' due to invalid LLM response: {error_str[:200]}",
                        argument_for_regulation="Unable to determine - classification was invalid",
                        argument_against_regulation="Unable to determine - classification was invalid",
                        severity=None,
                    )
                    unit.tier2_forced_classification = True
                    unit.tier2_rerun_count = rerun_count
                    unit.tier2_completed_at = datetime.now()
                    break
                else:
                    # Set error_message; orchestrator will handle state transition
                    unit.error_message = f"Tier 2 validation error: {str(e)}"
                    break

            except Exception as e:
                # Set error_message; orchestrator will handle state transition
                unit.error_message = f"Tier 2 error: {str(e)}"
                break

        # Rate limiting between units
        await asyncio.sleep(0.2)

    return units, all_prompt_requests
