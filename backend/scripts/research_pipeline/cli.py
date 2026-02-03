#!/usr/bin/env python3
"""
CLI for the research pipeline.

Runs documents through the 3-tier research pipeline for regulatory burden analysis.

Usage:
    cd backend && python3 -m scripts.research_pipeline.cli --help

    # Single issue type, 10 docs, Tier 2
    python3 -m scripts.research_pipeline.cli \\
        --state nj --issue mail_only \\
        --limit 10 --max-tier 2

    # All issues with web search
    python3 -m scripts.research_pipeline.cli \\
        --state ny --all \\
        --limit 50 --max-tier 3 --web-search
"""

import argparse
import asyncio
import sys
from collections import defaultdict
from pathlib import Path
from typing import Union
from dotenv import load_dotenv


# ============================================================================
# CLI ARGUMENT VALIDATORS
# ============================================================================

def state_validator(value: str) -> str:
    """
    Validate --state flag.

    Accepts 'nj', 'ny', or 'dangerously-run-all' (case insensitive).
    'dangerously-run-all' skips state filtering in database queries.
    """
    normalized = value.lower()
    valid_states = ['nj', 'ny', 'dangerously-run-all']
    if normalized not in valid_states:
        raise argparse.ArgumentTypeError(
            f"Invalid state '{value}'. Must be one of: {', '.join(valid_states)}"
        )
    return normalized


def positive_int_or_all(value: str) -> Union[int, str]:
    """
    Validate --limit flag.

    Accepts a positive integer or the string 'all'.
    """
    if value.lower() == 'all':
        return 'all'
    try:
        int_val = int(value)
        if int_val <= 0:
            raise argparse.ArgumentTypeError(
                f"Must be a positive integer or 'all', got '{value}'"
            )
        return int_val
    except ValueError:
        raise argparse.ArgumentTypeError(
            f"Must be a positive integer or 'all', got '{value}'"
        )


# ============================================================================

# Load .env from project root
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
load_dotenv(PROJECT_ROOT / ".env")

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from shared_utils import get_db_connection, BatchManager
from scripts.research_pipeline.models.matches import ProcessingUnit
from scripts.research_pipeline.tier_orchestrator import TierOrchestrator
from scripts.research_pipeline.batch_persistence import BatchPersistence, RunStatus

# Import from new db module
from scripts.research_pipeline.db import (
    fetch_unanalyzed_documents,
    fetch_documents_with_continuation,
    fetch_tier3_pending_documents,
    fetch_all_issue_documents,
    fetch_documents_for_rerun,
    get_issue_types_for_scope,
    save_final_results,
)
from scripts.research_pipeline.db.analysis_reader import get_existing_analyses
from scripts.research_pipeline.routing import should_escalate_to_tier3
from scripts.research_pipeline.state_machine import TrackedUnit, ProcessingState
from scripts.research_pipeline.models.llm_outputs import Tier1Output, Tier2Output, Tier3Output
from scripts.research_pipeline.db.analysis_writer import save_tier1_results, save_tier2_results
from scripts.research_pipeline.result_processor import parse_batch_result_tool_use


# ============================================================================
# BATCH RECOVERY
# ============================================================================

