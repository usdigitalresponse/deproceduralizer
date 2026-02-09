#!/usr/bin/env python3
"""
Backfill compliance_issue_analyses from legacy compliance_issues data.

Groups existing compliance_issues by (document_id, issue_type) and creates
analysis records with pipeline_version='legacy' for processing through
the 3-tier research pipeline.

Usage:
    python backend/scripts/research_pipeline/backfill_legacy_analyses.py [options]

Options:
    --dry-run       Show what would be migrated without writing
    --limit N       Process only N groups (for testing)
    --state NJ|NY   Filter by state
    --issue X       Filter by issue type
"""

import argparse
import sys
from datetime import datetime
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent.parent.parent / ".env")

from lib.db import get_db_connection


def get_unprocessed_groups(conn, state: str = None, issue_type: str = None, limit: int = None):
    """
    Query compliance_issues for groups not yet in compliance_issue_analyses.

    Returns grouped data ready for insertion.
    """
    # Build WHERE clause
    conditions = [
        """NOT EXISTS (
            SELECT 1 FROM compliance_issue_analyses cia
            WHERE cia.document_id = ci.document_id
            AND cia.issue_type = ci.issue_type
        )"""
    ]
    params = []

    if state:
        conditions.append("ci.state = %s")
        params.append(state)

    if issue_type:
        conditions.append("ci.issue_type = %s")
        params.append(issue_type)

    where_clause = " AND ".join(conditions)

    # Main query: group by (document_id, issue_type) and aggregate fields
    query = f"""
        SELECT
            ci.document_id,
            ci.issue_type,
            ci.state,
            COUNT(*) as match_count,
            ARRAY_AGG(ci.id ORDER BY ci.occurrence_number) as match_ids,
            BOOL_OR(ci.requirement_found) as has_requirement,
            MAX(ci.severity) FILTER (WHERE ci.requirement_found = true) as max_severity,
            -- Flatten all verbatim_supporting_text arrays into one
            ARRAY(
                SELECT DISTINCT unnested
                FROM (
                    SELECT unnest(ci2.verbatim_supporting_text) as unnested
                    FROM compliance_issues ci2
                    WHERE ci2.document_id = ci.document_id
                    AND ci2.issue_type = ci.issue_type
                    AND ci2.verbatim_supporting_text IS NOT NULL
                ) sub
                WHERE unnested IS NOT NULL AND unnested != ''
            ) as all_verbatim,
            -- Get is_verbatim from any match that has it true
            BOOL_OR(ci.is_verbatim) as is_verbatim,
            MIN(ci.created_at) as first_created_at
        FROM compliance_issues ci
        WHERE {where_clause}
        GROUP BY ci.document_id, ci.issue_type, ci.state
        ORDER BY ci.issue_type, ci.document_id
    """

    if limit:
        query += f" LIMIT {limit}"

    with conn.cursor() as cur:
        cur.execute(query, params)
        columns = [desc[0] for desc in cur.description]
        rows = cur.fetchall()

    return [dict(zip(columns, row)) for row in rows]


def insert_analysis_record(conn, group: dict, dry_run: bool = False) -> bool:
    """
    Insert a single analysis record from grouped compliance_issues data.

    Returns True if successful, False otherwise.
    """
    # Determine classification based on whether any match has requirement_found
    if group['has_requirement']:
        tier1_classification = 'needs_research'
        requirement_found = True
    else:
        tier1_classification = 'all_false_positives'
        requirement_found = False

    # All matches go to relevant_match_ids (no filtering in legacy backfill)
    tier1_relevant_match_ids = group['match_ids']
    tier1_dismissed_match_ids = []  # No dismissals in backfill

    # Severity
    severity = group['max_severity']  # May be None if no requirement_found
    final_severity = severity  # No tier adjustments yet

    # Verbatim requirements
    verbatim_requirements = group['all_verbatim'] if group['all_verbatim'] else None

    # is_verbatim flag
    is_verbatim = group['is_verbatim'] if group['is_verbatim'] else False

    if dry_run:
        return True

    insert_query = """
        INSERT INTO compliance_issue_analyses (
            document_id,
            issue_type,
            state,
            grouped_match_count,
            tier1_relevant_match_ids,
            tier1_dismissed_match_ids,
            tier1_classification,
            tier1_confidence,
            tier1_reasoning,
            verbatim_requirements,
            severity,
            final_severity,
            requirement_found,
            is_verbatim,
            pipeline_version,
            highest_tier_completed,
            classification_tier,
            created_at,
            updated_at
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
        )
        ON CONFLICT (document_id, issue_type) DO NOTHING
    """

    params = (
        group['document_id'],
        group['issue_type'],
        group['state'],
        group['match_count'],
        tier1_relevant_match_ids,
        tier1_dismissed_match_ids,
        tier1_classification,
        1.0,  # High confidence - this is existing data
        "Backfilled from legacy compliance_issues data. All regex matches grouped for analysis.",
        verbatim_requirements,
        severity,
        final_severity,
        requirement_found,
        is_verbatim,
        'legacy',  # pipeline_version
        1,  # highest_tier_completed - Tier 1 equivalent data is populated
        1 if tier1_classification == 'all_false_positives' else None,  # classification_tier - 1 if final, None if needs more
        group['first_created_at'] or datetime.now(),
        datetime.now(),
    )

    try:
        with conn.cursor() as cur:
            cur.execute(insert_query, params)
        return True
    except Exception as e:
        print(f"      ERROR inserting {group['document_id']}/{group['issue_type']}: {e}")
        return False


