"""
Summary generator for the research pipeline.

Generates 1-2 sentence plain-language review summaries for completed
compliance issue analyses. Runs as a post-processing step after the
3-tier pipeline reaches terminal state.

Uses Anthropic Batch API with Haiku model for cost efficiency.
Supports two modes:
  1. Post-pipeline: generate_review_summaries() — from TrackedUnit objects
  2. Standalone: generate_summaries_from_db() — from existing DB analyses

Prompt caching: 2-layer structure
  - Layer 1 (system): Pipeline explanation + tone guidelines (cached globally)
  - Layer 2 prefix (user): Issue type block (cached per issue type)
  - Layer 2 suffix (user): Per-document analysis template (unique, no cache)
"""

import asyncio
import json
import logging
from pathlib import Path
from typing import Optional

import yaml
from psycopg import Connection

from .config import SUMMARY_MODEL, SUMMARY_MAX_TOKENS, DEFAULT_POLL_INTERVAL, MAX_BATCH_POLL_TIME
from .ids import make_custom_id, parse_custom_id
from .models.llm_outputs import SummaryOutput
from .prompt_loader import load_issue_config, list_issue_types
from .state_machine import TrackedUnit, ProcessingState

from lib.batch import BatchManager, format_batch_request, parse_batch_result_tool_use
from lib.db import get_db_connection

logger = logging.getLogger(__name__)

# Path to the research pipeline prompt YAML
_PROMPTS_DIR = Path(__file__).parent.parent.parent.parent / "prompts"
_RESEARCH_PIPELINE_YAML = _PROMPTS_DIR / "research_pipeline.yaml"

# Cache for loaded summary prompts
_summary_prompts: Optional[dict] = None


def _load_summary_prompts() -> dict:
    """Load summary system and template prompts from YAML."""
    global _summary_prompts
    if _summary_prompts is not None:
        return _summary_prompts

    with open(_RESEARCH_PIPELINE_YAML, "r") as f:
        data = yaml.safe_load(f)

    summary_section = data.get("summary")
    if not summary_section:
        raise ValueError("No 'summary' section found in research_pipeline.yaml")

    _summary_prompts = {
        "system": summary_section["system"],
        "template": summary_section["template"],
    }
    return _summary_prompts


def _get_issue_display_name(issue_type: str) -> str:
    """Get the human-readable display name for an issue type."""
    try:
        config = load_issue_config(issue_type)
        return config.display_name
    except (FileNotFoundError, KeyError):
        return issue_type.replace("_", " ").title()


def _get_issue_description(issue_type: str) -> str:
    """Get the description for an issue type."""
    try:
        config = load_issue_config(issue_type)
        return config.description
    except (FileNotFoundError, KeyError):
        return ""


def _format_flag(flag) -> tuple[str, str]:
    """Format an EvidencedFlag (object or dict) into (value_str, reason_str)."""
    if flag is None:
        return ("N/A", "N/A")
    if isinstance(flag, dict):
        return (str(flag.get("value", "N/A")), flag.get("reason", "N/A"))
    return (str(flag.value), flag.reason)


def _build_tier2_block(analysis: dict) -> str:
    """Build the Tier 2 analysis block for the summary prompt."""
    classification = analysis.get("tier2_classification")
    if not classification:
        return ""

    return (
        "=== TIER 2 ANALYSIS (Classification & Severity) ===\n"
        f"Classification: {classification}\n"
        f"Reasoning: {analysis.get('tier2_reasoning', 'N/A')}\n"
        f"Severity Calculation: {analysis.get('severity_calculation', 'N/A')}\n"
        f"Federal Citation: {analysis.get('federal_citation', 'None')}\n"
    )


