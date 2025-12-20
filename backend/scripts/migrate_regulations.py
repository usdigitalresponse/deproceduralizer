#!/usr/bin/env python3
"""
Unified migration script for NY and NJ regulations.
Usage:
    python migrate_regulations.py NY
    python migrate_regulations.py NJ
    python migrate_regulations.py --all
"""

import json
import sys
import time
import argparse
import psycopg
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from config import PROJECT_ROOT, INDIVIDUAL_REGULATIONS_DIR, NJ_INDIVIDUAL_REGULATIONS_DIR
from shared_utils import get_db_connection
from dotenv import load_dotenv

load_dotenv(PROJECT_ROOT / '.env')


def get_state_config(state: str) -> dict:
    """Get configuration for a state."""
    if state == "NJ":
        return {
            "dir": NJ_INDIVIDUAL_REGULATIONS_DIR,
            "prefix": "njac",
            "fields": [
                "njac_title", "njac_title_name",
                "njac_subtitle", "njac_subtitle_name",
                "njac_chapter", "njac_chapter_name",
                "njac_subchapter", "njac_subchapter_name",
                "njac_article", "njac_article_name",
                "njac_part", "njac_part_name",
                "njac_subpart", "njac_subpart_name",
                "njac_section", "njac_section_name",
            ]
        }
    elif state == "NY":
        return {
            "dir": INDIVIDUAL_REGULATIONS_DIR,
            "prefix": "nycrr",
            "fields": [
                "nycrr_title", "nycrr_title_name",
                "nycrr_subtitle", "nycrr_subtitle_name",
                "nycrr_chapter", "nycrr_chapter_name",
                "nycrr_subchapter", "nycrr_subchapter_name",
                "nycrr_article", "nycrr_article_name",
                "nycrr_part", "nycrr_part_name",
                "nycrr_subpart", "nycrr_subpart_name",
                "nycrr_section", "nycrr_section_name",
            ]
        }
    else:
        raise ValueError(f"Unknown state: {state}")


def migrate_regulations(state: str):
    """Migrate all individual regulation files for a state."""
    config = get_state_config(state)
    reg_dir = Path(config["dir"])
    fields = config["fields"]

    if not reg_dir.exists():
        print(f"✗ Directory not found: {reg_dir}")
        return 0

    json_files = list(reg_dir.glob("*.json"))
    if not json_files:
        print(f"✗ No JSON files found in {reg_dir}/")
        return 0

    print(f"Found {len(json_files):,} {state} regulation files")

    # Build SQL dynamically based on state fields
    field_names = ", ".join(fields)
    field_placeholders = ", ".join(["%s"] * len(fields))
    field_updates = ", ".join([f"{f} = EXCLUDED.{f}" for f in fields])

    insert_sql = f"""
        INSERT INTO regulatory_documents
        (source_index, type, state, title, url, url_type, content,
         hierarchy_level, hierarchy_path, {field_names}, scraped_from_url)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, {field_placeholders}, %s)
        ON CONFLICT (state, source_index, type) DO UPDATE SET
            title = EXCLUDED.title,
            url = EXCLUDED.url,
            content = EXCLUDED.content,
            hierarchy_level = EXCLUDED.hierarchy_level,
            hierarchy_path = EXCLUDED.hierarchy_path,
            {field_updates},
            scraped_from_url = EXCLUDED.scraped_from_url
    """

    total = 0
    conn = None
    cur = None
    commit_every = 50

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        for file_idx, json_file in enumerate(sorted(json_files)):
            retries = 3
            while retries > 0:
                try:
                    with open(json_file) as f:
                        reg = json.load(f)

                    # Base fields
                    row = [
                        reg.get("source_index"),
                        "regulation",
                        state,
                        reg.get("title", ""),
                        reg.get("url", ""),
                        reg.get("url_type", "regulation"),
                        reg.get("content", ""),
                        reg.get("hierarchy_level"),
                        reg.get("hierarchy_path"),
                    ]

                    # State-specific hierarchy fields
                    for field in fields:
                        row.append(reg.get(field))

                    # Trailing field
                    row.append(reg.get("scraped_from_url"))

                    cur.execute(insert_sql, row)
                    total += 1

                    if total % commit_every == 0:
                        conn.commit()

                    if total % 1000 == 0:
                        print(f"  ✓ {total:,} / {len(json_files):,}")

                    break

                except (psycopg.OperationalError, psycopg.InterfaceError):
                    retries -= 1
                    print(f"  ⚠ Connection error, retries: {retries}")
                    if retries > 0:
                        time.sleep(2)
                        try:
                            cur.close()
                            conn.close()
                        except:
                            pass
                        conn = get_db_connection()
                        cur = conn.cursor()
                    else:
                        raise

        conn.commit()

    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

    print(f"✓ Migrated {total:,} {state} regulations")
    return total


