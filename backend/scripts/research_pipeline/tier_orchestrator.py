"""
Tier orchestrator for the research pipeline.

V5: Main orchestration engine that coordinates the 3-tier pipeline:
- State management for each ProcessingUnit
- Batch submission (Tiers 1-2) and real-time API (Tier 3)
- Tier transitions based on classification
- Progress reporting with ETA
- Cost tracking

Tier 3 is the web search tier (V5: merged from old Tier 4).
"""

import asyncio
import time
from collections import defaultdict
from datetime import datetime
from functools import partial
from pathlib import Path
from typing import Callable, Optional, Type
from pydantic import BaseModel

from .state_machine import (
    ProcessingState,
    TrackedUnit,
    get_next_state,
    is_terminal_state,
)
from .cost_tracker import CostTracker, format_time
from .result_processor import (
    process_tier1_results,
    process_tier2_results,
    process_tier3_results,
    compute_final_classification,
)
from .models.llm_outputs import Tier1Output, Tier2Output, Tier3Output
from .tier_runners import (
    prepare_tier1_batch,
    prepare_tier2_batch,
    prepare_tier3_batch,  # V5.2: Tier 3 batch preparation
    run_tier3_realtime,  # V5: Tier 3 real-time mode (with --realtime flag)
    run_tier2_with_reruns,  # V5: Tier 2 with re-run support
)
from .result_processor import process_tier3_batch_results  # V5.2: Tier 3 batch result processing
from .db_writer import (
    get_existing_analyses,
    get_db_connection,
    save_tier1_results,
    save_tier2_results,
    save_tier3_results,
)
from .db.connection import check_db_health, FailedUnitTracker
from .prompt_loader import load_issue_config, IssueConfig
from .config import TIER3_BATCH_SIZE, MAX_BATCH_POLL_TIME
from .models.matches import ProcessingUnit
from .context_builder import group_for_cache_efficiency
from .ids import make_custom_id
from .pipeline_logger import DualOutput

# Import from shared_utils
import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from shared_utils import BatchManager, DEFAULT_MODEL

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
except ImportError:
    LANGFUSE_AVAILABLE = False


