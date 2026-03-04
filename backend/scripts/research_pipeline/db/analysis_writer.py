"""
Analysis writer for the research pipeline.

Saves tier results to the compliance_issue_analyses table.
This module is a refactored extraction from db_writer.py,
consolidating the tier save functions into a single module.

All save functions are wrapped with retry_db_operation for resilience
to connection failures during long-running batch processes.
"""

import json
import logging
from typing import Optional
from psycopg import Connection

logger = logging.getLogger(__name__)

from ..state_machine import TrackedUnit, ProcessingState
from ..result_processor import (
    compute_final_classification,
    compute_final_severity,
    compute_requirement_found,
    compute_is_justified,
    get_classification_tier,
    check_verbatim,
)

from lib.db import get_db_connection

# Import centralized configuration
from ..config import PIPELINE_VERSION

# Import retry decorator for connection resilience
from .connection import retry_db_operation


def _doc_id_col(source_type: str) -> str:
    """Return the FK column name for the given source type."""
    return "guidance_document_id" if source_type == "guidance" else "document_id"


def _where_clause(source_type: str) -> str:
    """Return the WHERE clause matching the right FK column."""
    col = _doc_id_col(source_type)
    return f"WHERE {col} = %s AND issue_type = %s"


def _on_conflict_clause(source_type: str) -> str:
    """Return the ON CONFLICT clause for the right partial unique index.

    After migration 0058, compliance_issue_analyses uses partial unique indexes
    (one per FK column) instead of a single unique constraint. Partial indexes
    require the WHERE predicate in ON CONFLICT for PostgreSQL to infer them.

    IMPORTANT: Migration 0058 must be applied before deploying code that uses
    this helper, otherwise the regulation path will also fail (the old
    non-partial constraint won't match a WHERE-bearing ON CONFLICT).
    """
    col = _doc_id_col(source_type)
    return f"ON CONFLICT ({col}, issue_type) WHERE {col} IS NOT NULL"


def _link_analysis_to_issues(cur, document_id: int, issue_type: str, source_type: str = "regulation") -> None:
    """
    Link compliance_issues rows to their analysis via the analysis_id FK.

    Reads the RETURNING id from the cursor's last INSERT/UPSERT and updates
    compliance_issues rows that don't yet have an analysis_id.

    Args:
        cur: Database cursor positioned after a RETURNING id query
        document_id: Document ID to match
        issue_type: Issue type to match
        source_type: "regulation" or "guidance" — determines which FK column to match
    """
    analysis_row = cur.fetchone()
    if analysis_row:
        if source_type == "guidance":
            cur.execute("""
                UPDATE compliance_issues SET analysis_id = %s
                WHERE guidance_document_id = %s AND issue_type = %s AND analysis_id IS NULL
            """, (analysis_row[0], document_id, issue_type))
        else:
            cur.execute("""
                UPDATE compliance_issues SET analysis_id = %s
                WHERE document_id = %s AND issue_type = %s AND analysis_id IS NULL
            """, (analysis_row[0], document_id, issue_type))


def _merge_context_used(unit: TrackedUnit, output) -> list[dict]:
    """
    Merge registry context_used with LLM-reported context.

    Registry tracks what context was offered and used (verifiable).
    LLM may report additional context like statute references that
    aren't in the registry. This merges both to preserve all sources.

    Deduplication uses (type, identifier) as key to avoid collisions
    between different context types with same identifier.

    Args:
        unit: TrackedUnit with optional context_registry
        output: Tier output with context_used field

    Returns:
        Merged list of context_used dicts (camelCase keys)
    """
    if unit.context_registry:
        context_used = unit.context_registry.to_context_used()
        # Merge LLM-reported entries not in registry (like statutes)
        if hasattr(output, 'context_used') and output.context_used:
            # Key by (type, identifier) to avoid type collisions
            registry_keys = {(c.get("type"), c.get("identifier")) for c in context_used}
            for entry in output.context_used:
                key = (entry.type, entry.identifier)
                if key not in registry_keys:
                    # model_dump(by_alias=True) outputs camelCase from ConfigDict
                    context_used.append(entry.model_dump(by_alias=True, exclude_none=True))
        return context_used
    else:
        # No registry - use LLM-reported context directly
        if hasattr(output, 'context_used') and output.context_used:
            return [c.model_dump(by_alias=True, exclude_none=True) for c in output.context_used]
        return []


