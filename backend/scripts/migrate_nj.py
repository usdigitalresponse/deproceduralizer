#!/usr/bin/env python3
"""
Standalone NJ migration script - can run independently from NY migration.
"""

import json
import sys
import time
import psycopg
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from config import PROJECT_ROOT, NJ_INDIVIDUAL_REGULATIONS_DIR
from shared_utils import get_db_connection
from dotenv import load_dotenv

load_dotenv(PROJECT_ROOT / '.env')


def migrate_nj_regulations():
    """Migrate all NJ individual regulation files."""
    reg_dir = Path(NJ_INDIVIDUAL_REGULATIONS_DIR)
    if not reg_dir.exists():
        print(f"✗ Directory not found: {reg_dir}")
        return 0

    json_files = list(reg_dir.glob("*.json"))
    if not json_files:
        print(f"✗ No JSON files found in {reg_dir}/")
        return 0

    print(f"Found {len(json_files):,} NJ regulation files")

    insert_sql = """
        INSERT INTO regulatory_documents
        (source_index, type, state, title, url, url_type, content,
         hierarchy_level, hierarchy_path,
         njac_title, njac_title_name,
         njac_subtitle, njac_subtitle_name,
         njac_chapter, njac_chapter_name,
         njac_subchapter, njac_subchapter_name,
         njac_article, njac_article_name,
         njac_part, njac_part_name,
         njac_subpart, njac_subpart_name,
         njac_section, njac_section_name,
         scraped_from_url)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (state, source_index, type) DO UPDATE SET
            title = EXCLUDED.title,
            url = EXCLUDED.url,
            content = EXCLUDED.content,
            hierarchy_level = EXCLUDED.hierarchy_level,
            hierarchy_path = EXCLUDED.hierarchy_path,
            njac_title = EXCLUDED.njac_title,
            njac_title_name = EXCLUDED.njac_title_name,
            njac_subtitle = EXCLUDED.njac_subtitle,
            njac_subtitle_name = EXCLUDED.njac_subtitle_name,
            njac_chapter = EXCLUDED.njac_chapter,
            njac_chapter_name = EXCLUDED.njac_chapter_name,
            njac_subchapter = EXCLUDED.njac_subchapter,
            njac_subchapter_name = EXCLUDED.njac_subchapter_name,
            njac_article = EXCLUDED.njac_article,
            njac_article_name = EXCLUDED.njac_article_name,
            njac_part = EXCLUDED.njac_part,
            njac_part_name = EXCLUDED.njac_part_name,
            njac_subpart = EXCLUDED.njac_subpart,
            njac_subpart_name = EXCLUDED.njac_subpart_name,
            njac_section = EXCLUDED.njac_section,
            njac_section_name = EXCLUDED.njac_section_name,
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

                    row = (
                        reg.get("source_index"),
                        "regulation",
                        "NJ",
                        reg.get("title", ""),
                        reg.get("url", ""),
                        reg.get("url_type", "regulation"),
                        reg.get("content", ""),
                        reg.get("hierarchy_level"),
                        reg.get("hierarchy_path"),
                        reg.get("njac_title"),
                        reg.get("njac_title_name"),
                        reg.get("njac_subtitle"),
                        reg.get("njac_subtitle_name"),
                        reg.get("njac_chapter"),
                        reg.get("njac_chapter_name"),
                        reg.get("njac_subchapter"),
                        reg.get("njac_subchapter_name"),
                        reg.get("njac_article"),
                        reg.get("njac_article_name"),
                        reg.get("njac_part"),
                        reg.get("njac_part_name"),
                        reg.get("njac_subpart"),
                        reg.get("njac_subpart_name"),
                        reg.get("njac_section"),
                        reg.get("njac_section_name"),
                        reg.get("scraped_from_url"),
                    )

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

    print(f"✓ Migrated {total:,} NJ regulations")
    return total


def populate_parent_ids():
    """Populate parent_id for NJ regulations."""
    reg_dir = Path(NJ_INDIVIDUAL_REGULATIONS_DIR)

    print("Loading parent mappings...")
    parent_mappings = {}
    for filepath in reg_dir.glob("*.json"):
        try:
            with open(filepath) as f:
                data = json.load(f)
            si = data.get('source_index')
            psi = data.get('parent_source_index')
            if si is not None:
                parent_mappings[si] = psi
        except:
            continue

    with_parents = sum(1 for v in parent_mappings.values() if v is not None)
    print(f"  {len(parent_mappings):,} docs, {with_parents:,} have parents")

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, source_index FROM regulatory_documents
                WHERE state = 'NJ' AND type = 'regulation'
            """)
            source_to_id = {r[1]: r[0] for r in cur.fetchall() if r[1] is not None}

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

    print(f"✓ Updated {len(updates):,} parent relationships")


if __name__ == "__main__":
    print("=== NJ Migration ===\n")

    print("Phase 1: Migrating regulations")
    migrate_nj_regulations()

    print("\nPhase 2: Setting parent relationships")
    populate_parent_ids()

    print("\n✓ Done!")