def populate_parent_ids(state: str):
    """Populate parent_id for regulations."""
    config = get_state_config(state)
    reg_dir = Path(config["dir"])

    print(f"Loading {state} parent mappings...")
    parent_mappings = {}
    for filepath in reg_dir.glob("*.json"):
        try:
            with open(filepath) as f:
                data = json.load(f)
            si = data.get('source_index')
            psi = data.get('parent_source_index')
            if si is not None:
                parent_mappings[si] = psi  # psi can be None for roots
        except:
            continue

    with_parents = sum(1 for v in parent_mappings.values() if v is not None)
    roots = sum(1 for v in parent_mappings.values() if v is None)
    print(f"  {len(parent_mappings):,} docs, {with_parents:,} have parents, {roots:,} are roots")

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, source_index FROM regulatory_documents
                WHERE state = %s AND type = 'regulation'
            """, (state,))
            source_to_id = {r[1]: r[0] for r in cur.fetchall() if r[1] is not None}

            # First, clear ALL parent_ids for this state (to remove stale data)
            print(f"  Clearing existing parent_ids...")
            cur.execute("""
                UPDATE regulatory_documents SET parent_id = NULL
                WHERE state = %s AND type = 'regulation'
            """, (state,))

            # Now set parent_ids for docs that have parents
            updates = []
            for si, psi in parent_mappings.items():
                if psi is None:
                    continue  # Root documents stay NULL
                child_id = source_to_id.get(si)
                parent_id = source_to_id.get(psi)
                if child_id and parent_id:
                    updates.append((parent_id, child_id))

            print(f"  Applying {len(updates):,} parent updates...")
            cur.executemany("UPDATE regulatory_documents SET parent_id = %s WHERE id = %s", updates)
            conn.commit()

    print(f"✓ Updated {len(updates):,} {state} parent relationships ({roots:,} roots with no parent)")


def cleanup_stale_documents(state: str):
    """Remove documents from DB that aren't in current JSON files."""
    config = get_state_config(state)
    reg_dir = Path(config["dir"])

    print(f"Loading valid {state} source_indices...")
    valid_indices = set()
    for filepath in reg_dir.glob("*.json"):
        try:
            with open(filepath) as f:
                data = json.load(f)
            si = data.get('source_index')
            if si is not None:
                valid_indices.add(si)
        except:
            continue

    print(f"  {len(valid_indices):,} valid documents in JSON files")

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            # Find stale documents
            cur.execute("""
                SELECT id, source_index FROM regulatory_documents
                WHERE state = %s AND type = 'regulation'
            """, (state,))
            db_docs = cur.fetchall()

            stale_ids = [doc_id for doc_id, si in db_docs if si not in valid_indices]

            if not stale_ids:
                print(f"  No stale documents to remove")
                return

            print(f"  Found {len(stale_ids):,} stale documents to remove...")

            # Delete in batches
            batch_size = 100
            for i in range(0, len(stale_ids), batch_size):
                batch = stale_ids[i:i + batch_size]
                cur.execute("""
                    DELETE FROM regulatory_documents
                    WHERE id = ANY(%s)
                """, (batch,))

            conn.commit()

    print(f"✓ Removed {len(stale_ids):,} stale {state} documents")


def migrate_state(state: str):
    """Run full migration for a state."""
    print(f"\n{'='*60}")
    print(f"  {state} MIGRATION")
    print('='*60)

    print("\nPhase 1: Migrating regulations")
    migrate_regulations(state)

    print("\nPhase 2: Setting parent relationships")
    populate_parent_ids(state)

    print("\nPhase 3: Cleaning up stale documents")
    cleanup_stale_documents(state)

    print(f"\n✓ {state} Done!")


def main():
    parser = argparse.ArgumentParser(description='Migrate regulations to PostgreSQL')
    parser.add_argument('state', nargs='?', choices=['NY', 'NJ'],
                        help='State to migrate (NY or NJ)')
    parser.add_argument('--all', action='store_true', help='Migrate both states')

    args = parser.parse_args()

    if args.all:
        migrate_state("NJ")
        migrate_state("NY")
    elif args.state:
        migrate_state(args.state)
    else:
        parser.print_help()
        print("\nExamples:")
        print("  python migrate_regulations.py NY")
        print("  python migrate_regulations.py NJ")
        print("  python migrate_regulations.py --all")


if __name__ == "__main__":
    main()