def backfill_legacy_analyses(
    dry_run: bool = False,
    limit: int = None,
    state: str = None,
    issue_type: str = None,
):
    """
    Main backfill function.
    """
    print("=" * 60)
    print("BACKFILL: compliance_issues -> compliance_issue_analyses")
    print("=" * 60)

    if dry_run:
        print("MODE: Dry run (no changes will be made)")

    filters = []
    if state:
        filters.append(f"state={state}")
    if issue_type:
        filters.append(f"issue_type={issue_type}")
    if limit:
        filters.append(f"limit={limit}")
    if filters:
        print(f"FILTERS: {', '.join(filters)}")

    print()

    # Connect to database
    conn = get_db_connection()
    if not conn:
        print("ERROR: Could not connect to database")
        return 1

    try:
        # Get count of unprocessed groups
        print("Querying for unprocessed groups...")
        groups = get_unprocessed_groups(conn, state=state, issue_type=issue_type, limit=limit)
        total = len(groups)

        if total == 0:
            print("No unprocessed groups found. Nothing to backfill.")
            return 0

        print(f"Found {total} groups to process")
        print()

        # Process each group
        success_count = 0
        error_count = 0

        # Track by issue_type for summary
        by_issue_type = {}

        for i, group in enumerate(groups):
            doc_id = group['document_id']
            itype = group['issue_type']
            match_count = group['match_count']

            # Track by issue type
            if itype not in by_issue_type:
                by_issue_type[itype] = {'count': 0, 'matches': 0}
            by_issue_type[itype]['count'] += 1
            by_issue_type[itype]['matches'] += match_count

            if insert_analysis_record(conn, group, dry_run=dry_run):
                success_count += 1
            else:
                error_count += 1

            # Progress every 100
            if (i + 1) % 100 == 0 or (i + 1) == total:
                pct = int((i + 1) / total * 100)
                print(f"  Processed {i + 1}/{total} ({pct}%) - {success_count} success, {error_count} errors")

        # Commit if not dry run
        if not dry_run:
            conn.commit()
            print("\nChanges committed.")
        else:
            print("\n(Dry run - no changes made)")

        # Summary
        print()
        print("=" * 60)
        print("SUMMARY")
        print("=" * 60)
        print(f"Total groups processed: {total}")
        print(f"  Successful: {success_count}")
        print(f"  Errors: {error_count}")
        print()
        print("By issue type:")
        for itype, stats in sorted(by_issue_type.items()):
            print(f"  {itype}: {stats['count']} groups ({stats['matches']} matches)")

        return 0 if error_count == 0 else 1

    except Exception as e:
        print(f"ERROR: {e}")
        conn.rollback()
        return 1
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(
        description="Backfill compliance_issue_analyses from legacy compliance_issues data."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be migrated without writing",
    )
    parser.add_argument(
        "--limit",
        type=int,
        help="Process only N groups (for testing)",
    )
    parser.add_argument(
        "--state",
        choices=["NJ", "NY"],
        help="Filter by state",
    )
    parser.add_argument(
        "--issue",
        dest="issue_type",
        help="Filter by issue type (e.g., mail_only, wet_signature)",
    )

    args = parser.parse_args()

    exit_code = backfill_legacy_analyses(
        dry_run=args.dry_run,
        limit=args.limit,
        state=args.state,
        issue_type=args.issue_type,
    )

    sys.exit(exit_code)


if __name__ == "__main__":
    main()
