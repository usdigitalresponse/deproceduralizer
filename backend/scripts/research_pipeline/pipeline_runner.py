"""
Flat, function-based pipeline runner for the research pipeline.

Replaces TierOrchestrator with simple functions:
- run_pipeline() — main entry point
- run_tier3_only() — resume failed Tier 3
- hydrate_unit_from_analysis() — hydrate unit from DB data (public for testing)

All context is passed as function args — no class, no self.* state.
"""

import asyncio
import logging
import time
from collections import defaultdict
from datetime import datetime
from functools import partial
from pathlib import Path
from typing import Optional

import anthropic
import psycopg

from .state_machine import (
    ProcessingState,
    TrackedUnit,
    get_next_state,
    is_terminal_state,
)
from .cost_tracker import CostTracker
from .result_processor import (
    process_tier1_results,
    process_tier2_results,
    process_tier3_results,
    compute_final_classification,
)
from .result_processor import process_tier3_batch_results
from .models.llm_outputs import Tier1Output, Tier2Output, Tier3Output
from .tiers import (
    prepare_tier1_batch,
    prepare_tier2_batch,
    prepare_tier3_batch,
    run_tier3_realtime,
    run_tier2_with_reruns,
)
from .db import (
    get_existing_analyses,
    save_tier1_results,
    save_tier2_results,
    save_tier3_results,
)
from .db.connection import check_db_health
from .prompt_loader import load_issue_config, IssueConfig
from .config import TIER3_BATCH_SIZE, MAX_BATCH_POLL_TIME
from .models.matches import ProcessingUnit
from .context import group_for_cache_efficiency
from .ids import make_custom_id
from .fines_extraction import FINES_ISSUE_TYPE
from .pipeline_logger import DualOutput

from lib.db import get_db_connection
from lib.llm import DEFAULT_MODEL
from lib.batch import BatchManager
from lib.cache import CacheManager
from lib.prompt_store import store_prompt_batch

logger = logging.getLogger(__name__)

# Langfuse observability (graceful degradation if not configured)
try:
    from observability.langfuse_client import (
        log_batch_submission,
        log_batch_completion,
        log_generation,
        flush_langfuse,
    )
    from observability.types import LLMTraceContext
    LANGFUSE_AVAILABLE = True