def resume_from_batch(
    batch_id: str,
    tier: int,
    state: str,
    continue_pipeline: bool = False,
    max_tier: int = 3,
    enable_web_search: bool = True,
) -> dict:
    """
    Resume processing from an existing Anthropic batch.

    Use this when a previous run's batch completed successfully but the DB save
    failed (e.g., due to connection timeout).

    This function reuses existing pipeline components:
    1. parse_custom_id() to parse batch result IDs
    2. process_tier_results() to parse and hydrate TrackedUnits
    3. save_tier1_results() / save_tier2_results() to persist to database

    Args:
        batch_id: Anthropic batch ID (e.g., 'msgbatch_xxx')
        tier: Which tier the batch was for (1, 2, or 3)
        state: State code (e.g., 'nj', 'ny') for the recovered documents
        continue_pipeline: If True, continue to next tier after saving
        max_tier: Maximum tier to run (if continuing)
        enable_web_search: Enable web search in Tier 3 (if continuing)

    Returns:
        Dict with:
            - batch_status: Status from API
            - total_results: Number of results in batch
            - succeeded: Number of successfully parsed results
            - failed: Number of failed results
            - saved: Number of records saved to DB

    Raises:
        ValueError: If batch not found or not in 'ended' status
    """
    from datetime import datetime

    # Import existing pipeline components
    from scripts.research_pipeline.ids import parse_custom_id
    from scripts.research_pipeline.state_machine import TrackedUnit, ProcessingState
    from scripts.research_pipeline.models.matches import ProcessingUnit
    from scripts.research_pipeline.result_processor import process_tier_results
    from scripts.research_pipeline.db.analysis_writer import save_tier1_results, save_tier2_results

    print(f"\n{'='*70}")
    print(f"BATCH RECOVERY: Tier {tier}")
    print(f"{'='*70}")
    print(f"Batch ID: {batch_id}")

    # Initialize BatchManager
    manager = BatchManager()

    # Check batch status
    print("\nChecking batch status...")
    status = manager.get_batch_status(batch_id)
    print(f"  Status: {status['status']}")
    print(f"  Succeeded: {status['succeeded']}")
    print(f"  Errored: {status['errored']}")

    if status['status'] != 'ended':
        raise ValueError(
            f"Batch is not complete (status: {status['status']}). "
            f"Cannot recover from in-progress or failed batch."
        )

    if status['errored'] > 0:
        print(f"  WARNING: {status['errored']} requests errored in this batch")

    # Step 1: Build units dict from batch results
    # We iterate results once to build TrackedUnits with the correct custom_id keys
    print(f"\nBuilding units from batch results...")
    units: dict[str, TrackedUnit] = {}
    parse_errors = 0

    for result in manager.get_batch_results(batch_id):
        custom_id = result.custom_id
        try:
            issue_type, doc_id = parse_custom_id(custom_id)
        except ValueError as e:
            print(f"  Warning: {e}")
            parse_errors += 1
            continue

        # Create minimal ProcessingUnit (required fields only)
        # citation, title, content are empty - not used in save functions
        # matches is empty - match_id linkage won't be preserved in recovery
        pu = ProcessingUnit(
            document_id=doc_id,
            issue_type=issue_type,
            citation="",
            title="",
            content="",
            matches=[],
            state=state,
        )

        # Create TrackedUnit in the expected pre-processing state
        tracked = TrackedUnit(unit=pu)
        if tier == 1:
            tracked.state = ProcessingState.TIER1_SUBMITTED
            tracked.tier1_batch_id = batch_id
        elif tier == 2:
            tracked.state = ProcessingState.TIER2_SUBMITTED
            tracked.tier2_batch_id = batch_id
        elif tier == 3:
            tracked.state = ProcessingState.TIER3_PROCESSING
            # Tier 3 doesn't use batch API normally, but we handle it for completeness

        units[custom_id] = tracked

    print(f"  Built {len(units)} units from batch")
    if parse_errors:
        print(f"  Parse errors: {parse_errors}")

    # Step 2: Process results using existing function
    # This will iterate results again (cached by API) and hydrate units with tier outputs
    print(f"\nProcessing batch results...")
    output_model = Tier1Output if tier == 1 else Tier2Output if tier == 2 else Tier3Output
    succeeded, failed = process_tier_results(
        batch_id=batch_id,
        units=units,
        manager=manager,
        output_model=output_model,
        tier=tier,
        cost_tracker=None,  # Skip cost tracking for recovery
        trace_context=None,  # Skip Langfuse logging for recovery
    )

    print(f"  Succeeded: {len(succeeded)}")
    print(f"  Failed: {len(failed)}")

    if failed:
        print(f"\n  Failed units:")
        for unit in failed[:10]:
            print(f"    - {unit.issue_type}_{unit.document_id}: {unit.error_message}")
        if len(failed) > 10:
            print(f"    ... and {len(failed) - 10} more")

    # Step 3: Save using existing functions
    print(f"\nSaving to database...")

    # Set timestamps that save functions expect
    now = datetime.now()
    for unit in succeeded:
        if tier == 1:
            unit.tier1_completed_at = now
        elif tier == 2:
            unit.tier2_completed_at = now
        elif tier == 3:
            unit.tier3_completed_at = now

    conn = get_db_connection()
    try:
        if tier == 1:
            saved = save_tier1_results(succeeded, conn)
        elif tier == 2:
            saved = save_tier2_results(succeeded, conn)
        else:
            # Tier 3 save would need save_tier3_results - not typically used in recovery
            print(f"  Warning: Tier 3 recovery not implemented, skipping save")
            saved = 0
    finally:
        conn.close()

    print(f"  Saved {saved} records to database")

    result_summary = {
        'batch_status': status['status'],
        'total_results': status['succeeded'] + status['errored'],
        'succeeded': len(succeeded),
        'failed': len(failed),
        'saved': saved,
    }

    print(f"\n{'='*70}")
    print(f"RECOVERY COMPLETE")
    print(f"{'='*70}")
    print(f"  Total results: {result_summary['total_results']}")
    print(f"  Successfully parsed: {result_summary['succeeded']}")
    print(f"  Failed to parse: {result_summary['failed']}")
    print(f"  Saved to database: {result_summary['saved']}")

    # TODO: If continue_pipeline is True, could continue to next tier
    # This would require fetching documents from DB and running the next tier
    # For now, just return the summary

    return result_summary


# ============================================================================
# DRY-RUN RESUME SIMULATION
# ============================================================================

def _query_tier3_pending_from_db(
    state: str | None,
    issue_types: list[str],
    max_tier: int,
) -> list[dict]:
    """
    Query for documents that are tier3-pending in the database.

    These are documents from previous runs that completed tier 2 but
    haven't run tier 3 yet. They won't be returned by fetch_unanalyzed_documents
    because they already have analyses.

    Args:
        state: State code (NJ, NY, or None for all)
        issue_types: List of issue types to query
        max_tier: Maximum tier (only queries if >= 3)

    Returns:
        List of dicts with document info for tier3-pending documents
    """
    if max_tier < 3:
        return []

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Build query for tier3-pending documents
            state_filter = "AND cia.state = %s" if state else ""
            params = [issue_types]
            if state:
                params.append(state.upper())

            cur.execute(f"""
                SELECT
                    cia.document_id,
                    cia.issue_type,
                    cia.tier2_classification,
                    cia.severity,
                    cia.needs_web_search,
                    cia.cites_federal_statute,
                    cia.claims_no_alternative,
                    cia.federal_mandate_suspected,
                    rd.citation
                FROM compliance_issue_analyses cia
                JOIN regulatory_documents rd ON cia.document_id = rd.id
                WHERE cia.highest_tier_completed = 2
                  AND cia.issue_type = ANY(%s)
                  {state_filter}
                  AND cia.tier2_classification IN ('burdensome', 'justified')
                ORDER BY cia.issue_type, cia.document_id
            """, params)

            results = []
            for row in cur.fetchall():
                analysis = {
                    "document_id": row[0],
                    "issue_type": row[1],
                    "tier2_classification": row[2],
                    "severity": row[3],
                    "needs_web_search": row[4],
                    "cites_federal_statute": row[5],
                    "claims_no_alternative": row[6],
                    "federal_mandate_suspected": row[7],
                    "citation": row[8],
                }
                # Only include if would escalate to tier 3
                if _would_escalate_to_tier3(analysis):
                    results.append(analysis)

            return results
    finally:
        conn.close()