def _build_tier3_block(analysis: dict) -> str:
    """Build the Tier 3 analysis block for the summary prompt."""
    classification = analysis.get("tier3_classification")
    if not classification:
        return ""

    # Extract evidence flags
    federal_mandate = analysis.get("federal_mandate_confirmed")
    state_discretion = analysis.get("state_discretion_found")
    modernized_alt = analysis.get("modernized_alternative_found")
    superseded = analysis.get("superseded_by_law")
    advocacy = analysis.get("advocacy_for_change")

    fm_val, fm_reason = _format_flag(federal_mandate)
    sd_val, sd_reason = _format_flag(state_discretion)
    ma_val, ma_reason = _format_flag(modernized_alt)
    ss_val, ss_reason = _format_flag(superseded)
    adv_val, adv_reason = _format_flag(advocacy)

    # Build web quotes from context_used entries where type == "web"
    web_quotes = ""
    context_used = analysis.get("context_used")
    if context_used:
        if isinstance(context_used, str):
            try:
                context_used = json.loads(context_used)
            except (json.JSONDecodeError, TypeError):
                context_used = []
        if isinstance(context_used, list):
            for entry in context_used:
                if isinstance(entry, dict) and entry.get("type") == "web":
                    url = entry.get("identifier", "unknown")
                    quote = entry.get("quote", "")
                    relevance = entry.get("relevance", "")
                    if quote:
                        web_quotes += f'- [{url}]: "{quote}" — {relevance}\n'

    if not web_quotes:
        web_quotes = "No web sources cited"

    severity_adj = analysis.get("tier3_severity_adjustment", "None")
    severity_adj_reasoning = analysis.get("tier3_severity_adjustment_reasoning", "N/A")

    return (
        "=== TIER 3 ANALYSIS (Web Search Verification) ===\n"
        f"Classification: {classification}\n"
        f"Reasoning: {analysis.get('tier3_reasoning', 'N/A')}\n"
        f"Web Search Findings: {analysis.get('web_search_summary', 'N/A')}\n"
        f"Severity Adjustment: {severity_adj}\n"
        f"\n"
        f"KEY EVIDENCE FLAGS (include in summary when they'd add clarity):\n"
        f"- Federal Mandate: {fm_val} — {fm_reason}\n"
        f"- State Has Discretion: {sd_val} — {sd_reason}\n"
        f"- Peer State Alternative: {ma_val} — {ma_reason}\n"
        f"- Superseded by Law: {ss_val} — {ss_reason}\n"
        f"- Advocacy for Change: {adv_val} — {adv_reason}\n"
        f"\n"
        f"WEB SOURCE QUOTES:\n"
        f"{web_quotes}\n"
        f"\n"
        f"Cleanup Recommendation: {analysis.get('cleanup_recommendation', 'None')}\n"
    )


def _build_issue_type_block(issue_type: str) -> str:
    """Build the cached issue type prefix block for the user message."""
    display_name = _get_issue_display_name(issue_type)
    description = _get_issue_description(issue_type)
    return (
        f"ISSUE TYPE CONTEXT:\n"
        f"Issue Type: {display_name} ({issue_type})\n"
        f"Description: {description}\n"
        f"\n"
        f"---\n"
    )