except ImportError as e:
    logger.info("Langfuse observability not available: %s", e)
    LANGFUSE_AVAILABLE = False


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def run_pipeline(
    processing_units: list[ProcessingUnit],
    jurisdiction: str,
    issue_types: list[str],
    batches_dir: Path,
    max_tier: int = 3,
    enable_web_search: bool = False,
    poll_interval: int = 60,
    realtime: bool = False,
    resume: bool = True,
    incremental_save: bool = True,
    tier2_reruns: bool = False,
    title_filter: Optional[str] = None,
    model: Optional[str] = None,
    statute_mandate: bool = False,
    no_cache: bool = False,
) -> list[TrackedUnit]:
    """
    Run the full 3-tier research pipeline.

    Args:
        processing_units: List of ProcessingUnits to process
        jurisdiction: Jurisdiction code (NJ, NY, or NYC)
        issue_types: List of issue type keys to process
        batches_dir: Directory for batch metadata
        max_tier: Maximum tier to run (1-3)
        enable_web_search: If True, run Tier 3 web search when max_tier >= 3
        poll_interval: Seconds between batch status checks
        realtime: If True, use real-time API instead of batch
        resume: If True, skip documents already processed to target tier
        incremental_save: If True, save results to DB after each tier
        tier2_reruns: If True, run Tier 2 with re-run mechanics
        title_filter: Optional title filter (e.g., '3A' for Title 3A)
        model: Optional model override

    Returns:
        List of TrackedUnits with all tier outputs
    """
    out = DualOutput(logger=None, tier=None)
    run_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    model = model or DEFAULT_MODEL

    # Load issue configs
    issue_configs: dict[str, IssueConfig] = {
        itype: load_issue_config(itype) for itype in issue_types
    }

    # Batch manager + cost tracker + cache
    batch_manager = BatchManager(batches_dir=batches_dir)
    cost_tracker = CostTracker(run_id=run_id)
    cache = CacheManager(enabled=not no_cache)

    # Subchapter context cache (reuse across issue types)
    subchapter_context_cache: dict[int, dict[str, str]] = {}

    # Determine source_type from processing units (all units share the same source)
    source_type = "regulation"
    if processing_units and processing_units[0].source_type == "guidance":
        source_type = "guidance"

    # Initialize tracked units
    units: dict[str, TrackedUnit] = {}
    for pu in processing_units:
        tracked = TrackedUnit(unit=pu, state=ProcessingState.PENDING)
        units[tracked.custom_id] = tracked

    # Resume: skip already-processed units, hydrate partial progress
    skipped_count = 0
    skipped_by_type: dict[str, int] = {}
    hydrated_count = 0
    hydrated_by_tier: dict[int, int] = {}
    if resume:
        doc_ids = [pu.document_id for pu in processing_units]
        existing = get_existing_analyses(
            doc_ids, issue_types=issue_types, source_type=source_type,
        )

        units_to_remove = []
        for custom_id, unit in units.items():
            key = (unit.unit.document_id, unit.unit.issue_type)
            if key in existing:
                analysis = existing[key]
                highest_completed = analysis.get("highest_tier_completed", 0) or 0

                if highest_completed >= max_tier:
                    units_to_remove.append(custom_id)
                    skipped_count += 1
                    skipped_by_type[unit.unit.issue_type] = skipped_by_type.get(unit.unit.issue_type, 0) + 1
                elif highest_completed > 0:
                    hydrate_unit_from_analysis(unit, analysis, highest_completed)
                    hydrated_count += 1
                    hydrated_by_tier[highest_completed] = hydrated_by_tier.get(highest_completed, 0) + 1

        for custom_id in units_to_remove:
            del units[custom_id]

    # Sort for cache efficiency
    units = _sort_for_cache_efficiency(units)

    # Langfuse trace context
    trace_context = None
    batch_trace_ids: dict[str, str] = {}
    issue_type_single = issue_types[0] if len(issue_types) == 1 else None
    if LANGFUSE_AVAILABLE:
        date_str = datetime.now().strftime("%Y-%m-%d")
        trace_context = LLMTraceContext(
            run_id=run_id,
            session_name=f"research_{jurisdiction}_{issue_type_single}_{date_str}",
            stage="pipeline_start",
            state=jurisdiction,
            issue_type=issue_type_single,
            extra={
                "max_tier": max_tier,
                "realtime_mode": realtime,
                "unit_count": len(units),
            },
        )

    # Print header
    _print_header(out, jurisdiction, issue_types, title_filter, units, run_id,
                  realtime, max_tier, skipped_count, skipped_by_type,
                  hydrated_count, hydrated_by_tier)

    # --- Tier 1 ---
    if not _check_db_health(out, "Tier 1"):
        return list(units.values())
    await _run_tier1(units, issue_configs, batch_manager, cost_tracker,
                     subchapter_context_cache, realtime, model,
                     incremental_save, out, trace_context, batch_trace_ids,
                     jurisdiction, issue_type_single, run_id, poll_interval, cache)

    # --- Tier 2 ---
    if max_tier >= 2:
        if not _check_db_health(out, "Tier 2"):
            return list(units.values())
        await _run_tier2(units, issue_configs, batch_manager, cost_tracker,
                         realtime, model, incremental_save, tier2_reruns,
                         out, trace_context, batch_trace_ids,
                         jurisdiction, issue_type_single, run_id, poll_interval, cache)

    # --- Fines structured extraction (post-Tier 2 hook) ---
    if max_tier >= 2 and FINES_ISSUE_TYPE in issue_types:
        from .fines_extraction import run_fines_extraction
        await run_fines_extraction(units, jurisdiction)

    # --- Tier 3 ---
    if max_tier >= 3 and enable_web_search:
        if not _check_db_health(out, "Tier 3"):
            return list(units.values())
        await _run_tier3(units, issue_configs, batch_manager, cost_tracker,
                         realtime, model, incremental_save,
                         out, trace_context, batch_trace_ids,
                         jurisdiction, issue_type_single, run_id, poll_interval, cache)
    elif not enable_web_search:
        tier3_pending = [u for u in units.values() if u.state == ProcessingState.TIER3_PENDING]
        if tier3_pending:
            out.info(f"\n  Finalizing {len(tier3_pending)} units (Tier 3 skipped)")
            for unit in tier3_pending:
                unit.state = ProcessingState.DONE

    # --- Statute Mandate Check (post-pipeline, NY only) ---
    if statute_mandate and jurisdiction.upper() == "NY":
        done_units = [u for u in units.values()
                      if u.state in (ProcessingState.DONE, ProcessingState.TIER2_COMPLETE,
                                     ProcessingState.TIER3_COMPLETE)]
        if done_units:
            out.info(f"\n[STATUTE MANDATE] Running mandate checks for {jurisdiction}...")
            from .tiers.statute_mandate_runner import run_statute_mandate_checks
            await run_statute_mandate_checks(jurisdiction=jurisdiction, dry_run=False, model=model, cache=cache)

    # Complete
    cost_tracker.mark_complete()
    if cache.enabled:
        out.info(f"\n{cache.summary()}")
    cache.close()
    _print_summary(out, units, cost_tracker)

    if LANGFUSE_AVAILABLE:
        flush_langfuse()

    return list(units.values())


async def run_tier3_only(
    processing_units: list[ProcessingUnit],
    tier2_outputs: dict,
    jurisdiction: str,
    issue_types: list[str],
    batches_dir: Path,
    realtime: bool = True,
    model: Optional[str] = None,
    trigger_reasons: Optional[dict[str, str]] = None,
) -> list[TrackedUnit]:
    """
    Run ONLY Tier 3 on units that already have Tier 2 output.

    Used by --run-pending-tier3 to resume failed/skipped Tier 3.

    Args:
        processing_units: List of ProcessingUnit objects
        tier2_outputs: Dict mapping custom_id to Tier2Output
        jurisdiction: Jurisdiction code
        issue_types: List of issue type keys
        batches_dir: Directory for batch metadata
        realtime: API mode (default True for Tier 3)
        model: Optional model override
        trigger_reasons: Optional dict mapping custom_id to trigger reason string

    Returns:
        List of TrackedUnit with tier3_output populated
    """
    out = DualOutput(logger=None, tier=None)
    run_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    model = model or DEFAULT_MODEL

    issue_configs = {itype: load_issue_config(itype) for itype in issue_types}
    batch_manager = BatchManager(batches_dir=batches_dir)
    cost_tracker = CostTracker(run_id=run_id)

    out.info(f"\n{'='*70}")
    out.info("TIER 3 ONLY MODE")
    out.info(f"{'='*70}")
    out.info(f"Jurisdiction: {jurisdiction}")
    out.info(f"Issue types: {', '.join(issue_types)}")
    out.info(f"Units to process: {len(processing_units)}")
    out.info("")

    # Initialize and hydrate units
    units: dict[str, TrackedUnit] = {}
    hydrated = 0
    skipped = 0
    for pu in processing_units:
        custom_id = make_custom_id(pu.document_id, pu.issue_type)
        tracked = TrackedUnit(unit=pu, state=ProcessingState.PENDING)
        units[custom_id] = tracked

        if custom_id in tier2_outputs:
            tracked.tier2_output = tier2_outputs[custom_id]
            tracked.state = ProcessingState.TIER3_PENDING
            if trigger_reasons and custom_id in trigger_reasons:
                tracked.tier3_trigger_reason = trigger_reasons[custom_id]
            else:
                # Auto-compute from routing logic when not explicitly provided
                from .routing import get_tier3_trigger_reason
                tracked.tier3_trigger_reason = get_tier3_trigger_reason(tracked)
            hydrated += 1
            out.info(f"  \u2713 Hydrated {custom_id}: {tracked.tier2_output.classification}")
        else:
            out.warning(f"  \u26a0\ufe0f  No Tier 2 output for {custom_id}, skipping")
            tracked.state = ProcessingState.ERROR
            tracked.error_message = "No Tier 2 output found"
            skipped += 1

    out.info("")
    out.info(f"Hydrated: {hydrated}, Skipped: {skipped}")
    out.info("")

    if hydrated == 0:
        out.info("No units to process - all skipped")
        return list(units.values())

    # Run Tier 3
    issue_type_single = issue_types[0] if len(issue_types) == 1 else None
    batch_trace_ids: dict[str, str] = {}
    trace_context = None

    await _run_tier3(units, issue_configs, batch_manager, cost_tracker,
                     realtime, model, True,
                     out, trace_context, batch_trace_ids,
                     jurisdiction, issue_type_single, run_id, 60)

    cost_tracker.mark_complete()
    _print_summary(out, units, cost_tracker)

    if LANGFUSE_AVAILABLE:
        flush_langfuse()

    return list(units.values())