def _simulate_resume(
    processing_units: list[ProcessingUnit],
    issue_types: list[str],
    max_tier: int,
    state: str | None = None,
    existing_analyses: dict[tuple[int, str], dict] | None = None,
) -> dict:
    """
    Simulate the resume logic without making API calls.

    Mirrors the logic in TierOrchestrator.run() lines 220-244 to show
    what would happen during an actual pipeline run.

    Args:
        processing_units: List of ProcessingUnits fetched for processing
        issue_types: List of issue types being processed
        max_tier: Maximum tier to run (1-3)
        state: State code for querying tier3-pending from DB (NJ or NY)
        existing_analyses: Pre-loaded analyses from fetch (avoids extra DB query)

    Returns:
        Dict with:
        - new: list of ProcessingUnits with no existing analysis
        - skipped: list of (ProcessingUnit, highest_tier) tuples
        - resumed: dict[tier] -> list of (ProcessingUnit, analysis) tuples
        - tier3_pending: list of (ProcessingUnit, analysis) tuples that would run web search
        - tier3_pending_from_db: list of dicts with tier3-pending docs not in fetch (legacy only)
    """
    if not processing_units:
        # If no processing units and no pre-loaded analyses, query for tier3_pending_from_db
        # This is legacy behavior - with new fetch, tier3-pending docs are in the main fetch
        if existing_analyses is None:
            tier3_pending_from_db = _query_tier3_pending_from_db(state, issue_types, max_tier)
        else:
            tier3_pending_from_db = []  # Already included in fetch
        return {"new": [], "skipped": [], "resumed": {}, "tier3_pending": [], "tier3_pending_from_db": tier3_pending_from_db}

    # Use pre-loaded analyses if provided, otherwise query
    if existing_analyses is not None:
        existing = existing_analyses
    else:
        doc_ids = [pu.document_id for pu in processing_units]
        existing = get_existing_analyses(doc_ids, issue_types=issue_types)

    new_units = []
    skipped_units = []
    resumed_units: dict[int, list] = {1: [], 2: []}  # tier -> [(unit, analysis)]
    tier3_pending = []

    for pu in processing_units:
        key = (pu.document_id, pu.issue_type)
        if key not in existing:
            # No existing analysis - this is a new unit
            new_units.append(pu)
        else:
            analysis = existing[key]
            highest_completed = analysis.get("highest_tier_completed", 0) or 0

            # Check if Tier 1 completed as all_false_positives - these are done
            tier1_classification = analysis.get("tier1_classification")
            if tier1_classification == "all_false_positives":
                # Tier 1 dismissed all matches - no further processing needed
                skipped_units.append((pu, 1))
                continue

            # Check if Tier 2 completed as unrelated - these are done (no Tier 3 needed)
            tier2_classification = analysis.get("tier2_classification")
            if highest_completed >= 2 and tier2_classification == "unrelated":
                # Tier 2 classified as unrelated - no further processing needed
                skipped_units.append((pu, 2))
                continue

            if highest_completed >= max_tier:
                # Skip: already processed to target tier
                skipped_units.append((pu, highest_completed))
            elif highest_completed > 0:
                # Resume: partial progress
                resumed_units[highest_completed].append((pu, analysis))

                # Check if this would go to Tier 3
                if highest_completed == 2 and max_tier >= 3:
                    # Check the routing logic for Tier 3 escalation
                    # We need to simulate what should_escalate_to_tier3 would do
                    # Since we don't have a full TrackedUnit, check the key conditions
                    needs_tier3 = _would_escalate_to_tier3(analysis)
                    if needs_tier3:
                        tier3_pending.append((pu, analysis))

    # Query for tier3-pending documents that weren't in the fetch
    # Only needed for legacy fetch that doesn't include partial progress
    # With new fetch_documents_with_continuation, tier3-pending docs are in main fetch
    if existing_analyses is None:
        tier3_pending_from_db = _query_tier3_pending_from_db(state, issue_types, max_tier)
    else:
        tier3_pending_from_db = []  # Already included in the fetch

    return {
        "new": new_units,
        "skipped": skipped_units,
        "resumed": resumed_units,
        "tier3_pending": tier3_pending,
        "tier3_pending_from_db": tier3_pending_from_db,
    }


def _would_escalate_to_tier3(analysis: dict) -> bool:
    """
    Check if an analysis would escalate to Tier 3 based on routing rules.

    Mirrors the logic in routing.should_escalate_to_tier3() but works
    with analysis dict instead of TrackedUnit.

    Args:
        analysis: Dict from get_existing_analyses()

    Returns:
        True if the analysis would trigger Tier 3 escalation
    """
    classification = analysis.get("tier2_classification")
    severity = analysis.get("severity") or 0
    needs_web_search = analysis.get("needs_web_search", False)
    cites_federal = analysis.get("cites_federal_statute", False)
    claims_no_alt = analysis.get("claims_no_alternative", False)
    federal_mandate_suspected = analysis.get("federal_mandate_suspected", False)

    # Tier 3 escalation triggers (from routing.py):
    # 1. needs_web_search flag is True
    if needs_web_search:
        return True

    # 2. Cites federal statute (unverified)
    if cites_federal:
        return True

    # 3. Claims no alternative with severity >= 7
    if claims_no_alt and severity >= 7:
        return True

    # 4. Burdensome with severity >= 8
    if classification == "burdensome" and severity >= 8:
        return True

    # 5. Federal mandate suspected
    if federal_mandate_suspected:
        return True

    return False