def _build_analysis_template(
    analysis: dict,
    prompts: dict,
) -> str:
    """Build the per-document analysis template (unique suffix, no cache).

    Args:
        analysis: Dict with all analysis fields and document metadata.
        prompts: Dict with 'system' and 'template' keys from YAML.

    Returns:
        Formatted template string.
    """
    # Format verbatim requirements
    verbatim = analysis.get("verbatim_requirements")
    if isinstance(verbatim, list):
        verbatim_str = "\n".join(f"- {r}" for r in verbatim) if verbatim else "N/A"
    elif isinstance(verbatim, str):
        verbatim_str = verbatim or "N/A"
    else:
        verbatim_str = "N/A"

    # Format context_used
    context_used = analysis.get("context_used")
    if isinstance(context_used, str):
        try:
            context_used = json.loads(context_used)
        except (json.JSONDecodeError, TypeError):
            pass
    if isinstance(context_used, list):
        context_str = "\n".join(
            f"- [{c.get('type', '?')}] {c.get('identifier', '?')}: {c.get('quote', '')[:100]}"
            for c in context_used
            if isinstance(c, dict)
        ) if context_used else "None"
    else:
        context_str = "None"

    # Format dismissed reasons
    dismissed = analysis.get("tier1_dismissed_reasons")
    if isinstance(dismissed, str):
        try:
            dismissed = json.loads(dismissed)
        except (json.JSONDecodeError, TypeError):
            pass
    if isinstance(dismissed, list):
        dismissed_str = "\n".join(
            f"- Match {d.get('matchIndex', '?')}: {d.get('reason', '?')}"
            for d in dismissed
            if isinstance(d, dict)
        ) if dismissed else "None"
    else:
        dismissed_str = str(dismissed) if dismissed else "None"

    # Determine highest tier
    highest_tier = analysis.get("highest_tier_completed", 1)

    # Determine final classification
    classification = (
        analysis.get("tier3_classification")
        or analysis.get("tier2_classification")
        or analysis.get("tier1_classification")
        or "unknown"
    )

    # Build tier blocks
    tier2_block = _build_tier2_block(analysis)
    tier3_block = _build_tier3_block(analysis)

    template = prompts["template"]
    return template.format(
        citation=analysis.get("citation", "Unknown"),
        title=analysis.get("title", "Unknown"),
        document_summary=analysis.get("document_summary", "N/A"),
        issue_type_display=analysis.get("issue_type_display", analysis.get("issue_type", "Unknown")),
        issue_type=analysis.get("issue_type", "Unknown"),
        classification=classification,
        highest_tier=highest_tier,
        severity=analysis.get("final_severity") or analysis.get("severity") or "N/A",
        affected_population=analysis.get("primary_affected_population", "N/A"),
        verbatim_requirements=verbatim_str,
        argument_against=analysis.get("argument_against_regulation", "N/A"),
        argument_for=analysis.get("argument_for_regulation", "N/A"),
        regex_match_context=analysis.get("regex_match_context", "N/A"),
        context_used=context_str,
        tier1_classification=analysis.get("tier1_classification", "N/A"),
        tier1_reasoning=analysis.get("tier1_reasoning", "N/A"),
        dismissed_reasons=dismissed_str,
        tier2_block=tier2_block,
        tier3_block=tier3_block,
    )


def _prepare_batch_requests(
    analyses: list[dict],
    prompts: dict,
) -> tuple[list[dict], dict[str, dict]]:
    """Prepare batch requests for summary generation.

    Sorts by issue_type to maximize cache hits on the issue type prefix block.

    Args:
        analyses: List of analysis dicts with all required fields.
        prompts: Summary prompts from YAML.

    Returns:
        Tuple of (batch_requests, id_to_analysis_map).
    """
    # Sort by issue_type for cache efficiency
    sorted_analyses = sorted(analyses, key=lambda a: a.get("issue_type", ""))

    requests = []
    id_map: dict[str, dict] = {}

    for analysis in sorted_analyses:
        doc_id = analysis.get("document_id") or analysis.get("guidance_document_id")
        issue_type = analysis.get("issue_type", "unknown")
        source_type = analysis.get("source_type", "regulation")

        custom_id = f"summary_{make_custom_id(doc_id, issue_type, source_type)}"

        # Build the 2-layer user message
        issue_block = _build_issue_type_block(issue_type)
        document_template = _build_analysis_template(analysis, prompts)

        request = format_batch_request(
            custom_id=custom_id,
            prompt=document_template,
            response_format=SummaryOutput,
            model=SUMMARY_MODEL,
            system=prompts["system"],
            max_tokens=SUMMARY_MAX_TOKENS,
            user_cached_prefix=issue_block,
        )
        requests.append(request)
        id_map[custom_id] = analysis

    return requests, id_map