@retry_db_operation()
def save_tier1_results(
    units: list[TrackedUnit],
    conn: Optional[Connection] = None,
) -> int:
    """
    Save Tier 1 results to database.

    For false positives: Updates original compliance_issues rows
    For needs_research: Creates/updates compliance_issue_analyses rows

    Args:
        units: List of TrackedUnit objects with tier1_output
        conn: Optional database connection

    Returns:
        Count of saved rows
    """
    if conn is None:
        conn = get_db_connection()
        should_close = True
    else:
        should_close = False

    saved = 0
    total = len(units)

    try:
        with conn.cursor() as cur:
            for i, unit in enumerate(units):
                if i % 10 == 0 and total > 10:
                    print(f"    Saving Tier 1: {i}/{total}...", end="\r", flush=True)
                if unit.tier1_output is None:
                    continue

                output = unit.tier1_output
                source_type = unit.unit.source_type
                id_col = _doc_id_col(source_type)

                # For false positives, update original compliance_issues rows AND create analysis row
                if output.classification == "all_false_positives":
                    # 1. Collect dismissed match IDs
                    dismissed_match_ids = []
                    for dismissed in output.dismissed_matches:
                        if 0 <= dismissed.match_index < len(unit.unit.matches):
                            match_id = unit.unit.matches[dismissed.match_index].match_id
                            dismissed_match_ids.append(match_id)

                    # 2. Create analysis row for tracking
                    # Include match_id in dismissed_reasons for future reference
                    dismissed_reasons = []
                    for d in output.dismissed_matches:
                        reason_dict = d.model_dump(by_alias=True)
                        if 0 <= d.match_index < len(unit.unit.matches):
                            reason_dict['matchId'] = unit.unit.matches[d.match_index].match_id
                        dismissed_reasons.append(reason_dict)

                    on_conflict = _on_conflict_clause(source_type)
                    cur.execute(f"""
                        INSERT INTO compliance_issue_analyses (
                            {id_col}, issue_type, jurisdiction, grouped_match_count,
                            tier1_dismissed_match_ids, tier1_dismissed_reasons,
                            tier1_classification, tier1_confidence, tier1_reasoning,
                            tier1_batch_id, tier1_completed_at, highest_tier_completed,
                            requirement_found, pipeline_version, created_at, updated_at
                        ) VALUES (
                            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW()
                        )
                        {on_conflict} DO UPDATE SET
                            tier1_dismissed_match_ids = EXCLUDED.tier1_dismissed_match_ids,
                            tier1_dismissed_reasons = EXCLUDED.tier1_dismissed_reasons,
                            tier1_classification = EXCLUDED.tier1_classification,
                            tier1_confidence = EXCLUDED.tier1_confidence,
                            tier1_reasoning = EXCLUDED.tier1_reasoning,
                            tier1_batch_id = EXCLUDED.tier1_batch_id,
                            tier1_completed_at = EXCLUDED.tier1_completed_at,
                            highest_tier_completed = GREATEST(
                                COALESCE(compliance_issue_analyses.highest_tier_completed, 0), 1
                            ),
                            requirement_found = EXCLUDED.requirement_found,
                            updated_at = NOW()
                        RETURNING id
                    """, (
                        unit.document_id,
                        unit.issue_type,
                        unit.unit.jurisdiction,
                        len(unit.unit.matches),
                        dismissed_match_ids,
                        json.dumps(dismissed_reasons),
                        output.classification,
                        output.confidence,
                        output.reasoning,
                        unit.tier1_batch_id,
                        unit.tier1_completed_at,
                        1,  # highest_tier_completed
                        False,  # requirement_found = False for false positives
                        PIPELINE_VERSION,
                    ))
                    _link_analysis_to_issues(cur, unit.document_id, unit.issue_type, source_type)
                    saved += 1

                    # Commit every 50 rows to prevent Neon idle-in-transaction timeout
                    if saved % 50 == 0:
                        conn.commit()
                    continue

                # For needs_research, create analysis row
                relevant_match_ids = [
                    unit.unit.matches[i].match_id
                    for i in output.relevant_match_indices
                    if 0 <= i < len(unit.unit.matches)
                ]

                dismissed_match_ids = [
                    unit.unit.matches[d.match_index].match_id
                    for d in output.dismissed_matches
                    if 0 <= d.match_index < len(unit.unit.matches)
                ]

                # Include matchId in dismissed_reasons for future reference
                dismissed_reasons = []
                for d in output.dismissed_matches:
                    reason_dict = d.model_dump(by_alias=True)
                    if 0 <= d.match_index < len(unit.unit.matches):
                        reason_dict['matchId'] = unit.unit.matches[d.match_index].match_id
                    dismissed_reasons.append(reason_dict)

                # V5: Build argument framing JSONB (only for needs_research)
                tier1_argument_framing = {
                    "best_argument_burdensome": output.best_argument_burdensome,
                    "best_argument_justified": output.best_argument_justified,
                    "best_argument_unrelated": output.best_argument_unrelated,
                }

                # Build context requests JSONB (structured requests for Tier 2)
                tier1_recommendations = {
                    "context_requests": [
                        {
                            "context_type": req.context_type,
                            "identifier": req.identifier,
                            "need_level": req.need_level,
                            "reason": req.reason,
                        }
                        for req in output.context_requests
                    ]
                }

                on_conflict = _on_conflict_clause(source_type)
                cur.execute(f"""
                    INSERT INTO compliance_issue_analyses (
                        {id_col}, issue_type, jurisdiction, grouped_match_count,
                        tier1_relevant_match_ids, tier1_dismissed_match_ids,
                        tier1_dismissed_reasons, tier1_classification, tier1_confidence,
                        tier1_reasoning, tier1_batch_id,
                        tier1_completed_at, highest_tier_completed, pipeline_version,
                        tier1_argument_framing, tier1_recommendations,
                        created_at, updated_at
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW()
                    )
                    {on_conflict} DO UPDATE SET
                        tier1_relevant_match_ids = EXCLUDED.tier1_relevant_match_ids,
                        tier1_dismissed_match_ids = EXCLUDED.tier1_dismissed_match_ids,
                        tier1_dismissed_reasons = EXCLUDED.tier1_dismissed_reasons,
                        tier1_classification = EXCLUDED.tier1_classification,
                        tier1_confidence = EXCLUDED.tier1_confidence,
                        tier1_reasoning = EXCLUDED.tier1_reasoning,
                        tier1_batch_id = EXCLUDED.tier1_batch_id,
                        tier1_completed_at = EXCLUDED.tier1_completed_at,
                        highest_tier_completed = GREATEST(
                            COALESCE(compliance_issue_analyses.highest_tier_completed, 0), 1
                        ),
                        tier1_argument_framing = EXCLUDED.tier1_argument_framing,
                        tier1_recommendations = EXCLUDED.tier1_recommendations,
                        updated_at = NOW()
                    RETURNING id
                """, (
                    unit.document_id,
                    unit.issue_type,
                    unit.unit.jurisdiction,
                    len(unit.unit.matches),
                    relevant_match_ids,
                    dismissed_match_ids,
                    json.dumps(dismissed_reasons),
                    output.classification,
                    output.confidence,
                    output.reasoning,
                    unit.tier1_batch_id,
                    unit.tier1_completed_at,
                    1,
                    PIPELINE_VERSION,
                    json.dumps(tier1_argument_framing),
                    json.dumps(tier1_recommendations),
                ))
                _link_analysis_to_issues(cur, unit.document_id, unit.issue_type, source_type)
                saved += 1

                # Commit every 50 rows to prevent Neon idle-in-transaction timeout
                if saved % 50 == 0:
                    conn.commit()

            if total > 10:
                print(f"    Saved {saved} Tier 1 results" + " " * 20)
        conn.commit()
    finally:
        if should_close:
            conn.close()

    return saved