def _print_resume_simulation(simulation: dict, max_tier: int) -> None:
    """
    Print the resume simulation results in a clear format.

    Args:
        simulation: Dict returned by _simulate_resume()
        max_tier: Maximum tier to run (for context)
    """
    new_units = simulation["new"]
    skipped_units = simulation["skipped"]
    resumed_units = simulation["resumed"]
    tier3_pending = simulation["tier3_pending"]

    print(f"\n{'='*70}")
    print("RESUME SIMULATION")
    print(f"{'='*70}")

    # New documents
    print(f"\nNew documents (no existing analysis): {len(new_units)}")
    if new_units:
        by_issue: dict[str, int] = defaultdict(int)
        for pu in new_units:
            by_issue[pu.issue_type] += 1
        for issue_type, count in sorted(by_issue.items()):
            print(f"  - {issue_type}: {count}")

    # Skipped documents
    print(f"\nSkipped (already completed to tier {max_tier}+): {len(skipped_units)}")
    if skipped_units:
        by_issue_tier: dict[str, dict[int, int]] = defaultdict(lambda: defaultdict(int))
        for pu, tier in skipped_units:
            by_issue_tier[pu.issue_type][tier] += 1
        for issue_type, tiers in sorted(by_issue_tier.items()):
            tier_str = ", ".join(f"tier {t}: {c}" for t, c in sorted(tiers.items()))
            print(f"  - {issue_type}: {sum(tiers.values())} ({tier_str})")

    # Resumed documents
    total_resumed = sum(len(units) for units in resumed_units.values())
    print(f"\nResumed from partial progress: {total_resumed}")

    # Tier 1 complete units
    tier1_units = resumed_units.get(1, [])
    if tier1_units:
        print(f"  Tier 1 complete → run Tier 2+: {len(tier1_units)}")
        for pu, analysis in tier1_units[:5]:
            classification = analysis.get("tier1_classification", "?")
            print(f"    - {pu.citation} ({classification})")
        if len(tier1_units) > 5:
            print(f"    ... and {len(tier1_units) - 5} more")

    # Tier 2 complete units - split into those that need Tier 3 vs those that don't
    tier2_units = resumed_units.get(2, [])
    if tier2_units:
        needs_tier3 = [(pu, a) for pu, a in tier2_units if _would_escalate_to_tier3(a)]
        done_at_tier2 = [(pu, a) for pu, a in tier2_units if not _would_escalate_to_tier3(a)]

        print(f"  Tier 2 complete: {len(tier2_units)}")

        if needs_tier3 and max_tier >= 3:
            print(f"    → will run Tier 3: {len(needs_tier3)}")
            for pu, analysis in needs_tier3[:5]:
                classification = analysis.get("tier2_classification", "?")
                severity = analysis.get("severity", "?")
                print(f"      - {pu.citation} ({classification}, severity {severity})")
            if len(needs_tier3) > 5:
                print(f"      ... and {len(needs_tier3) - 5} more")

        if done_at_tier2:
            print(f"    → complete (no Tier 3 needed): {len(done_at_tier2)}")
            for pu, analysis in done_at_tier2[:3]:
                classification = analysis.get("tier2_classification", "?")
                print(f"      - {pu.citation} ({classification})")
            if len(done_at_tier2) > 3:
                print(f"      ... and {len(done_at_tier2) - 3} more")

    # Tier 3 pending (web search candidates) from current fetch
    if max_tier >= 3:
        print(f"\nWeb search (Tier 3) candidates from current fetch: {len(tier3_pending)}")
        if tier3_pending:
            for pu, analysis in tier3_pending[:10]:  # Show first 10
                classification = analysis.get("tier2_classification", "?")
                severity = analysis.get("severity", "?")
                needs_ws = analysis.get("needs_web_search", False)
                cites_fed = analysis.get("cites_federal_statute", False)
                reasons = []
                if needs_ws:
                    reasons.append("needs_web_search")
                if cites_fed:
                    reasons.append("cites_federal")
                if analysis.get("claims_no_alternative") and severity >= 7:
                    reasons.append("claims_no_alt")
                if classification == "burdensome" and severity >= 8:
                    reasons.append("high_severity")
                reason_str = ", ".join(reasons) if reasons else "routing rule"
                print(f"  - {pu.citation}: {classification}, severity {severity} [{reason_str}]")
            if len(tier3_pending) > 10:
                print(f"  ... and {len(tier3_pending) - 10} more")

        # Tier 3 pending from previous runs (not in current fetch)
        tier3_from_db = simulation.get("tier3_pending_from_db", [])
        if tier3_from_db:
            print(f"\nTier 3 PENDING from previous runs (not fetched above): {len(tier3_from_db)}")
            for analysis in tier3_from_db[:10]:
                citation = analysis.get("citation", "?")
                issue_type = analysis.get("issue_type", "?")
                classification = analysis.get("tier2_classification", "?")
                severity = analysis.get("severity", "?")
                needs_ws = analysis.get("needs_web_search", False)
                cites_fed = analysis.get("cites_federal_statute", False)
                reasons = []
                if needs_ws:
                    reasons.append("needs_web_search")
                if cites_fed:
                    reasons.append("cites_federal")
                if analysis.get("claims_no_alternative") and (severity or 0) >= 7:
                    reasons.append("claims_no_alt")
                if classification == "burdensome" and (severity or 0) >= 8:
                    reasons.append("high_severity")
                reason_str = ", ".join(reasons) if reasons else "routing rule"
                print(f"  - {citation} [{issue_type}]: {classification}, severity {severity} [{reason_str}]")
            if len(tier3_from_db) > 10:
                print(f"  ... and {len(tier3_from_db) - 10} more")

    print()


# ============================================================================
# BATCH PERSISTENCE HELPERS
# ============================================================================

def get_persistence() -> BatchPersistence:
    """Get the BatchPersistence instance for the pipeline."""
    batches_dir = Path(__file__).parent.parent.parent / ".pipeline_batches"
    return BatchPersistence(base_dir=batches_dir)


async def check_and_resume(
    persistence: BatchPersistence,
    state: str,
    issue_types: list[str],
    max_tier: int,
    batch_manager: BatchManager,
    title_filter: str | None = None,
) -> tuple[Path, list[dict]] | None:
    """
    Check for existing runs and attempt to resume.

    This function looks for an existing run with the same parameters that is
    either IN_PROGRESS or FAILED. If found, it polls the Anthropic API for
    any in-flight batches and returns the run directory and unit data.

    Args:
        persistence: BatchPersistence instance
        state: State code ('nj', 'ny', or 'dangerously-run-all')
        issue_types: List of issue types being processed
        max_tier: Maximum tier to run (1-3)
        batch_manager: BatchManager instance for API polling
        title_filter: Optional title filter (e.g., '3A' for Title 3A)

    Returns:
        Tuple of (run_dir, unit_data) if resumable run found, None otherwise
    """
    run_dir = persistence.find_matching_run(state, issue_types, max_tier, title_filter)
    if not run_dir:
        return None

    manifest = persistence.load_manifest(run_dir)
    if not manifest:
        return None

    print(f"\n{'='*70}")
    print("FOUND EXISTING RUN - CHECKING FOR RESUME")
    print(f"{'='*70}")
    print(f"Run directory: {run_dir.name}")
    print(f"Status: {manifest.status.value}")
    print(f"Current tier: {manifest.current_tier}")
    print(f"Units: {manifest.units_completed}/{manifest.total_units} completed")
    print()

    # Check for in-flight batches
    for tier in [1, 2]:
        batch_info = persistence.load_batch_info(run_dir, tier)
        if batch_info and batch_info.status in ("submitted", "in_progress"):
            print(f"Checking Tier {tier} batch: {batch_info.batch_id}...")
            try:
                status = batch_manager.get_batch_status(batch_info.batch_id)

                if status["status"] == "ended":
                    print(f"  ✓ Batch completed! Ready to process results.")
                    print(f"    Succeeded: {status.get('succeeded', 0)}, Errored: {status.get('errored', 0)}")
                    persistence.update_batch_info(
                        run_dir, tier,
                        status="ended",
                        succeeded=status.get("succeeded", 0),
                        errored=status.get("errored", 0),
                        expired=status.get("expired", 0),
                    )
                elif status["status"] == "in_progress":
                    processing = status.get("processing", 0)
                    succeeded = status.get("succeeded", 0)
                    total = status.get("total", 0)
                    print(f"  ⏳ Batch still running: {succeeded}/{total} completed ({processing} processing)")
                    print("    Resume will poll for completion.")
                else:
                    print(f"  Status: {status['status']}")

            except Exception as e:
                print(f"  ⚠️  Could not check batch status: {e}")

    print()
    return run_dir, persistence.load_units(run_dir)