def _extract_analysis_from_unit(unit: TrackedUnit, conn: Connection) -> Optional[dict]:
    """Extract analysis data from a TrackedUnit for summary generation.

    Fetches document metadata from DB since TrackedUnit doesn't carry
    citation/title/summary. Assembles tier outputs into a flat dict.
    """
    source_type = unit.unit.source_type
    doc_id = unit.document_id
    issue_type = unit.issue_type

    # Fetch document metadata
    with conn.cursor() as cur:
        if source_type == "guidance":
            cur.execute(
                "SELECT title, NULL as citation, NULL as summary FROM guidance_documents WHERE id = %s",
                (doc_id,),
            )
        else:
            cur.execute(
                "SELECT title, citation, summary FROM regulatory_documents WHERE id = %s",
                (doc_id,),
            )
        row = cur.fetchone()
        if not row:
            logger.warning("Document %d not found in DB", doc_id)
            return None

    title = row[0] or "Unknown"
    citation = row[1] or unit.unit.citation or "Unknown"
    doc_summary = row[2] or ""

    # Fetch regex match context from compliance_issues
    regex_match_context = ""
    with conn.cursor() as cur:
        id_col = "guidance_document_id" if source_type == "guidance" else "document_id"
        cur.execute(f"""
            SELECT regex_match_context
            FROM compliance_issues
            WHERE {id_col} = %s AND issue_type = %s
            LIMIT 5
        """, (doc_id, issue_type))
        contexts = [r[0] for r in cur.fetchall() if r[0]]
        if contexts:
            regex_match_context = "\n".join(f"- {c[:200]}" for c in contexts)

    analysis: dict = {
        "document_id": doc_id if source_type == "regulation" else None,
        "guidance_document_id": doc_id if source_type == "guidance" else None,
        "issue_type": issue_type,
        "source_type": source_type,
        "citation": citation,
        "title": title,
        "document_summary": doc_summary,
        "issue_type_display": _get_issue_display_name(issue_type),
        "regex_match_context": regex_match_context,
    }

    # Tier 1 fields
    t1 = unit.tier1_output
    if t1:
        analysis["tier1_classification"] = t1.classification
        analysis["tier1_reasoning"] = t1.reasoning
        analysis["tier1_dismissed_reasons"] = json.dumps(
            [d.model_dump(by_alias=True) for d in t1.dismissed_matches]
        ) if t1.dismissed_matches else "[]"

    # Tier 2 fields
    t2 = unit.tier2_output
    if t2:
        analysis["tier2_classification"] = t2.classification
        analysis["tier2_reasoning"] = t2.reasoning
        analysis["severity"] = t2.severity
        analysis["severity_calculation"] = t2.severity_calculation
        analysis["final_severity"] = t2.severity
        analysis["argument_for_regulation"] = t2.argument_for_regulation
        analysis["argument_against_regulation"] = t2.argument_against_regulation
        analysis["federal_citation"] = t2.federal_citation
        analysis["primary_affected_population"] = t2.primary_affected_population
        analysis["verbatim_requirements"] = t2.verbatim_requirements
        analysis["context_used"] = json.dumps(
            [c.model_dump(by_alias=True, exclude_none=True) for c in t2.context_used]
        ) if t2.context_used else "[]"
        analysis["highest_tier_completed"] = 2

    # Tier 3 fields (override Tier 2 where present)
    t3 = unit.tier3_output
    if t3:
        analysis["tier3_classification"] = t3.classification
        analysis["tier3_reasoning"] = t3.reasoning
        analysis["final_severity"] = t3.final_severity or analysis.get("severity")
        analysis["tier3_severity_adjustment"] = t3.severity_adjustment
        analysis["tier3_severity_adjustment_reasoning"] = t3.severity_adjustment_reasoning
        analysis["web_search_summary"] = t3.web_search_summary
        analysis["argument_for_regulation"] = t3.argument_for_regulation
        analysis["argument_against_regulation"] = t3.argument_against_regulation
        analysis["cleanup_recommendation"] = t3.cleanup_recommendation
        analysis["highest_tier_completed"] = 3

        # EvidencedFlag objects
        analysis["federal_mandate_confirmed"] = t3.federal_mandate_confirmed
        analysis["state_discretion_found"] = t3.state_discretion_found
        analysis["modernized_alternative_found"] = t3.modernized_alternative_found
        analysis["superseded_by_law"] = t3.superseded_by_law
        analysis["advocacy_for_change"] = t3.advocacy_for_change

        # Merge context_used (Tier 3 includes web sources)
        if t3.context_used:
            analysis["context_used"] = json.dumps(
                [c.model_dump(by_alias=True, exclude_none=True) for c in t3.context_used]
            )

    # Set highest_tier if only Tier 1 completed
    if not t2 and t1:
        analysis["highest_tier_completed"] = 1

    return analysis


