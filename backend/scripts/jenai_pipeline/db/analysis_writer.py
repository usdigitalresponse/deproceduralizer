"""Write JenAI analysis results to the database."""
import json
from datetime import datetime

from ..state_machine import TrackedUnit, ProcessingState
from ..config import PIPELINE_VERSION, BATCH_MODEL
from lib.db import get_db_connection
from lib.jurisdictions import get_title_agency_map, agency_for_document, jurisdiction_prefix
from scripts.research_pipeline.result_processor import check_verbatim


def save_analysis_results(
    units: list[TrackedUnit],
    batch_id: str,
    run_id: str,
) -> int:
    """Save single-pass analysis results to jenai_analyses and jenai_issues tables.

    Supports both regulation and guidance source types via source_type-aware
    column routing (document_id vs guidance_document_id).

    Args:
        units: Tracked units with analysis_output populated
        batch_id: Batch API ID for tracking
        run_id: Pipeline run identifier

    Returns:
        Number of rows saved
    """
    conn = get_db_connection()
    if not conn:
        raise RuntimeError("Failed to connect to database")

    # Build title→agency map once for regulation agency resolution
    jurisdictions = {u.unit.jurisdiction for u in units if u.analysis_output is not None}
    title_agency_maps = {j: get_title_agency_map(j) for j in jurisdictions}

    saved = 0
    now = datetime.now()

    try:
        with conn.cursor() as cur:
            for tracked in units:
                if tracked.analysis_output is None:
                    continue

                output = tracked.analysis_output
                categories_json = json.dumps(
                    [c.model_dump() for c in output.categories]
                )
                has_issues = output.classification == "has_issues"
                active_categories = output.categories

                is_guidance = tracked.unit.source_type == "guidance"
                id_column = "guidance_document_id" if is_guidance else "document_id"
                doc_id = tracked.unit.document_id

                # Resolve responsible agency
                if is_guidance:
                    responsible_agency = tracked.unit.agency or None
                else:
                    title_num = tracked.unit.title_num
                    tam = title_agency_maps.get(tracked.unit.jurisdiction)
                    responsible_agency = agency_for_document(
                        tracked.unit.jurisdiction, title_num, tam
                    )

                # Upsert analysis row — column depends on source type
                # Use partial index predicate for ON CONFLICT with partial unique indexes
                conflict_clause = (
                    f"({id_column}) WHERE {id_column} IS NOT NULL"
                )
                cur.execute(f"""
                    INSERT INTO jenai_analyses (
                        {id_column}, jurisdiction, run_id,
                        batch_id, completed_at,
                        classification, confidence, categories,
                        has_implementation_issues,
                        overall_complexity,
                        summary,
                        max_severity,
                        num_categories_found,
                        responsible_agency,
                        pipeline_version, model_version,
                        created_at, updated_at
                    ) VALUES (
                        %s, %s, %s,
                        %s, %s,
                        %s, %s, %s,
                        %s,
                        %s,
                        %s,
                        %s,
                        %s,
                        %s,
                        %s, %s,
                        %s, %s
                    )
                    ON CONFLICT {conflict_clause} DO UPDATE SET
                        run_id = EXCLUDED.run_id,
                        batch_id = EXCLUDED.batch_id,
                        completed_at = EXCLUDED.completed_at,
                        classification = EXCLUDED.classification,
                        confidence = EXCLUDED.confidence,
                        categories = EXCLUDED.categories,
                        has_implementation_issues = EXCLUDED.has_implementation_issues,
                        overall_complexity = EXCLUDED.overall_complexity,
                        summary = EXCLUDED.summary,
                        max_severity = EXCLUDED.max_severity,
                        num_categories_found = EXCLUDED.num_categories_found,
                        responsible_agency = EXCLUDED.responsible_agency,
                        updated_at = EXCLUDED.updated_at
                """, (
                    doc_id, tracked.unit.jurisdiction.upper(), run_id,
                    batch_id, now,
                    output.classification, output.overall_confidence, categories_json,
                    has_issues,
                    output.overall_complexity,
                    output.summary,
                    max((c.severity for c in active_categories), default=0),
                    len(active_categories),
                    responsible_agency,
                    PIPELINE_VERSION, BATCH_MODEL,
                    now, now,
                ))

                # Get analysis_id for issue rows
                cur.execute(
                    f"SELECT id FROM jenai_analyses WHERE {id_column} = %s",
                    (doc_id,)
                )
                row = cur.fetchone()
                if not row:
                    continue
                analysis_id = row[0]

                # Delete existing issues for this analysis (clean slate)
                cur.execute(
                    "DELETE FROM jenai_issues WHERE analysis_id = %s",
                    (analysis_id,)
                )

                # Insert issue rows for each category finding
                source_text = tracked.unit.content or ""
                for cat in output.categories:
                    # Check if matched_phrases are verbatim from source
                    is_verbatim = None
                    if cat.matched_phrases and source_text:
                        is_verbatim, _ = check_verbatim(cat.matched_phrases, source_text)

                    cur.execute(f"""
                        INSERT INTO jenai_issues (
                            analysis_id, {id_column}, category,
                            explanation, severity, complexity, confidence,
                            matched_phrases, implementation_approach,
                            effort_estimate, text_examples,
                            tags, is_verbatim,
                            created_at, updated_at
                        ) VALUES (
                            %s, %s, %s,
                            %s, %s, %s, %s,
                            %s, %s,
                            %s, %s,
                            %s, %s,
                            %s, %s
                        )
                        ON CONFLICT (analysis_id, category) DO UPDATE SET
                            explanation = EXCLUDED.explanation,
                            severity = EXCLUDED.severity,
                            complexity = EXCLUDED.complexity,
                            confidence = EXCLUDED.confidence,
                            matched_phrases = EXCLUDED.matched_phrases,
                            implementation_approach = EXCLUDED.implementation_approach,
                            effort_estimate = EXCLUDED.effort_estimate,
                            text_examples = EXCLUDED.text_examples,
                            tags = EXCLUDED.tags,
                            is_verbatim = EXCLUDED.is_verbatim,
                            updated_at = EXCLUDED.updated_at
                    """, (
                        analysis_id, doc_id, cat.category.value,
                        cat.explanation, cat.severity, cat.complexity, cat.confidence,
                        cat.matched_phrases, cat.implementation_approach,
                        cat.effort_estimate, cat.text_examples,
                        cat.tags, is_verbatim,
                        now, now,
                    ))

                saved += 1

        conn.commit()
        conn.close()
    except Exception as e:
        print(f"ERROR saving analysis results: {e}")
        conn.rollback()
        conn.close()
        raise

    return saved