# ============================================================================
# PIPELINE EXECUTION
# ============================================================================

# Note: Helper functions (_build_match_info, _build_processing_unit) and
# fetch functions (fetch_documents_for_rerun, fetch_tier3_pending_documents,
# fetch_unanalyzed_documents, fetch_all_issue_documents, get_issue_types_for_scope)
# have been moved to scripts.research_pipeline.db module.


async def _execute_pipeline(
    processing_units: list[ProcessingUnit],
    state: str | None,
    issue_type: str | None = None,
    issue_types: list[str] | None = None,
    max_tier: int = 2,
    realtime: bool = False,
    force_rerun: bool = False,
    max_docs_per_issue: int | str | None = None,
    global_docs_limit: int | str | None = None,
    enable_web_search: bool = False,
    title_filter: str | None = None,
) -> list:
    """Execute the pipeline with given processing units.

    Common execution logic extracted from run_test and run_batched_issues:
    - Creates batches directory
    - Instantiates TierOrchestrator
    - Runs the pipeline
    - Saves results to database

    Args:
        processing_units: Documents to process
        state: State code ('NJ', 'NY', or None for all states)
        issue_type: Single issue type (use this OR issue_types)
        issue_types: List of issue types (use this OR issue_type)
        max_tier: Maximum tier to run (1-3)
        realtime: Use realtime API instead of batch
        force_rerun: If True, re-analyze even if already processed
        max_docs_per_issue: Max docs per issue (for persistence manifest)
        global_docs_limit: Global docs limit (for persistence manifest)
        enable_web_search: If True, run Tier 3 web search verification when max_tier >= 3
        title_filter: Optional title filter (e.g., '3A' for Title 3A)

    Returns:
        List of TrackedUnit results
    """
    # Create batches directory
    batches_dir = Path(__file__).parent / "batches"
    batches_dir.mkdir(exist_ok=True)

    # For orchestrator, we need a valid state string
    # When state is None (dangerously-run-all), default to "NJ" for orchestrator
    # but the actual state filtering was already done in document fetching
    orchestrator_state = state if state else "NJ"

    # Normalize issue_types list
    all_issue_types = issue_types or ([issue_type] if issue_type else [])

    # Determine state for persistence (use original input, not orchestrator_state)
    persistence_state = state if state else "dangerously-run-all"

    # Set up batch persistence
    persistence = get_persistence()
    run_dir: Path | None = None

    # Check for resume (unless force_rerun)
    if not force_rerun and not realtime:
        # Create batch manager for API polling
        batch_manager = BatchManager(batches_dir=batches_dir)
        resume_result = await check_and_resume(
            persistence=persistence,
            state=persistence_state,
            issue_types=all_issue_types,
            max_tier=max_tier,
            batch_manager=batch_manager,
            title_filter=title_filter,
        )
        if resume_result:
            run_dir, _ = resume_result  # unit_data unused - resume via DB
            print(f"Resuming from run: {run_dir.name}")

    # Create new run if not resuming
    if run_dir is None and not realtime:
        run_dir = persistence.create_run(
            state=persistence_state,
            issue_types=all_issue_types,
            max_tier=max_tier,
            enable_web_search=enable_web_search,
            max_docs_per_issue=max_docs_per_issue or "all",
            global_docs_limit=global_docs_limit or "no-limit",
            title_filter=title_filter,
        )
        print(f"Created new run: {run_dir.name}")

    # Create orchestrator with appropriate issue type(s)
    orchestrator = TierOrchestrator(
        state=orchestrator_state,
        issue_type=issue_type,
        issue_types=issue_types,
        batches_dir=batches_dir,
        poll_interval=30,
        realtime=realtime,
        resume=not force_rerun,  # If force_rerun, don't resume/skip existing
        persistence=persistence if not realtime else None,
        run_dir=run_dir,
        title_filter=title_filter,
    )

    # Run the pipeline
    results = await orchestrator.run(
        processing_units=processing_units,
        max_tier=max_tier,
        enable_web_search=enable_web_search,
    )

    # Save final results to database (tier results already saved incrementally)
    print("\nSaving final classifications to database...")
    conn = get_db_connection()
    saved_count = save_final_results(results, conn)
    conn.close()
    print(f"Saved {saved_count} final classifications")

    return results


