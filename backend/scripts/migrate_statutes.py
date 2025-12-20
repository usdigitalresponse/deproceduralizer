#!/usr/bin/env python3
"""
Migration script for NJ statutes into regulatory_documents table.
Usage:
    python migrate_statutes.py
    python migrate_statutes.py --link  # Also create regulation-statute links
"""

import json
import sys
import re
import time
import argparse
import psycopg
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from config import PROJECT_ROOT, NJ_STATUTES_COMPLETE_FILE, NJ_INDIVIDUAL_REGULATIONS_DIR
from shared_utils import get_db_connection
from dotenv import load_dotenv

load_dotenv(PROJECT_ROOT / '.env')


def migrate_statutes():
    """Migrate all NJ statutes from the complete JSON file into statutes table."""
    if not NJ_STATUTES_COMPLETE_FILE.exists():
        print(f"Error: Statutes file not found: {NJ_STATUTES_COMPLETE_FILE}")
        return 0

    print(f"Loading statutes from {NJ_STATUTES_COMPLETE_FILE}...")
    with open(NJ_STATUTES_COMPLETE_FILE) as f:
        statutes = json.load(f)

    print(f"Found {len(statutes):,} statutes")

    insert_sql = """
        INSERT INTO statutes
        (citation, state, title, content,
         njsa_title, njsa_title_name, njsa_chapter, njsa_section, njsa_section_name,
         hierarchy_level, hierarchy_path, source_index)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (state, citation) DO UPDATE SET
            title = EXCLUDED.title,
            content = EXCLUDED.content,
            njsa_title = EXCLUDED.njsa_title,
            njsa_title_name = EXCLUDED.njsa_title_name,
            njsa_chapter = EXCLUDED.njsa_chapter,
            njsa_section = EXCLUDED.njsa_section,
            njsa_section_name = EXCLUDED.njsa_section_name,
            hierarchy_level = EXCLUDED.hierarchy_level,
            hierarchy_path = EXCLUDED.hierarchy_path,
            source_index = EXCLUDED.source_index
    """

    total = 0
    conn = None
    cur = None
    commit_every = 100

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        for statute in statutes:
            retries = 3
            while retries > 0:
                try:
                    citation = statute.get("citation", "")
                    if not citation:
                        break  # Skip statutes without citations

                    # Build title from citation and section name
                    section_name = statute.get("njsa_section_name", "")
                    title = f"N.J.S.A. {citation}"
                    if section_name:
                        title += f" - {section_name}"

                    row = [
                        citation,
                        "NJ",
                        title,
                        statute.get("content", ""),
                        statute.get("njsa_title"),
                        statute.get("njsa_title_name"),
                        statute.get("njsa_chapter"),
                        statute.get("njsa_section"),
                        statute.get("njsa_section_name"),
                        statute.get("hierarchy_level", "section"),
                        statute.get("hierarchy_path", ""),
                        statute.get("source_index"),
                    ]

                    cur.execute(insert_sql, row)
                    total += 1

                    if total % commit_every == 0:
                        conn.commit()

                    if total % 5000 == 0:
                        print(f"  Migrated {total:,} / {len(statutes):,}")

                    break

                except (psycopg.OperationalError, psycopg.InterfaceError):
                    retries -= 1
                    print(f"  Connection error, retries: {retries}")
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

    print(f"Migrated {total:,} NJ statutes")
    return total


def create_statute_links():
    """
    Parse NJ regulations for N.J.S.A. citations and create links to statutes.
    Uses the statutes table and regulation_statute_links crosswalk table.
    """
    print("\nCreating regulation-statute links...")

    # Pattern for N.J.S.A. citations
    njsa_pattern = re.compile(
        r'N\.J\.S\.A\.\s*(\d+[A-Za-z]?):(\d+[A-Za-z]?)-(\d+(?:\.\d+)?[a-z]?)',
        re.IGNORECASE
    )

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Get all NJ regulations
        print("  Loading NJ regulations...")
        cur.execute("""
            SELECT id, content FROM regulatory_documents
            WHERE state = 'NJ' AND type = 'regulation'
        """)
        regulations = cur.fetchall()
        print(f"  Found {len(regulations):,} regulations")

        # Get all statutes from the statutes table and build citation lookup
        print("  Loading NJ statutes...")
        cur.execute("""
            SELECT id, citation FROM statutes
            WHERE state = 'NJ'
        """)
        statute_rows = cur.fetchall()
        statute_lookup = {row[1]: row[0] for row in statute_rows}
        print(f"  Found {len(statute_lookup):,} statutes")

        # Clear existing links
        print("  Clearing existing links...")
        cur.execute("DELETE FROM regulation_statute_links")

        # Process each regulation
        links_created = 0
        regs_with_links = 0
        unmatched_citations = set()

        insert_sql = """
            INSERT INTO regulation_statute_links (regulation_id, statute_id, citation, context)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (regulation_id, statute_id, citation) DO NOTHING
        """

        for reg_id, content in regulations:
            if not content:
                continue

            matches = list(njsa_pattern.finditer(content))
            if not matches:
                continue

            reg_had_link = False
            for match in matches:
                citation = f"{match.group(1)}:{match.group(2)}-{match.group(3)}"
                statute_id = statute_lookup.get(citation)

                if statute_id:
                    # Extract context (100 chars before and after)
                    start = max(0, match.start() - 100)
                    end = min(len(content), match.end() + 100)
                    context = content[start:end]

                    cur.execute(insert_sql, (reg_id, statute_id, citation, context))
                    links_created += 1
                    reg_had_link = True
                else:
                    unmatched_citations.add(citation)

            if reg_had_link:
                regs_with_links += 1

            if regs_with_links % 1000 == 0 and regs_with_links > 0:
                conn.commit()
                print(f"  Processed {regs_with_links:,} regulations with links...")

        conn.commit()
        print(f"  Created {links_created:,} links from {regs_with_links:,} regulations")
        print(f"  Found {len(unmatched_citations):,} citations with no matching statute")

    finally:
        cur.close()
        conn.close()

    return links_created


def main():
    parser = argparse.ArgumentParser(description='Migrate NJ statutes to PostgreSQL')
    parser.add_argument('--link', action='store_true', help='Also create regulation-statute links')

    args = parser.parse_args()

    print("=" * 60)
    print("  NJ STATUTES MIGRATION")
    print("=" * 60)

    print("\nPhase 1: Migrating statutes")
    migrate_statutes()

    if args.link:
        print("\nPhase 2: Creating regulation-statute links")
        create_statute_links()

    print("\nDone!")


if __name__ == "__main__":
    main()
