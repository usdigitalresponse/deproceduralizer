#!/usr/bin/env python3
"""
Refresh precomputed hierarchy statistics.

Updates the count columns on regulatory_documents:
- child_count, descendant_count (structure)
- descendant_flag_count, descendant_analyzed_count (analysis)
- compliance_issue_count, descendant_compliance_issue_count (compliance)

Updates the count columns on statutes:
- descendant_linked_regulation_count, descendant_enabling_authority_count (statute links)

Examples:
    # Refresh all stats for NJ
    python refresh_hierarchy_stats.py --state NJ

    # Refresh only compliance stats for NJ (after processing compliance issues)
    python refresh_hierarchy_stats.py --state NJ --compliance

    # Refresh only analysis stats for NY (after processing red flags)
    python refresh_hierarchy_stats.py --state NY --analysis

    # Refresh only statute link stats
    python refresh_hierarchy_stats.py --all-states --statute-links

    # Refresh all states
    python refresh_hierarchy_stats.py --all-states
"""

import argparse
import sys

from config import PROJECT_ROOT
from dotenv import load_dotenv

load_dotenv(PROJECT_ROOT / '.env')

from lib.db import get_db_connection
from lib.jurisdictions import VALID_JURISDICTIONS_LOWER
from lib.stats import refresh_all_stats, refresh_structure_stats, refresh_analysis_stats, refresh_compliance_stats, refresh_statute_link_stats


def main():
    parser = argparse.ArgumentParser(
        description='Refresh hierarchy statistics for regulatory documents',
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    parser.add_argument('--state', '-s', choices=VALID_JURISDICTIONS_LOWER,
                        help='State to refresh (required unless --all-states)')
    parser.add_argument('--all-states', action='store_true',
                        help='Refresh all states')
    parser.add_argument('--structure', action='store_true',
                        help='Only refresh structure stats (child_count, descendant_count)')
    parser.add_argument('--analysis', action='store_true',
                        help='Only refresh analysis stats (flag counts)')
    parser.add_argument('--compliance', action='store_true',
                        help='Only refresh compliance stats (issue counts)')
    parser.add_argument('--statute-links', action='store_true',
                        help='Only refresh statute descendant link counts')

    args = parser.parse_args()

    if not args.state and not args.all_states:
        parser.error("--state or --all-states required")

    conn = get_db_connection()
    if not conn:
        print("ERROR: Could not connect to database")
        sys.exit(1)

    states = ['NJ', 'NY'] if args.all_states else [args.state.upper()]

    try:
        for state in states:
            print(f"\n{'=' * 60}")
            print(f"Refreshing {state} hierarchy stats")
            print('=' * 60)

            if args.structure:
                refresh_structure_stats(conn, state)
            elif args.analysis:
                refresh_analysis_stats(conn, state)
            elif args.compliance:
                refresh_compliance_stats(conn, state)
            elif args.statute_links:
                refresh_statute_link_stats(conn, state)
            else:
                refresh_all_stats(conn, state)

            print(f"✓ {state} complete")

    finally:
        conn.close()

    print("\nDone!")


if __name__ == '__main__':
    main()