def hydrate_unit_from_analysis(
    unit: TrackedUnit,
    analysis: dict,
    highest_completed: int,
) -> None:
    """
    Hydrate a TrackedUnit with existing tier outputs from the database.

    Enables resume by:
    1. Creating tier output objects from DB data
    2. Setting state based on highest tier completed
    3. Assigning outputs so tier runners skip this unit

    Args:
        unit: The TrackedUnit to hydrate
        analysis: Dict from get_existing_analyses()
        highest_completed: The highest tier number completed (1, 2, or 3)
    """
    # Hydrate Tier 1
    if highest_completed >= 1 and analysis.get("tier1_classification"):
        unit.tier1_output = Tier1Output(
            classification=analysis["tier1_classification"],
            relevant_match_indices=[],
            dismissed_matches=[],
            confidence=analysis.get("tier1_confidence") or 0.8,
            reasoning=analysis.get("tier1_reasoning") or "Resumed from database",
            context_requests=analysis.get("tier1_context_requests") or [],
        )
        unit._tier1_relevant_match_ids = analysis.get("tier1_relevant_match_ids") or []
        unit._tier1_dismissed_match_ids = analysis.get("tier1_dismissed_match_ids") or []

    # Hydrate Tier 2
    if highest_completed >= 2 and analysis.get("tier2_classification"):
        unit.tier2_output = Tier2Output(
            classification=analysis["tier2_classification"],
            confidence=analysis.get("tier2_confidence") or 0.8,
            reasoning=analysis.get("tier2_reasoning") or "Resumed from database",
            argument_for_regulation=analysis.get("argument_for_regulation") or "",
            argument_against_regulation=analysis.get("argument_against_regulation") or "",
            severity=analysis.get("severity"),
            verbatim_requirements=analysis.get("verbatim_requirements") or [],
            context_used=[],
            full_text_requests=analysis.get("tier2_full_text_requests") or [],
        )
        unit.tier2_context_requests_made = analysis.get("tier2_context_requests_made") or []

    # Hydrate Tier 3
    if highest_completed >= 3 and analysis.get("tier3_classification"):
        unit.tier3_output = Tier3Output(
            classification=analysis["tier3_classification"],
            confidence=analysis.get("tier3_confidence") or 0.8,
            reasoning=analysis.get("tier3_reasoning") or "Resumed from database",
            argument_for_regulation=analysis.get("argument_for_regulation") or "",
            argument_against_regulation=analysis.get("argument_against_regulation") or "",
            severity_adjustment=analysis.get("tier3_severity_adjustment"),
            severity_adjustment_reasoning=analysis.get("tier3_severity_adjustment_reasoning"),
            web_search_summary="",
            verbatim_requirements=[],
            context_used=[],
        )

    # Set state based on highest tier completed
    if highest_completed == 1:
        if unit.tier1_output and unit.tier1_output.classification == "all_false_positives":
            unit.state = ProcessingState.DONE_FALSE_POSITIVE
        else:
            unit.state = ProcessingState.TIER2_PENDING
    elif highest_completed == 2:
        unit.state = ProcessingState.TIER2_COMPLETE
        unit.state = get_next_state(unit)
    elif highest_completed >= 3:
        unit.state = ProcessingState.DONE


# ---------------------------------------------------------------------------
# Internal: Per-tier runners
# ---------------------------------------------------------------------------