@retry_db_operation()
def save_tier2_results(
    units: list[TrackedUnit],
    conn: Optional[Connection] = None,
) -> int:
    """
    Save Tier 2 results to database.

    Args:
        units: List of TrackedUnit objects with tier2_output
        conn: Optional database connection

    Returns:
        Count of saved rows
    """
    if conn is None:
        conn = get_db_connection()
        should_close = True
    else:
        should_close = False

    saved = 0
    total = len(units)

    try:
        with conn.cursor() as cur:
            for i, unit in enumerate(units):
                if i % 10 == 0 and total > 10:
                    print(f"    Saving Tier 2: {i}/{total}...", end="\r", flush=True)
                if unit.tier2_output is None:
                    continue

                output = unit.tier2_output
                source_type = unit.unit.source_type
                id_col = _doc_id_col(source_type)

                # Check if verbatim quotes are actually verbatim
                is_verbatim = True
                if output.verbatim_requirements:
                    is_verbatim, _ = check_verbatim(
                        output.verbatim_requirements,
                        unit.unit.content,
                    )

                # Merge registry context with LLM-reported context (preserves statutes, etc.)
                context_used = _merge_context_used(unit, output)
                full_text_requests = [r.model_dump(by_alias=True) for r in output.full_text_requests]

                # V5: Serialize context requests made during re-runs
                context_requests_made = json.dumps(
                    [r.model_dump(by_alias=True) for r in unit.tier2_context_requests_made]
                ) if unit.tier2_context_requests_made else None

                # Compute requirement_found inline so data is consistent
                # even if the pipeline crashes before save_final_results
                requirement_found = output.classification in ('burdensome', 'justified')
                is_justified = output.classification == 'justified'

                cur.execute(f"""
                    UPDATE compliance_issue_analyses SET
                        tier2_classification = %s,
                        tier2_confidence = %s,
                        tier2_reasoning = %s,
                        verbatim_requirements = %s,
                        severity = %s,
                        severity_baseline = %s,
                        severity_calculation = %s,
                        argument_for_regulation = %s,
                        argument_against_regulation = %s,
                        context_used = %s,
                        tier2_full_text_requests = %s,
                        needs_web_search = %s,
                        web_search_topics = %s,
                        potentially_controversial = %s,
                        federal_mandate_suspected = %s,
                        cites_federal_statute = %s,
                        federal_citation = %s,
                        claims_no_alternative = %s,
                        ambiguity_type = %s,
                        tier2_batch_id = %s,
                        tier2_completed_at = %s,
                        is_verbatim = %s,
                        -- V5: Re-run tracking fields
                        tier2_rerun_count = %s,
                        tier2_context_requests_made = %s,
                        tier2_forced_classification = %s,
                        -- V5.2: Web search disambiguation fields
                        program_context = %s,
                        not_to_confuse_with = %s,
                        search_scope_guidance = %s,
                        -- Inline so crash between tiers doesn't leave NULLs
                        requirement_found = %s,
                        is_justified = %s,
                        final_severity = %s,
                        classification_tier = 2,
                        highest_tier_completed = GREATEST(
                            COALESCE(highest_tier_completed, 0), 2
                        ),
                        updated_at = NOW()
                    {_where_clause(source_type)}
                """, (
                    output.classification,
                    output.confidence,
                    output.reasoning,
                    output.verbatim_requirements,
                    output.severity,
                    output.severity_baseline,
                    output.severity_calculation,
                    output.argument_for_regulation,
                    output.argument_against_regulation,
                    json.dumps(context_used),
                    json.dumps(full_text_requests),
                    output.needs_web_search,
                    output.web_search_topics,
                    output.potentially_controversial,
                    output.federal_mandate_suspected,
                    output.cites_federal_statute,
                    output.federal_citation,
                    output.claims_no_alternative,
                    output.ambiguity_type,
                    unit.tier2_batch_id,
                    unit.tier2_completed_at,
                    is_verbatim,
                    # V5: Re-run tracking
                    unit.tier2_rerun_count,
                    context_requests_made,
                    unit.tier2_forced_classification,
                    # V5.2: Web search disambiguation
                    getattr(output, 'program_context', None),
                    getattr(output, 'not_to_confuse_with', None) or [],
                    getattr(output, 'search_scope_guidance', None),
                    # Inline derived fields
                    requirement_found,
                    is_justified,
                    output.severity,  # final_severity = tier2 severity before tier3
                    unit.document_id,
                    unit.issue_type,
                ))
                if cur.rowcount == 0:
                    logger.warning(
                        "Tier 2 UPDATE matched 0 rows for document_id=%s, "
                        "issue_type=%s — result not persisted",
                        unit.document_id, unit.issue_type,
                    )
                saved += 1

                # Commit every 50 rows to prevent Neon idle-in-transaction timeout
                if saved % 50 == 0:
                    conn.commit()

            if total > 10:
                print(f"    Saved {saved} Tier 2 results" + " " * 20)
        conn.commit()
    finally:
        if should_close:
            conn.close()

    return saved


