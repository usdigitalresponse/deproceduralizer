#!/usr/bin/env python3
"""
Populate parent_id in regulatory_documents table.

Reads parent_source_index from JSON files and updates the database
to set parent_id based on matching source_index values.
"""

import json
import os
import sys
from pathlib import Path
from typing import Dict, Optional
import psycopg
from dotenv import load_dotenv

# Add parent directory to path for config import
sys.path.insert(0, str(Path(__file__).parent.parent))
from config import PROJECT_ROOT

load_dotenv(PROJECT_ROOT / '.env')

# Individual regulations are at project root, not in data/
INDIVIDUAL_REGULATIONS_DIR = PROJECT_ROOT / 'individual_regulations'


def get_db_connection():
    """Create connection to Neon PostgreSQL database"""
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise ValueError("DATABASE_URL not set in environment variables")
    return psycopg.connect(database_url, connect_timeout=30)


def load_parent_mappings() -> Dict[int, Optional[int]]:
    """
    Load source_index -> parent_source_index mappings from JSON files.

    Returns:
        Dict mapping source_index to parent_source_index (or None if no parent)
    """
    mappings = {}
    json_files = list(INDIVIDUAL_REGULATIONS_DIR.glob("*.json"))

    print(f"Reading {len(json_files)} JSON files for parent mappings...")

    for filepath in json_files:
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)

            source_index = data.get('source_index')
            parent_source_index = data.get('parent_source_index')

            if source_index is not None:
                mappings[source_index] = parent_source_index

        except Exception as e:
            print(f"  Warning: Error reading {filepath.name}: {e}")

    # Count how many have parents
    with_parents = sum(1 for v in mappings.values() if v is not None)
    print(f"  Found {len(mappings)} documents, {with_parents} have parent_source_index")

    return mappings


def populate_parent_ids(dry_run: bool = False):
    """
    Populate parent_id column in regulatory_documents table.

    Args:
        dry_run: If True, show what would be done without making changes
    """
    # Step 1: Load parent mappings from JSON
    parent_mappings = load_parent_mappings()

    if not parent_mappings:
        print("No mappings found!")
        return

    # Step 2: Get all documents from database
    print("\nQuerying database for existing documents...")

    conn = get_db_connection()

    try:
        with conn.cursor() as cur:
            # Get id and source_index for all NY regulations
            cur.execute("""
                SELECT id, source_index
                FROM regulatory_documents
                WHERE state = 'NY' AND type = 'regulation'
            """)

            rows = cur.fetchall()
            print(f"  Found {len(rows)} documents in database")

            # Build source_index -> database_id mapping
            source_to_db_id = {row[1]: row[0] for row in rows if row[1] is not None}
            print(f"  {len(source_to_db_id)} have source_index set")

            # Step 3: Build updates
            updates = []
            missing_parents = 0

            for source_index, parent_source_index in parent_mappings.items():
                if parent_source_index is None:
                    continue

                # Get database IDs
                child_db_id = source_to_db_id.get(source_index)
                parent_db_id = source_to_db_id.get(parent_source_index)

                if child_db_id is None:
                    # Child not in database (not in our 6000 sample)
                    continue

                if parent_db_id is None:
                    # Parent not in database
                    missing_parents += 1
                    continue

                updates.append((parent_db_id, child_db_id))

            print(f"\nPrepared {len(updates)} parent_id updates")
            print(f"  ({missing_parents} documents have parents not in database)")

            if dry_run:
                print("\n[DRY RUN] Would update these documents:")
                for parent_id, child_id in updates[:10]:
                    print(f"  Document {child_id} -> parent_id = {parent_id}")
                if len(updates) > 10:
                    print(f"  ... and {len(updates) - 10} more")
                return

            # Step 4: Apply updates
            print("\nApplying updates...")

            updated = 0
            for parent_id, child_id in updates:
                cur.execute("""
                    UPDATE regulatory_documents
                    SET parent_id = %s
                    WHERE id = %s
                """, (parent_id, child_id))
                updated += 1

                if updated % 500 == 0:
                    print(f"  Updated {updated}/{len(updates)}...")
                    conn.commit()

            conn.commit()
            print(f"\n✓ Successfully updated {updated} documents with parent_id")

            # Verify
            cur.execute("""
                SELECT COUNT(*) FROM regulatory_documents
                WHERE parent_id IS NOT NULL AND state = 'NY'
            """)
            count = cur.fetchone()[0]
            print(f"  Database now has {count} documents with parent_id set")

    finally:
        conn.close()


def main():
    import argparse

    parser = argparse.ArgumentParser(description='Populate parent_id in regulatory_documents')
    parser.add_argument('--dry-run', action='store_true',
                        help='Show what would be done without making changes')

    args = parser.parse_args()

    print("=" * 60)
    print("POPULATE PARENT_ID IN REGULATORY_DOCUMENTS")
    print("=" * 60)
    print()

    populate_parent_ids(dry_run=args.dry_run)


if __name__ == '__main__':
    main()