async def _run_tier1(units, issue_configs, batch_manager, cost_tracker,
                     subchapter_context_cache, realtime, model,
                     incremental_save, out, trace_context, batch_trace_ids,
                     jurisdiction, issue_type_single, run_id, poll_interval,
                     cache=None):
    """Run Tier 1: Match Filtering."""
    tier_out = DualOutput(logger=None, tier=1)

    pending = [u for u in units.values() if u.state == ProcessingState.PENDING]
    if not pending:
        tier_out.info("\n[TIER 1] No units need Tier 1 processing (all resumed)")
        return

    tier_out.info(f"\n[TIER 1] Match Filtering ({len(pending)} units)")
    tier_out.info("-" * 50)

    # Group by issue_type and prepare requests
    by_issue: dict[str, list[TrackedUnit]] = defaultdict(list)
    for unit in pending:
        by_issue[unit.issue_type].append(unit)

    prepare_fn = partial(prepare_tier1_batch, context_cache=subchapter_context_cache)
    requests = []
    issue_list = list(by_issue.items())
    for i, (issue_type, units_for_issue) in enumerate(issue_list):
        tier_out.progress(f"  Preparing {issue_type} ({i+1}/{len(issue_list)})...", end="\r")
        config = issue_configs[issue_type]
        requests.extend(prepare_fn(units_for_issue, config))
    tier_out.info(f"  Prepared {len(requests)} requests across {len(by_issue)} issue types" + " " * 20)

    # Store prompt templates and assign IDs to units
    _store_and_assign_prompts(requests, pending, "research", 1, "tier1_prompt_id", tier_out)

    batch_id = None
    if realtime:
        succeeded, failed = await _run_realtime(
            requests, pending, Tier1Output, "tier1_output", "Tier 1",
            out, model, cost_tracker, trace_context, cache=cache,
            cache_pipeline="research", cache_tier=1)
    else:
        succeeded, failed, batch_id = await _submit_and_poll_batch(
            requests, pending, "tier1", process_tier1_results,
            batch_manager, cost_tracker, out, trace_context, batch_trace_ids,
            jurisdiction, issue_type_single, run_id, poll_interval,
            cache=cache, cache_pipeline="research", cache_tier=1)

    # State transitions
    for unit in succeeded:
        unit.state = ProcessingState.TIER1_COMPLETE
        unit.tier1_completed_at = datetime.now()
        if batch_id:
            unit.tier1_batch_id = batch_id
        unit.state = get_next_state(unit)

    _log_tier_complete(out, cost_tracker, "Tier 1", len(succeeded), len(failed),
                       trace_context, batch_trace_ids)

    # Incremental save
    if incremental_save:
        tier1_units = [u for u in units.values() if u.tier1_output]
        if tier1_units:
            conn = get_db_connection()
            saved = save_tier1_results(tier1_units, conn)
            conn.close()
            tier_out.info(f"  Saved {saved} Tier 1 results to database")


async def _run_tier2(units, issue_configs, batch_manager, cost_tracker,
                     realtime, model, incremental_save, tier2_reruns,
                     out, trace_context, batch_trace_ids,
                     jurisdiction, issue_type_single, run_id, poll_interval,
                     cache=None):
    """Run Tier 2: Summary-Based Research."""
    tier_out = DualOutput(logger=None, tier=2)

    if tier2_reruns:
        await _run_tier2_with_reruns(units, issue_configs, cost_tracker,
                                     trace_context, out, cache=cache)
    else:
        pending = [u for u in units.values() if u.state == ProcessingState.TIER2_PENDING]
        if not pending:
            tier_out.info("\n[TIER 2] No units need Tier 2 processing (all resumed)")
            _save_tier2(units, incremental_save, tier_out)
            return

        tier_out.info(f"\n[TIER 2] Summary-Based Research ({len(pending)} units)")
        tier_out.info("-" * 50)

        by_issue: dict[str, list[TrackedUnit]] = defaultdict(list)
        for unit in pending:
            by_issue[unit.issue_type].append(unit)

        requests = []
        issue_list = list(by_issue.items())
        for i, (issue_type, units_for_issue) in enumerate(issue_list):
            tier_out.progress(f"  Preparing {issue_type} ({i+1}/{len(issue_list)})...", end="\r")
            config = issue_configs[issue_type]
            requests.extend(prepare_tier2_batch(units_for_issue, config))
        tier_out.info(f"  Prepared {len(requests)} requests across {len(by_issue)} issue types" + " " * 20)

        # Store prompt templates and assign IDs to units
        _store_and_assign_prompts(requests, pending, "research", 2, "tier2_prompt_id", tier_out)

        batch_id = None
        if realtime:
            succeeded, failed = await _run_realtime(
                requests, pending, Tier2Output, "tier2_output", "Tier 2",
                out, model, cost_tracker, trace_context, cache=cache,
                cache_pipeline="research", cache_tier=2)
        else:
            succeeded, failed, batch_id = await _submit_and_poll_batch(
                requests, pending, "tier2", process_tier2_results,
                batch_manager, cost_tracker, out, trace_context, batch_trace_ids,
                jurisdiction, issue_type_single, run_id, poll_interval,
                cache=cache, cache_pipeline="research", cache_tier=2)

        for unit in succeeded:
            unit.state = ProcessingState.TIER2_COMPLETE
            unit.tier2_completed_at = datetime.now()
            if batch_id:
                unit.tier2_batch_id = batch_id
            unit.state = get_next_state(unit)

        _log_tier_complete(out, cost_tracker, "Tier 2", len(succeeded), len(failed),
                           trace_context, batch_trace_ids)

    _save_tier2(units, incremental_save, tier_out)


