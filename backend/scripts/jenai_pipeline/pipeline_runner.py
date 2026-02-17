"""JenAI Pipeline runner - orchestrates two-tier analysis."""
import asyncio
import time
import uuid

import anthropic

from .state_machine import TrackedUnit, ProcessingState, should_promote_to_tier2
from .models.processing import JenAIUnit
from .models.llm_outputs import Tier1Output, Tier2Output
from .db.document_queries import get_sections_for_analysis
from .db.analysis_writer import save_tier1_results, save_tier2_results
from .db.analysis_reader import get_existing_analyses
from .tiers.tier1_runner import prepare_tier1_batch
from .tiers.tier2_runner import prepare_tier2_batch
from .config import DEFAULT_MAX_SECTIONS, BATCH_MODEL
from lib.batch import BatchManager, parse_batch_result_tool_use
from lib.llm import call_llm_parse_async


def run_pipeline(
    state: str,
    title: int | None = None,
    part: str | None = None,
    limit: int | None = DEFAULT_MAX_SECTIONS,
    max_tier: int = 2,
    tier2_only: bool = False,
    dry_run: bool = True,
    include_all_types: bool = False,
    force: bool = False,
    realtime: bool = False,
    document_ids: list[int] | None = None,
) -> dict:
    """Run the JenAI two-tier pipeline.

    Args:
        state: State code ('nj' or 'ny')
        title: Optional title number to filter by
        part: Optional part number to filter by
        limit: Max sections to analyze
        max_tier: Stop after this tier (1 or 2)
        tier2_only: Only run Tier 2 for sections with existing Tier 1 results
        dry_run: If True, preview what would run without executing
        include_all_types: Include reserved/definitions/scope sections
        force: Re-analyze sections that already have analyses
        realtime: Use realtime API instead of batch
        document_ids: Specific document IDs to analyze

    Returns:
        Summary dict with counts
    """
    run_id = uuid.uuid4().hex[:12]

    # Fetch sections
    sections = get_sections_for_analysis(
        state=state,
        title=title,
        part=part,
        limit=limit,
        exclude_analyzed=not tier2_only and not force and not document_ids,
        include_all_types=include_all_types,
        document_ids=document_ids,
    )

    if not sections:
        print("No sections found for analysis.")
        return {"sections": 0}

    mode = "realtime" if realtime else "batch"
    print(f"\nFound {len(sections)} sections for analysis")
    print(f"Run ID: {run_id}")
    print(f"Max tier: {max_tier}, Mode: {mode}")

    if dry_run:
        print("\n[DRY RUN] Would analyze these sections. Use --execute to run.")
        for i, s in enumerate(sections[:10]):
            print(f"  {i+1}. [{s['id']}] {s.get('citation', 'N/A')}: {(s.get('title') or '')[:60]}")
        if len(sections) > 10:
            print(f"  ... and {len(sections) - 10} more")
        return {"sections": len(sections), "dry_run": True}

    # Build tracked units
    units = [
        TrackedUnit(unit=JenAIUnit(
            document_id=s['id'],
            citation=s['citation'] or '',
            title=s['title'] or '',
            content=s['content'],
            state=s['state'],
            summary=s.get('summary'),
            url=s.get('url'),
            hierarchy_level=s.get('hierarchy_level'),
            parent_id=s.get('parent_id'),
        ))
        for s in sections
    ]

    # Resume: check existing analyses for tier2-only mode
    if tier2_only:
        existing = get_existing_analyses([u.unit.document_id for u in units])
        for tracked in units:
            doc_id = tracked.unit.document_id
            if doc_id in existing and existing[doc_id]['highest_tier_completed'] >= 1:
                tracked.state = ProcessingState.TIER2_PENDING
            else:
                tracked.state = ProcessingState.ERROR
                tracked.error = "No Tier 1 results found for tier2-only mode"

    # ═══ TIER 1 ═══
    if not tier2_only:
        print("\n=== TIER 1: Catalog Context ===")
        tier1_units = [u for u in units if u.state == ProcessingState.PENDING]

        if tier1_units:
            batch_requests, id_map = prepare_tier1_batch(tier1_units)
            print(f"Processing {len(batch_requests)} Tier 1 requests ({mode})...")

            if realtime:
                _run_realtime_tier(
                    batch_requests, id_map, tier1_units,
                    Tier1Output, "tier1_output", "tier1_batch_id",
                    ProcessingState.TIER1_COMPLETE, "Tier 1",
                )
            else:
                manager = BatchManager()
                batch_id = manager.submit_batch(batch_requests, batch_name="jenai_tier1")
                manager.poll_until_complete(batch_id)

                doc_id_to_unit = {u.unit.document_id: u for u in tier1_units}
                for result in manager.get_batch_results(batch_id):
                    parsed = parse_batch_result_tool_use(result, Tier1Output)
                    if parsed:
                        doc_id = id_map.get(result.custom_id)
                        if doc_id and doc_id in doc_id_to_unit:
                            tracked = doc_id_to_unit[doc_id]
                            tracked.tier1_output = parsed
                            tracked.tier1_batch_id = batch_id
                            tracked.state = ProcessingState.TIER1_COMPLETE

            # Save Tier 1 results
            saved = save_tier1_results(tier1_units, "realtime" if realtime else batch_id, run_id)
            print(f"Saved {saved} Tier 1 results")

            # Promote to Tier 2 or mark clean
            for tracked in tier1_units:
                if tracked.state == ProcessingState.TIER1_COMPLETE:
                    if should_promote_to_tier2(tracked):
                        tracked.state = ProcessingState.TIER2_PENDING
                    else:
                        tracked.state = ProcessingState.DONE_CLEAN

            clean = sum(1 for u in tier1_units if u.state == ProcessingState.DONE_CLEAN)
            promoted = sum(1 for u in tier1_units if u.state == ProcessingState.TIER2_PENDING)
            errors = sum(1 for u in tier1_units if u.state not in (
                ProcessingState.DONE_CLEAN, ProcessingState.TIER2_PENDING,
                ProcessingState.TIER1_COMPLETE,
            ))
            print(f"Clean: {clean}, Promoted to Tier 2: {promoted}, Errors: {errors}")

    if max_tier < 2:
        print("\n[max-tier 1] Stopping after Tier 1.")
        return _build_summary(units)

    # ═══ TIER 2 ═══
    tier2_units = [u for u in units if u.state == ProcessingState.TIER2_PENDING]
    if not tier2_units:
        print("\nNo sections need Tier 2 analysis.")
        return _build_summary(units)

    print(f"\n=== TIER 2: Full Context Confirmation ({len(tier2_units)} sections) ===")
    batch_requests, id_map = prepare_tier2_batch(tier2_units)
    print(f"Processing {len(batch_requests)} Tier 2 requests ({mode})...")

    if realtime:
        _run_realtime_tier(
            batch_requests, id_map, tier2_units,
            Tier2Output, "tier2_output", "tier2_batch_id",
            ProcessingState.DONE, "Tier 2",
        )
    else:
        manager = BatchManager()
        batch_id = manager.submit_batch(batch_requests, batch_name="jenai_tier2")
        manager.poll_until_complete(batch_id)

        doc_id_to_unit = {u.unit.document_id: u for u in tier2_units}
        for result in manager.get_batch_results(batch_id):
            parsed = parse_batch_result_tool_use(result, Tier2Output)
            if parsed:
                doc_id = id_map.get(result.custom_id)
                if doc_id and doc_id in doc_id_to_unit:
                    tracked = doc_id_to_unit[doc_id]
                    tracked.tier2_output = parsed
                    tracked.tier2_batch_id = batch_id
                    tracked.state = ProcessingState.DONE

    # Save Tier 2 results
    saved = save_tier2_results(tier2_units, "realtime" if realtime else batch_id, run_id)
    completed = sum(1 for u in tier2_units if u.state == ProcessingState.DONE)
    print(f"Saved {saved} Tier 2 results ({completed} completed)")

    return _build_summary(units)


