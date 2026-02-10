"""
Statute mandate check runner.

Post-pipeline step that checks whether cited statutes actually mandate
the flagged regulatory issues. Runs for NY regulations that:
1. Have completed analysis (classification = burdensome or justified)
2. Have linked statutes (via regulation_statute_links with match_status='matched')

This is a standalone function, not part of the tier state machine.
"""

import asyncio
import time
from pathlib import Path
from typing import Optional

import anthropic
import yaml

from lib.db import get_db_connection
from lib.llm import call_llm_parse_async, DEFAULT_MODEL
from scripts.research_pipeline.models.statute_mandate import StatuteMandateOutput
from scripts.research_pipeline.cost_tracker import CostTracker, format_time


# Load prompt from YAML
PROMPTS_DIR = Path(__file__).parent.parent.parent.parent.parent / 'prompts'
RESEARCH_PIPELINE_YAML = PROMPTS_DIR / 'research_pipeline.yaml'

_prompt_cache: Optional[dict] = None


def _load_statute_mandate_prompt() -> dict:
    """Load the statute_mandate prompt section from research_pipeline.yaml."""
    global _prompt_cache
    if _prompt_cache is not None:
        return _prompt_cache

    with open(RESEARCH_PIPELINE_YAML, 'r') as f:
        data = yaml.safe_load(f)

    _prompt_cache = data['statute_mandate']
    return _prompt_cache


def _fetch_mandate_check_candidates(
    state: str,
    limit: Optional[int] = None,
) -> list[dict]:
    """
    Fetch (analysis, statute) pairs that need mandate checks.

    Joins compliance_issue_analyses + regulation_statute_links + statutes + regulatory_documents
    where:
    - state matches
    - classification is burdensome or justified
    - link match_status is 'matched'
    - no existing row in statute_mandate_checks for this (analysis_id, statute_id) pair

    Returns list of dicts with all fields needed to build the prompt.
    """
    conn = get_db_connection()
    if conn is None:
        raise RuntimeError("Failed to establish database connection")

    try:
        with conn.cursor() as cur:
            limit_clause = f"LIMIT {limit}" if limit else ""

            cur.execute(f"""
                SELECT
                    cia.id AS analysis_id,
                    cia.document_id,
                    cia.issue_type,
                    COALESCE(cia.tier3_classification, cia.tier2_classification) AS classification,
                    COALESCE(cia.final_severity, cia.severity) AS severity,
                    COALESCE(cia.tier3_reasoning, cia.tier2_reasoning) AS analysis_reasoning,
                    rd.citation AS regulation_citation,
                    rd.content AS regulation_text,
                    s.id AS statute_id,
                    s.citation AS statute_citation,
                    s.content AS statute_text,
                    COALESCE(s.nycls_law_name, s.title) AS statute_law_name,
                    rsl.id AS link_id,
                    rsl.link_type
                FROM compliance_issue_analyses cia
                JOIN regulatory_documents rd ON cia.document_id = rd.id
                JOIN regulation_statute_links rsl ON rsl.regulation_id = rd.id
                JOIN statutes s ON rsl.statute_id = s.id
                LEFT JOIN statute_mandate_checks smc
                    ON smc.analysis_id = cia.id AND smc.statute_id = s.id
                WHERE cia.state = %s
                  AND COALESCE(cia.tier3_classification, cia.tier2_classification)
                      IN ('burdensome', 'justified')
                  AND rsl.match_status = 'matched'
                  AND smc.id IS NULL
                ORDER BY cia.id, s.id
                {limit_clause}
            """, [state.upper()])

            columns = [desc[0] for desc in cur.description]
            return [dict(zip(columns, row)) for row in cur.fetchall()]
    finally:
        conn.close()


def _get_issue_description(issue_type: str) -> str:
    """Get a human-readable description for an issue type."""
    try:
        from scripts.research_pipeline.prompt_loader import load_issue_config
        config = load_issue_config(issue_type)
        return config.description
    except Exception:
        return issue_type.replace('_', ' ')