@retry_db_operation()
def save_tier3_results(
    units: list[TrackedUnit],
    conn: Optional[Connection] = None,
) -> int:
    """
    V5: Save Tier 3 results to database.

    Tier 3 is now the web search tier (merged from old Tier 4).
    Includes web search summary and structured flags.

    Args:
        units: List of TrackedUnit objects with tier3_output
        conn: Optional database connection

    Returns:
        Count of saved rows
    """
    if conn is None:
        conn = get_db_connection()
        should_close = True
    else:
        should_close = False

    saved = 0
    total = len(units)

    try:
        with conn.cursor() as cur:
            for i, unit in enumerate(units):
                if i % 10 == 0 and total > 10:
                    print(f"    Saving Tier 3: {i}/{total}...", end="\r", flush=True)
                if unit.tier3_output is None:
                    continue

                output = unit.tier3_output
                source_type = unit.unit.source_type
                id_col = _doc_id_col(source_type)

                # NOTE: We no longer merge context_used for Tier 3.
                # Tier 2's context_used is preserved; web evidence goes in tier3_flags.

                # Recompute is_verbatim since Tier 3 may have updated verbatim_requirements
                is_verbatim = True
                if output.verbatim_requirements:
                    is_verbatim, _ = check_verbatim(
                        output.verbatim_requirements,
                        unit.unit.content,
                    )

                # V5: Serialize structured flags (EvidencedFlag objects)
                tier3_flags = {}
                if output.superseded_by_law:
                    tier3_flags["superseded_by_law"] = output.superseded_by_law.model_dump(by_alias=True)
                if output.federal_mandate_confirmed:
                    tier3_flags["federal_mandate_confirmed"] = output.federal_mandate_confirmed.model_dump(by_alias=True)
                if output.state_discretion_found:
                    tier3_flags["state_discretion_found"] = output.state_discretion_found.model_dump(by_alias=True)
                if output.modernized_alternative_found:
                    tier3_flags["modernized_alternative_found"] = output.modernized_alternative_found.model_dump(by_alias=True)
                if output.advocacy_for_change:
                    tier3_flags["advocacy_for_change"] = output.advocacy_for_change.model_dump(by_alias=True)
                tier3_flags["evidence_gap"] = output.evidence_gap

                # Compute requirement_found inline so data is consistent
                # even if the pipeline crashes before save_final_results
                requirement_found = output.classification in ('burdensome', 'justified')
                is_justified = output.classification == 'justified'

                # NOTE: We intentionally do NOT update context_used here.
                # Tier 2's context_used (definitions, siblings, cross-refs, statutes) is preserved.
                # Tier 3's web search evidence goes into tier3_flags.*.evidence (V5 structured approach).
                cur.execute(f"""
                    UPDATE compliance_issue_analyses SET
                        tier3_classification = %s,
                        tier3_confidence = %s,
                        tier3_reasoning = %s,
                        tier3_severity_adjustment = %s,
                        tier3_severity_adjustment_reasoning = %s,
                        final_severity = %s,
                        verbatim_requirements = %s,
                        is_verbatim = %s,
                        argument_for_regulation = %s,
                        argument_against_regulation = %s,
                        -- V5: Web search fields (merged from old Tier 4)
                        -- Web evidence goes in tier3_flags, not context_used
                        web_search_summary = %s,
                        federal_mandate_found = %s,
                        state_has_discretion = %s,
                        tier3_flags = %s,
                        tier3_evidence_gap = %s,
                        -- V5.1: Easy cleanup detection
                        easy_cleanup_candidate = %s,
                        cleanup_type = %s,
                        cleanup_evidence = %s,
                        cleanup_recommendation = %s,
                        cleanup_effort = %s,
                        tier3_completed_at = %s,
                        tier3_trigger_reason = %s,
                        -- Inline so crash between tiers doesn't leave NULLs
                        requirement_found = %s,
                        is_justified = %s,
                        classification_tier = 3,
                        highest_tier_completed = GREATEST(
                            COALESCE(highest_tier_completed, 0), 3
                        ),
                        updated_at = NOW()
                    {_where_clause(source_type)}
                """, (
                    output.classification,
                    output.confidence,
                    output.reasoning,
                    output.severity_adjustment,
                    output.severity_adjustment_reasoning,
                    output.final_severity,
                    output.verbatim_requirements,
                    is_verbatim,
                    output.argument_for_regulation,
                    output.argument_against_regulation,
                    # V5: Web search fields
                    output.web_search_summary,
                    output.federal_mandate_found,
                    output.state_has_discretion,
                    json.dumps(tier3_flags),
                    output.evidence_gap,
                    # V5.1: Easy cleanup fields
                    output.easy_cleanup_candidate,
                    output.cleanup_type,
                    output.cleanup_evidence,
                    output.cleanup_recommendation,
                    output.cleanup_effort,
                    unit.tier3_completed_at,
                    unit.tier3_trigger_reason,  # V5.1: Why this was escalated
                    # Inline derived fields
                    requirement_found,
                    is_justified,
                    unit.document_id,
                    unit.issue_type,
                ))
                if cur.rowcount == 0:
                    logger.warning(
                        "Tier 3 UPDATE matched 0 rows for document_id=%s, "
                        "issue_type=%s — result not persisted",
                        unit.document_id, unit.issue_type,
                    )
                saved += 1

                # Commit every 50 rows to prevent Neon idle-in-transaction timeout
                if saved % 50 == 0:
                    conn.commit()

            if total > 10:
                print(f"    Saved {saved} Tier 3 results" + " " * 20)
        conn.commit()
    finally:
        if should_close:
            conn.close()

    return saved