async def _run_tier2_with_reruns(units, issue_configs, cost_tracker,
                                  trace_context, out, cache=None):
    """Run Tier 2 with real-time API re-run support."""
    tier_out = DualOutput(logger=None, tier=2)
    pending = [u for u in units.values() if u.state == ProcessingState.TIER2_PENDING]

    if not pending:
        tier_out.info("\n[TIER 2] No units need Tier 2 processing")
        return

    tier_out.info(f"\n[TIER 2] Summary-Based Research with Re-runs ({len(pending)} units)")
    tier_out.info("-" * 50)
    tier_out.info("  (Using real-time API with re-run support)")

    _, rerun_requests = await run_tier2_with_reruns(
        units=pending,
        issue_configs=issue_configs,
        cost_tracker=cost_tracker,
        trace_context=trace_context,
        cache=cache,
    )

    # Store prompt templates for observability (mirrors batch path)
    _store_and_assign_prompts(rerun_requests, pending, "research", 2, "tier2_prompt_id", tier_out)

    succeeded = []
    failed = []
    for unit in pending:
        if unit.tier2_output is not None:
            unit.state = ProcessingState.TIER2_COMPLETE
            unit.state = get_next_state(unit)
            succeeded.append(unit)
        elif unit.error_message:
            unit.state = ProcessingState.ERROR
            failed.append(unit)

    reruns = sum(u.tier2_rerun_count for u in succeeded)
    units_with_reruns = sum(1 for u in succeeded if u.tier2_rerun_count > 0)
    forced = sum(1 for u in succeeded if u.tier2_forced_classification)

    _log_tier_complete(out, None, "Tier 2", len(succeeded), len(failed))

    if reruns > 0:
        tier_out.info(f"\n  {'*'*60}")
        tier_out.info(f"  TIER 2 RE-RUN SUMMARY")
        tier_out.info(f"  Total re-runs: {reruns} across {units_with_reruns} units")
        tier_out.info(f"  Units with 1 re-run: {sum(1 for u in succeeded if u.tier2_rerun_count == 1)}")
        tier_out.info(f"  Units with 2 re-runs: {sum(1 for u in succeeded if u.tier2_rerun_count == 2)}")
        tier_out.info(f"  {'*'*60}\n")
    if forced > 0:
        tier_out.info(f"    Forced classifications: {forced}")


def _save_tier2(units, incremental_save, tier_out):
    """Save Tier 2 results to database."""
    if incremental_save:
        tier2_units = [u for u in units.values() if u.tier2_output]
        if tier2_units:
            conn = get_db_connection()
            saved = save_tier2_results(tier2_units, conn)
            conn.close()
            tier_out.info(f"  Saved {saved} Tier 2 results to database")


async def _run_tier3(units, issue_configs, batch_manager, cost_tracker,
                     realtime, model, incremental_save,
                     out, trace_context, batch_trace_ids,
                     jurisdiction, issue_type_single, run_id, poll_interval,
                     cache=None):
    """Run Tier 3: Web Search Verification."""
    tier_out = DualOutput(logger=None, tier=3)

    pending = [u for u in units.values() if u.state == ProcessingState.TIER3_PENDING]
    if not pending:
        tier_out.info("\n[TIER 3] No units need web search verification")
        return

    tier_out.info(f"\n[TIER 3] Web Search Verification ({len(pending)} units)")
    tier_out.info("-" * 50)

    if realtime:
        await _run_tier3_realtime(pending, issue_configs, cost_tracker,
                                   trace_context, jurisdiction, out, cache=cache)
    else:
        await _run_tier3_batch(pending, units, issue_configs, batch_manager,
                                cost_tracker, out, trace_context, batch_trace_ids,
                                jurisdiction, issue_type_single, run_id, poll_interval)

    # Save
    if incremental_save:
        tier3_units = [u for u in units.values() if u.tier3_output]
        if tier3_units:
            conn = get_db_connection()
            saved = save_tier3_results(tier3_units, conn)
            conn.close()
            tier_out.info(f"  Saved {saved} Tier 3 results to database")


async def _run_tier3_realtime(pending, issue_configs, cost_tracker,
                               trace_context, jurisdiction, out, cache=None):
    """Run Tier 3 using real-time API with rate limiting."""
    tier_out = DualOutput(logger=None, tier=3)
    tier_out.info("  (Using REAL-TIME API with web search)")

    completed = 0
    for i in range(0, len(pending), TIER3_BATCH_SIZE):
        batch = pending[i:i + TIER3_BATCH_SIZE]
        await run_tier3_realtime(
            batch, issue_configs,
            cost_tracker=cost_tracker,
            trace_context=trace_context,
            jurisdiction=jurisdiction,
            cache=cache,
        )
        completed = min(i + TIER3_BATCH_SIZE, len(pending))
        tier_out.info(f"  Progress: {completed}/{len(pending)}")

    succeeded = []
    failed = []
    for unit in pending:
        if unit.tier3_output is not None:
            unit.state = ProcessingState.TIER3_COMPLETE
            unit.state = get_next_state(unit)
            succeeded.append(unit)
        elif unit.error_message:
            unit.state = ProcessingState.ERROR
            failed.append(unit)

    _log_tier_complete(out, cost_tracker, "Tier 3 (realtime)", len(succeeded), len(failed))


async def _run_tier3_batch(pending, units, issue_configs, batch_manager,
                            cost_tracker, out, trace_context, batch_trace_ids,
                            jurisdiction, issue_type_single, run_id, poll_interval):
    """Run Tier 3 using Batch API."""
    tier_out = DualOutput(logger=None, tier=3)
    tier_out.info("  (Using BATCH API with web search - 50% cost savings)")

    requests = prepare_tier3_batch(
        units=pending, issue_configs=issue_configs, jurisdiction=jurisdiction,
    )
    if not requests:
        tier_out.info("  No valid requests to submit")
        return

    # Store prompt templates and assign IDs to units
    _store_and_assign_prompts(requests, pending, "research", 3, "tier3_prompt_id", tier_out)

    batch_id = _submit_batch(requests, "tier3", batch_manager, out,
                              trace_context, batch_trace_ids,
                              jurisdiction, issue_type_single, run_id)

    await _poll_batch(batch_id, batch_manager, out, poll_interval)

    succeeded, failed = process_tier3_batch_results(
        batch_id=batch_id, units=units, manager=batch_manager,
        cost_tracker=cost_tracker, trace_context=trace_context,
    )

    for unit in succeeded:
        unit.tier3_batch_id = batch_id
        unit.state = get_next_state(unit)

    _log_tier_complete(out, cost_tracker, "Tier 3 (batch)", len(succeeded), len(failed),
                       trace_context, batch_trace_ids)