def _save_mandate_check(
    analysis_id: int,
    statute_id: int,
    link_id: Optional[int],
    result: StatuteMandateOutput,
    model: str,
) -> bool:
    """Save a single mandate check result to the database."""
    conn = get_db_connection()
    if conn is None:
        return False

    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO statute_mandate_checks
                    (analysis_id, statute_id, link_id,
                     statute_mandated, confidence, reasoning, statute_text_excerpt,
                     model)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (analysis_id, statute_id) DO UPDATE SET
                    statute_mandated = EXCLUDED.statute_mandated,
                    confidence = EXCLUDED.confidence,
                    reasoning = EXCLUDED.reasoning,
                    statute_text_excerpt = EXCLUDED.statute_text_excerpt,
                    model = EXCLUDED.model,
                    created_at = CURRENT_TIMESTAMP
            """, [
                analysis_id,
                statute_id,
                link_id,
                result.statute_mandated,
                result.confidence,
                result.reasoning,
                result.statute_text_excerpt,
                model,
            ])
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        print(f"  Error saving mandate check: {e}")
        return False
    finally:
        conn.close()


async def run_statute_mandate_checks(
    state: str = "NY",
    dry_run: bool = True,
    limit: Optional[int] = None,
    model: Optional[str] = None,
) -> dict:
    """
    Run statute mandate checks for flagged analyses with statute links.

    This is a post-pipeline step that:
    1. Queries for (analysis, statute) pairs needing checks
    2. Calls the LLM for each pair
    3. Stores results in statute_mandate_checks table

    Args:
        state: State code (default: NY)
        dry_run: If True, preview without making LLM calls
        limit: Max pairs to process (None = all)
        model: LLM model override

    Returns:
        Dict with counts: total, processed, mandated, not_mandated, errors
    """
    model = model or DEFAULT_MODEL
    prompt_config = _load_statute_mandate_prompt()
    system_prompt = prompt_config['system']
    template = prompt_config['template']

    print(f"\n{'='*70}")
    print(f"STATUTE MANDATE CHECK {'(DRY RUN)' if dry_run else ''}")
    print(f"{'='*70}")
    print(f"State: {state}")
    print(f"Model: {model}")
    if limit:
        print(f"Limit: {limit}")
    print()

    # Fetch candidates
    print("Fetching analysis-statute pairs needing mandate checks...")
    candidates = _fetch_mandate_check_candidates(state, limit)

    if not candidates:
        print("No pairs need mandate checks.")
        print("  (All matched statute links already checked, or no flagged analyses with statute links)")
        return {"total": 0, "processed": 0, "mandated": 0, "not_mandated": 0, "errors": 0}

    # Count unique analyses and statutes
    unique_analyses = len(set(c['analysis_id'] for c in candidates))
    unique_statutes = len(set(c['statute_id'] for c in candidates))
    print(f"Found {len(candidates)} pairs ({unique_analyses} analyses x {unique_statutes} unique statutes)")
    print()

    # Show sample
    print("Sample pairs:")
    for c in candidates[:5]:
        print(f"  - {c['regulation_citation']} [{c['issue_type']}] "
              f"({c['classification']}, severity {c['severity']}) "
              f"<-> {c['statute_citation']} ({c['link_type']})")
    if len(candidates) > 5:
        print(f"  ... and {len(candidates) - 5} more")
    print()

    if dry_run:
        # Breakdown by classification
        by_class = {}
        for c in candidates:
            key = c['classification']
            by_class[key] = by_class.get(key, 0) + 1
        print("By classification:")
        for cls, count in sorted(by_class.items()):
            print(f"  {cls}: {count}")

        # Breakdown by link_type
        by_link = {}
        for c in candidates:
            key = c['link_type'] or 'reference'
            by_link[key] = by_link.get(key, 0) + 1
        print("By link type:")
        for lt, count in sorted(by_link.items()):
            print(f"  {lt}: {count}")

        print(f"\n{'='*70}")
        print("DRY RUN COMPLETE")
        print(f"{'='*70}")
        print(f"Would process: {len(candidates)} pairs")
        return {"total": len(candidates), "processed": 0, "mandated": 0, "not_mandated": 0, "errors": 0}

    # Process candidates
    client = anthropic.AsyncAnthropic()
    cost_tracker = CostTracker(run_id="statute_mandate")
    start_time = time.time()

    stats = {"total": len(candidates), "processed": 0, "mandated": 0, "not_mandated": 0, "errors": 0}

    # Cache issue descriptions to avoid repeated lookups
    issue_desc_cache: dict[str, str] = {}

    for i, candidate in enumerate(candidates):
        issue_type = candidate['issue_type']
        if issue_type not in issue_desc_cache:
            issue_desc_cache[issue_type] = _get_issue_description(issue_type)

        # Truncate texts to avoid exceeding context window
        regulation_text = (candidate['regulation_text'] or '')[:8000]
        statute_text = (candidate['statute_text'] or '')[:8000]

        # Build prompt from template
        user_prompt = template.format(
            regulation_citation=candidate['regulation_citation'],
            regulation_text=regulation_text,
            issue_type=issue_type,
            issue_description=issue_desc_cache[issue_type],
            classification=candidate['classification'],
            severity=candidate['severity'] or 'N/A',
            analysis_reasoning=(candidate['analysis_reasoning'] or '')[:2000],
            statute_citation=candidate['statute_citation'],
            statute_law_name=candidate['statute_law_name'] or '',
            link_type=candidate['link_type'] or 'reference',
            statute_text=statute_text,
        )

        elapsed = time.time() - start_time
        rate = (i / elapsed) if elapsed > 0 and i > 0 else 0
        remaining = ((len(candidates) - i) / rate) if rate > 0 else 0
        eta = format_time(remaining) if rate > 0 else "calculating..."

        print(f"  [{i+1}/{len(candidates)}] {candidate['regulation_citation']} <-> "
              f"{candidate['statute_citation']} (ETA: {eta})", end="", flush=True)

        try:
            result, usage = await call_llm_parse_async(
                client=client,
                prompt=user_prompt,
                response_format=StatuteMandateOutput,
                system=system_prompt,
                model=model,
                max_tokens=4096,
            )

            if result:
                saved = _save_mandate_check(
                    analysis_id=candidate['analysis_id'],
                    statute_id=candidate['statute_id'],
                    link_id=candidate['link_id'],
                    result=result,
                    model=model,
                )

                if saved:
                    stats['processed'] += 1
                    if result.statute_mandated:
                        stats['mandated'] += 1
                        print(f" -> MANDATED (conf: {result.confidence:.2f})")
                    else:
                        stats['not_mandated'] += 1
                        print(f" -> NOT MANDATED (conf: {result.confidence:.2f})")

                    cost_tracker.record_batch_usage(
                        tier=0,
                        input_tokens=usage.get("input_tokens", 0),
                        output_tokens=usage.get("output_tokens", 0),
                        cache_read_tokens=usage.get("cache_read_tokens", 0),
                        cache_write_tokens=usage.get("cache_write_tokens", 0),
                        request_count=1,
                        model=model,
                    )
                else:
                    stats['errors'] += 1
                    print(" -> SAVE ERROR")
            else:
                stats['errors'] += 1
                print(" -> NO RESULT")

        except Exception as e:
            stats['errors'] += 1
            print(f" -> ERROR: {str(e)[:60]}")

        # Rate limiting
        await asyncio.sleep(0.3)

    # Summary
    elapsed = time.time() - start_time
    cost_tracker.mark_complete()

    print(f"\n{'='*70}")
    print("STATUTE MANDATE CHECK COMPLETE")
    print(f"{'='*70}")
    print(f"Total pairs: {stats['total']}")
    print(f"Processed: {stats['processed']}")
    print(f"  Mandated by statute: {stats['mandated']}")
    print(f"  NOT mandated (agency discretion): {stats['not_mandated']}")
    print(f"Errors: {stats['errors']}")
    print(f"Time: {format_time(elapsed)}")
    print(cost_tracker.summary())

    return stats
