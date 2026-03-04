#!/usr/bin/env python3
"""
CLI for the research pipeline.

Runs documents through the 3-tier research pipeline for regulatory burden analysis.
Defaults are cost-safe: dry-run mode, explicit issue selection required.

Usage:
    cd backend && python3 -m scripts.research_pipeline.cli --help

    # Preview what would run (default is dry-run)
    python3 -m scripts.research_pipeline.cli --state nj --all-issues

    # Actually run a single issue type
    python3 -m scripts.research_pipeline.cli \\
        --state nj --issue mail_only --execute

    # All issues with explicit limits
    python3 -m scripts.research_pipeline.cli \\
        --state ny --all-issues --execute \\
        --limit 50 --global-limit 500
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

from lib.jurisdictions import jurisdiction_validator as _base_jurisdiction_validator, title_column_for_jurisdiction


def jurisdiction_validator(value: str) -> str:
    """Validate --state flag, including 'dangerously-run-all'."""
    return _base_jurisdiction_validator(value, allow_run_all=True)


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


def positive_int_or_no_limit(value: str) -> Union[int, str]:
    """
    Validate --global-limit flag.

    Accepts a positive integer or the string 'no-limit'.
    """
    if value.lower() == 'no-limit':
        return 'no-limit'
    try:
        int_val = int(value)
        if int_val <= 0:
            raise argparse.ArgumentTypeError(
                f"Must be a positive integer or 'no-limit', got '{value}'"
            )
        return int_val
    except ValueError:
        raise argparse.ArgumentTypeError(
            f"Must be a positive integer or 'no-limit', got '{value}'"
        )


# ============================================================================

# Load .env from project root
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
load_dotenv(PROJECT_ROOT / ".env")

from lib.db import get_db_connection
from scripts.research_pipeline.models.matches import ProcessingUnit
from scripts.research_pipeline.pipeline_runner import run_pipeline as run_pipeline_fn, run_tier3_only

# Import from db module
from scripts.research_pipeline.db import (
    fetch_documents_with_continuation,
    fetch_tier3_pending_documents,
    fetch_all_issue_documents,
    get_issue_types_for_scope,
    save_final_results,
)
from scripts.research_pipeline.routing import should_escalate_to_tier3
from scripts.research_pipeline.state_machine import TrackedUnit
from scripts.research_pipeline.models.llm_outputs import Tier2Output


# ============================================================================
# DRY-RUN RESUME SIMULATION
# ============================================================================



def _simulate_resume(
    processing_units: list[ProcessingUnit],
    issue_types: list[str],
    max_tier: int,
    existing_analyses: dict[tuple[int, str], dict],
) -> dict:
    """
    Simulate the resume logic without making API calls.

    Mirrors the logic in pipeline_runner.run_pipeline() to show
    what would happen during an actual pipeline run.

    Args:
        processing_units: List of ProcessingUnits fetched for processing
        issue_types: List of issue types being processed
        max_tier: Maximum tier to run (1-3)
        existing_analyses: Pre-loaded analyses from fetch

    Returns:
        Dict with:
        - new: list of ProcessingUnits with no existing analysis
        - skipped: list of (ProcessingUnit, highest_tier) tuples
        - resumed: dict[tier] -> list of (ProcessingUnit, analysis) tuples
        - tier3_pending: list of (ProcessingUnit, analysis) tuples that would run web search
    """
    if not processing_units:
        return {"new": [], "skipped": [], "resumed": {}, "tier3_pending": []}

    existing = existing_analyses

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

    return {
        "new": new_units,
        "skipped": skipped_units,
        "resumed": resumed_units,
        "tier3_pending": tier3_pending,
    }


def _would_escalate_to_tier3(analysis: dict) -> bool:
    """
    Check if an analysis would escalate to Tier 3 based on routing rules.

    Delegates to routing.should_escalate_to_tier3() by constructing a
    minimal TrackedUnit from the analysis dict.

    Args:
        analysis: Dict from get_existing_analyses() or similar

    Returns:
        True if the analysis would trigger Tier 3 escalation
    """
    classification = analysis.get("tier2_classification")
    if not classification or classification == "unrelated":
        return False

    # Build a Tier2Output from the analysis dict
    # Pydantic requires severity for burdensome/justified classifications
    severity = analysis.get("severity")
    if severity is None and classification == "burdensome":
        severity = 5  # Safe default for routing check
    tier2 = Tier2Output(
        classification=classification,
        confidence=analysis.get("tier2_confidence") or 0.85,
        reasoning=analysis.get("tier2_reasoning") or "",
        argument_for_regulation=analysis.get("argument_for_regulation") or "",
        argument_against_regulation=analysis.get("argument_against_regulation") or "",
        severity=severity,
        needs_web_search=analysis.get("needs_web_search", False),
        web_search_topics=analysis.get("web_search_topics") or [],
        cites_federal_statute=analysis.get("cites_federal_statute", False),
        federal_citation=analysis.get("federal_citation"),
        claims_no_alternative=analysis.get("claims_no_alternative", False),
        potentially_controversial=analysis.get("potentially_controversial", False),
        federal_mandate_suspected=analysis.get("federal_mandate_suspected", False),
    )

    # Build a minimal TrackedUnit with just the fields routing needs
    dummy_unit = ProcessingUnit(
        document_id=analysis.get("document_id", 0),
        issue_type=analysis.get("issue_type", ""),
        citation="",
        title="",
        matches=[],
        content="",
        jurisdiction="",
    )
    tracked = TrackedUnit(unit=dummy_unit)
    tracked.tier2_output = tier2

    return should_escalate_to_tier3(tracked)


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

    print()


# ============================================================================
# PIPELINE EXECUTION
# ============================================================================

async def _execute_pipeline(
    processing_units: list[ProcessingUnit],
    jurisdiction: str | None,
    issue_type: str | None = None,
    issue_types: list[str] | None = None,
    max_tier: int = 2,
    realtime: bool = False,
    force_rerun: bool = False,
    max_docs_per_issue: int | str | None = None,
    global_docs_limit: int | str | None = None,
    enable_web_search: bool = False,
    title_filter: str | None = None,
    statute_mandate: bool = False,
    summarize: bool = False,
    no_cache: bool = False,
) -> list:
    """Execute the pipeline with given processing units.

    Common execution logic extracted from run_test and run_batched_issues:
    - Creates batches directory
    - Calls run_pipeline_fn() (flat function, no class)
    - Saves results to database

    Args:
        processing_units: Documents to process
        jurisdiction: Jurisdiction code ('NJ', 'NY', 'NYC', or None for all)
        issue_type: Single issue type (use this OR issue_types)
        issue_types: List of issue types (use this OR issue_type)
        max_tier: Maximum tier to run (1-3)
        realtime: Use realtime API instead of batch
        force_rerun: If True, re-analyze even if already processed
        max_docs_per_issue: Max docs per issue type
        global_docs_limit: Max total docs across all issue types
        enable_web_search: If True, run Tier 3 web search verification when max_tier >= 3
        title_filter: Optional title filter (e.g., '3A' for Title 3A)
        summarize: If True, run document summarization after pipeline

    Returns:
        List of TrackedUnit results
    """
    # Create batches directory
    batches_dir = Path(__file__).parent / "batches"
    batches_dir.mkdir(exist_ok=True)

    # When jurisdiction is None (dangerously-run-all), default to "NJ" for pipeline
    # but the actual jurisdiction filtering was already done in document fetching
    pipeline_jurisdiction = jurisdiction if jurisdiction else "NJ"

    # Normalize issue_type(s) to list
    if issue_types:
        all_issue_types = issue_types
    elif issue_type:
        all_issue_types = [issue_type]
    else:
        raise ValueError("Either issue_type or issue_types must be provided")

    # Run the pipeline
    results = await run_pipeline_fn(
        processing_units=processing_units,
        jurisdiction=pipeline_jurisdiction,
        issue_types=all_issue_types,
        batches_dir=batches_dir,
        max_tier=max_tier,
        enable_web_search=enable_web_search,
        poll_interval=30,
        realtime=realtime,
        resume=not force_rerun,
        title_filter=title_filter,
        statute_mandate=statute_mandate,
        no_cache=no_cache,
    )

    # Save final results to database (tier results already saved incrementally)
    print("\nSaving final classifications to database...")
    conn = get_db_connection()
    if conn is None:
        raise RuntimeError("Failed to establish database connection for saving results")
    saved_count = save_final_results(results, conn)
    conn.close()
    print(f"Saved {saved_count} final classifications")

    # --- Summarization (post-pipeline, optional) ---
    if summarize and title_filter:
        pipeline_jurisdiction = jurisdiction if jurisdiction else "NJ"
        print(f"\n{'='*60}")
        print(f"POST-PIPELINE SUMMARIZATION: {pipeline_jurisdiction} Title {title_filter}")
        print(f"{'='*60}")

        from scripts.summarization.runner import SummarizationBatchRunner
        from scripts.summarization.import_summaries import (
            find_all_results_files, load_results, extract_summary_data,
            batch_update_summaries,
        )

        output_dir = Path(__file__).parent.parent.parent / "summaries_staging"
        runner = SummarizationBatchRunner(
            jurisdiction=pipeline_jurisdiction,
            output_dir=output_dir,
            title=title_filter,
        )
        all_results = runner.run_all_phases(poll_interval=30)

        total = sum(len(r) for r in all_results.values())
        if total > 0:
            print(f"\n{'='*60}")
            print(f"IMPORTING SUMMARIES TO DATABASE")
            print(f"{'='*60}")

            results_files = find_all_results_files(pipeline_jurisdiction, output_dir)
            all_updates = []
            for rf in results_files:
                for result in load_results(rf):
                    data = extract_summary_data(result)
                    if data and data["summary"]:
                        all_updates.append(data)

            if all_updates:
                summary_conn = get_db_connection()
                if summary_conn:
                    updated = batch_update_summaries(summary_conn, all_updates)
                    summary_conn.close()
                    print(f"  Updated {updated} documents in database")
            else:
                print("  No summaries to import")
    elif summarize and not title_filter:
        print("\n[SUMMARIZE] Skipping: --summarize requires --title")

    return results


def _check_summarization_completeness(jurisdiction: str, title: str) -> float | None:
    """
    Check what percentage of sections have summaries for a given jurisdiction/title.

    Returns percentage (0-100) or None if the check fails.
    """
    from lib.db import get_db_connection

    conn = get_db_connection()
    if not conn:
        return None

    try:
        with conn.cursor() as cur:
            jurisdiction_upper = jurisdiction.upper()
            col = title_column_for_jurisdiction(jurisdiction_upper)
            cur.execute(f"""
                SELECT
                    COUNT(*) as total,
                    COUNT(summary) as summarized
                FROM regulatory_documents
                WHERE jurisdiction = %s AND {col} = %s AND hierarchy_level = 'section'
            """, (jurisdiction.upper(), title))
            row = cur.fetchone()
            if not row or row[0] == 0:
                return None
            return row[1] / row[0] * 100
    except Exception:
        return None
    finally:
        conn.close()


async def run_test(
    issue_type: str,
    max_docs_per_issue: int | None = None,
    max_tier: int = 2,
    jurisdiction: str | None = None,
    realtime: bool = False,
    title: str | None = None,
    dry_run: bool = False,
    enable_web_search: bool = False,
    force_rerun: bool = False,
    statute_mandate: bool = False,
    summarize: bool = False,
    no_cache: bool = False,
    source_type: str = "regulation",
    agency: str | None = None,
    doc_type: str | None = None,
):
    """
    Run the research pipeline on unanalyzed documents.

    Args:
        issue_type: The compliance issue type to process
        max_docs_per_issue: Max documents to process (None = no limit)
        max_tier: Maximum tier to run (1-3)
        jurisdiction: Jurisdiction code ('NJ', 'NY', 'NYC', or None for all)
        realtime: Use realtime API instead of batch
        title: Optional filter by regulatory title
        dry_run: Preview without API calls
        enable_web_search: Enable Tier 3 web search
        force_rerun: Re-analyze documents even if already processed
        source_type: "regulation" or "guidance"
        agency: Filter guidance by agency (e.g., "OCFS")
        doc_type: Filter guidance by doc_type (e.g., "ADM")
    """

    # Default limit if not specified
    limit = max_docs_per_issue if max_docs_per_issue is not None else 999999

    print(f"\n{'='*70}")
    print(f"RESEARCH PIPELINE {'DRY RUN' if dry_run else 'TEST RUN'}")
    print(f"{'='*70}")
    print(f"Source: {source_type}")
    print(f"Issue type: {issue_type}")
    print(f"Jurisdiction: {jurisdiction if jurisdiction else 'ALL (dangerously-run-all)'}")
    if title:
        print(f"Title filter: {title}")
    if agency:
        print(f"Agency filter: {agency}")
    if doc_type:
        print(f"Doc type filter: {doc_type}")
    print(f"Target docs: {max_docs_per_issue if max_docs_per_issue else 'all'}")
    print(f"Max tier: {max_tier}")
    print(f"Force rerun: {force_rerun}")
    if dry_run:
        print("Mode: DRY RUN (no LLM calls, no DB writes)")
    print()

    # Fetch documents based on source type
    print("Fetching documents requiring analysis (new or incomplete)...")
    if source_type == "guidance":
        from scripts.research_pipeline.db import fetch_guidance_unanalyzed
        processing_units, existing_analyses = fetch_guidance_unanalyzed(
            issue_types=[issue_type],
            max_tier=max_tier,
            jurisdiction=jurisdiction,
            max_docs_per_issue=limit,
            agency=agency,
            doc_type=doc_type,
        )
    else:
        processing_units, existing_analyses = fetch_documents_with_continuation(
            issue_type=issue_type,
            max_tier=max_tier,
            jurisdiction=jurisdiction,
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
            existing_analyses=existing_analyses,
        )
        _print_resume_simulation(simulation, max_tier)

        print(f"{'='*70}")
        print("DRY RUN COMPLETE")
        print(f"{'='*70}")
        print(f"Documents fetched: {len(processing_units)}")
        print(f"  - Would process: {len(simulation['new']) + sum(len(u) for u in simulation['resumed'].values())}")
        print(f"  - Would skip: {len(simulation['skipped'])}")
        print(f"Total matches: {sum(len(pu.matches) for pu in processing_units)}")
        print(f"Max tier: {max_tier}")
        print(f"Estimated API mode: {'realtime' if realtime else 'batch'}")
        return

    # Execute pipeline
    print()
    results = await _execute_pipeline(
        processing_units=processing_units,
        jurisdiction=jurisdiction,
        issue_type=issue_type,
        max_tier=max_tier,
        realtime=realtime,
        force_rerun=force_rerun,
        max_docs_per_issue=max_docs_per_issue,
        global_docs_limit=None,  # Single issue type has no global limit
        enable_web_search=enable_web_search,
        title_filter=title,
        statute_mandate=statute_mandate,
        summarize=summarize,
        no_cache=no_cache,
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
    jurisdiction: str | None,
    title: str | None,
    max_docs_per_issue: int | None,
    max_tier: int,
    realtime: bool,
    dry_run: bool,
    global_docs_limit: int | None = None,
    enable_web_search: bool = False,
    force_rerun: bool = False,
    statute_mandate: bool = False,
    summarize: bool = False,
    no_cache: bool = False,
    source_type: str = "regulation",
    agency: str | None = None,
    doc_type: str | None = None,
):
    """Run pipeline with all issue types batched together per tier."""
    if source_type == "guidance":
        from scripts.research_pipeline.db import get_guidance_issue_types
        issue_types = get_guidance_issue_types(agency=agency, doc_type=doc_type)
    else:
        issue_types = get_issue_types_for_scope(jurisdiction, title)

    # Default limits if not specified
    docs_per_issue = max_docs_per_issue if max_docs_per_issue is not None else 999999

    print(f"\n{'='*70}")
    print(f"RUNNING ALL ISSUE TYPES (BATCHED)")
    print(f"{'='*70}")
    print(f"Source: {source_type}")
    print(f"Jurisdiction: {jurisdiction if jurisdiction else 'ALL (dangerously-run-all)'}")
    if title:
        print(f"Title: {title}")
    if agency:
        print(f"Agency: {agency}")
    if doc_type:
        print(f"Doc type: {doc_type}")
    print(f"Issue types found: {len(issue_types)}")
    print(f"Issue types: {', '.join(issue_types[:10])}{'...' if len(issue_types) > 10 else ''}")
    print(f"Docs per issue type: {max_docs_per_issue if max_docs_per_issue else 'all'}")
    if global_docs_limit:
        print(f"Global limit: {global_docs_limit}")
    print(f"Force rerun: {force_rerun}")
    print()

    # Fetch all documents across all issue types (includes new and partial progress)
    print(f"Fetching documents requiring analysis (new or incomplete, target tier {max_tier})...")
    if source_type == "guidance":
        from scripts.research_pipeline.db import fetch_guidance_unanalyzed
        processing_units, existing_analyses = fetch_guidance_unanalyzed(
            issue_types=issue_types,
            max_tier=max_tier,
            jurisdiction=jurisdiction,
            max_docs_per_issue=docs_per_issue,
            global_docs_limit=global_docs_limit,
            agency=agency,
            doc_type=doc_type,
        )
    else:
        processing_units, existing_analyses = fetch_all_issue_documents(
            issue_types=issue_types,
            jurisdiction=jurisdiction,
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
            existing_analyses=existing_analyses,
        )
        _print_resume_simulation(simulation, max_tier)

        print(f"{'='*70}")
        print("DRY RUN COMPLETE")
        print(f"{'='*70}")
        print(f"Documents fetched: {len(processing_units)}")
        print(f"  - Would process: {len(simulation['new']) + sum(len(u) for u in simulation['resumed'].values())}")
        print(f"  - Would skip: {len(simulation['skipped'])}")
        print(f"Total matches: {sum(len(pu.matches) for pu in processing_units)}")
        print(f"Max tier: {max_tier}")
        print(f"Issue types: {len(by_issue)}")
        print(f"Estimated API mode: {'realtime' if realtime else 'batch'}")
        return

    # Execute pipeline with all issue types
    results = await _execute_pipeline(
        processing_units=processing_units,
        jurisdiction=jurisdiction,
        issue_types=list(by_issue.keys()),
        max_tier=max_tier,
        realtime=realtime,
        force_rerun=force_rerun,
        max_docs_per_issue=max_docs_per_issue,
        global_docs_limit=global_docs_limit,
        enable_web_search=enable_web_search,
        title_filter=title,
        statute_mandate=statute_mandate,
        summarize=summarize,
        no_cache=no_cache,
    )

    return results


async def run_tier3_pending(
    issue_type: str,
    jurisdiction: str = "NJ",
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
        jurisdiction=jurisdiction,
        limit=num_docs,
    )

    if not processing_units:
        print("No documents pending Tier 3. Nothing to do.")
        return

    # Set up batches directory
    batches_dir = Path(__file__).parent / "batches"
    batches_dir.mkdir(exist_ok=True)

    # Run Tier 3 only
    results = await run_tier3_only(
        processing_units=processing_units,
        tier2_outputs=tier2_outputs,
        jurisdiction=jurisdiction,
        issue_types=[issue_type],
        batches_dir=batches_dir,
        realtime=True,
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
            print(f"  \u274c Error: {unit.error_message}")

    # Save results
    from .db import save_final_results
    conn = get_db_connection()
    if conn is None:
        raise RuntimeError("Failed to establish database connection for saving results")
    saved = save_final_results(results, conn)
    conn.close()
    print(f"\nSaved {saved} results to database")

    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Run the 3-tier research pipeline for regulatory burden analysis",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
REQUIRED FLAGS:
  --state                 State code: 'nj', 'ny', 'nyc', or 'dangerously-run-all'
  --issue OR --all-issues  Single issue type OR all 41 issue types (must choose one)

COST-SAFE DEFAULTS:
  By default, the pipeline runs in DRY-RUN mode (no API calls, no cost).
  Use --execute to actually run the pipeline.

  --limit                 Max docs per issue type (default: 1000)
  --global-limit          Max total docs across all issues (default: 100)
  --max-tier              1=filtering, 2=classification, 3=web search (default: 2)
  --web-search            Enable Tier 3 web search (default: off)

OPTIONAL FLAGS:
  --execute               Actually run the pipeline (default is dry-run)
  --realtime              Use realtime API (faster but 2x cost)
  --title                 Filter by regulatory title (e.g., '7' for Title 7)
  --force-rerun           Re-analyze documents with existing analyses

EXAMPLES:
  # Preview what would run (default behavior)
  python3 -m scripts.research_pipeline.cli --state nj --all-issues

  # Single issue type preview
  python3 -m scripts.research_pipeline.cli --state nj --issue mail_only

  # Actually run the pipeline
  python3 -m scripts.research_pipeline.cli --state nj --issue mail_only --execute

  # Run all issues with explicit limits
  python3 -m scripts.research_pipeline.cli --state nj --all-issues --execute --global-limit 500

  # Full pipeline with Tier 3 web search
  python3 -m scripts.research_pipeline.cli --state nj --all-issues --execute --max-tier 3 --web-search

  # Run statute mandate checks after pipeline (NY only)
  python3 -m scripts.research_pipeline.cli --state ny --all-issues --execute --statute-mandate

  # Run statute mandate checks standalone (preview)
  python3 -m scripts.research_pipeline.cli --state ny --all-issues --run-statute-mandate-only

  # Run statute mandate checks standalone (execute, limited)
  python3 -m scripts.research_pipeline.cli --state ny --all-issues --run-statute-mandate-only --execute --limit 10

  # Unlimited processing (must be explicit)
  python3 -m scripts.research_pipeline.cli --state nj --all-issues --execute --global-limit no-limit

BATCH API TIMING:
  By default, ALL tiers use the Batch API for 50% cost savings.
  The Batch API can take up to 24 hours (typical: 10-40 min for <200 requests).
  Use --realtime for immediate processing (2x cost, no wait).

RESUME BEHAVIOR:
  The pipeline automatically resumes via database state (skips already-analyzed documents).
  Use --force-rerun to re-analyze documents even if they already have analyses.
"""
    )

    # === REQUIRED FLAGS ===
    parser.add_argument(
        "--state",
        type=jurisdiction_validator,
        required=True,
        help="State code: 'nj', 'ny', 'nyc', or 'dangerously-run-all' (skip state filtering)"
    )
    parser.add_argument(
        "--source",
        choices=["regulation", "guidance"],
        default="regulation",
        help="Document source: 'regulation' (default) or 'guidance' (guidance documents)"
    )
    parser.add_argument(
        "--agency",
        help="Filter guidance docs by agency (e.g., 'OCFS', 'OMH'). Only used with --source guidance."
    )
    parser.add_argument(
        "--doc-type",
        dest="doc_type",
        help="Filter guidance docs by doc_type (e.g., 'ADM', 'LCM'). Only used with --source guidance."
    )

    # === ISSUE TYPE SELECTION (required) ===
    # Must explicitly choose what to process - no implicit "run everything"
    issue_group = parser.add_mutually_exclusive_group(required=True)
    issue_group.add_argument(
        "--issue",
        dest="issue_type",
        help="Single issue type to process (e.g., 'mail_only', 'wet_signature')"
    )
    issue_group.add_argument(
        "--all-issues",
        dest="all_issues",
        action="store_true",
        help="Run all 41 issue types in scope (batched together per tier). Must be explicit."
    )

    parser.add_argument(
        "--limit",
        dest="max_docs",
        type=positive_int_or_all,
        default=1000,
        metavar="N|all",
        help="Max documents per issue type (default: 1000)"
    )

    parser.add_argument(
        "--global-limit",
        dest="global_docs_limit",
        type=positive_int_or_no_limit,
        default=100,
        metavar="N|no-limit",
        help="Max total documents across all issue types (default: 100)"
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
        "--execute",
        action="store_true",
        help="Actually run the pipeline (default is dry-run mode which previews without API calls or DB writes)"
    )
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
        "--force-rerun",
        action="store_true",
        help="Re-analyze all matching documents regardless of existing analyses (upserts to DB)"
    )
    parser.add_argument(
        "--skip-summary-check",
        action="store_true",
        help="Skip the pre-flight summarization completeness check (not recommended)"
    )

    # === POST-PIPELINE FLAGS ===
    parser.add_argument(
        "--statute-mandate",
        action="store_true",
        help="Run statute mandate checks after the pipeline (NY only). "
             "Checks whether cited statutes actually mandate the flagged issues."
    )
    parser.add_argument(
        "--summarize",
        action="store_true",
        help="Run document summarization after the pipeline. "
             "Requires --title. Summarizes all documents in the title "
             "(bottom-up: sections → parts → chapters → titles) and imports to DB."
    )
    parser.add_argument(
        "--run-statute-mandate-only",
        action="store_true",
        help="Run ONLY the statute mandate check step (no pipeline). "
             "Processes NY analyses that have statute links but no mandate checks yet."
    )

    parser.add_argument(
        "--no-cache",
        action="store_true",
        help="Disable LLM API response cache (forces fresh API calls for all tiers)",
    )

    # === RECOVERY FLAGS ===
    parser.add_argument(
        "--retry-failed-tier3",
        action="store_true",
        help="Find and retry items that should have gone to Tier 3 but failed. "
             "Queries for items with tier2_classification but no tier3_classification "
             "that match Tier 3 escalation triggers, then processes them with realtime API."
    )
    parser.add_argument(
        "--rerun-placeholder-tier2",
        action="store_true",
        help="Re-run Tier 2 for items with placeholder text ('Resumed from database') in "
             "argument fields. Loads Tier 1 results from database and skips Tier 1 execution. "
             "Use with --max-tier 3 --web-search to run through Tier 3 as well."
    )

    args = parser.parse_args()

    # Validate --summarize requires --title
    if args.summarize and not args.title:
        parser.error("--summarize requires --title (e.g., --title 18)")

    # Normalize jurisdiction for DB queries
    # 'dangerously-run-all' means no jurisdiction filter (None)
    # Otherwise, uppercase for DB compatibility
    jurisdiction_for_db = None if args.state == 'dangerously-run-all' else args.state.upper()

    # Convert max_docs to int or None
    # 'all' means no limit (use a very large number)
    max_docs = None if args.max_docs == 'all' else args.max_docs

    # Convert global_docs_limit to int or None
    # 'no-limit' means no global limit
    global_limit = None if args.global_docs_limit == 'no-limit' else args.global_docs_limit

    # === STATUTE MANDATE ONLY MODE ===
    if args.run_statute_mandate_only:
        from scripts.research_pipeline.tiers.statute_mandate_runner import run_statute_mandate_checks
        print(f"\n*** STATUTE MANDATE CHECK ONLY MODE ***")
        asyncio.run(run_statute_mandate_checks(
            jurisdiction=jurisdiction_for_db or "NY",
            dry_run=not args.execute,
            limit=max_docs,
        ))
        sys.exit(0)

    # === RETRY FAILED TIER 3 MODE ===
    if args.retry_failed_tier3:
        from scripts.research_pipeline.maintenance.recovery import retry_failed_tier3
        print(f"\n*** RETRY FAILED TIER 3 MODE ***")
        asyncio.run(retry_failed_tier3(
            jurisdiction=jurisdiction_for_db,
            title=args.title,
            issue_types=None if args.all_issues else [args.issue_type] if args.issue_type else None,
            dry_run=not args.execute,
        ))
        sys.exit(0)

    # === RERUN PLACEHOLDER TIER 2 MODE ===
    if args.rerun_placeholder_tier2:
        from scripts.research_pipeline.maintenance.recovery import rerun_placeholder_tier2
        print(f"\n*** RERUN PLACEHOLDER TIER 2 MODE ***")
        asyncio.run(rerun_placeholder_tier2(
            jurisdiction=jurisdiction_for_db,
            title=args.title,
            issue_types=None if args.all_issues else [args.issue_type] if args.issue_type else None,
            dry_run=not args.execute,
            realtime=args.realtime,
            max_tier=args.max_tier,
            enable_web_search=args.enable_web_search,
        ))
        sys.exit(0)

    # === NORMAL PIPELINE MODE ===
    # Dry-run by default; --execute opts into real execution
    dry_run = not args.execute

    # Pre-flight check: verify summarization is largely complete
    if not args.skip_summary_check and jurisdiction_for_db and args.title and not dry_run:
        summary_pct = _check_summarization_completeness(jurisdiction_for_db, args.title)
        if summary_pct is not None and summary_pct < 50.0:
            print(f"\n⚠️  WARNING: Only {summary_pct:.1f}% of sections in Title {args.title} have summaries.")
            print(f"   The pipeline uses summaries as LLM context — running with incomplete")
            print(f"   summaries degrades analysis quality and wastes API costs.")
            print(f"   Run summarization first:")
            print(f"     python3 -m scripts.summarization.cli --state {jurisdiction_for_db} --title {args.title} --run-all-phases")
            print(f"\n   Pass --skip-summary-check to override this check.\n")
            sys.exit(1)

    # Validate guidance-specific flags
    if args.agency and args.source != "guidance":
        parser.error("--agency requires --source guidance")
    if args.doc_type and args.source != "guidance":
        parser.error("--doc-type requires --source guidance")

    if args.all_issues:
        asyncio.run(run_batched_issues(
            jurisdiction=jurisdiction_for_db,
            title=args.title,
            max_docs_per_issue=max_docs,
            global_docs_limit=global_limit,
            max_tier=args.max_tier,
            realtime=args.realtime,
            dry_run=dry_run,
            enable_web_search=args.enable_web_search,
            force_rerun=args.force_rerun,
            statute_mandate=args.statute_mandate,
            summarize=args.summarize,
            no_cache=args.no_cache,
            source_type=args.source,
            agency=args.agency,
            doc_type=args.doc_type,
        ))
    else:
        asyncio.run(run_test(
            issue_type=args.issue_type,
            max_docs_per_issue=max_docs,
            max_tier=args.max_tier,
            jurisdiction=jurisdiction_for_db,
            realtime=args.realtime,
            title=args.title,
            dry_run=dry_run,
            enable_web_search=args.enable_web_search,
            force_rerun=args.force_rerun,
            statute_mandate=args.statute_mandate,
            summarize=args.summarize,
            no_cache=args.no_cache,
            source_type=args.source,
            agency=args.agency,
            doc_type=args.doc_type,
        ))