def _run_realtime_tier(
    batch_requests: list[dict],
    id_map: dict[str, int],
    units: list[TrackedUnit],
    output_class: type,
    output_attr: str,
    batch_id_attr: str,
    success_state: ProcessingState,
    tier_name: str,
) -> None:
    """Run a tier's requests using the realtime API."""
    asyncio.run(_run_realtime_tier_async(
        batch_requests, id_map, units,
        output_class, output_attr, batch_id_attr,
        success_state, tier_name,
    ))


async def _run_realtime_tier_async(
    batch_requests: list[dict],
    id_map: dict[str, int],
    units: list[TrackedUnit],
    output_class: type,
    output_attr: str,
    batch_id_attr: str,
    success_state: ProcessingState,
    tier_name: str,
) -> None:
    """Async implementation of realtime tier processing."""
    client = anthropic.AsyncAnthropic()
    doc_id_to_unit = {u.unit.document_id: u for u in units}
    total = len(batch_requests)

    for i, request in enumerate(batch_requests):
        custom_id = request["custom_id"]
        doc_id = id_map.get(custom_id)
        if not doc_id or doc_id not in doc_id_to_unit:
            continue

        tracked = doc_id_to_unit[doc_id]
        citation = tracked.unit.citation

        params = request.get("params", request.get("body", {}))
        messages = params.get("messages", [])
        user_prompt = messages[0]["content"] if messages else ""

        system_raw = params.get("system", "")
        if isinstance(system_raw, list) and system_raw:
            system = system_raw[0].get("text", "") if system_raw else ""
        else:
            system = system_raw

        print(f"  [{i+1}/{total}] {citation}...", end="", flush=True)
        start = time.time()

        try:
            result, usage = await call_llm_parse_async(
                client=client,
                prompt=user_prompt,
                response_format=output_class,
                system=system,
                model=BATCH_MODEL,
                max_tokens=64000,
            )

            elapsed = time.time() - start

            if result:
                setattr(tracked, output_attr, result)
                setattr(tracked, batch_id_attr, "realtime")
                tracked.state = success_state
                tokens = usage.get("input_tokens", 0) + usage.get("output_tokens", 0)
                print(f" OK ({elapsed:.1f}s, {tokens} tokens)")
            else:
                tracked.state = ProcessingState.ERROR
                tracked.error = f"{tier_name} returned None"
                print(f" FAILED (no result, {elapsed:.1f}s)")

        except Exception as e:
            elapsed = time.time() - start
            tracked.state = ProcessingState.ERROR
            tracked.error = str(e)[:200]
            print(f" ERROR ({elapsed:.1f}s): {str(e)[:80]}")


def _build_summary(units: list[TrackedUnit]) -> dict:
    """Build pipeline run summary."""
    return {
        "total": len(units),
        "clean": sum(1 for u in units if u.state == ProcessingState.DONE_CLEAN),
        "completed": sum(1 for u in units if u.state == ProcessingState.DONE),
        "errors": sum(1 for u in units if u.state == ProcessingState.ERROR),
        "pending": sum(1 for u in units if u.state == ProcessingState.PENDING),
    }