def _process_batch_results(
    batch_id: str,
    manager: BatchManager,
    id_map: dict[str, dict],
) -> list[tuple]:
    """Process batch results and return list of (doc_id, guidance_doc_id, issue_type, summary) tuples."""
    results = []
    succeeded = 0
    failed = 0

    for result in manager.get_batch_results(batch_id):
        custom_id = result.custom_id
        analysis = id_map.get(custom_id)

        if not analysis:
            logger.warning("Unknown custom_id in summary batch: %s", custom_id)
            failed += 1
            continue

        if result.result.type != "succeeded":
            error_msg = ""
            if hasattr(result.result, "error") and result.result.error:
                error_msg = str(result.result.error)
            logger.warning(
                "Summary batch failed for %s: %s %s",
                custom_id, result.result.type, error_msg,
            )
            failed += 1
            continue

        try:
            output = parse_batch_result_tool_use(result, SummaryOutput)
            if output is None:
                logger.warning("Could not parse summary output for %s", custom_id)
                failed += 1
                continue

            results.append((
                analysis.get("document_id"),
                analysis.get("guidance_document_id"),
                analysis.get("issue_type"),
                output.review_summary,
            ))
            succeeded += 1
        except Exception as e:
            logger.warning("Error parsing summary for %s: %s", custom_id, e)
            failed += 1

    print(f"  Summary batch results: {succeeded} succeeded, {failed} failed")
    return results


async def generate_review_summaries(
    units: list[TrackedUnit],
    jurisdiction: str,
    conn: Optional[Connection] = None,
) -> int:
    """Generate review summaries for completed pipeline units.

    Main entry point used after pipeline run completes.

    Args:
        units: List of TrackedUnit objects in terminal state.
        jurisdiction: Jurisdiction code (e.g., 'NJ', 'NY').
        conn: Optional database connection.

    Returns:
        Count of summaries generated and saved.
    """
    if conn is None:
        conn = get_db_connection()
        should_close = True
    else:
        should_close = False

    try:
        # Filter to terminal-state units only
        terminal_units = [
            u for u in units
            if u.state in (ProcessingState.DONE, ProcessingState.DONE_FALSE_POSITIVE)
        ]

        if not terminal_units:
            print("  No terminal-state units to summarize.")
            return 0

        print(f"  Assembling summary prompts for {len(terminal_units)} analyses...")

        # Load prompts
        prompts = _load_summary_prompts()

        # Build analysis dicts from TrackedUnits
        analyses = []
        for i, unit in enumerate(terminal_units):
            if i % 100 == 0 and len(terminal_units) > 100:
                print(f"    Assembling: {i}/{len(terminal_units)}...", end="\r", flush=True)
            analysis = _extract_analysis_from_unit(unit, conn)
            if analysis:
                analyses.append(analysis)

        if len(terminal_units) > 100:
            print(f"    Assembled {len(analyses)} analysis contexts" + " " * 20)

        if not analyses:
            print("  No valid analyses to summarize.")
            return 0

        # Prepare and submit batch
        requests, id_map = _prepare_batch_requests(analyses, prompts)
        print(f"  Submitting summary batch: {len(requests)} requests (model: {SUMMARY_MODEL})")

        batches_dir = Path(__file__).parent / "batches"
        batches_dir.mkdir(exist_ok=True)
        manager = BatchManager(batches_dir=batches_dir)

        batch_id = manager.submit_batch(
            requests=requests,
            batch_name=f"{jurisdiction}_summaries",
            metadata={"jurisdiction": jurisdiction, "type": "review_summaries"},
        )
        print(f"  Batch submitted: {batch_id}")

        # Poll for completion
        await asyncio.to_thread(
            manager.poll_until_complete,
            batch_id,
            poll_interval=DEFAULT_POLL_INTERVAL,
            timeout=MAX_BATCH_POLL_TIME,
            log=print,
        )

        # Process results
        summary_tuples = _process_batch_results(batch_id, manager, id_map)

        if not summary_tuples:
            print("  No summaries to save.")
            return 0

        # Save to DB
        from .db.analysis_writer import save_review_summaries
        saved = save_review_summaries(summary_tuples, conn)
        print(f"  Saved {saved} review summaries to database")
        return saved

    finally:
        if should_close and conn:
            conn.close()