# ---------------------------------------------------------------------------
# Internal: Prompt observability
# ---------------------------------------------------------------------------


def _store_and_assign_prompts(
    requests: list[dict],
    units: list[TrackedUnit],
    pipeline: str,
    tier: int,
    prompt_id_attr: str,
    out,
) -> None:
    """Store prompt templates in DB and assign IDs to TrackedUnits.

    Matches requests to units via custom_id. DB/network failures are
    logged but don't block the pipeline. Other errors propagate.
    """
    if not requests:
        return
    try:
        prompt_ids = store_prompt_batch(requests, pipeline=pipeline, tier=tier)
        unit_by_cid = {u.custom_id: u for u in units}
        assigned = 0
        for cid, pid in prompt_ids.items():
            if cid in unit_by_cid:
                setattr(unit_by_cid[cid], prompt_id_attr, pid)
                assigned += 1
        out.info(f"  Stored {len(set(prompt_ids.values()))} unique prompt templates, assigned to {assigned} units")
    except (psycopg.Error, OSError) as e:
        logger.warning("Prompt template storage failed (non-fatal): %s", e, exc_info=True)
        out.info(f"  Warning: prompt template storage failed (non-fatal): {e}")


# ---------------------------------------------------------------------------
# Internal: Batch helpers
# ---------------------------------------------------------------------------


async def _submit_and_poll_batch(requests, pending, tier_key, process_fn,
                                  batch_manager, cost_tracker, out,
                                  trace_context, batch_trace_ids,
                                  jurisdiction, issue_type_single, run_id, poll_interval,
                                  cache=None, cache_pipeline=None, cache_tier=None):
    """Submit batch, poll for completion, process results.

    When cache is provided, filters out cached requests before submitting.
    Cached results are processed by parsing tool_use output directly into units.
    """
    # --- Cache: filter out cached requests ---
    uncached_requests = requests
    cache_hit_count = 0

    if cache and cache.enabled:
        from lib.batch import _parse_cached_response
        request_hashes = {}
        for req in requests:
            request_hashes[req["custom_id"]] = cache.compute_hash(req["params"])

        hash_to_response = cache.lookup_batch(list(request_hashes.values()))

        # Map hashes back to custom_ids
        hash_to_cids = {}
        for cid, h in request_hashes.items():
            hash_to_cids.setdefault(h, []).append(cid)

        cached_cids = set()
        unit_map = {u.custom_id: u for u in pending}

        # Determine output class from tier_key
        tier_output_classes = {"tier1": Tier1Output, "tier2": Tier2Output}
        output_class = tier_output_classes.get(tier_key)
        tier_output_attrs = {"tier1": "tier1_output", "tier2": "tier2_output"}
        output_attr = tier_output_attrs.get(tier_key)

        if output_class and output_attr:
            for h, resp in hash_to_response.items():
                for cid in hash_to_cids.get(h, []):
                    parsed = _parse_cached_response(resp, output_class)
                    if parsed and cid in unit_map:
                        setattr(unit_map[cid], output_attr, parsed)
                        cached_cids.add(cid)
                        cache_hit_count += 1

        uncached_requests = [r for r in requests if r["custom_id"] not in cached_cids]

        if cache_hit_count > 0:
            out.info(f"  Cache: {cache_hit_count} hits, {len(uncached_requests)} to submit")

    # If all requests were cached, return early
    if not uncached_requests:
        out.info(f"  All {len(requests)} requests served from cache")
        cached_units = [u for u in pending if getattr(u, output_attr, None) is not None] if cache_hit_count > 0 else []
        return cached_units, [], "cache"

    out.info("")
    out.info(f"  >>> SUBMITTING BATCH TO API...")
    out.info(f"  >>> (Batch API can take up to 24 hours - typically 10-40 min for <200 requests)")

    batch_id = _submit_batch(uncached_requests, tier_key, batch_manager, out,
                              trace_context, batch_trace_ids,
                              jurisdiction, issue_type_single, run_id)

    await _poll_batch(batch_id, batch_manager, out, poll_interval)

    succeeded, failed = process_fn(
        batch_id=batch_id,
        units={u.custom_id: u for u in pending},
        manager=batch_manager,
        cost_tracker=cost_tracker,
        trace_context=trace_context if LANGFUSE_AVAILABLE else None,
    )

    # Store fresh results in cache
    if cache and cache.enabled and succeeded:
        _store_batch_results_in_cache(
            cache, batch_id, uncached_requests, request_hashes,
            batch_manager, cache_pipeline, cache_tier,
        )

    # Include cache-hit units in succeeded list
    if cache_hit_count > 0:
        cached_units = [u for u in pending if u not in succeeded and u not in failed
                        and getattr(u, output_attr, None) is not None]
        succeeded = cached_units + succeeded

    return succeeded, failed, batch_id


def _store_batch_results_in_cache(cache, batch_id, requests, request_hashes,
                                   batch_manager, cache_pipeline, cache_tier):
    """Store batch API results in cache for future reuse."""
    from lib.batch import _message_to_dict
    try:
        cid_to_req = {r["custom_id"]: r for r in requests}
        entries = []
        for result in batch_manager.get_batch_results(batch_id):
            if result.result.type != "succeeded":
                continue
            cid = result.custom_id
            h = request_hashes.get(cid)
            req = cid_to_req.get(cid)
            if not h or not req:
                continue
            msg = result.result.message
            usage = {
                "input_tokens": getattr(msg.usage, "input_tokens", 0) if msg.usage else 0,
                "output_tokens": getattr(msg.usage, "output_tokens", 0) if msg.usage else 0,
                "cache_read_tokens": getattr(msg.usage, "cache_read_input_tokens", 0) if msg.usage else 0,
                "cache_write_tokens": getattr(msg.usage, "cache_creation_input_tokens", 0) if msg.usage else 0,
            }
            entries.append({
                "request_hash": h,
                "model": req["params"].get("model", ""),
                "request_body": req["params"],
                "response_body": _message_to_dict(msg),
                "usage": usage,
                "pipeline": cache_pipeline,
                "tier": cache_tier,
            })
        if entries:
            cache.store_batch(entries)
            print(f"  Cache: stored {len(entries)} new responses")
    except (psycopg.Error, anthropic.APIError) as e:
        print(f"  Cache store warning: {e}")