@retry_db_operation()
def save_final_results(
    units: list[TrackedUnit],
    conn: Optional[Connection] = None,
) -> int:
    """
    Save final results after all tiers complete.

    Computes final_severity, requirement_found, is_justified, classification_tier.

    Args:
        units: List of TrackedUnit objects in DONE or DONE_FALSE_POSITIVE state
        conn: Optional database connection

    Returns:
        Count of saved rows
    """
    if conn is None:
        conn = get_db_connection()
        should_close = True
    else:
        should_close = False

    saved = 0
    total = len(units)

    try:
        with conn.cursor() as cur:
            for i, unit in enumerate(units):
                if i % 10 == 0 and total > 10:
                    print(f"    Saving final: {i}/{total}...", end="\r", flush=True)
                if unit.state not in (ProcessingState.DONE, ProcessingState.DONE_FALSE_POSITIVE):
                    continue

                # Skip false positives - they were already handled in Tier 1
                if unit.state == ProcessingState.DONE_FALSE_POSITIVE:
                    continue

                final_classification = compute_final_classification(unit)
                final_severity = compute_final_severity(unit)
                requirement_found = compute_requirement_found(unit)
                is_justified = compute_is_justified(unit)
                classification_tier = get_classification_tier(unit)
                source_type = unit.unit.source_type

                cur.execute(f"""
                    UPDATE compliance_issue_analyses SET
                        requirement_found = %s,
                        is_justified = %s,
                        final_severity = %s,
                        classification_tier = %s,
                        updated_at = NOW()
                    {_where_clause(source_type)}
                """, (
                    requirement_found,
                    is_justified,
                    final_severity,
                    classification_tier,
                    unit.document_id,
                    unit.issue_type,
                ))
                saved += 1

                # Commit every 50 rows to prevent Neon idle-in-transaction timeout
                if saved % 50 == 0:
                    conn.commit()

            if total > 10:
                print(f"    Saved {saved} final results" + " " * 20)
        conn.commit()
    finally:
        if should_close:
            conn.close()

    return saved


@retry_db_operation()
def save_all_results(
    units: list[TrackedUnit],
    conn: Optional[Connection] = None,
) -> dict[str, int]:
    """
    Save all tier results and final calculations.

    V5: 3-tier pipeline (Tier 3 is web search tier).

    Convenience function that calls all save functions in order.

    Args:
        units: List of TrackedUnit objects
        conn: Optional database connection

    Returns:
        Dict with counts per tier: {"tier1": N, "tier2": N, "tier3": N, "final": N}
    """
    if conn is None:
        conn = get_db_connection()
        should_close = True
    else:
        should_close = False

    try:
        # Group units by highest completed tier
        tier1_units = [u for u in units if u.tier1_output is not None]
        tier2_units = [u for u in units if u.tier2_output is not None]
        tier3_units = [u for u in units if u.tier3_output is not None]
        final_units = [u for u in units if u.state in (ProcessingState.DONE, ProcessingState.DONE_FALSE_POSITIVE)]

        counts = {
            "tier1": save_tier1_results(tier1_units, conn),
            "tier2": save_tier2_results(tier2_units, conn),
            "tier3": save_tier3_results(tier3_units, conn),
            "final": save_final_results(final_units, conn),
        }

        return counts
    finally:
        if should_close:
            conn.close()
