#!/usr/bin/env python3
"""
Batch exclude non-regulatory NY sections from analysis.

Categories excluded:
1. Executive Orders (9 NYCRR Parts 1-9) - gubernatorial directives, not admin regs
2. Military Code (9 NYCRR Parts 490-520) - military justice/civil defense law
3. Chemical/Hazmat Data Tables - pure lookup tables (chemical lists, exposure limits)
4. Water Classification Tables (6 NYCRR) - water body classification lists
5. Shellfish/Geographic Enumerations (6 NYCRR) - geographic boundary data
6. Fee Schedules/Rate Tables - rate/fee lookup tables, not regulatory prose

Usage:
    python backend/scripts/batch_exclude_ny_sections.py [--dry-run]
"""

import argparse
import os
import sys

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from lib.db import get_db_connection


EXCLUSION_CATEGORIES = [
    {
        "name": "Executive Orders",
        "reason": "Executive orders (gubernatorial directives) - not administrative regulations",
        "where": """
            state = 'NY'
            AND (exclude_from_analysis = FALSE OR exclude_from_analysis IS NULL)
            AND hierarchy_path LIKE '%%Governor''s Office%%'
            AND hierarchy_path LIKE '%%Title 9%%'
        """
    },
    {
        "name": "Military Code (Parts 490-520)",
        "reason": "Military justice and civil defense code - not administrative regulations",
        "where": """
            state = 'NY'
            AND (exclude_from_analysis = FALSE OR exclude_from_analysis IS NULL)
            AND hierarchy_path LIKE '%%Division of Military and Naval Affairs%%'
        """
    },
    {
        "name": "Chemical/Hazmat Data Tables",
        "reason": "Chemical/hazmat data lookup table - not regulatory prose",
        "where": """
            id IN (198302, 193976, 144229, 75774, 78678)
            AND (exclude_from_analysis = FALSE OR exclude_from_analysis IS NULL)
        """
    },
    {
        "name": "Water Classification Tables (Title 6)",
        "reason": "Water body classification table - geographic data, not regulatory prose",
        "where": """
            state = 'NY'
            AND (exclude_from_analysis = FALSE OR exclude_from_analysis IS NULL)
            AND hierarchy_path LIKE '%%Title 6%%'
            AND LOWER(title) SIMILAR TO '%%(table i|table 1|table ii|table iii|table iv|table v|table vi)%%'
        """
    },
    {
        "name": "Shellfish Lands / Geographic Enumerations",
        "reason": "Geographic boundary enumeration - data listing, not regulatory prose",
        "where": """
            id IN (173022, 129954, 124897, 119670, 78501, 83917, 181060)
            AND (exclude_from_analysis = FALSE OR exclude_from_analysis IS NULL)
        """
    },
    {
        "name": "Fee Schedules / Rate Tables",
        "reason": "Fee schedule or rate table - numeric data, not regulatory prose",
        "where": """
            id IN (83103, 107304, 137978, 78669, 131490)
            AND (exclude_from_analysis = FALSE OR exclude_from_analysis IS NULL)
        """
    },
]


def main():
    parser = argparse.ArgumentParser(description="Batch exclude non-regulatory NY sections")
    parser.add_argument("--dry-run", action="store_true", help="Preview counts without making changes")
    args = parser.parse_args()

    conn = get_db_connection()
    if not conn:
        print("Failed to connect to database")
        sys.exit(1)

    total_excluded = 0

    try:
        with conn.cursor() as cur:
            # Show current state
            cur.execute("""
                SELECT COUNT(*) FROM regulatory_documents
                WHERE state = 'NY' AND (exclude_from_analysis = FALSE OR exclude_from_analysis IS NULL)
            """)
            active_before = cur.fetchone()[0]
            cur.execute("""
                SELECT COUNT(*) FROM regulatory_documents
                WHERE state = 'NY' AND exclude_from_analysis = TRUE
            """)
            excluded_before = cur.fetchone()[0]
            print(f"NY sections before: {active_before:,} active, {excluded_before:,} excluded\n")

            for category in EXCLUSION_CATEGORIES:
                where = category["where"]
                reason = category["reason"]

                # Count matches
                cur.execute(f"SELECT COUNT(*) FROM regulatory_documents WHERE {where}")
                count = cur.fetchone()[0]
                print(f"  {category['name']}: {count:,} sections to exclude")

                if not args.dry_run and count > 0:
                    cur.execute(f"""
                        UPDATE regulatory_documents
                        SET exclude_from_analysis = TRUE,
                            excluded_at = NOW(),
                            excluded_by = 'batch-exclude-ny-2025',
                            excluded_reason = '{reason}'
                        WHERE {where}
                    """)
                    print(f"    -> Excluded {count:,} sections")

                total_excluded += count

            if not args.dry_run:
                conn.commit()

                # Show final state
                cur.execute("""
                    SELECT COUNT(*) FROM regulatory_documents
                    WHERE state = 'NY' AND (exclude_from_analysis = FALSE OR exclude_from_analysis IS NULL)
                """)
                active_after = cur.fetchone()[0]
                cur.execute("""
                    SELECT COUNT(*) FROM regulatory_documents
                    WHERE state = 'NY' AND exclude_from_analysis = TRUE
                """)
                excluded_after = cur.fetchone()[0]

                print(f"\n{'='*60}")
                print(f"Total newly excluded: {total_excluded:,}")
                print(f"NY sections after: {active_after:,} active, {excluded_after:,} excluded")
                if active_before > 0:
                    print(f"Reduction: {active_before - active_after:,} sections ({(active_before - active_after) / active_before * 100:.1f}%)")
            else:
                print(f"\n{'='*60}")
                print(f"DRY RUN - Would exclude {total_excluded:,} sections total")
                print("Run without --dry-run to apply changes")

    except Exception as e:
        conn.rollback()
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
