"""
Recovery operations for the research pipeline.

Provides retry/rerun commands for items that failed or have placeholder data:
- retry_failed_tier3: Re-process items that should have gone to Tier 3 but failed
- rerun_placeholder_tier2: Re-run Tier 2 for items with placeholder argument text
"""

import asyncio
from collections import defaultdict
from pathlib import Path
from typing import Optional

from shared_utils import get_db_connection
from scripts.research_pipeline.ids import make_custom_id
from scripts.research_pipeline.models.llm_outputs import Tier1Output, Tier2Output
from scripts.research_pipeline.models.matches import ProcessingUnit, MatchInfo
from scripts.research_pipeline.pipeline_runner import run_pipeline as run_pipeline_fn, run_tier3_only
from scripts.research_pipeline.routing import is_high_risk_issue_type, LOW_CONFIDENCE_THRESHOLD


def _build_match_infos(matches: list, content: str) -> list[MatchInfo]:
    """Build MatchInfo objects from raw DB match rows (id, pattern, context)."""
    match_infos = []
    for m in matches:
        match_id, pattern, context = m[0], m[1] or '', m[2] or ''
        pos = content.lower().find(pattern.lower()) if pattern else -1
        if pos == -1:
            pos = content.lower().find(context[:50].lower()) if context else 0
            pos = max(0, pos)

        match_infos.append(MatchInfo(
            match_id=match_id,
            matched_text=pattern,
            position_start=pos,
            position_end=pos + len(pattern) if pattern else pos,
            surrounding_context=context,
        ))
    return match_infos


def _fetch_matches_for_pairs(conn, doc_issue_pairs: list[tuple[int, str]]) -> dict[tuple[int, str], list]:
    """Batch fetch compliance_issues matches for a list of (doc_id, issue_type) pairs."""
    if not doc_issue_pairs:
        return {}

    values_placeholders = ', '.join(['(%s, %s)'] * len(doc_issue_pairs))
    flat_params = []
    for doc_id, issue_type in doc_issue_pairs:
        flat_params.extend([doc_id, issue_type])

    query = f"""
        SELECT document_id, issue_type, id, regex_match_pattern, regex_match_context
        FROM compliance_issues
        WHERE (document_id, issue_type) IN ({values_placeholders})
        ORDER BY document_id, issue_type, id
    """
    with conn.cursor() as cur:
        cur.execute(query, tuple(flat_params))
        all_matches = cur.fetchall()

    matches_by_doc: dict[tuple[int, str], list] = defaultdict(list)
    for row in all_matches:
        key = (row[0], row[1])
        matches_by_doc[key].append(row[2:])  # (id, pattern, context)

    return matches_by_doc