def _submit_batch(requests, tier_key, batch_manager, out,
                   trace_context, batch_trace_ids,
                   jurisdiction, issue_type_single, run_id):
    """Submit a batch and return batch ID."""
    issue_label = issue_type_single if issue_type_single else "multi"
    batch_id = batch_manager.submit_batch(
        requests=requests,
        batch_name=f"{jurisdiction}_{issue_label}_{tier_key}_{run_id}",
        metadata={
            "state": jurisdiction,
            "tier": tier_key,
            "run_id": run_id,
        },
    )

    tier_num = int(tier_key[-1]) if tier_key[-1].isdigit() else 0
    tier_out = DualOutput(logger=None, tier=tier_num) if tier_num else out
    tier_out.info(f"  >>> BATCH SUBMITTED: {batch_id}")
    tier_out.info(f"  >>> Requests: {len(requests)}")

    if LANGFUSE_AVAILABLE and trace_context:
        trace_context.stage = tier_key
        trace_id = log_batch_submission(
            context=trace_context,
            batch_id=batch_id,
            batch_name=f"{jurisdiction}_{issue_type_single}_{tier_key}",
            request_count=len(requests),
        )
        if trace_id:
            batch_trace_ids[batch_id] = trace_id

    return batch_id


async def _poll_batch(batch_id, batch_manager, out, poll_interval):
    """Poll batch until complete. Delegates to BatchManager.poll_until_complete."""
    await asyncio.to_thread(
        batch_manager.poll_until_complete,
        batch_id,
        poll_interval=poll_interval,
        timeout=MAX_BATCH_POLL_TIME,
        log=out.info,
    )


async def _run_realtime(requests, units, output_class, output_attr, tier_name,
                         out, model, cost_tracker, trace_context,
                         cache=None, cache_pipeline=None, cache_tier=None):
    """Run requests in realtime mode (no batch API)."""
    from lib.llm import call_llm_parse_async

    client = anthropic.AsyncAnthropic()
    id_to_unit = {u.custom_id: u for u in units}
    succeeded = []
    failed = []
    total = len(requests)
    cache_hit_count = 0

    out.info(f"  Running {total} requests in realtime mode...")

    for i, request in enumerate(requests):
        custom_id = request["custom_id"]
        unit = id_to_unit.get(custom_id)
        if not unit:
            continue

        out.progress(f"  [{i+1}/{total}] Processing {unit.unit.citation}...", end="")

        # --- Cache check ---
        request_hash = None
        if cache and cache.enabled:
            from lib.batch import _parse_cached_response
            request_hash = cache.compute_hash(request["params"])
            cached = cache.lookup(request_hash)
            if cached:
                parsed = _parse_cached_response(cached, output_class)
                if parsed:
                    setattr(unit, output_attr, parsed)
                    succeeded.append(unit)
                    cache_hit_count += 1
                    print(" CACHE HIT", flush=True)
                    continue

        params = request.get("params", request.get("body", {}))
        messages = params.get("messages", [])
        user_prompt = messages[0]["content"] if messages else ""

        system_raw = params.get("system", "")
        if isinstance(system_raw, list) and system_raw:
            system = system_raw[0].get("text", "") if system_raw else ""
        else:
            system = system_raw

        start_time = time.time()

        try:
            result, usage = await call_llm_parse_async(
                client=client,
                prompt=user_prompt,
                response_format=output_class,
                system=system,
                model=model,
                max_tokens=64000,
                trace_context=trace_context if LANGFUSE_AVAILABLE else None,
            )

            if result:
                setattr(unit, output_attr, result)
                succeeded.append(unit)
                print(" OK", flush=True)

                tier_num = int(tier_name.split()[1])
                cost_tracker.record_batch_usage(
                    tier=tier_num,
                    input_tokens=usage.get("input_tokens", 0),
                    output_tokens=usage.get("output_tokens", 0),
                    cache_read_tokens=usage.get("cache_read_tokens", 0),
                    cache_write_tokens=usage.get("cache_write_tokens", 0),
                    request_count=1,
                    model=model,
                )

                # Store in cache
                if cache and cache.enabled and request_hash:
                    response_body = {"tool_use_input": result.model_dump()}
                    cache.store(
                        request_hash=request_hash,
                        request_body=request["params"],
                        response_body=response_body,
                        model=model,
                        usage=usage,
                        pipeline=cache_pipeline,
                        tier=cache_tier,
                    )
            else:
                unit.state = ProcessingState.ERROR
                unit.error_message = f"{tier_name} returned no result"
                failed.append(unit)
                print(" FAILED (no result)", flush=True)

        except Exception as e:
            unit.state = ProcessingState.ERROR
            unit.error_message = f"{tier_name} error: {str(e)}"
            failed.append(unit)
            print(f" ERROR: {str(e)[:50]}", flush=True)

            if LANGFUSE_AVAILABLE and trace_context:
                latency_ms = (time.time() - start_time) * 1000
                log_generation(
                    context=trace_context,
                    name=f"{tier_name}_realtime",
                    model=model,
                    input_text=user_prompt[:1000],
                    output_text="",
                    input_tokens=len(user_prompt) // 4,
                    output_tokens=0,
                    latency_ms=latency_ms,
                    success=False,
                    error_message=str(e)[:500],
                )

        await asyncio.sleep(0.2)

    if cache_hit_count > 0:
        out.info(f"  Cache: {cache_hit_count}/{total} served from cache")

    return succeeded, failed