async def generate_summaries_from_db(
    jurisdiction: str,
    issue_types: Optional[list[str]] = None,
    conn: Optional[Connection] = None,
    limit: Optional[int] = None,
    title: Optional[str] = None,
    source: Optional[str] = None,
    agency: Optional[str] = None,
    doc_type: Optional[str] = None,
) -> int:
    """Generate summaries for existing analyses from the database.

    Standalone mode for the --summaries-only CLI flag.

    Args:
        jurisdiction: Jurisdiction code (e.g., 'NJ', 'NY').
        issue_types: Optional list of issue types to filter. If None, all types.
        conn: Optional database connection.
        limit: Optional limit on total analyses to process.
        title: Optional regulatory title filter (e.g., '18' for NYCRR Title 18).
        source: Optional source filter ('regulation' or 'guidance').
        agency: Optional agency filter for guidance docs (e.g., 'OCFS').
        doc_type: Optional document type filter for guidance docs (e.g., 'ADM').

    Returns:
        Count of summaries generated and saved.
    """
    if conn is None:
        conn = get_db_connection()
        should_close = True
    else:
        should_close = False

    try:
        prompts = _load_summary_prompts()

        # Fetch analyses from DB
        print(f"  Fetching analyses for summary generation...")
        analyses = _fetch_analyses_for_summaries(
            jurisdiction, issue_types, conn, limit,
            title=title, source=source, agency=agency, doc_type=doc_type,
        )

        if not analyses:
            print("  No analyses found to summarize.")
            return 0

        print(f"  Found {len(analyses)} analyses to summarize")

        # Prepare and submit batch
        requests, id_map = _prepare_batch_requests(analyses, prompts)
        print(f"  Submitting summary batch: {len(requests)} requests (model: {SUMMARY_MODEL})")

        batches_dir = Path(__file__).parent / "batches"
        batches_dir.mkdir(exist_ok=True)
        manager = BatchManager(batches_dir=batches_dir)

        batch_id = manager.submit_batch(
            requests=requests,
            batch_name=f"{jurisdiction}_summaries_standalone",
            metadata={
                "jurisdiction": jurisdiction,
                "type": "review_summaries_standalone",
                "issue_types": issue_types,
            },
        )
        print(f"  Batch submitted: {batch_id}")

        # Poll for completion
        await asyncio.to_thread(
            manager.poll_until_complete,
            batch_id,
            poll_interval=DEFAULT_POLL_INTERVAL,
            timeout=MAX_BATCH_POLL_TIME,
            log=print,
        )

        # Process results
        summary_tuples = _process_batch_results(batch_id, manager, id_map)

        if not summary_tuples:
            print("  No summaries to save.")
            return 0

        # Save to DB
        from .db.analysis_writer import save_review_summaries
        saved = save_review_summaries(summary_tuples, conn)
        print(f"  Saved {saved} review summaries to database")
        return saved

    finally:
        if should_close and conn:
            conn.close()