async def run_test(
    issue_type: str,
    max_docs_per_issue: int | None = None,
    max_tier: int = 2,
    state: str | None = None,
    realtime: bool = False,
    title: str | None = None,
    dry_run: bool = False,
    enable_web_search: bool = False,
    force_rerun: bool = False,
):
    """
    Run the research pipeline on unanalyzed documents.

    Args:
        issue_type: The compliance issue type to process
        max_docs_per_issue: Max documents to process (None = no limit)
        max_tier: Maximum tier to run (1-3)
        state: State code ('NJ', 'NY', or None for all states)
        realtime: Use realtime API instead of batch
        title: Optional filter by regulatory title
        dry_run: Preview without API calls
        enable_web_search: Enable Tier 3 web search
        force_rerun: Re-analyze documents even if already processed
    """

    # Default limit if not specified
    limit = max_docs_per_issue if max_docs_per_issue is not None else 999999

    print(f"\n{'='*70}")
    print(f"RESEARCH PIPELINE {'DRY RUN' if dry_run else 'TEST RUN'}")
    print(f"{'='*70}")
    print(f"Issue type: {issue_type}")
    print(f"State: {state if state else 'ALL STATES (dangerously-run-all)'}")
    if title:
        print(f"Title filter: {title}")
    print(f"Target docs: {max_docs_per_issue if max_docs_per_issue else 'all'}")
    print(f"Max tier: {max_tier}")
    print(f"Force rerun: {force_rerun}")
    if dry_run:
        print("Mode: DRY RUN (no LLM calls, no DB writes)")
    print()

    # Fetch documents (includes both new and needing continuation)
    print("Fetching documents requiring analysis (new or incomplete)...")
    processing_units, existing_analyses = fetch_documents_with_continuation(
        issue_type=issue_type,
        max_tier=max_tier,
        state=state,
        limit=limit,
        title=title,
    )

    if not processing_units:
        print("No documents to process!")
        return

    new_count = sum(1 for pu in processing_units if (pu.document_id, issue_type) not in existing_analyses)
    resume_count = len(processing_units) - new_count
    print(f"Found {len(processing_units)} documents ({new_count} new, {resume_count} resuming) with {sum(len(pu.matches) for pu in processing_units)} total matches")
    print()

    # Show sample
    print("Sample documents:")
    for pu in processing_units[:5]:
        print(f"  - {pu.citation}: {len(pu.matches)} matches")
        for m in pu.matches[:2]:
            print(f"      Match: '{m.matched_text[:40]}...' in '{m.surrounding_context[:50]}...'")

    if dry_run:
        # Simulate resume logic to show what would actually happen
        simulation = _simulate_resume(
            processing_units=processing_units,
            issue_types=[issue_type],
            max_tier=max_tier,
            state=state,
            existing_analyses=existing_analyses,
        )
        _print_resume_simulation(simulation, max_tier)

        tier3_from_db = simulation.get("tier3_pending_from_db", [])
        print(f"{'='*70}")
        print("DRY RUN COMPLETE")
        print(f"{'='*70}")
        print(f"Documents fetched: {len(processing_units)}")
        print(f"  - Would process: {len(simulation['new']) + sum(len(u) for u in simulation['resumed'].values())}")
        print(f"  - Would skip: {len(simulation['skipped'])}")
        if tier3_from_db:
            print(f"  - Tier 3 pending (from DB): {len(tier3_from_db)}")
        print(f"Total matches: {sum(len(pu.matches) for pu in processing_units)}")
        print(f"Max tier: {max_tier}")
        print(f"Estimated API mode: {'realtime' if realtime else 'batch'}")
        return

    # Execute pipeline
    print()
    results = await _execute_pipeline(
        processing_units=processing_units,
        state=state,
        issue_type=issue_type,
        max_tier=max_tier,
        realtime=realtime,
        force_rerun=force_rerun,
        max_docs_per_issue=max_docs_per_issue,
        global_docs_limit=None,  # Single issue type has no global limit
        enable_web_search=enable_web_search,
        title_filter=title,
    )

    # Print detailed results
    print(f"\n{'='*70}")
    print("DETAILED RESULTS")
    print(f"{'='*70}")

    for unit in results:
        print(f"\n{unit.unit.citation}:")
        print(f"  State: {unit.state.name}")

        if unit.tier1_output:
            t1 = unit.tier1_output
            print(f"  Tier 1: {t1.classification} (confidence: {t1.confidence})")
            if t1.dismissed_matches:
                print(f"    Dismissed: {len(t1.dismissed_matches)} matches")
                for dm in t1.dismissed_matches[:2]:
                    print(f"      - '{dm.text[:30]}...': {dm.reason[:50]}...")
            # Show context requests that will be fetched for Tier 2
            if t1.context_requests:
                print(f"    Context requests: {len(t1.context_requests)} items for Tier 2")
                for req in t1.context_requests[:3]:
                    print(f"      - {req.context_type}: {req.identifier} ({req.need_level})")

        if unit.tier2_output:
            t2 = unit.tier2_output
            print(f"  Tier 2: {t2.classification} (severity: {t2.severity})")
            print(f"    Reasoning: {t2.reasoning[:100]}...")

    return results


