"""
Database migration utilities: state config, regulation upsert, parent ID population, stale doc cleanup.
"""

import json
import time
from pathlib import Path
from typing import Optional

import psycopg

from lib.db import get_db_connection


def get_state_config(state: str) -> dict:
    """Get configuration for a state's regulation fields."""
    if state == "NJ":
        return {
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


def migrate_regulations_to_db(state: str, regulations: list = None, reg_dir: Path = None) -> int:
    """
    Migrate regulations to database using upsert (ON CONFLICT).

    This preserves existing IDs by matching on (state, source_index, type).

    Args:
        state: State code ('NY' or 'NJ')
        regulations: List of regulation dicts (from scraper or JSON files)
        reg_dir: Optional directory to load from JSON files instead

    Returns:
        Number of regulations migrated
    """
    config = get_state_config(state)
    fields = config["fields"]

    # If reg_dir provided, load from JSON files
    if reg_dir is not None:
        json_files = list(Path(reg_dir).glob("*.json"))
        if not json_files:
            print(f"✗ No JSON files found in {reg_dir}/")
            return 0
        regulations = []
        for json_file in sorted(json_files):
            with open(json_file) as f:
                regulations.append(json.load(f))

    if not regulations:
        print(f"✗ No regulations to migrate")
        return 0

    print(f"Migrating {len(regulations):,} {state} regulations to database...")

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

        for reg in regulations:
            retries = 3
            while retries > 0:
                try:
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
                        print(f"  ✓ {total:,} / {len(regulations):,}")

                    break

                except (psycopg.OperationalError, psycopg.InterfaceError):
                    retries -= 1
                    print(f"  ⚠ Connection error, retries: {retries}")
                    if retries > 0:
                        time.sleep(2)
                        try:
                            cur.close()
                            conn.close()
                        except (psycopg.Error, AttributeError):
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


def populate_parent_ids(state: str, regulations: list = None, reg_dir: Path = None):
    """
    Populate parent_id for regulations by converting parent_source_index to parent_id.

    Args:
        state: State code ('NY' or 'NJ')
        regulations: List of regulation dicts with parent_source_index
        reg_dir: Optional directory to load parent mappings from JSON files
    """
    # Build parent mappings
    parent_mappings = {}

    if reg_dir is not None:
        print(f"Loading {state} parent mappings from {reg_dir}...")
        for filepath in Path(reg_dir).glob("*.json"):
            try:
                with open(filepath) as f:
                    data = json.load(f)
                si = data.get('source_index')
                psi = data.get('parent_source_index')
                if si is not None:
                    parent_mappings[si] = psi
            except (json.JSONDecodeError, OSError, KeyError) as e:
                print(f"  Warning: Failed to load {filepath.name}: {type(e).__name__}")
                continue
    elif regulations is not None:
        print(f"Loading {state} parent mappings from {len(regulations)} regulations...")
        for reg in regulations:
            si = reg.get('source_index')
            psi = reg.get('parent_source_index')
            if si is not None:
                parent_mappings[si] = psi
    else:
        print("✗ No regulations or reg_dir provided")
        return

    with_parents = sum(1 for v in parent_mappings.values() if v is not None)
    roots = sum(1 for v in parent_mappings.values() if v is None)
    print(f"  {len(parent_mappings):,} docs, {with_parents:,} have parents, {roots:,} are roots")

    conn = get_db_connection()
    if conn is None:
        print("✗ Failed to connect to database (DATABASE_URL not set?)")
        return

    with conn:
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
                    continue
                child_id = source_to_id.get(si)
                parent_id = source_to_id.get(psi)
                if child_id and parent_id:
                    updates.append((parent_id, child_id))

            print(f"  Applying {len(updates):,} parent updates...")
            cur.executemany("UPDATE regulatory_documents SET parent_id = %s WHERE id = %s", updates)
            conn.commit()

    print(f"✓ Updated {len(updates):,} {state} parent relationships ({roots:,} roots with no parent)")


def cleanup_stale_documents(state: str, valid_source_indices: set = None, reg_dir: Path = None):
    """
    Remove documents from DB that aren't in current data.

    Args:
        state: State code ('NY' or 'NJ')
        valid_source_indices: Set of valid source_index values
        reg_dir: Optional directory to load valid indices from JSON files
    """
    if valid_source_indices is None and reg_dir is not None:
        print(f"Loading valid {state} source_indices from {reg_dir}...")
        valid_source_indices = set()
        for filepath in Path(reg_dir).glob("*.json"):
            try:
                with open(filepath) as f:
                    data = json.load(f)
                si = data.get('source_index')
                if si is not None:
                    valid_source_indices.add(si)
            except (json.JSONDecodeError, OSError, KeyError) as e:
                print(f"  Warning: Failed to load {filepath.name}: {type(e).__name__}")
                continue
    elif valid_source_indices is None:
        print("✗ No valid_source_indices or reg_dir provided")
        return

    print(f"  {len(valid_source_indices):,} valid documents")

    conn = get_db_connection()
    if conn is None:
        print("✗ Failed to connect to database (DATABASE_URL not set?)")
        return

    with conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, source_index FROM regulatory_documents
                WHERE state = %s AND type = 'regulation'
            """, (state,))
            db_docs = cur.fetchall()

            stale_ids = [doc_id for doc_id, si in db_docs if si not in valid_source_indices]

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
