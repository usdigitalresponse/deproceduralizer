#!/usr/bin/env python3
"""
Fix hierarchy_level and related fields for orphaned documents in the database.
Uses the updated parse_citation_url with alphanumeric part number support.
"""

import sys
from pathlib import Path
from typing import Optional, Dict
from dotenv import load_dotenv

# Add parent directory to path for config import
sys.path.insert(0, str(Path(__file__).parent.parent))
from config import PROJECT_ROOT
from shared_utils import get_db_connection
from scripts.ny_regulations_scraper import get_hierarchy_info

# Load .env
load_dotenv(PROJECT_ROOT / '.env')

def fix_orphaned_hierarchy(state: str = "NY"):
    """
    Find documents with NULL hierarchy_level and attempt to parse them using
    the fixed get_hierarchy_info function.
    """

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            # Get all orphaned documents
            print("Fetching orphaned documents...")
            cur.execute("""
                SELECT id, url
                FROM regulatory_documents
                WHERE state = %s AND type = 'regulation'
                AND hierarchy_level IS NULL
                ORDER BY id
            """, (state,))

            orphaned = cur.fetchall()
            print(f"Found {len(orphaned)} orphaned documents")

            # Try to parse each one
            updates = []
            still_unfixable = 0

            for i, (doc_id, url) in enumerate(orphaned):
                if (i + 1) % 100 == 0:
                    print(f"  Processing {i + 1}/{len(orphaned)}...")

                hierarchy = get_hierarchy_info(url)

                # Only update if we got a non-null hierarchy_level
                if hierarchy.get('hierarchy_level') is not None:
                    updates.append((
                        hierarchy.get('hierarchy_level'),
                        hierarchy.get('hierarchy_path'),
                        hierarchy.get('nycrr_title'),
                        hierarchy.get('nycrr_part'),
                        hierarchy.get('nycrr_section'),
                        doc_id
                    ))
                else:
                    still_unfixable += 1

            # Apply updates
            if updates:
                print(f"\nUpdating {len(updates)} documents...")
                cur.executemany("""
                    UPDATE regulatory_documents
                    SET hierarchy_level = %s,
                        hierarchy_path = %s,
                        nycrr_title = %s,
                        nycrr_part = %s,
                        nycrr_section = %s
                    WHERE id = %s
                """, updates)
                conn.commit()
                print(f"✓ Updated {len(updates)} documents")

            print(f"\nResults:")
            print(f"  Updated: {len(updates)}")
            print(f"  Still unfixable: {still_unfixable}")

            # Show what's still unfixable
            if still_unfixable > 0:
                print(f"\nSample of still-unfixable URLs (for reference):")
                cur.execute("""
                    SELECT url
                    FROM regulatory_documents
                    WHERE state = %s AND type = 'regulation'
                    AND hierarchy_level IS NULL
                    LIMIT 5
                """, (state,))

                for row in cur.fetchall():
                    print(f"  {row[0]}")


if __name__ == "__main__":
    fix_orphaned_hierarchy(state="NY")