# ---------------------------------------------------------------------------
# Internal: Utility functions
# ---------------------------------------------------------------------------


def _sort_for_cache_efficiency(units: dict[str, TrackedUnit]) -> dict[str, TrackedUnit]:
    """Sort units for maximum prompt cache hits."""
    try:
        processing_units = [u.unit for u in units.values()]
        ordered_pus = group_for_cache_efficiency(processing_units)
        pu_to_tracked = {id(u.unit): u for u in units.values()}
        return {
            pu_to_tracked[id(pu)].custom_id: pu_to_tracked[id(pu)]
            for pu in ordered_pus
        }
    except Exception as e:
        print(f"  Warning: Cache sort failed ({e}), using original order")
        return units


def _check_db_health(out, tier_name: str) -> bool:
    """Check database health with one retry."""
    if check_db_health():
        return True

    out.warning(f"  \u26a0\ufe0f  DB health check failed before {tier_name}, waiting 5s...")
    time.sleep(5)

    if check_db_health():
        out.info(f"  \u2713 DB reconnected, continuing {tier_name}")
        return True

    out.error(f"  \u274c DB health check failed after retry - cannot start {tier_name}")
    return False


def _print_header(out, jurisdiction, issue_types, title_filter, units, run_id,
                  realtime, max_tier, skipped_count, skipped_by_type,
                  hydrated_count, hydrated_by_tier):
    """Print pipeline header."""
    title_label = f"Title {title_filter}" if title_filter else "All Titles"
    issue_type_single = issue_types[0] if len(issue_types) == 1 else None
    issue_label = issue_type_single if issue_type_single else f"{len(issue_types)} issue types"

    out.info(f"\n{'='*70}")
    out.info(f"RESEARCH PIPELINE: {jurisdiction} / {title_label} / {issue_label}")
    out.info(f"{'='*70}")
    out.info(f"Processing units: {len(units)}")
    if skipped_count > 0:
        out.info(f"  Resuming: Skipped {skipped_count} already processed to tier {max_tier}+")
        for issue_type, count in sorted(skipped_by_type.items()):
            out.info(f"    - {issue_type}: {count} skipped")
    if hydrated_count > 0:
        out.info(f"  Resuming: Hydrated {hydrated_count} units with partial tier progress")
        for tier_num, count in sorted(hydrated_by_tier.items()):
            out.info(f"    - Tier {tier_num} complete: {count} units (will continue from Tier {tier_num + 1})")
    out.info(f"Max tier: {max_tier}")
    out.info(f"Run ID: {run_id}")
    out.info(f"Mode: {'REALTIME (no batch)' if realtime else 'BATCH API'}")
    out.info("")


def _print_summary(out, units, cost_tracker):
    """Print final pipeline summary."""
    out.info(f"\n{'='*70}")
    out.info("PIPELINE SUMMARY")
    out.info(f"{'='*70}")

    done = [u for u in units.values() if u.state == ProcessingState.DONE]
    false_pos = [u for u in units.values() if u.state == ProcessingState.DONE_FALSE_POSITIVE]
    errors = [u for u in units.values() if u.state == ProcessingState.ERROR]
    still_pending = [u for u in units.values() if not is_terminal_state(u.state)]

    burdensome = [u for u in done if compute_final_classification(u) == "burdensome"]
    justified = [u for u in done if compute_final_classification(u) == "justified"]
    unrelated = [u for u in done if compute_final_classification(u) == "unrelated"]

    out.info(f"Total processed: {len(units)}")
    out.info(f"  Completed: {len(done)}")
    out.info(f"  False positives (Tier 1): {len(false_pos)}")
    out.info(f"  Errors: {len(errors)}")
    if still_pending:
        out.info(f"  Still pending: {len(still_pending)}")
    out.info("")
    out.info("Classifications:")
    out.info(f"  Burdensome: {len(burdensome)}")
    out.info(f"  Justified: {len(justified)}")
    out.info(f"  Unrelated: {len(unrelated)}")
    out.info("")
    out.info(cost_tracker.summary())

    if LANGFUSE_AVAILABLE:
        flush_langfuse()


def _log_tier_complete(out, cost_tracker, tier_name, succeeded, failed,
                        trace_context=None, batch_trace_ids=None, batch_id=None):
    """Log tier completion stats."""
    total = succeeded + failed
    tier_num = int(tier_name.split()[-1]) if tier_name.split()[-1].isdigit() else None
    tier_out = DualOutput(logger=None, tier=tier_num) if tier_num else out
    if total > 0:
        success_rate = succeeded / total * 100
        tier_out.info(f"  {tier_name} complete: {succeeded}/{total} succeeded ({success_rate:.1f}%)")

    if LANGFUSE_AVAILABLE and trace_context and batch_trace_ids and batch_id:
        trace_id = batch_trace_ids.get(batch_id)
        if trace_id and cost_tracker:
            tier_stats = cost_tracker.get_tier_stats(tier_name.lower().replace(" ", ""))
            log_batch_completion(
                context=trace_context,
                trace_id=trace_id,
                succeeded=succeeded,
                errored=failed,
                expired=0,
                total_input_tokens=tier_stats.get("input_tokens", 0),
                total_output_tokens=tier_stats.get("output_tokens", 0),
                total_cost=tier_stats.get("cost", 0.0),
            )
