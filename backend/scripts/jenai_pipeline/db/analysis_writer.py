"""Write JenAI analysis results to the database."""
import json
from datetime import datetime

from ..state_machine import TrackedUnit, ProcessingState
from ..config import PIPELINE_VERSION, BATCH_MODEL
from lib.db import get_db_connection


def save_tier1_results(
    units: list[TrackedUnit],
    batch_id: str,
    run_id: str,
) -> int:
    """Save Tier 1 results to jenai_analyses table.

    Creates or updates an analysis row for each unit that completed Tier 1.

    Args:
        units: Tracked units with tier1_output populated
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
                if tracked.tier1_output is None:
                    continue

                output = tracked.tier1_output
                categories_json = json.dumps(
                    [c.model_dump() for c in output.categories_found]
                )
                context_requests_json = json.dumps(
                    [r.model_dump() for r in output.context_requests]
                )
                has_issues = output.classification != "clean"

                cur.execute("""
                    INSERT INTO jenai_analyses (
                        document_id, state, run_id,
                        tier1_categories, tier1_has_issues,
                        tier1_classification, tier1_confidence,
                        tier1_context_requests, tier1_batch_id,
                        tier1_completed_at,
                        has_implementation_issues,
                        overall_complexity,
                        max_severity,
                        num_categories_found,
                        highest_tier_completed,
                        pipeline_version, model_version,
                        created_at, updated_at
                    ) VALUES (
                        %s, %s, %s,
                        %s, %s,
                        %s, %s,
                        %s, %s,
                        %s,
                        %s,
                        %s,
                        %s,
                        %s,
                        1,
                        %s, %s,
                        %s, %s
                    )
                    ON CONFLICT (document_id) DO UPDATE SET
                        run_id = EXCLUDED.run_id,
                        tier1_categories = EXCLUDED.tier1_categories,
                        tier1_has_issues = EXCLUDED.tier1_has_issues,
                        tier1_classification = EXCLUDED.tier1_classification,
                        tier1_confidence = EXCLUDED.tier1_confidence,
                        tier1_context_requests = EXCLUDED.tier1_context_requests,
                        tier1_batch_id = EXCLUDED.tier1_batch_id,
                        tier1_completed_at = EXCLUDED.tier1_completed_at,
                        has_implementation_issues = EXCLUDED.has_implementation_issues,
                        overall_complexity = EXCLUDED.overall_complexity,
                        max_severity = EXCLUDED.max_severity,
                        num_categories_found = EXCLUDED.num_categories_found,
                        highest_tier_completed = GREATEST(
                            jenai_analyses.highest_tier_completed, 1
                        ),
                        updated_at = EXCLUDED.updated_at
                """, (
                    tracked.unit.document_id, tracked.unit.state.upper(), run_id,
                    categories_json, has_issues,
                    output.classification, output.overall_confidence,
                    context_requests_json, batch_id,
                    now,
                    has_issues,
                    output.overall_complexity,
                    max((c.severity for c in output.categories_found), default=0),
                    len(output.categories_found),
                    PIPELINE_VERSION, BATCH_MODEL,
                    now, now,
                ))
                saved += 1

        conn.commit()
        conn.close()
    except Exception as e:
        print(f"ERROR saving Tier 1 results: {e}")
        conn.rollback()
        conn.close()
        raise

    return saved


def save_tier2_results(
    units: list[TrackedUnit],
    batch_id: str,
    run_id: str,
) -> int:
    """Save Tier 2 results to jenai_analyses and jenai_issues tables.

    Updates the analysis row with Tier 2 data and creates issue rows
    for each confirmed/new category finding.

    Args:
        units: Tracked units with tier2_output populated
        batch_id: Batch API ID for tracking
        run_id: Pipeline run identifier

    Returns:
        Number of analyses updated
    """
    conn = get_db_connection()
    if not conn:
        raise RuntimeError("Failed to connect to database")

    saved = 0
    now = datetime.now()

    try:
        with conn.cursor() as cur:
            for tracked in units:
                if tracked.tier2_output is None:
                    continue

                output = tracked.tier2_output

                # Separate new discoveries from confirmed/revised
                new_discoveries = [
                    c for c in output.categories
                    if c.status == "new_discovery"
                ]
                confirmed_or_revised = [
                    c for c in output.categories
                    if c.status in ("confirmed", "revised_up", "revised_down")
                ]

                categories_json = json.dumps(
                    [c.model_dump() for c in output.categories]
                )
                new_discoveries_json = json.dumps(
                    [c.model_dump() for c in new_discoveries]
                )
                context_used_json = json.dumps(output.context_audit)

                has_issues = output.classification != "dismissed"
                active_categories = [
                    c for c in output.categories
                    if c.status != "dismissed"
                ]

                # Update analysis row
                cur.execute("""
                    UPDATE jenai_analyses SET
                        tier2_categories = %s,
                        tier2_has_issues = %s,
                        tier2_classification = %s,
                        tier2_confidence = %s,
                        tier2_new_discoveries = %s,
                        tier2_context_used = %s,
                        tier2_batch_id = %s,
                        tier2_completed_at = %s,
                        has_implementation_issues = %s,
                        overall_complexity = %s,
                        summary = %s,
                        max_severity = %s,
                        num_categories_found = %s,
                        highest_tier_completed = GREATEST(highest_tier_completed, 2),
                        updated_at = %s
                    WHERE document_id = %s
                """, (
                    categories_json,
                    has_issues,
                    output.classification,
                    output.overall_confidence,
                    new_discoveries_json,
                    context_used_json,
                    batch_id,
                    now,
                    has_issues,
                    output.overall_complexity,
                    output.summary,
                    max((c.severity for c in active_categories), default=0),
                    len(active_categories),
                    now,
                    tracked.unit.document_id,
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

                # Upsert issue rows for each non-dismissed category
                for cat in output.categories:
                    if cat.status == "dismissed":
                        continue

                    discovered_in = 2 if cat.status == "new_discovery" else 1
                    confirmed_in = 2
                    tier2_revised = cat.status in ("revised_up", "revised_down")

                    cur.execute("""
                        INSERT INTO jenai_issues (
                            analysis_id, document_id, category,
                            explanation, severity, complexity, confidence,
                            matched_phrases, implementation_approach,
                            effort_estimate, text_examples,
                            discovered_in_tier, confirmed_in_tier, tier2_revised,
                            created_at, updated_at
                        ) VALUES (
                            %s, %s, %s,
                            %s, %s, %s, %s,
                            %s, %s,
                            %s, %s,
                            %s, %s, %s,
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
                            confirmed_in_tier = EXCLUDED.confirmed_in_tier,
                            tier2_revised = EXCLUDED.tier2_revised,
                            updated_at = EXCLUDED.updated_at
                    """, (
                        analysis_id, tracked.unit.document_id, cat.category.value,
                        cat.explanation, cat.severity, cat.complexity, cat.confidence,
                        cat.matched_phrases, cat.implementation_approach,
                        cat.effort_estimate, cat.text_examples,
                        discovered_in, confirmed_in, tier2_revised,
                        now, now,
                    ))

                saved += 1

        conn.commit()
        conn.close()
    except Exception as e:
        print(f"ERROR saving Tier 2 results: {e}")
        conn.rollback()
        conn.close()
        raise

    return saved