class TierOrchestrator:
    """
    V5: Orchestrates the 3-tier research pipeline.

    Tiers:
    - Tier 1: Match Filtering (batch API)
    - Tier 2: Summary-Based Research (batch or real-time with re-runs)
    - Tier 3: Web Search Verification (real-time API)

    Usage:
        # Single issue type
        orchestrator = TierOrchestrator(
            state="NJ",
            issue_type="mail_only",
            batches_dir=Path("./batches"),
        )

        # Multiple issue types (batched together)
        orchestrator = TierOrchestrator(
            state="NJ",
            issue_types=["mail_only", "wet_signature", "in_person_appearance"],
            batches_dir=Path("./batches"),
        )
        results = await orchestrator.run(processing_units)
    """

    def __init__(
        self,
        state: str,
        batches_dir: Path,
        issue_type: Optional[str] = None,
        issue_types: Optional[list[str]] = None,
        poll_interval: int = 60,
        max_retries: int = 3,
        run_id: Optional[str] = None,
        realtime: bool = False,
        resume: bool = True,
        model: Optional[str] = None,
        incremental_save: bool = True,
        tier2_reruns: bool = False,  # V5: Enable Tier 2 re-run mechanics
        title_filter: Optional[str] = None,
    ):
        """
        Initialize the orchestrator.

        Args:
            state: State code (NJ or NY)
            batches_dir: Directory for batch metadata
            issue_type: Single issue type key (deprecated, use issue_types)
            issue_types: List of issue type keys to process together
            poll_interval: Seconds between batch status checks
            max_retries: Max retries for failed requests
            run_id: Optional run identifier (generated if not provided)
            realtime: If True, use real-time API instead of batch (for testing)
            resume: If True, skip documents already processed to target tier
            model: Optional model override (default: DEFAULT_MODEL)
            incremental_save: If True, save results to DB after each tier completes
            tier2_reruns: If True, run Tier 2 with re-run mechanics (real-time API)
            title_filter: Optional title filter (e.g., '3A' for Title 3A)
        """
        self.state = state
        self.batches_dir = batches_dir
        self.poll_interval = poll_interval
        self.max_retries = max_retries
        self.run_id = run_id or datetime.now().strftime("%Y%m%d_%H%M%S")
        self.realtime = realtime
        self.resume = resume
        self.model = model or DEFAULT_MODEL  # For Langfuse logging
        self.incremental_save = incremental_save
        self.tier2_reruns = tier2_reruns  # V5: Tier 2 re-run mechanics
        self.title_filter = title_filter

        # DualOutput helper (prints to console)
        self.out = DualOutput(logger=None, tier=None)

        # Normalize issue_type(s) to list
        if issue_types:
            self.issue_types = issue_types
        elif issue_type:
            self.issue_types = [issue_type]
        else:
            raise ValueError("Either issue_type or issue_types must be provided")

        # For backward compatibility
        self.issue_type = self.issue_types[0] if len(self.issue_types) == 1 else None

        # Load all issue configs upfront
        self.issue_configs: dict[str, IssueConfig] = {
            itype: load_issue_config(itype) for itype in self.issue_types
        }

        # For backward compatibility with single issue_type code paths
        self.issue_config = self.issue_configs[self.issue_types[0]] if len(self.issue_types) == 1 else None

        # Batch manager
        self.batch_manager = BatchManager(batches_dir=batches_dir)

        # Cost tracker
        self.cost_tracker = CostTracker(run_id=self.run_id)

        # Processing state
        self.units: dict[str, TrackedUnit] = {}  # custom_id -> TrackedUnit
        self.active_batches: dict[str, list[str]] = {}  # batch_id -> [custom_ids]

        # Langfuse observability context
        self.trace_context: Optional["LLMTraceContext"] = None
        self.batch_trace_ids: dict[str, str] = {}  # batch_id -> trace_id

        # Context cache: reuse subchapter context across issue types (major optimization)
        # Key: subchapter_id, Value: formatted context vars dict
        self._subchapter_context_cache: dict[int, dict[str, str]] = {}

    def _tier_out(self, tier: int) -> DualOutput:
        """Get a DualOutput helper for a specific tier."""
        return DualOutput(logger=None, tier=tier)

    async def run(
        self,
        processing_units: list[ProcessingUnit],
        max_tier: int = 3,
        enable_web_search: bool = False,
    ) -> list[TrackedUnit]:
        """
        Run the full pipeline.

        V5: 3-tier pipeline where Tier 3 is the web search tier.

        Args:
            processing_units: List of ProcessingUnits to process
            max_tier: Maximum tier to run (1-3)
            enable_web_search: If True, run Tier 3 web search verification when max_tier >= 3

        Returns:
            List of TrackedUnits with all tier outputs
        """
        # Initialize tracked units
        for pu in processing_units:
            tracked = TrackedUnit(unit=pu, state=ProcessingState.PENDING)
            self.units[tracked.custom_id] = tracked

        # Resume: check for existing analyses and skip already-processed units
        skipped_count = 0
        skipped_by_type: dict[str, int] = {}  # Track skipped counts per issue type
        hydrated_count = 0
        hydrated_by_tier: dict[int, int] = {}  # Track hydration by tier
        if self.resume:
            doc_ids = [pu.document_id for pu in processing_units]
            existing = get_existing_analyses(doc_ids, issue_types=self.issue_types)

            units_to_remove = []
            for custom_id, unit in self.units.items():
                # Key by (document_id, issue_type) tuple for multi-issue support
                key = (unit.unit.document_id, unit.unit.issue_type)
                if key in existing:
                    analysis = existing[key]
                    highest_completed = analysis.get("highest_tier_completed", 0) or 0

                    # Skip if already processed to target tier
                    if highest_completed >= max_tier:
                        units_to_remove.append(custom_id)
                        skipped_count += 1
                        # Track by issue type
                        issue_type = unit.unit.issue_type
                        skipped_by_type[issue_type] = skipped_by_type.get(issue_type, 0) + 1
                    elif highest_completed > 0:
                        # Partial progress: hydrate existing tier outputs
                        self._hydrate_unit_from_analysis(unit, analysis, highest_completed)
                        hydrated_count += 1
                        hydrated_by_tier[highest_completed] = hydrated_by_tier.get(highest_completed, 0) + 1

            for custom_id in units_to_remove:
                del self.units[custom_id]

        # Sort for cache efficiency
        self._sort_for_cache_efficiency()

        # Initialize Langfuse trace context
        if LANGFUSE_AVAILABLE:
            date_str = datetime.now().strftime("%Y-%m-%d")
            self.trace_context = LLMTraceContext(
                run_id=self.run_id,
                session_name=f"research_{self.state}_{self.issue_type}_{date_str}",
                stage="pipeline_start",
                state=self.state,
                issue_type=self.issue_type,
                extra={
                    "max_tier": max_tier,
                    "realtime_mode": self.realtime,
                    "unit_count": len(self.units),
                },
            )

        # Build title label
        title_label = f"Title {self.title_filter}" if self.title_filter else "All Titles"
        issue_label = self.issue_type if self.issue_type else f"{len(self.issue_types)} issue types"

        self.out.info(f"\n{'='*70}")
        self.out.info(f"RESEARCH PIPELINE: {self.state} / {title_label} / {issue_label}")
        self.out.info(f"{'='*70}")
        self.out.info(f"Processing units: {len(self.units)}")
        if skipped_count > 0:
            self.out.info(f"  Resuming: Skipped {skipped_count} already processed to tier {max_tier}+")
            for issue_type, count in sorted(skipped_by_type.items()):
                self.out.info(f"    - {issue_type}: {count} skipped")
        if hydrated_count > 0:
            self.out.info(f"  Resuming: Hydrated {hydrated_count} units with partial tier progress")
            for tier_num, count in sorted(hydrated_by_tier.items()):
                self.out.info(f"    - Tier {tier_num} complete: {count} units (will continue from Tier {tier_num + 1})")
        self.out.info(f"Max tier: {max_tier}")
        self.out.info(f"Run ID: {self.run_id}")
        self.out.info(f"Mode: {'REALTIME (no batch)' if self.realtime else 'BATCH API'}")
        self.out.info("")

        # Run each tier (with health check before each)
        if not self._check_db_health_with_retry("Tier 1"):
            return list(self.units.values())  # Early exit if DB unavailable
        await self._run_tier1()

        if max_tier >= 2:
            if not self._check_db_health_with_retry("Tier 2"):
                return list(self.units.values())  # Early exit if DB unavailable
            await self._run_tier2()

        if max_tier >= 3 and enable_web_search:
            if not self._check_db_health_with_retry("Tier 3"):
                return list(self.units.values())  # Early exit if DB unavailable
            await self._run_tier3()
        elif not enable_web_search:
            # Finalize any units that were routed to Tier 3 but web search was skipped
            # Their Tier 2 classification becomes final
            tier3_pending = [
                u for u in self.units.values()
                if u.state == ProcessingState.TIER3_PENDING
            ]
            if tier3_pending:
                self.out.info(f"\n  Finalizing {len(tier3_pending)} units (Tier 3 skipped)")
                for unit in tier3_pending:
                    unit.state = ProcessingState.DONE

        # Mark complete
        self.cost_tracker.mark_complete()

        # Print final summary
        self._print_summary()

        # Flush Langfuse to ensure all events are sent
        if LANGFUSE_AVAILABLE:
            flush_langfuse()

        return list(self.units.values())

    async def run_tier3_only(
        self,
        processing_units: list,
        tier2_outputs: dict,
    ) -> list:
        """
        Run ONLY Tier 3 on units that already have Tier 2 output.

        This method is used by --run-pending-tier3 to resume failed/skipped Tier 3.
        Units are hydrated with pre-loaded Tier 2 output from the database.

        Args:
            processing_units: List of ProcessingUnit objects
            tier2_outputs: Dict mapping custom_id to Tier2Output

        Returns:
            List of TrackedUnit with tier3_output populated
        """
        from .state_machine import TrackedUnit, ProcessingState

        self.out.info(f"\n{'='*70}")
        self.out.info("TIER 3 ONLY MODE")
        self.out.info(f"{'='*70}")
        self.out.info(f"State: {self.state}")
        self.out.info(f"Issue types: {', '.join(self.issue_types)}")
        self.out.info(f"Units to process: {len(processing_units)}")
        self.out.info("")

        # Initialize units from processing_units
        for pu in processing_units:
            custom_id = make_custom_id(pu.document_id, pu.issue_type)
            tracked = TrackedUnit(unit=pu, state=ProcessingState.PENDING)
            self.units[custom_id] = tracked

        # Hydrate units with Tier 2 output and set state to TIER3_PENDING
        hydrated = 0
        skipped = 0
        for custom_id, unit in self.units.items():
            if custom_id in tier2_outputs:
                unit.tier2_output = tier2_outputs[custom_id]
                unit.state = ProcessingState.TIER3_PENDING
                hydrated += 1
                self.out.info(f"  ✓ Hydrated {custom_id}: {unit.tier2_output.classification}")
            else:
                self.out.warning(f"  ⚠️  No Tier 2 output for {custom_id}, skipping")
                unit.state = ProcessingState.ERROR
                unit.error_message = "No Tier 2 output found"
                skipped += 1

        self.out.info("")
        self.out.info(f"Hydrated: {hydrated}, Skipped: {skipped}")
        self.out.info("")

        if hydrated == 0:
            self.out.info("No units to process - all skipped")
            return list(self.units.values())

        # Run only Tier 3
        await self._run_tier3()

        # Mark complete
        self.cost_tracker.mark_complete()

        # Print final summary
        self._print_summary()

        # Flush Langfuse
        if LANGFUSE_AVAILABLE:
            flush_langfuse()

        return list(self.units.values())

    async def _run_tier_batch(
        self,
        tier_num: int,
        pending_state: ProcessingState,
        prepare_fn: Callable[[list[TrackedUnit], IssueConfig], list[dict]],
        process_fn: Callable,
        output_class: Type[BaseModel],
        output_attr: str,
        submitted_state: ProcessingState,
        complete_state: ProcessingState,
        batch_id_attr: str,
        completed_at_attr: str,
    ) -> None:
        """
        Generic tier execution - handles grouping, batching, state transitions.

        This is the core abstraction that reduces duplication across Tiers 1-3.
        Each tier has the same structure:
        1. Filter pending units by state
        2. Group by issue_type
        3. Prepare requests per group
        4. Submit batch or run realtime
        5. Process results
        6. Transition states

        Args:
            tier_num: Tier number (1, 2, or 3)
            pending_state: State to filter units by (e.g., ProcessingState.PENDING)
            prepare_fn: Function to prepare batch requests (e.g., prepare_tier1_batch)
            process_fn: Function to process results (e.g., process_tier1_results)
            output_class: Pydantic model class (e.g., Tier1Output)
            output_attr: Attribute name on unit (e.g., "tier1_output")
            submitted_state: State after batch submission (e.g., TIER1_SUBMITTED)
            complete_state: State after completion (e.g., TIER1_COMPLETE)
            batch_id_attr: Attribute name for batch ID (e.g., "tier1_batch_id")
            completed_at_attr: Attribute name for timestamp (e.g., "tier1_completed_at")
        """
        tier_name = f"Tier {tier_num}"
        batch_key = f"tier{tier_num}"
        tier_out = self._tier_out(tier_num)

        # Filter pending units
        pending = [
            u for u in self.units.values()
            if u.state == pending_state
        ]

        if not pending:
            tier_out.info(f"\n[{tier_name.upper()}] No units need {tier_name} processing (all resumed)")
            return

        # Tier-specific display names
        tier_labels = {
            1: "Match Filtering",
            2: "Summary-Based Research",
            3: "Full Context Deep Dive",
        }
        display_name = tier_labels.get(tier_num, tier_name)
        tier_out.info(f"\n[{tier_name.upper()}] {display_name} ({len(pending)} units)")
        tier_out.info("-" * 50)

        # Group by issue_type and prepare requests per group
        by_issue: dict[str, list[TrackedUnit]] = defaultdict(list)
        for unit in pending:
            by_issue[unit.issue_type].append(unit)

        # Prepare requests for each issue type, combine into single batch
        requests = []
        issue_list = list(by_issue.items())
        for i, (issue_type, units_for_issue) in enumerate(issue_list):
            tier_out.progress(f"  Preparing {issue_type} ({i+1}/{len(issue_list)})...", end="\r")
            config = self.issue_configs[issue_type]
            issue_requests = prepare_fn(units_for_issue, config)
            requests.extend(issue_requests)

        tier_out.info(f"  Prepared {len(requests)} requests across {len(by_issue)} issue types" + " " * 20)  # Clear \r residue

        batch_id: Optional[str] = None

        if not self.realtime:
            tier_out.info("")
            tier_out.info(f"  >>> SUBMITTING BATCH TO API...")
            tier_out.info(f"  >>> (Batch API can take up to 24 hours - typically 10-40 min for <200 requests)")

        if self.realtime:
            # Run in realtime mode
            succeeded, failed = await self._run_realtime(
                requests=requests,
                units=pending,
                output_class=output_class,
                output_attr=output_attr,
                tier_name=tier_name,
            )
        else:
            # Submit batch
            batch_id = self._submit_batch(requests, batch_key)
            self.active_batches[batch_id] = [u.custom_id for u in pending]

            # Update states and batch IDs
            for unit in pending:
                setattr(unit, batch_id_attr, batch_id)
                unit.state = submitted_state

            # Poll until complete
            await self._poll_batch(batch_id)

            # Process results (includes Langfuse logging for each result)
            succeeded, failed = process_fn(
                batch_id=batch_id,
                units=self.units,
                manager=self.batch_manager,
                cost_tracker=self.cost_tracker,
                trace_context=self.trace_context if LANGFUSE_AVAILABLE else None,
            )

        # Transition states
        for unit in succeeded:
            # Set to complete state so get_next_state works correctly
            unit.state = complete_state
            setattr(unit, completed_at_attr, datetime.now())
            unit.state = get_next_state(unit)

        self._log_tier_complete(tier_name, len(succeeded), len(failed), batch_id=batch_id)

    async def _run_tier1(self):
        """Run Tier 1: Match Filtering."""
        # Use partial to bind the subchapter context cache to prepare_tier1_batch
        # This enables cross-issue-type caching of subchapter context (major optimization)
        prepare_fn_with_cache = partial(
            prepare_tier1_batch,
            context_cache=self._subchapter_context_cache,
        )

        await self._run_tier_batch(
            tier_num=1,
            pending_state=ProcessingState.PENDING,
            prepare_fn=prepare_fn_with_cache,
            process_fn=process_tier1_results,
            output_class=Tier1Output,
            output_attr="tier1_output",
            submitted_state=ProcessingState.TIER1_SUBMITTED,
            complete_state=ProcessingState.TIER1_COMPLETE,
            batch_id_attr="tier1_batch_id",
            completed_at_attr="tier1_completed_at",
        )

        # Incremental save: persist Tier 1 results to database
        if self.incremental_save:
            tier1_units = [u for u in self.units.values() if u.tier1_output]
            if tier1_units:
                conn = get_db_connection()
                saved = save_tier1_results(tier1_units, conn)
                conn.close()
                self._tier_out(1).info(f"  Saved {saved} Tier 1 results to database")

    async def _run_tier2(self):
        """Run Tier 2: Summary-Based Research."""
        # V5: Check if re-run mechanics are enabled
        if self.tier2_reruns:
            await self._run_tier2_with_reruns()
        else:
            await self._run_tier_batch(
                tier_num=2,
                pending_state=ProcessingState.TIER2_PENDING,
                prepare_fn=prepare_tier2_batch,
                process_fn=process_tier2_results,
                output_class=Tier2Output,
                output_attr="tier2_output",
                submitted_state=ProcessingState.TIER2_SUBMITTED,
                complete_state=ProcessingState.TIER2_COMPLETE,
                batch_id_attr="tier2_batch_id",
                completed_at_attr="tier2_completed_at",
            )

        # Incremental save: persist Tier 2 results to database
        if self.incremental_save:
            tier2_units = [u for u in self.units.values() if u.tier2_output]
            if tier2_units:
                conn = get_db_connection()
                saved = save_tier2_results(tier2_units, conn)
                conn.close()
                self._tier_out(2).info(f"  Saved {saved} Tier 2 results to database")

    async def _run_tier2_with_reruns(self):
        """
        V5: Run Tier 2 using real-time API with re-run support.

        Uses run_tier2_with_reruns() which:
        - Calls LLM in real-time (not batch)
        - If classification is "needs_full_context", fetches context and re-runs
        - Maximum 2 re-runs (3 total attempts)
        - Forces classification on 3rd attempt

        STATE MANAGEMENT: The tier runner only sets intermediate states and
        populates outputs/errors. This orchestrator method handles all terminal
        state transitions based on the results.
        """
        pending = [
            u for u in self.units.values()
            if u.state == ProcessingState.TIER2_PENDING
        ]

        tier_out = self._tier_out(2)

        if not pending:
            tier_out.info("\n[TIER 2] No units need Tier 2 processing")
            return

        tier_out.info(f"\n[TIER 2] Summary-Based Research with Re-runs ({len(pending)} units)")
        tier_out.info("-" * 50)
        tier_out.info("  (Using real-time API with re-run support)")

        # Run with re-runs (does NOT set terminal states)
        await run_tier2_with_reruns(
            units=pending,
            issue_configs=self.issue_configs,
            cost_tracker=self.cost_tracker,
            trace_context=self.trace_context,
        )

        # Orchestrator handles all state transitions
        succeeded = []
        failed = []
        for unit in pending:
            if unit.tier2_output is not None:
                # Success: set complete state, then transition to next state
                unit.state = ProcessingState.TIER2_COMPLETE
                unit.state = get_next_state(unit)
                succeeded.append(unit)
            elif unit.error_message:
                # Error: transition to ERROR state
                unit.state = ProcessingState.ERROR
                failed.append(unit)
            # Units still in TIER2_RERUNNING without output or error stay pending

        # Count re-runs
        reruns = sum(u.tier2_rerun_count for u in succeeded)
        units_with_reruns = sum(1 for u in succeeded if u.tier2_rerun_count > 0)
        forced = sum(1 for u in succeeded if u.tier2_forced_classification)

        self._log_tier_complete("Tier 2", len(succeeded), len(failed))
        if reruns > 0:
            tier_out.info(f"\n  {'*'*60}")
            tier_out.info(f"  TIER 2 RE-RUN SUMMARY")
            tier_out.info(f"  Total re-runs: {reruns} across {units_with_reruns} units")
            tier_out.info(f"  Units with 1 re-run: {sum(1 for u in succeeded if u.tier2_rerun_count == 1)}")
            tier_out.info(f"  Units with 2 re-runs: {sum(1 for u in succeeded if u.tier2_rerun_count == 2)}")
            tier_out.info(f"  {'*'*60}\n")
        if forced > 0:
            tier_out.info(f"    Forced classifications: {forced}")

    async def _run_tier3(self):
        """
        V5.2: Run Tier 3: Web Search Verification.

        By default uses Batch API (like Tiers 1-2) for cost savings.
        When self.realtime is True, uses real-time API with rate limiting.

        STATE MANAGEMENT: The tier runner only sets intermediate states
        and populates outputs/errors. This orchestrator method handles
        all terminal state transitions based on the results.
        """
        tier_out = self._tier_out(3)

        pending = [
            u for u in self.units.values()
            if u.state == ProcessingState.TIER3_PENDING
        ]
        if not pending:
            tier_out.info("\n[TIER 3] No units need web search verification")
            return

        tier_out.info(f"\n[TIER 3] Web Search Verification ({len(pending)} units)")
        tier_out.info("-" * 50)

        if self.realtime:
            # Real-time mode: sequential with rate limiting
            await self._run_tier3_realtime(pending)
        else:
            # Batch mode: submit and poll (default)
            await self._run_tier3_batch(pending)

    async def _run_tier3_realtime(self, pending: list[TrackedUnit]):
        """
        V5.2: Run Tier 3 using real-time API with rate limiting.

        Used when --realtime flag is passed. Processes units sequentially
        with rate limiting between requests.
        """
        tier_out = self._tier_out(3)
        tier_out.info("  (Using REAL-TIME API with web search)")

        # Run in batches to avoid rate limits
        completed = 0

        for i in range(0, len(pending), TIER3_BATCH_SIZE):
            batch = pending[i:i + TIER3_BATCH_SIZE]
            await run_tier3_realtime(
                batch,
                self.issue_configs,  # Pass dict of all issue configs
                cost_tracker=self.cost_tracker,
                trace_context=self.trace_context,
                state=self.state,  # Pass state for web search localization
            )

            # Progress update
            completed = min(i + TIER3_BATCH_SIZE, len(pending))
            tier_out.info(f"  Progress: {completed}/{len(pending)}")

        # Orchestrator handles all state transitions
        succeeded = []
        failed = []
        for unit in pending:
            if unit.tier3_output is not None:
                # Success: set complete state, then transition to DONE
                unit.state = ProcessingState.TIER3_COMPLETE
                unit.state = get_next_state(unit)  # Returns DONE for Tier 3
                succeeded.append(unit)
            elif unit.error_message:
                # Error: transition to ERROR state
                unit.state = ProcessingState.ERROR
                failed.append(unit)
            # Units still in TIER3_PROCESSING without output or error stay pending

        self._log_tier_complete("Tier 3 (realtime)", len(succeeded), len(failed))
        self._save_tier3_results(succeeded, tier_out)

    async def _run_tier3_batch(self, pending: list[TrackedUnit]):
        """
        V5.2: Run Tier 3 using Batch API.

        Default mode. Submits all requests as a batch, polls for completion,
        then processes results. Provides 50% cost savings on token costs.
        """
        tier_out = self._tier_out(3)
        tier_out.info("  (Using BATCH API with web search - 50% cost savings)")

        # Prepare batch requests
        requests = prepare_tier3_batch(
            units=pending,
            issue_configs=self.issue_configs,
            state=self.state,
        )

        if not requests:
            tier_out.info("  No valid requests to submit")
            return

        # Submit batch
        batch_id = self._submit_batch(requests, "tier3")

        # Update states and batch IDs
        for unit in pending:
            unit.tier3_batch_id = batch_id
            unit.state = ProcessingState.TIER3_SUBMITTED

        # Poll until complete
        await self._poll_batch(batch_id)

        # Process results
        succeeded, failed = process_tier3_batch_results(
            batch_id=batch_id,
            units=self.units,
            manager=self.batch_manager,
            cost_tracker=self.cost_tracker,
            trace_context=self.trace_context,
        )

        # Transition successful units to DONE
        for unit in succeeded:
            unit.state = get_next_state(unit)  # Returns DONE for Tier 3

        self._log_tier_complete("Tier 3 (batch)", len(succeeded), len(failed))
        self._save_tier3_results(succeeded, tier_out)

    def _save_tier3_results(self, succeeded: list[TrackedUnit], tier_out):
        """Save Tier 3 results to database."""
        if self.incremental_save:
            tier3_units = [u for u in self.units.values() if u.tier3_output]
            if tier3_units:
                conn = get_db_connection()
                saved = save_tier3_results(tier3_units, conn)
                conn.close()
                tier_out.info(f"  Saved {saved} Tier 3 results to database")

    def _submit_batch(self, requests: list[dict], tier_name: str) -> str:
        """Submit a batch and return batch ID."""
        # For multi-issue batches, use "multi" in the name
        issue_label = self.issue_type if self.issue_type else "multi"
        batch_id = self.batch_manager.submit_batch(
            requests=requests,
            batch_name=f"{self.state}_{issue_label}_{tier_name}_{self.run_id}",
            metadata={
                "state": self.state,
                "issue_types": self.issue_types,
                "tier": tier_name,
                "run_id": self.run_id,
            },
        )

        # Extract tier number from tier_name (e.g., "tier1" -> 1)
        tier_num = int(tier_name[-1]) if tier_name[-1].isdigit() else 0
        tier_out = self._tier_out(tier_num) if tier_num else self.out
        tier_out.info(f"  >>> BATCH SUBMITTED: {batch_id}")
        tier_out.info(f"  >>> Requests: {len(requests)}")

        # Log to Langfuse
        if LANGFUSE_AVAILABLE and self.trace_context:
            self.trace_context.stage = tier_name
            trace_id = log_batch_submission(
                context=self.trace_context,
                batch_id=batch_id,
                batch_name=f"{self.state}_{self.issue_type}_{tier_name}",
                request_count=len(requests),
            )
            if trace_id:
                self.batch_trace_ids[batch_id] = trace_id

        return batch_id

    async def _poll_batch(self, batch_id: str):
        """
        Poll batch until complete with progress reporting.

        Includes timeout and retry logic for robustness:
        - 48 hour maximum poll time (Anthropic batch API guarantees 24h)
        - Retry with exponential backoff on API errors
        """
        start_time = time.time()
        last_progress = 0
        retry_count = 0
        max_retries = 5
        max_poll_time = MAX_BATCH_POLL_TIME

        while True:
            # Check for timeout
            elapsed = time.time() - start_time
            if elapsed > max_poll_time:
                error_msg = f"Batch timed out after {format_time(elapsed)}"
                self.out.error(f"  ❌ {error_msg}")
                raise TimeoutError(error_msg)

            try:
                status = self.batch_manager.get_batch_status(batch_id)
                retry_count = 0  # Reset on success

                if status["status"] == "ended":
                    self.out.info(f"  Batch complete in {format_time(elapsed)}")
                    self.out.info(f"    Succeeded: {status['succeeded']}, Errored: {status['errored']}")
                    break

                # Progress update with ETA
                completed = status.get("succeeded", 0) + status.get("errored", 0)
                total = status.get("total", 0)

                if completed > last_progress and total > 0:
                    rate = completed / elapsed if elapsed > 0 else 0
                    remaining = (total - completed) / rate if rate > 0 else 0
                    eta = format_time(remaining)
                    processing = status.get("processing", 0)
                    self.out.info(f"  Progress: {completed}/{total} ({processing} processing) ETA: {eta}")
                    last_progress = completed

            except Exception as e:
                retry_count += 1
                if retry_count > max_retries:
                    error_msg = f"Batch polling failed after {max_retries} retries: {e}"
                    self.out.error(f"  ❌ {error_msg}")
                    raise

                # Exponential backoff: 2, 4, 8, 16, 32 seconds
                backoff = min(60, 2 ** retry_count)
                self.out.warning(f"  ⚠️  API error (attempt {retry_count}/{max_retries}): {e}")
                self.out.warning(f"      Retrying in {backoff}s...")
                await asyncio.sleep(backoff)
                continue

            await asyncio.sleep(self.poll_interval)

    async def _run_realtime(
        self,
        requests: list[dict],
        units: list[TrackedUnit],
        output_class: type,
        output_attr: str,
        tier_name: str,
    ) -> tuple[list[TrackedUnit], list[TrackedUnit]]:
        """
        Run requests in realtime mode (no batch API).

        Args:
            requests: List of batch-format requests
            units: List of TrackedUnits to process
            output_class: Pydantic model class for response parsing
            output_attr: Attribute name to set on unit (e.g., 'tier1_output')
            tier_name: Name for logging

        Returns:
            Tuple of (succeeded, failed) unit lists
        """
        import anthropic
        from shared_utils import call_llm_parse_async

        client = anthropic.AsyncAnthropic()

        # Build lookup from custom_id to unit
        id_to_unit = {u.custom_id: u for u in units}

        succeeded = []
        failed = []
        total = len(requests)

        self.out.info(f"  Running {total} requests in realtime mode...")

        for i, request in enumerate(requests):
            custom_id = request["custom_id"]
            unit = id_to_unit.get(custom_id)

            if not unit:
                continue

            # Extract prompt from batch request format
            # format_batch_request uses "params" key, not "body"
            params = request.get("params", request.get("body", {}))
            messages = params.get("messages", [])
            user_prompt = messages[0]["content"] if messages else ""

            # System may be a list of dicts (batch format) or a string
            system_raw = params.get("system", "")
            if isinstance(system_raw, list) and system_raw:
                # Extract text from batch format: [{"type": "text", "text": "...", ...}]
                system = system_raw[0].get("text", "") if system_raw else ""
            else:
                system = system_raw

            # Progress indicator
            self.out.progress(f"  [{i+1}/{total}] Processing {unit.unit.citation}...", end="")

            import time
            start_time = time.time()

            try:
                # Pass trace_context for Langfuse logging inside call_llm_parse_async
                # This captures actual token counts from the API response
                result, usage = await call_llm_parse_async(
                    client=client,
                    prompt=user_prompt,
                    response_format=output_class,
                    system=system,
                    max_tokens=8192,  # Reduced for realtime to avoid SDK long-request warning
                    trace_context=self.trace_context if LANGFUSE_AVAILABLE else None,
                )

                latency_ms = (time.time() - start_time) * 1000

                if result:
                    setattr(unit, output_attr, result)
                    succeeded.append(unit)
                    print(" OK", flush=True)  # Inline status - keep as print

                    # Record cost from usage dict
                    tier_num = int(tier_name.split()[1])  # "Tier 1" -> 1
                    self.cost_tracker.record_batch_usage(
                        tier=tier_num,
                        input_tokens=usage.get("input_tokens", 0),
                        output_tokens=usage.get("output_tokens", 0),
                        cache_read_tokens=usage.get("cache_read_tokens", 0),
                        cache_write_tokens=usage.get("cache_write_tokens", 0),
                        request_count=1,
                        model=self.model,
                    )
                else:
                    unit.state = ProcessingState.ERROR
                    unit.error_message = f"{tier_name} returned no result"
                    failed.append(unit)
                    print(" FAILED (no result)", flush=True)  # Inline status
                    # Langfuse logging for errors also happens inside call_llm_parse_async

            except Exception as e:
                latency_ms = (time.time() - start_time) * 1000
                unit.state = ProcessingState.ERROR
                unit.error_message = f"{tier_name} error: {str(e)}"
                failed.append(unit)
                print(f" ERROR: {str(e)[:50]}", flush=True)  # Inline status

                # Log error to Langfuse
                if LANGFUSE_AVAILABLE and self.trace_context:
                    log_generation(
                        context=self.trace_context,
                        name=f"{tier_name}_realtime",
                        model=self.model,
                        input_text=user_prompt[:1000],
                        output_text="",
                        input_tokens=len(user_prompt) // 4,
                        output_tokens=0,
                        latency_ms=latency_ms,
                        success=False,
                        error_message=str(e)[:500],
                    )

            # Small delay between requests to avoid rate limits
            await asyncio.sleep(0.2)

        return succeeded, failed

    def _sort_for_cache_efficiency(self):
        """Sort units for maximum prompt cache hits.

        Uses group_for_cache_efficiency to order by:
        1. issue_type (same system prompt = cache hits)
        2. subchapter_id (siblings share parent context)
        3. citation (for predictability)
        """
        # Extract ProcessingUnits from TrackedUnits
        processing_units = [u.unit for u in self.units.values()]

        # Get optimally ordered ProcessingUnits
        ordered_pus = group_for_cache_efficiency(processing_units)

        # Build lookup from ProcessingUnit to TrackedUnit
        pu_to_tracked = {id(u.unit): u for u in self.units.values()}

        # Rebuild units dict in optimal order
        self.units = {
            pu_to_tracked[id(pu)].custom_id: pu_to_tracked[id(pu)]
            for pu in ordered_pus
        }

    def _check_db_health_with_retry(self, tier_name: str) -> bool:
        """
        Check database health before starting a tier.

        Pings the database with SELECT 1 and retries once after 5s delay
        if the first check fails.

        Args:
            tier_name: Name of the tier (for logging)

        Returns:
            True if database is healthy, False if health check fails after retry
        """
        if check_db_health():
            return True

        # First check failed - wait and retry
        self.out.warning(f"  ⚠️  DB health check failed before {tier_name}, waiting 5s...")
        time.sleep(5)

        if check_db_health():
            self.out.info(f"  ✓ DB reconnected, continuing {tier_name}")
            return True

        # Both checks failed
        self.out.error(f"  ❌ DB health check failed after retry - cannot start {tier_name}")
        return False

    def _hydrate_unit_from_analysis(
        self,
        unit: TrackedUnit,
        analysis: dict,
        highest_completed: int,
    ) -> None:
        """
        Hydrate a TrackedUnit with existing tier outputs from the database.

        This enables resume to skip already-completed tiers by:
        1. Creating tier output objects from DB data
        2. Setting appropriate state based on highest tier completed
        3. Assigning outputs to unit so tier runners can skip it

        Args:
            unit: The TrackedUnit to hydrate
            analysis: Dict from get_existing_analyses() with full tier data
            highest_completed: The highest tier number completed (1, 2, or 3)
        """
        # Hydrate Tier 1 output if completed
        if highest_completed >= 1 and analysis.get("tier1_classification"):
            unit.tier1_output = Tier1Output(
                classification=analysis["tier1_classification"],
                relevant_match_indices=[],  # Not stored in DB (we store IDs instead)
                dismissed_matches=[],  # Not critical for resume
                confidence=analysis.get("tier1_confidence") or 0.8,
                reasoning=analysis.get("tier1_reasoning") or "Resumed from database",
                context_requests=analysis.get("tier1_context_requests") or [],
            )
            # Store relevant/dismissed match IDs for later use
            unit._tier1_relevant_match_ids = analysis.get("tier1_relevant_match_ids") or []
            unit._tier1_dismissed_match_ids = analysis.get("tier1_dismissed_match_ids") or []

        # Hydrate Tier 2 output if completed
        if highest_completed >= 2 and analysis.get("tier2_classification"):
            unit.tier2_output = Tier2Output(
                classification=analysis["tier2_classification"],
                confidence=analysis.get("tier2_confidence") or 0.8,
                reasoning=analysis.get("tier2_reasoning") or "Resumed from database",
                argument_for_regulation="Resumed from database",
                argument_against_regulation="Resumed from database",
                severity=analysis.get("severity"),
                verbatim_requirements=analysis.get("verbatim_requirements") or [],
                context_used=[],
                full_text_requests=analysis.get("tier2_full_text_requests") or [],
            )
            # Store context requests made for potential re-use
            unit.tier2_context_requests_made = analysis.get("tier2_context_requests_made") or []

        # Hydrate Tier 3 output if completed
        if highest_completed >= 3 and analysis.get("tier3_classification"):
            unit.tier3_output = Tier3Output(
                classification=analysis["tier3_classification"],
                confidence=analysis.get("tier3_confidence") or 0.8,
                reasoning=analysis.get("tier3_reasoning") or "Resumed from database",
                argument_for_regulation="Resumed from database",
                argument_against_regulation="Resumed from database",
                severity_adjustment=analysis.get("tier3_severity_adjustment"),
                severity_adjustment_reasoning=analysis.get("tier3_severity_adjustment_reasoning"),
                web_search_summary="",
                verbatim_requirements=[],
                context_used=[],
            )

        # Set state based on highest tier completed
        # The state determines which tier runner will process this unit next
        if highest_completed == 1:
            # Tier 1 done: check if false positive, otherwise go to Tier 2
            if unit.tier1_output and unit.tier1_output.classification == "all_false_positives":
                unit.state = ProcessingState.DONE_FALSE_POSITIVE
            else:
                unit.state = ProcessingState.TIER2_PENDING
        elif highest_completed == 2:
            # Tier 2 done: use get_next_state() to determine if Tier 3 needed
            unit.state = ProcessingState.TIER2_COMPLETE
            unit.state = get_next_state(unit)  # May go to TIER3_PENDING or DONE
        elif highest_completed >= 3:
            # Tier 3 done: final state
            unit.state = ProcessingState.DONE

    def _log_tier_complete(self, tier_name: str, succeeded: int, failed: int, batch_id: Optional[str] = None):
        """Log tier completion stats."""
        total = succeeded + failed
        # Extract tier number from tier_name (e.g., "Tier 1" -> 1)
        tier_num = int(tier_name.split()[-1]) if tier_name.split()[-1].isdigit() else None
        tier_out = self._tier_out(tier_num) if tier_num else self.out
        if total > 0:
            success_rate = succeeded / total * 100
            tier_out.info(f"  {tier_name} complete: {succeeded}/{total} succeeded ({success_rate:.1f}%)")

        # Log to Langfuse if we have a trace for this batch
        if LANGFUSE_AVAILABLE and self.trace_context and batch_id:
            trace_id = self.batch_trace_ids.get(batch_id)
            if trace_id:
                # Get token/cost stats from cost tracker
                tier_stats = self.cost_tracker.get_tier_stats(tier_name.lower().replace(" ", ""))
                log_batch_completion(
                    context=self.trace_context,
                    trace_id=trace_id,
                    succeeded=succeeded,
                    errored=failed,
                    expired=0,
                    total_input_tokens=tier_stats.get("input_tokens", 0),
                    total_output_tokens=tier_stats.get("output_tokens", 0),
                    total_cost=tier_stats.get("cost", 0.0),
                )

    def _print_summary(self):
        """Print final pipeline summary."""
        self.out.info(f"\n{'='*70}")
        self.out.info("PIPELINE SUMMARY")
        self.out.info(f"{'='*70}")

        # Count by final state
        done = [u for u in self.units.values() if u.state == ProcessingState.DONE]
        false_pos = [u for u in self.units.values() if u.state == ProcessingState.DONE_FALSE_POSITIVE]
        errors = [u for u in self.units.values() if u.state == ProcessingState.ERROR]
        still_pending = [u for u in self.units.values() if not is_terminal_state(u.state)]

        # Count by classification
        burdensome = [u for u in done if compute_final_classification(u) == "burdensome"]
        justified = [u for u in done if compute_final_classification(u) == "justified"]
        unrelated = [u for u in done if compute_final_classification(u) == "unrelated"]

        self.out.info(f"Total processed: {len(self.units)}")
        self.out.info(f"  Completed: {len(done)}")
        self.out.info(f"  False positives (Tier 1): {len(false_pos)}")
        self.out.info(f"  Errors: {len(errors)}")
        if still_pending:
            self.out.info(f"  Still pending: {len(still_pending)}")
        self.out.info("")
        self.out.info("Classifications:")
        self.out.info(f"  Burdensome: {len(burdensome)}")
        self.out.info(f"  Justified: {len(justified)}")
        self.out.info(f"  Unrelated: {len(unrelated)}")
        self.out.info("")
        self.out.info(self.cost_tracker.summary())

        # Flush Langfuse traces
        if LANGFUSE_AVAILABLE:
            flush_langfuse()

    def get_results_by_state(self) -> dict[str, list[TrackedUnit]]:
        """Get results grouped by final state."""
        results = {}
        for unit in self.units.values():
            state_name = unit.state.name
            if state_name not in results:
                results[state_name] = []
            results[state_name].append(unit)
        return results

    def get_results_by_classification(self) -> dict[str, list[TrackedUnit]]:
        """Get results grouped by final classification."""
        results = {"burdensome": [], "justified": [], "unrelated": [], "false_positive": [], "unknown": []}

        for unit in self.units.values():
            if unit.state == ProcessingState.DONE_FALSE_POSITIVE:
                results["false_positive"].append(unit)
            elif unit.state == ProcessingState.DONE:
                classification = compute_final_classification(unit)
                if classification in results:
                    results[classification].append(unit)
                else:
                    results["unknown"].append(unit)
            else:
                results["unknown"].append(unit)

        return results