def _fetch_analyses_for_summaries(
    jurisdiction: str,
    issue_types: Optional[list[str]],
    conn: Connection,
    limit: Optional[int] = None,
    title: Optional[str] = None,
    source: Optional[str] = None,
    agency: Optional[str] = None,
    doc_type: Optional[str] = None,
) -> list[dict]:
    """Fetch completed analyses from DB for standalone summary generation.

    Joins compliance_issue_analyses with regulatory_documents and
    guidance_documents to get document metadata.
    """
    analyses = []

    # Build issue type filter
    issue_type_filter = ""
    params: list = [jurisdiction.upper()]
    if issue_types:
        issue_type_filter = "AND a.issue_type = ANY(%s)"
        params.append(issue_types)

    limit_clause = ""
    if limit:
        limit_clause = f"LIMIT {int(limit)}"

    # Build title filter for regulations
    title_filter = ""
    if title:
        from lib.jurisdictions import title_column_for_jurisdiction
        title_col = title_column_for_jurisdiction(jurisdiction)
        title_filter = f"AND d.{title_col} = %s"
        params.append(title)

    skip_regulations = source == "guidance"
    skip_guidance = source == "regulation"

    with conn.cursor() as cur:
        # Fetch regulation analyses
        if not skip_regulations:
            cur.execute(f"""
                SELECT
                    a.document_id, NULL as guidance_document_id,
                    a.issue_type, a.highest_tier_completed,
                    a.tier1_classification, a.tier1_reasoning, a.tier1_dismissed_reasons,
                    a.tier2_classification, a.tier2_reasoning,
                    a.severity, a.severity_calculation, a.final_severity,
                    a.argument_for_regulation, a.argument_against_regulation,
                    a.federal_citation, a.primary_affected_population,
                    a.verbatim_requirements, a.context_used,
                    a.tier3_classification, a.tier3_reasoning,
                    a.tier3_severity_adjustment, a.tier3_severity_adjustment_reasoning,
                    a.web_search_summary, a.cleanup_recommendation,
                    d.citation, d.title, d.summary,
                    'regulation' as source_type,
                    a.tier3_flags
                FROM compliance_issue_analyses a
                JOIN regulatory_documents d ON a.document_id = d.id
                WHERE a.jurisdiction = %s
                    AND a.document_id IS NOT NULL
                    AND a.review_summary IS NULL
                    AND a.highest_tier_completed >= 1
                    {issue_type_filter}
                    {title_filter}
                ORDER BY a.issue_type, a.document_id
                {limit_clause}
            """, params)

            for row in cur.fetchall():
                analyses.append(_row_to_analysis_dict(row))

        # Fetch guidance analyses
        if not skip_guidance:
            guidance_params: list = [jurisdiction.upper()]
            guidance_issue_filter = ""
            if issue_types:
                guidance_issue_filter = "AND a.issue_type = ANY(%s)"
                guidance_params.append(issue_types)

            # Build guidance-specific filters
            guidance_extra_filters = ""
            if agency:
                guidance_extra_filters += " AND g.agency = %s"
                guidance_params.append(agency)
            if doc_type:
                guidance_extra_filters += " AND g.doc_type = %s"
                guidance_params.append(doc_type)

            cur.execute(f"""
                SELECT
                    NULL as document_id, a.guidance_document_id,
                    a.issue_type, a.highest_tier_completed,
                    a.tier1_classification, a.tier1_reasoning, a.tier1_dismissed_reasons,
                    a.tier2_classification, a.tier2_reasoning,
                    a.severity, a.severity_calculation, a.final_severity,
                    a.argument_for_regulation, a.argument_against_regulation,
                    a.federal_citation, a.primary_affected_population,
                    a.verbatim_requirements, a.context_used,
                    a.tier3_classification, a.tier3_reasoning,
                    a.tier3_severity_adjustment, a.tier3_severity_adjustment_reasoning,
                    a.web_search_summary, a.cleanup_recommendation,
                    NULL as citation, g.title, NULL as summary,
                    'guidance' as source_type,
                    a.tier3_flags
                FROM compliance_issue_analyses a
                JOIN guidance_documents g ON a.guidance_document_id = g.id
                WHERE a.jurisdiction = %s
                    AND a.guidance_document_id IS NOT NULL
                    AND a.review_summary IS NULL
                    AND a.highest_tier_completed >= 1
                    {guidance_issue_filter}
                    {guidance_extra_filters}
                ORDER BY a.issue_type, a.guidance_document_id
                {limit_clause}
            """, guidance_params)

        for row in cur.fetchall():
            analyses.append(_row_to_analysis_dict(row))

    # Fetch regex match context for all analyses
    _enrich_with_regex_context(analyses, conn)

    return analyses