async def retry_failed_tier3(
    state: Optional[str] = None,
    title: Optional[str] = None,
    issue_types: Optional[list[str]] = None,
    dry_run: bool = False,
):
    """
    Find and retry items that should have gone to Tier 3 but failed.

    Queries for items that:
    - Have tier2_classification (burdensome or justified)
    - Do NOT have tier3_classification
    - Match Tier 3 escalation triggers based on routing logic

    Args:
        state: State code ('NJ', 'NY', or None for all)
        title: Optional title filter
        issue_types: Optional list of issue types to filter
        dry_run: If True, just show what would be retried
    """
    conn = get_db_connection()
    if conn is None:
        print("ERROR: Could not connect to database")
        return

    print(f"State: {state or 'ALL'}")
    print(f"Title: {title or 'ALL'}")
    print(f"Issue types: {', '.join(issue_types) if issue_types else 'ALL'}")
    print()

    # Query items with tier2 but no tier3
    query = """
        SELECT
            cia.document_id, cia.issue_type,
            cia.tier2_classification, cia.tier2_confidence, cia.tier2_reasoning,
            cia.severity, cia.verbatim_requirements,
            cia.argument_for_regulation, cia.argument_against_regulation,
            cia.cites_federal_statute, cia.federal_citation,
            cia.claims_no_alternative, cia.potentially_controversial,
            cia.federal_mandate_suspected,
            rd.citation, rd.title, rd.content, rd.state
        FROM compliance_issue_analyses cia
        JOIN regulatory_documents rd ON cia.document_id = rd.id
        WHERE cia.tier2_classification IN ('burdensome', 'justified')
          AND cia.tier3_classification IS NULL
    """

    params = []
    if state:
        query += " AND cia.state = %s"
        params.append(state)

    if issue_types:
        placeholders = ', '.join(['%s'] * len(issue_types))
        query += f" AND cia.issue_type IN ({placeholders})"
        params.extend(issue_types)

    if title:
        query += " AND rd.njac_title = %s"
        params.append(title)

    query += " ORDER BY cia.document_id"

    try:
        with conn.cursor() as cur:
            cur.execute(query, tuple(params) if params else None)
            rows = cur.fetchall()

        print(f"Found {len(rows)} items with tier2 but no tier3")

        if not rows:
            print("No items to retry")
            conn.close()
            return

        # Filter to items that SHOULD have gone to Tier 3 based on routing logic
        items_to_retry = []
        skipped_no_trigger = 0

        for row in rows:
            (doc_id, issue_type,
             t2_class, t2_conf, t2_reasoning,
             severity, verbatim,
             arg_for, arg_against,
             cites_federal, federal_citation,
             claims_no_alt, potentially_controversial,
             federal_mandate_suspected,
             citation, title_val, content, doc_state) = row

            # Check escalation triggers
            should_escalate = False
            reason = ""

            if is_high_risk_issue_type(issue_type) and t2_class == "justified":
                should_escalate = True
                reason = f"High-risk issue ({issue_type}) + justified"
            elif is_high_risk_issue_type(issue_type) and severity and severity >= 7:
                should_escalate = True
                reason = f"High-risk issue ({issue_type}) + severity {severity}"
            elif cites_federal:
                should_escalate = True
                reason = f"Federal statute: {federal_citation or 'unspecified'}"
            elif claims_no_alt and severity and severity >= 7:
                should_escalate = True
                reason = f"No alternative claimed + severity {severity}"
            elif t2_conf and t2_conf < LOW_CONFIDENCE_THRESHOLD and severity and severity >= 7:
                should_escalate = True
                reason = f"Low confidence ({t2_conf:.2f}) + severity {severity}"
            elif t2_class == "justified" and potentially_controversial:
                should_escalate = True
                reason = "Controversial justified"
            elif federal_mandate_suspected:
                should_escalate = True
                reason = "Federal mandate suspected"

            if should_escalate:
                items_to_retry.append({
                    'doc_id': doc_id,
                    'issue_type': issue_type,
                    'reason': reason,
                    'tier2_output': {
                        'classification': t2_class,
                        'confidence': t2_conf or 0.8,
                        'reasoning': t2_reasoning or '',
                        'argument_for_regulation': arg_for or '',
                        'argument_against_regulation': arg_against or '',
                        'severity': severity,
                        'verbatim_requirements': verbatim or [],
                        'context_used': [],
                        'full_text_requests': [],
                    },
                    'citation': citation,
                    'title': title_val,
                    'content': content,
                    'state': doc_state,
                })
            else:
                skipped_no_trigger += 1

        print(f"\nItems that should have escalated to Tier 3: {len(items_to_retry)}")
        print(f"Skipped (no trigger): {skipped_no_trigger}")

        if not items_to_retry:
            print("\nNo items need retry")
            conn.close()
            return

        # Report by issue type
        by_issue: dict[str, list] = {}
        for item in items_to_retry:
            by_issue.setdefault(item['issue_type'], []).append(item)

        print("\nBy issue type:")
        for issue, items in sorted(by_issue.items()):
            print(f"  {issue}: {len(items)}")

        if dry_run:
            print("\n[DRY RUN] Would retry the following items:")
            for item in items_to_retry[:10]:
                print(f"  - {item['citation']} ({item['issue_type']}): {item['reason']}")
            if len(items_to_retry) > 10:
                print(f"  ... and {len(items_to_retry) - 10} more")
            conn.close()
            return

        # Build processing units and tier2 outputs
        doc_issue_pairs = [(item['doc_id'], item['issue_type']) for item in items_to_retry]
        matches_by_doc = _fetch_matches_for_pairs(conn, doc_issue_pairs)

        processing_units = []
        tier2_outputs = {}
        skipped_no_matches = 0

        for item in items_to_retry:
            doc_id = item['doc_id']
            issue_type = item['issue_type']
            content = item['content'] or ''

            matches = matches_by_doc.get((doc_id, issue_type), [])
            if not matches:
                skipped_no_matches += 1
                continue

            match_infos = _build_match_infos(matches, content)

            pu = ProcessingUnit(
                document_id=doc_id,
                issue_type=issue_type,
                citation=item['citation'] or '',
                title=item['title'] or '',
                content=content,
                matches=match_infos,
            )
            processing_units.append(pu)

            custom_id = make_custom_id(doc_id, issue_type)
            tier2_outputs[custom_id] = Tier2Output(
                classification=item['tier2_output']['classification'],
                confidence=item['tier2_output']['confidence'],
                reasoning=item['tier2_output']['reasoning'],
                argument_for_regulation=item['tier2_output']['argument_for_regulation'],
                argument_against_regulation=item['tier2_output']['argument_against_regulation'],
                severity=item['tier2_output']['severity'],
                verbatim_requirements=item['tier2_output']['verbatim_requirements'],
                context_used=[],
                full_text_requests=[],
            )

        if skipped_no_matches > 0:
            print(f"  Skipped {skipped_no_matches} items without matches")

        print(f"\nProcessing {len(processing_units)} items with realtime API...")

        # Run Tier 3
        batches_dir = Path(__file__).parent.parent / "batches"
        batches_dir.mkdir(exist_ok=True)

        unique_issues = list(set(item['issue_type'] for item in items_to_retry))

        results = await run_tier3_only(
            processing_units=processing_units,
            tier2_outputs=tier2_outputs,
            state=state or "NJ",
            issue_types=unique_issues,
            batches_dir=batches_dir,
            realtime=True,
        )

        # Results summary
        succeeded = [u for u in results if u.tier3_output]
        failed = [u for u in results if u.error_message]

        print(f"\n{'='*70}")
        print("RETRY RESULTS")
        print(f"{'='*70}")
        print(f"Succeeded: {len(succeeded)}")
        print(f"Failed: {len(failed)}")

        if failed:
            print("\nFailed items:")
            for unit in failed[:10]:
                print(f"  - {unit.unit.citation}: {unit.error_message}")
            if len(failed) > 10:
                print(f"  ... and {len(failed) - 10} more")

        from scripts.research_pipeline.db import save_final_results
        saved = save_final_results(results, conn)
        print(f"\nSaved {saved} results to database")

        conn.close()

    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        conn.close()