async def run_pipeline(
    processing_units: list[ProcessingUnit],
    state: str,
    issue_type: str,
    batches_dir: Path,
    max_tier: int = 3,
    poll_interval: int = 60,
    realtime: bool = False,
    resume: bool = True,
    incremental_save: bool = True,
    tier2_reruns: bool = False,
) -> list[TrackedUnit]:
    """
    Convenience function to run the pipeline.

    V5: 3-tier pipeline where Tier 3 is the web search tier.

    Args:
        processing_units: Units to process
        state: State code
        issue_type: Issue type key
        batches_dir: Directory for batch metadata
        max_tier: Maximum tier to run (1-3)
        poll_interval: Seconds between status checks
        realtime: Use realtime API instead of batch
        resume: If True, skip documents already processed to target tier
        incremental_save: If True, save results to DB after each tier completes
        tier2_reruns: If True, run Tier 2 with re-run mechanics (real-time API)

    Returns:
        List of TrackedUnits with results
    """
    orchestrator = TierOrchestrator(
        state=state,
        issue_type=issue_type,
        batches_dir=batches_dir,
        poll_interval=poll_interval,
        realtime=realtime,
        resume=resume,
        incremental_save=incremental_save,
        tier2_reruns=tier2_reruns,
    )

    return await orchestrator.run(
        processing_units=processing_units,
        max_tier=max_tier,
    )
