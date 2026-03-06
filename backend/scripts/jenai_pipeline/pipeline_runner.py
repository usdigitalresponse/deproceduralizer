"""JenAI Pipeline runner — single-pass enriched analysis."""
import uuid

from .state_machine import TrackedUnit, ProcessingState
from .models.processing import JenAIUnit
from .models.llm_outputs import AnalysisOutput
from .db.document_queries import get_sections_for_analysis, get_guidance_for_analysis
from .db.analysis_writer import save_analysis_results
from .db.analysis_reader import get_existing_analyses
from .tiers.prepare_batch import prepare_analysis_batch, prepare_guidance_batch
from .config import DEFAULT_MAX_SECTIONS, BATCH_MODEL
from lib.batch import run_batch_tier, run_realtime_tier
from lib.cache import CacheManager


def _get_unit_id(tracked: TrackedUnit) -> int:
    return tracked.unit.document_id


def _get_unit_label(tracked: TrackedUnit) -> str:
    return tracked.unit.citation


def run_pipeline(
    jurisdiction: str,
    title: int | None = None,
    part: str | None = None,
    limit: int | None = DEFAULT_MAX_SECTIONS,
    dry_run: bool = True,
    include_all_types: bool = False,
    force: bool = False,
    realtime: bool = False,
    document_ids: list[int] | None = None,
    no_cache: bool = False,
    source_type: str = "regulation",
    agency: str | None = None,
    doc_type: str | None = None,
) -> dict:
    """Run the JenAI single-pass enriched pipeline.

    Args:
        jurisdiction: Jurisdiction code ('nj', 'ny', or 'nyc')
        title: Optional title number to filter by (regulation only)
        part: Optional part number to filter by (regulation only)
        limit: Max sections to analyze
        dry_run: If True, preview what would run without executing
        include_all_types: Include reserved/definitions/scope sections (regulation only)
        force: Re-analyze sections that already have analyses
        realtime: Use realtime API instead of batch
        document_ids: Specific document IDs to analyze
        source_type: "regulation" or "guidance"
        agency: Agency filter (guidance only, e.g., 'OCFS')
        doc_type: Document type filter (guidance only, e.g., 'ADM')

    Returns:
        Summary dict with counts
    """
    run_id = uuid.uuid4().hex[:12]
    cache = CacheManager(enabled=not no_cache)

    # Fetch documents based on source type
    if source_type == "guidance":
        sections = get_guidance_for_analysis(
            jurisdiction=jurisdiction,
            agency=agency,
            doc_type=doc_type,
            limit=limit,
            exclude_analyzed=not force and not document_ids,
            document_ids=document_ids,
        )
    else:
        sections = get_sections_for_analysis(
            jurisdiction=jurisdiction,
            title=title,
            part=part,
            limit=limit,
            exclude_analyzed=not force and not document_ids,
            include_all_types=include_all_types,
            document_ids=document_ids,
        )

    if not sections:
        label = "guidance documents" if source_type == "guidance" else "sections"
        print(f"No {label} found for analysis.")
        return {"sections": 0}

    mode = "realtime" if realtime else "batch"
    label = "guidance documents" if source_type == "guidance" else "sections"
    print(f"\nFound {len(sections)} {label} for analysis")
    print(f"Run ID: {run_id}, Mode: {mode}, Source: {source_type}")

    if dry_run:
        print("\n[DRY RUN] Would analyze these. Use --execute to run.")
        for i, s in enumerate(sections[:10]):
            print(f"  {i+1}. [{s['id']}] {s.get('citation', 'N/A')}: {(s.get('title') or '')[:60]}")
        if len(sections) > 10:
            print(f"  ... and {len(sections) - 10} more")
        return {"sections": len(sections), "dry_run": True}

    # Build tracked units
    units = []
    for s in sections:
        unit = JenAIUnit(
            document_id=s['id'],
            citation=s['citation'] or '',
            title=s['title'] or '',
            content=s['content'],
            jurisdiction=s['jurisdiction'],
            summary=s.get('summary'),
            url=s.get('url'),
            hierarchy_level=s.get('hierarchy_level'),
            parent_id=s.get('parent_id'),
            source_type=source_type,
        )
        # Attach metadata for agency resolution and prompt preamble
        unit.title_num = s.get('reg_title_num')
        if source_type == "guidance":
            unit.agency = s.get('agency', '')
            unit.doc_type = s.get('doc_type', '')
            unit.date_published = str(s.get('date_published', '')) if s.get('date_published') else ''
            unit.status = s.get('status', '')
            unit.cites_regulations = s.get('cites_regulations') or []
        units.append(TrackedUnit(unit=unit))

    # === SINGLE PASS: Rich Context Analysis ===
    print("\n=== Analysis: Rich Context Single Pass ===")
    pending_units = [u for u in units if u.state == ProcessingState.PENDING]

    if pending_units:
        # Route to correct batch prep based on source type
        if source_type == "guidance":
            batch_requests, id_map = prepare_guidance_batch(pending_units)
        else:
            batch_requests, id_map = prepare_analysis_batch(pending_units)

        print(f"Processing {len(batch_requests)} requests ({mode})...")

        if realtime:
            run_realtime_tier(
                batch_requests, id_map, pending_units,
                AnalysisOutput, "analysis_output", "batch_id",
                ProcessingState.DONE, ProcessingState.ERROR,
                "Analysis", BATCH_MODEL,
                get_unit_id=_get_unit_id, get_unit_label=_get_unit_label,
                cache=cache, cache_pipeline="jenai", cache_tier=1,
            )
            batch_id = "realtime"
        else:
            batch_id = run_batch_tier(
                batch_requests, id_map, pending_units,
                AnalysisOutput, "analysis_output", "batch_id",
                ProcessingState.DONE, batch_name="jenai_analysis",
                get_unit_id=_get_unit_id,
                cache=cache, cache_pipeline="jenai", cache_tier=1,
            )

        # Save results
        saved = save_analysis_results(pending_units, batch_id, run_id)
        completed = sum(1 for u in pending_units if u.state == ProcessingState.DONE)
        errors = sum(1 for u in pending_units if u.state == ProcessingState.ERROR)
        print(f"Saved {saved} results ({completed} completed, {errors} errors)")

    if cache.enabled:
        print(f"\n{cache.summary()}")
    cache.close()

    return _build_summary(units)


def _build_summary(units: list[TrackedUnit]) -> dict:
    """Build pipeline run summary."""
    completed_units = [u for u in units if u.state == ProcessingState.DONE]
    has_issues = sum(
        1 for u in completed_units
        if u.analysis_output and u.analysis_output.classification == "has_issues"
    )
    clean = sum(
        1 for u in completed_units
        if u.analysis_output and u.analysis_output.classification == "clean"
    )
    return {
        "total": len(units),
        "completed": len(completed_units),
        "has_issues": has_issues,
        "clean": clean,
        "errors": sum(1 for u in units if u.state == ProcessingState.ERROR),
        "pending": sum(1 for u in units if u.state == ProcessingState.PENDING),
    }