async def run_batched_issues(
    state: str | None,
    title: str | None,
    max_docs_per_issue: int | None,
    max_tier: int,
    realtime: bool,
    dry_run: bool,
    global_docs_limit: int | None = None,
    enable_web_search: bool = False,
    force_rerun: bool = False,
):
    """Run pipeline with all issue types batched together per tier."""
    issue_types = get_issue_types_for_scope(state, title)

    # Default limits if not specified
    docs_per_issue = max_docs_per_issue if max_docs_per_issue is not None else 999999

    print(f"\n{'='*70}")
    print(f"RUNNING ALL ISSUE TYPES (BATCHED)")
    print(f"{'='*70}")
    print(f"State: {state if state else 'ALL STATES (dangerously-run-all)'}")
    if title:
        print(f"Title: {title}")
    print(f"Issue types found: {len(issue_types)}")
    print(f"Issue types: {', '.join(issue_types[:10])}{'...' if len(issue_types) > 10 else ''}")
    print(f"Docs per issue type: {max_docs_per_issue if max_docs_per_issue else 'all'}")
    if global_docs_limit:
        print(f"Global limit: {global_docs_limit}")
    print(f"Force rerun: {force_rerun}")
    print()

    # Fetch all documents across all issue types (includes new and partial progress)
    print(f"Fetching documents requiring analysis (new or incomplete, target tier {max_tier})...")
    processing_units, existing_analyses = fetch_all_issue_documents(
        issue_types=issue_types,
        state=state,
        max_tier=max_tier,
        max_docs_per_issue=docs_per_issue,
        global_docs_limit=global_docs_limit,
        title=title,
    )

    if not processing_units:
        print("No documents to process!")
        return

    # Count by issue type
    by_issue: dict[str, int] = defaultdict(int)
    for pu in processing_units:
        by_issue[pu.issue_type] += 1

    # Count new vs resuming
    new_count = sum(1 for pu in processing_units if (pu.document_id, pu.issue_type) not in existing_analyses)
    resume_count = len(processing_units) - new_count
    print(f"Found {len(processing_units)} documents ({new_count} new, {resume_count} resuming) across {len(by_issue)} issue types")
    print("Distribution:")
    for issue_type, count in sorted(by_issue.items()):
        print(f"  {issue_type}: {count} docs")
    print()

    if dry_run:
        # Simulate resume logic to show what would actually happen
        simulation = _simulate_resume(
            processing_units=processing_units,
            issue_types=list(by_issue.keys()),
            max_tier=max_tier,
            state=state,
            existing_analyses=existing_analyses,
        )
        _print_resume_simulation(simulation, max_tier)

        tier3_from_db = simulation.get("tier3_pending_from_db", [])
        print(f"{'='*70}")
        print("DRY RUN COMPLETE")
        print(f"{'='*70}")
        print(f"Documents fetched: {len(processing_units)}")
        print(f"  - Would process: {len(simulation['new']) + sum(len(u) for u in simulation['resumed'].values())}")
        print(f"  - Would skip: {len(simulation['skipped'])}")
        if tier3_from_db:
            print(f"  - Tier 3 pending (from DB): {len(tier3_from_db)}")
        print(f"Total matches: {sum(len(pu.matches) for pu in processing_units)}")
        print(f"Max tier: {max_tier}")
        print(f"Issue types: {len(by_issue)}")
        print(f"Estimated API mode: {'realtime' if realtime else 'batch'}")
        return

    # Execute pipeline with all issue types
    results = await _execute_pipeline(
        processing_units=processing_units,
        state=state,
        issue_types=list(by_issue.keys()),
        max_tier=max_tier,
        realtime=realtime,
        force_rerun=force_rerun,
        max_docs_per_issue=max_docs_per_issue,
        global_docs_limit=global_docs_limit,
        enable_web_search=enable_web_search,
        title_filter=title,
    )

    return results


async def run_all_issues(
    state: str | None,
    title: str | None,
    max_docs_per_issue: int | None,
    max_tier: int,
    realtime: bool,
    dry_run: bool,
    global_docs_limit: int | None = None,
    enable_web_search: bool = False,
    force_rerun: bool = False,
):
    """Run pipeline for all issue types in scope.

    Batches all issue types together per tier for efficient processing.

    Args:
        state: State code ('NJ', 'NY', or None for all states)
        title: Optional filter by regulatory title
        max_docs_per_issue: Max documents per issue type (None = no limit)
        global_docs_limit: Max total documents (None = no limit)
        max_tier: Maximum tier to run (1-3)
        realtime: Use realtime API instead of batch
        dry_run: Preview without API calls
        enable_web_search: Enable Tier 3 web search
        force_rerun: Re-analyze documents even if already processed
    """
    await run_batched_issues(
        state=state,
        title=title,
        max_docs_per_issue=max_docs_per_issue,
        global_docs_limit=global_docs_limit,
        max_tier=max_tier,
        realtime=realtime,
        dry_run=dry_run,
        enable_web_search=enable_web_search,
        force_rerun=force_rerun,
    )


async def run_tier3_pending(
    issue_type: str,
    state: str = "NJ",
    num_docs: int = 20,
):
    """
    Run only Tier 3 on documents that completed Tier 2 but not Tier 3.

    Validates documents, loads their Tier 2 output, and runs Tier 3.
    This is used to resume failed or skipped Tier 3 processing.
    """
    from pathlib import Path

    # Fetch documents pending Tier 3
    processing_units, tier2_outputs = fetch_tier3_pending_documents(
        issue_type=issue_type,
        state=state,
        limit=num_docs,
    )

    if not processing_units:
        print("No documents pending Tier 3. Nothing to do.")
        return

    # Set up orchestrator
    batches_dir = Path(__file__).parent / "batches"
    batches_dir.mkdir(exist_ok=True)

    orchestrator = TierOrchestrator(
        state=state,
        batches_dir=batches_dir,
        issue_types=[issue_type],
        realtime=True,  # Tier 3 always uses real-time API
    )

    # Run Tier 3 only
    results = await orchestrator.run_tier3_only(
        processing_units=processing_units,
        tier2_outputs=tier2_outputs,
    )

    # Print detailed results
    print(f"\n{'='*70}")
    print("TIER 3 RESULTS")
    print(f"{'='*70}")

    for unit in results:
        print(f"\n{unit.unit.citation}:")
        print(f"  State: {unit.state.name}")

        if unit.tier3_output:
            t3 = unit.tier3_output
            print(f"  Tier 3: {t3.classification} (confidence: {t3.confidence:.2f})")
            print(f"    Final severity: {t3.final_severity}")
            print(f"    Web search summary: {t3.web_search_summary[:100]}..." if t3.web_search_summary else "    (no web summary)")
            if t3.federal_mandate_found:
                print(f"    Federal mandate: FOUND")
            if t3.evidence_gap:
                print(f"    Evidence gap: YES")
        elif unit.error_message:
            print(f"  ❌ Error: {unit.error_message}")

    # Save results
    from .db_writer import save_final_results
    conn = get_db_connection()
    saved = save_final_results(results, conn)
    conn.close()
    print(f"\nSaved {saved} results to database")

    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Run the 3-tier research pipeline for regulatory burden analysis",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
REQUIRED FLAG:
  --state                 State code: 'nj', 'ny', or 'dangerously-run-all'

FLAGS WITH DEFAULTS:
  --issue                 Single issue type (e.g., 'mail_only'). Default: all issues
  --all                   Run all 43 issue types. This is the default.
  --limit                 Max docs per issue type (default: 1000)
  --max-tier              1=filtering, 2=classification, 3=web search (default: 2)
  --web-search            Enable Tier 3 web search

OPTIONAL FLAGS:
  --realtime              Use realtime API (faster but 2x cost)
  --title                 Filter by regulatory title (e.g., '7' for Title 7)
  --dry-run               Preview without making API calls
  --force-rerun           Re-analyze documents with existing analyses
  --sequential            Process issue types one at a time