async def rerun_placeholder_tier2(
    state: Optional[str] = None,
    title: Optional[str] = None,
    issue_types: Optional[list[str]] = None,
    dry_run: bool = False,
    realtime: bool = False,
    max_tier: int = 2,
    enable_web_search: bool = False,
):
    """
    Re-run Tier 2 (and optionally Tier 3) for items with placeholder text.

    Finds items where argument_for_regulation or argument_against_regulation
    contains 'Resumed from database', loads their Tier 1 results, and re-runs
    Tier 2 to generate proper arguments.

    Args:
        state: State code ('NJ', 'NY', or None for all)
        title: Optional title filter
        issue_types: Optional list of issue types to filter
        dry_run: If True, just show what would be rerun
        realtime: If True, use realtime API (default: batch API)
        max_tier: Maximum tier to run (2 or 3)
        enable_web_search: Whether to enable Tier 3 web search
    """
    conn = get_db_connection()
    if conn is None:
        print("ERROR: Could not connect to database")
        return

    print(f"State: {state or 'ALL'}")
    print(f"Title: {title or 'ALL'}")
    print(f"Issue types: {', '.join(issue_types) if issue_types else 'ALL'}")
    print(f"Max tier: {max_tier}")
    print(f"Enable web search: {enable_web_search}")
    print(f"API mode: {'realtime' if realtime else 'batch'}")
    print()

    query = """
        SELECT
            cia.document_id, cia.issue_type,
            cia.tier1_classification, cia.tier1_confidence, cia.tier1_reasoning,
            cia.tier1_relevant_match_ids, cia.tier1_dismissed_match_ids,
            cia.tier1_argument_framing, cia.tier1_recommendations,
            rd.citation, rd.title, rd.content, rd.state
        FROM compliance_issue_analyses cia
        JOIN regulatory_documents rd ON cia.document_id = rd.id
        WHERE cia.highest_tier_completed >= 2
          AND (cia.argument_for_regulation LIKE '%%Resumed from database%%'
               OR cia.argument_against_regulation LIKE '%%Resumed from database%%')
          AND cia.tier1_classification = 'needs_research'
    """

    params = []
    if state:
        query += " AND cia.state = %s"
        params.append(state)

    if issue_types:
        placeholders = ', '.join(['%s'] * len(issue_types))
        query += f" AND cia.issue_type IN ({placeholders})"
        params.extend(issue_types)

    if title:
        query += " AND rd.njac_title = %s"
        params.append(title)

    query += " ORDER BY cia.document_id"

    try:
        with conn.cursor() as cur:
            cur.execute(query, tuple(params) if params else None)
            rows = cur.fetchall()

        print(f"Found {len(rows)} items with placeholder text")

        if not rows:
            print("No items to rerun")
            conn.close()
            return

        # Report by issue type
        by_issue: dict[str, list] = {}
        for row in rows:
            by_issue.setdefault(row[1], []).append(row)

        print("\nBy issue type:")
        for issue, items in sorted(by_issue.items()):
            print(f"  {issue}: {len(items)}")

        if dry_run:
            print("\n[DRY RUN] Would rerun Tier 2 for the following items:")
            for row in rows[:10]:
                doc_id, issue_type = row[0], row[1]
                citation = row[9]
                print(f"  - doc {doc_id}: {citation} ({issue_type})")
            if len(rows) > 10:
                print(f"  ... and {len(rows) - 10} more")
            conn.close()
            return

        # Build items list
        items_to_rerun = []
        for row in rows:
            (doc_id, issue_type,
             t1_class, t1_conf, t1_reasoning,
             t1_relevant_ids, t1_dismissed_ids,
             t1_argument_framing, t1_recommendations,
             citation, title_val, content, doc_state) = row

            items_to_rerun.append({
                'doc_id': doc_id,
                'issue_type': issue_type,
                'tier1_output': {
                    'classification': t1_class,
                    'confidence': t1_conf or 0.8,
                    'reasoning': t1_reasoning or '',
                    'relevant_match_ids': t1_relevant_ids or [],
                    'dismissed_match_ids': t1_dismissed_ids or [],
                    'argument_framing': t1_argument_framing or {},
                    'recommendations': t1_recommendations or {},
                },
                'citation': citation,
                'title': title_val,
                'content': content,
                'state': doc_state,
            })

        # Batch fetch matches
        doc_issue_pairs = [(item['doc_id'], item['issue_type']) for item in items_to_rerun]
        matches_by_doc = _fetch_matches_for_pairs(conn, doc_issue_pairs)

        processing_units = []
        skipped_no_matches = 0

        for item in items_to_rerun:
            doc_id = item['doc_id']
            issue_type = item['issue_type']
            content = item['content'] or ''

            matches = matches_by_doc.get((doc_id, issue_type), [])
            if not matches:
                skipped_no_matches += 1
                continue

            match_infos = _build_match_infos(matches, content)

            pu = ProcessingUnit(
                document_id=doc_id,
                issue_type=issue_type,
                citation=item['citation'] or '',
                title=item['title'] or '',
                content=content,
                matches=match_infos,
            )
            processing_units.append(pu)

        if skipped_no_matches > 0:
            print(f"  Skipped {skipped_no_matches} items without matches")

        print(f"\nProcessing {len(processing_units)} items...")

        # Run pipeline from Tier 2 (tier2_reruns=True skips Tier 1)
        batches_dir = Path(__file__).parent.parent / "batches"
        batches_dir.mkdir(exist_ok=True)

        unique_issues = list(set(item['issue_type'] for item in items_to_rerun))

        results = await run_pipeline_fn(
            processing_units=processing_units,
            state=state or "NJ",
            issue_types=unique_issues,
            batches_dir=batches_dir,
            realtime=realtime,
            max_tier=max_tier,
            enable_web_search=enable_web_search,
            tier2_reruns=True,
        )

        # Results summary
        tier2_succeeded = [u for u in results if u.tier2_output]
        tier2_failed = [u for u in results if u.error_message and not u.tier2_output]
        tier3_succeeded = [u for u in results if u.tier3_output]

        print(f"\n{'='*70}")
        print("RERUN RESULTS")
        print(f"{'='*70}")
        print(f"Tier 2 succeeded: {len(tier2_succeeded)}")
        print(f"Tier 2 failed: {len(tier2_failed)}")
        if max_tier >= 3:
            print(f"Tier 3 succeeded: {len(tier3_succeeded)}")

        if tier2_failed:
            print("\nFailed items:")
            for unit in tier2_failed[:10]:
                print(f"  - {unit.unit.citation}: {unit.error_message}")
            if len(tier2_failed) > 10:
                print(f"  ... and {len(tier2_failed) - 10} more")

        # Results are already saved by pipeline's incremental save
        print(f"\nResults saved to database")

        conn.close()

    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        conn.close()
