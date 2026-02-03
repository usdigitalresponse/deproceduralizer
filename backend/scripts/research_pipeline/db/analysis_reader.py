"""
Analysis reader for the research pipeline.

Reads existing analyses from the compliance_issue_analyses table
for resume checking and progress tracking.
"""

from typing import Optional
from psycopg import Connection

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))
from shared_utils import get_db_connection

from .connection import retry_db_operation


@retry_db_operation()
def get_existing_analyses(
    document_ids: list[int],
    issue_type: Optional[str] = None,
    issue_types: Optional[list[str]] = None,
    conn: Optional[Connection] = None,
) -> dict[tuple[int, str], dict]:
    """
    Get existing analyses for documents to check for resume.

    V5: 3-tier pipeline (Tier 3 is the final tier).

    Returns full tier outputs to enable hydration of TrackedUnits during resume,
    so already-completed tiers can be skipped.

    Args:
        document_ids: List of document IDs to query
        issue_type: Single issue type (for backward compatibility)
        issue_types: List of issue types (for --all mode)
        conn: Optional database connection

    Returns:
        Dict mapping (document_id, issue_type) tuples to analysis data.
        Each value is a dict with:
        - highest_tier_completed: int
        - requirement_found: bool
        - final_severity: int
        - Tier 1 outputs: tier1_classification, tier1_relevant_match_ids,
          tier1_dismissed_match_ids, tier1_confidence, tier1_reasoning,
          tier1_context_requests
        - Tier 2 outputs: tier2_classification, tier2_confidence, tier2_reasoning,
          tier2_context_requests_made, tier2_full_text_requests, severity,
          verbatim_requirements
        - Tier 3 outputs: tier3_classification, tier3_confidence, tier3_reasoning,
          tier3_severity_adjustment, tier3_severity_adjustment_reasoning
    """
    if not document_ids:
        return {}

    # Build issue_type filter
    if issue_types:
        type_list = issue_types
    elif issue_type:
        type_list = [issue_type]
    else:
        raise ValueError("Either issue_type or issue_types must be provided")

    if conn is None:
        conn = get_db_connection()
        should_close = True
    else:
        should_close = False

    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    document_id, issue_type, highest_tier_completed,
                    requirement_found, final_severity,
                    -- Tier 1 outputs
                    tier1_classification, tier1_relevant_match_ids, tier1_dismissed_match_ids,
                    tier1_confidence, tier1_reasoning, tier1_context_requests,
                    -- Tier 2 outputs
                    tier2_classification, tier2_confidence, tier2_reasoning,
                    tier2_context_requests_made, tier2_full_text_requests,
                    severity, verbatim_requirements,
                    -- Tier 3 outputs
                    tier3_classification, tier3_confidence, tier3_reasoning,
                    tier3_severity_adjustment, tier3_severity_adjustment_reasoning
                FROM compliance_issue_analyses
                WHERE document_id = ANY(%s) AND issue_type = ANY(%s)
            """, (document_ids, type_list))

            results = {}
            for row in cur.fetchall():
                # Key by (document_id, issue_type) tuple
                key = (row[0], row[1])
                results[key] = {
                    "highest_tier_completed": row[2],
                    "requirement_found": row[3],
                    "final_severity": row[4],
                    # Tier 1 outputs
                    "tier1_classification": row[5],
                    "tier1_relevant_match_ids": row[6] or [],
                    "tier1_dismissed_match_ids": row[7] or [],
                    "tier1_confidence": row[8],
                    "tier1_reasoning": row[9],
                    "tier1_context_requests": row[10] or [],
                    # Tier 2 outputs
                    "tier2_classification": row[11],
                    "tier2_confidence": row[12],
                    "tier2_reasoning": row[13],
                    "tier2_context_requests_made": row[14] or [],
                    "tier2_full_text_requests": row[15] or [],
                    "severity": row[16],
                    "verbatim_requirements": row[17] or [],
                    # Tier 3 outputs
                    "tier3_classification": row[18],
                    "tier3_confidence": row[19],
                    "tier3_reasoning": row[20],
                    "tier3_severity_adjustment": row[21],
                    "tier3_severity_adjustment_reasoning": row[22],
                }

            return results
    finally:
        if should_close:
            conn.close()


@retry_db_operation()
def get_analysis_by_document(
    document_id: int,
    issue_type: str,
    conn: Optional[Connection] = None,
) -> Optional[dict]:
    """
    Get a single analysis record by document_id and issue_type.

    Args:
        document_id: Document ID
        issue_type: Issue type string
        conn: Optional database connection

    Returns:
        Analysis dict or None if not found.
    """
    results = get_existing_analyses(
        document_ids=[document_id],
        issue_type=issue_type,
        conn=conn,
    )
    return results.get((document_id, issue_type))


@retry_db_operation()
def get_tier_completion_counts(
    state: str,
    issue_type: Optional[str] = None,
    conn: Optional[Connection] = None,
) -> dict[int, int]:
    """
    Get count of documents at each tier completion level.

    Useful for progress tracking and reporting.

    Args:
        state: State code (NJ or NY)
        issue_type: Optional filter by issue type
        conn: Optional database connection

    Returns:
        Dict mapping tier number to count of documents at that tier.
        Example: {0: 100, 1: 50, 2: 30, 3: 10}
    """
    if conn is None:
        conn = get_db_connection()
        should_close = True
    else:
        should_close = False

    try:
        issue_filter = ""
        params = [state]
        if issue_type:
            issue_filter = "AND issue_type = %s"
            params.append(issue_type)

        with conn.cursor() as cur:
            cur.execute(f"""
                SELECT COALESCE(highest_tier_completed, 0) as tier, COUNT(*)
                FROM compliance_issue_analyses
                WHERE state = %s {issue_filter}
                GROUP BY highest_tier_completed
                ORDER BY tier
            """, params)

            return {row[0]: row[1] for row in cur.fetchall()}
    finally:
        if should_close:
            conn.close()


@retry_db_operation()
def get_classification_counts(
    state: str,
    issue_type: Optional[str] = None,
    tier: int = 2,
    conn: Optional[Connection] = None,
) -> dict[str, int]:
    """
    Get count of documents by classification at a given tier.

    Args:
        state: State code (NJ or NY)
        issue_type: Optional filter by issue type
        tier: Tier to check classification for (1, 2, or 3)
        conn: Optional database connection

    Returns:
        Dict mapping classification to count.
        Example: {"burdensome": 50, "justified": 30, "unrelated": 20}
    """
    if conn is None:
        conn = get_db_connection()
        should_close = True
    else:
        should_close = False

    try:
        issue_filter = ""
        params = [state]
        if issue_type:
            issue_filter = "AND issue_type = %s"
            params.append(issue_type)

        tier_col = f"tier{tier}_classification"

        with conn.cursor() as cur:
            cur.execute(f"""
                SELECT {tier_col}, COUNT(*)
                FROM compliance_issue_analyses
                WHERE state = %s
                  AND {tier_col} IS NOT NULL
                  {issue_filter}
                GROUP BY {tier_col}
                ORDER BY {tier_col}
            """, params)

            return {row[0]: row[1] for row in cur.fetchall()}
    finally:
        if should_close:
            conn.close()