EXAMPLES:
  # Simplest usage - just specify state (uses all defaults)
  python3 -m scripts.research_pipeline.cli --state nj

  # Preview what would run
  python3 -m scripts.research_pipeline.cli --state nj --dry-run

  # Single issue type with limit
  python3 -m scripts.research_pipeline.cli --state nj --issue mail_only --limit 10

  # Full pipeline with Tier 3 web search
  python3 -m scripts.research_pipeline.cli --state nj --max-tier 3 --web-search

  # Process specific title
  python3 -m scripts.research_pipeline.cli --state nj --title 7

BATCH API TIMING:
  By default, ALL tiers use the Batch API for 50% cost savings.
  The Batch API can take up to 24 hours (typical: 10-40 min for <200 requests).
  Use --realtime for immediate processing (2x cost, no wait).

RESUME BEHAVIOR:
  The pipeline automatically saves state and resumes interrupted runs.
  Use --force-rerun to ignore previous runs and start fresh.
"""
    )

    # === REQUIRED FLAGS ===
    parser.add_argument(
        "--state",
        type=state_validator,
        required=True,
        help="State code: 'nj', 'ny', or 'dangerously-run-all' (skip state filtering)"
    )

    # === FLAGS WITH DEFAULTS ===
    # Issue type selection - defaults to --all if neither specified
    issue_group = parser.add_mutually_exclusive_group(required=False)
    issue_group.add_argument(
        "--issue",
        dest="issue_type",
        help="Single issue type to process (e.g., 'mail_only', 'wet_signature')"
    )
    issue_group.add_argument(
        "--all",
        dest="all_issues",
        action="store_true",
        help="Run all issue types. This is the default."
    )

    parser.add_argument(
        "--limit",
        dest="max_docs",
        type=positive_int_or_all,
        default=1000,
        metavar="N|all",
        help="Max documents to process per issue type (default: 1000)"
    )

    parser.add_argument(
        "--max-tier",
        type=int,
        choices=[1, 2, 3],
        default=2,
        help="Maximum tier: 1=filter, 2=classify, 3=web search (default: 2)"
    )

    parser.add_argument(
        "--web-search",
        dest="enable_web_search",
        action="store_true",
        help="Enable Tier 3 web search verification"
    )

    # === OPTIONAL FLAGS ===
    parser.add_argument(
        "--realtime",
        action="store_true",
        help="Use realtime API for ALL tiers (faster but 2x cost, no batch discount)"
    )
    parser.add_argument(
        "--title",
        help="Filter by NJAC/NYCRR title number (e.g., '7' for Title 7). "
             "Matches documents whose citation starts with 'N.J.A.C. 7:' or 'NYCRR Title 7'. "
             "Useful for processing the corpus incrementally by title."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be processed without making API calls or DB writes"
    )
    parser.add_argument(
        "--force-rerun",
        action="store_true",
        help="Re-analyze all matching documents regardless of existing analyses (upserts to DB)"
    )

    # === BATCH RECOVERY FLAGS ===
    parser.add_argument(
        "--resume-batch",
        metavar="BATCH_ID",
        help="Resume from an existing Anthropic batch ID (e.g., 'msgbatch_xxx'). "
             "Use this when a previous run's batch completed but DB save failed. "
             "Must be used with --resume-tier to specify which tier the batch was for."
    )
    parser.add_argument(
        "--resume-tier",
        type=int,
        choices=[1, 2, 3],
        help="Which tier the --resume-batch was for: 1=filtering, 2=classification, 3=web search. "
             "Required when using --resume-batch."
    )

    args = parser.parse_args()

    # Normalize state for DB queries
    # 'dangerously-run-all' means no state filter (None)
    # Otherwise, uppercase for DB compatibility
    state_for_db = None if args.state == 'dangerously-run-all' else args.state.upper()

    # Convert max_docs to int or None
    # 'all' means no limit (use a very large number)
    max_docs = None if args.max_docs == 'all' else args.max_docs

    # === BATCH RECOVERY MODE ===
    # If --resume-batch is specified, run batch recovery instead of normal pipeline
    if args.resume_batch:
        # Validate that --resume-tier is also provided
        if not args.resume_tier:
            parser.error("--resume-batch requires --resume-tier to specify which tier the batch was for")

        print(f"\n*** BATCH RECOVERY MODE ***")
        print(f"Resuming from batch: {args.resume_batch}")
        print(f"Tier: {args.resume_tier}")

        try:
            result = resume_from_batch(
                batch_id=args.resume_batch,
                tier=args.resume_tier,
                state=args.state.upper(),  # State for DB (uppercase, e.g., 'NJ')
                continue_pipeline=False,  # Continuation handled by falling through to normal pipeline
                max_tier=args.max_tier,
                enable_web_search=args.enable_web_search,
            )

            # If recovery had failures, exit
            if result['failed'] > 0:
                print(f"\nRecovery had {result['failed']} parse failures, not continuing pipeline")
                sys.exit(1)

            # Success - fall through to normal pipeline execution
            # The pipeline will pick up Tier 2/3 pending documents from DB
            print(f"\nBatch recovery successful! Continuing pipeline to max-tier {args.max_tier}...")

        except Exception as e:
            print(f"\nBatch recovery failed: {e}")
            sys.exit(1)

    # === NORMAL PIPELINE MODE ===
    # Default to all_issues if neither --issue nor --all specified
    run_all = args.all_issues or args.issue_type is None

    if run_all:
        asyncio.run(run_all_issues(
            state=state_for_db,
            title=args.title,
            max_docs_per_issue=max_docs,
            max_tier=args.max_tier,
            realtime=args.realtime,
            dry_run=args.dry_run,
            enable_web_search=args.enable_web_search,
            force_rerun=args.force_rerun,
        ))
    else:
        asyncio.run(run_test(
            issue_type=args.issue_type,
            max_docs_per_issue=max_docs,
            max_tier=args.max_tier,
            state=state_for_db,
            realtime=args.realtime,
            title=args.title,
            dry_run=args.dry_run,
            enable_web_search=args.enable_web_search,
            force_rerun=args.force_rerun,
        ))