def _row_to_analysis_dict(row) -> dict:
    """Convert a DB row from _fetch_analyses_for_summaries into an analysis dict."""
    issue_type = row[2]

    # Parse JSON fields
    verbatim = row[16]
    if isinstance(verbatim, str):
        try:
            verbatim = json.loads(verbatim)
        except (json.JSONDecodeError, TypeError):
            pass

    # Parse tier3_flags JSONB (index 28) for evidence flags
    tier3_flags = row[28] if len(row) > 28 else None
    if isinstance(tier3_flags, str):
        try:
            tier3_flags = json.loads(tier3_flags)
        except (json.JSONDecodeError, TypeError):
            tier3_flags = {}
    tier3_flags = tier3_flags or {}

    result = {
        "document_id": row[0],
        "guidance_document_id": row[1],
        "issue_type": issue_type,
        "highest_tier_completed": row[3],
        "tier1_classification": row[4],
        "tier1_reasoning": row[5],
        "tier1_dismissed_reasons": row[6],
        "tier2_classification": row[7],
        "tier2_reasoning": row[8],
        "severity": row[9],
        "severity_calculation": row[10],
        "final_severity": row[11],
        "argument_for_regulation": row[12],
        "argument_against_regulation": row[13],
        "federal_citation": row[14],
        "primary_affected_population": row[15],
        "verbatim_requirements": verbatim,
        "context_used": row[17],
        "tier3_classification": row[18],
        "tier3_reasoning": row[19],
        "tier3_severity_adjustment": row[20],
        "tier3_severity_adjustment_reasoning": row[21],
        "web_search_summary": row[22],
        "cleanup_recommendation": row[23],
        "citation": row[24] or "Unknown",
        "title": row[25] or "Unknown",
        "document_summary": row[26] or "",
        "source_type": row[27],
        "issue_type_display": _get_issue_display_name(issue_type),
        "regex_match_context": "",  # Enriched later
    }

    # Store tier3_flags as dicts so _build_tier3_block can use _format_flag()
    for flag_name in [
        "federal_mandate_confirmed", "state_discretion_found",
        "modernized_alternative_found", "superseded_by_law", "advocacy_for_change",
    ]:
        flag = tier3_flags.get(flag_name)
        result[flag_name] = flag  # dict or None — _format_flag handles both

    return result


def _enrich_with_regex_context(analyses: list[dict], conn: Connection) -> None:
    """Fetch regex match context for analyses and add to each dict."""
    if not analyses:
        return

    # Group by (source_type, doc_id, issue_type)
    reg_keys: list[tuple[int, str]] = []
    guid_keys: list[tuple[int, str]] = []

    for a in analyses:
        if a.get("document_id"):
            reg_keys.append((a["document_id"], a["issue_type"]))
        elif a.get("guidance_document_id"):
            guid_keys.append((a["guidance_document_id"], a["issue_type"]))

    context_map: dict[tuple[int, str, str], str] = {}

    with conn.cursor() as cur:
        if reg_keys:
            doc_ids = list(set(k[0] for k in reg_keys))
            issue_types_list = list(set(k[1] for k in reg_keys))
            cur.execute("""
                SELECT document_id, issue_type, regex_match_context
                FROM compliance_issues
                WHERE document_id = ANY(%s) AND issue_type = ANY(%s)
            """, (doc_ids, issue_types_list))
            for row in cur.fetchall():
                key = (row[0], row[1], "regulation")
                existing = context_map.get(key, "")
                if row[2]:
                    context_map[key] = existing + f"\n- {row[2][:200]}" if existing else f"- {row[2][:200]}"

        if guid_keys:
            doc_ids = list(set(k[0] for k in guid_keys))
            issue_types_list = list(set(k[1] for k in guid_keys))
            cur.execute("""
                SELECT guidance_document_id, issue_type, regex_match_context
                FROM compliance_issues
                WHERE guidance_document_id = ANY(%s) AND issue_type = ANY(%s)
            """, (doc_ids, issue_types_list))
            for row in cur.fetchall():
                key = (row[0], row[1], "guidance")
                existing = context_map.get(key, "")
                if row[2]:
                    context_map[key] = existing + f"\n- {row[2][:200]}" if existing else f"- {row[2][:200]}"

    # Assign back
    for a in analyses:
        if a.get("document_id"):
            key = (a["document_id"], a["issue_type"], "regulation")
        else:
            key = (a["guidance_document_id"], a["issue_type"], "guidance")
        a["regex_match_context"] = context_map.get(key, "N/A")
