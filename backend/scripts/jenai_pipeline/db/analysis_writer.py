"""Write JenAI analysis results to the database."""
import json
from datetime import datetime

from ..state_machine import TrackedUnit, ProcessingState
from ..config import PIPELINE_VERSION, BATCH_MODEL
from lib.db import get_db_connection


def save_analysis_results(
    units: list[TrackedUnit],
    batch_id: str,
    run_id: str,
) -> int:
    """Save single-pass analysis results to jenai_analyses and jenai_issues tables.

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

                # Extract worst_thing text if present
                worst_thing_text = None
                for cat in output.categories:
                    if cat.category.value == "WORST_THING":
                        worst_thing_text = cat.explanation
                        break

                # Upsert analysis row
                cur.execute("""
                    INSERT INTO jenai_analyses (
                        document_id, state, run_id,
                        batch_id, completed_at,
                        classification, confidence, categories,
                        worst_thing,
                        has_implementation_issues,
                        overall_complexity,
                        summary,
                        max_severity,
                        num_categories_found,
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
                    ON CONFLICT (document_id) DO UPDATE SET
                        run_id = EXCLUDED.run_id,
                        batch_id = EXCLUDED.batch_id,
                        completed_at = EXCLUDED.completed_at,
                        classification = EXCLUDED.classification,
                        confidence = EXCLUDED.confidence,
                        categories = EXCLUDED.categories,
                        worst_thing = EXCLUDED.worst_thing,
                        has_implementation_issues = EXCLUDED.has_implementation_issues,
                        overall_complexity = EXCLUDED.overall_complexity,
                        summary = EXCLUDED.summary,
                        max_severity = EXCLUDED.max_severity,
                        num_categories_found = EXCLUDED.num_categories_found,
                        updated_at = EXCLUDED.updated_at
                """, (
                    tracked.unit.document_id, tracked.unit.state.upper(), run_id,
                    batch_id, now,
                    output.classification, output.overall_confidence, categories_json,
                    worst_thing_text,
                    has_issues,
                    output.overall_complexity,
                    output.summary,
                    max((c.severity for c in active_categories), default=0),
                    len(active_categories),
                    PIPELINE_VERSION, BATCH_MODEL,
                    now, now,
                ))

                # Get analysis_id for issue rows
                cur.execute(
                    "SELECT id FROM jenai_analyses WHERE document_id = %s",
                    (tracked.unit.document_id,)
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
                for cat in output.categories:
                    cur.execute("""
                        INSERT INTO jenai_issues (
                            analysis_id, document_id, category,
                            explanation, severity, complexity, confidence,
                            matched_phrases, implementation_approach,
                            effort_estimate, text_examples,
                            created_at, updated_at
                        ) VALUES (
                            %s, %s, %s,
                            %s, %s, %s, %s,
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
                            updated_at = EXCLUDED.updated_at
                    """, (
                        analysis_id, tracked.unit.document_id, cat.category.value,
                        cat.explanation, cat.severity, cat.complexity, cat.confidence,
                        cat.matched_phrases, cat.implementation_approach,
                        cat.effort_estimate, cat.text_examples,
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
