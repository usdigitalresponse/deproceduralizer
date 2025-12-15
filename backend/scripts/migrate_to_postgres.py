#!/usr/bin/env python3
"""
Migration script to import regulations and LLM-analyzed red flags into PostgreSQL
"""

import json
import sys
import psycopg
from pathlib import Path
from typing import Dict, List, Any, Tuple, Optional
import os
from dotenv import load_dotenv
import re

# Add parent directory to path for config import
sys.path.insert(0, str(Path(__file__).parent.parent))
from config import OUTPUTS_DIR, PROJECT_ROOT, INDIVIDUAL_REGULATIONS_DIR
from shared_utils import get_db_connection

load_dotenv(PROJECT_ROOT / '.env')

def migrate_json_analysis(json_file: str, state: str = "NY"):
    """
    Migrate regulations and red flag analysis from JSON to PostgreSQL

    Args:
        json_file: Path to JSON file with regulations and analysis
        state: State code (e.g., 'NY')
    """

    print(f"Reading {json_file}...")
    with open(json_file) as f:
        sections = json.load(f)

    if not isinstance(sections, list):
        print("✗ JSON file must contain a list of sections")
        return

    total_documents = 0
    total_analyses = 0
    total_flags = 0

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            for section_idx, section in enumerate(sections):
                try:
                    section_title = section.get("section_title", f"Section-{section_idx}")
                    regulations = section.get("regulations", [])
                    source_indices = section.get("source_indices", [])

                    print(f"\nProcessing {section_title} ({len(regulations)} regulations)...")

                    # For this section, we'll create one analysis record
                    # and link it to all regulations in the section
                    analysis_id = None

                    # First, insert all regulatory documents for this section
                    doc_ids = []
                    for reg_idx, reg in enumerate(regulations):
                        try:
                            title = reg.get("title", "")
                            url = reg.get("url", "")
                            content = reg.get("content", "")
                            url_type = reg.get("url_type", "regulation")
                            source_index = reg.get("source_index", source_indices[reg_idx] if reg_idx < len(source_indices) else None)
                            hierarchy_level = reg.get("hierarchy_level")
                            hierarchy_path = reg.get("hierarchy_path")

                            # Read hierarchy fields from JSON
                            nycrr_title = reg.get("nycrr_title")
                            nycrr_title_name = reg.get("nycrr_title_name")
                            nycrr_subtitle = reg.get("nycrr_subtitle")
                            nycrr_subtitle_name = reg.get("nycrr_subtitle_name")
                            nycrr_chapter = reg.get("nycrr_chapter")
                            nycrr_chapter_name = reg.get("nycrr_chapter_name")
                            nycrr_subchapter = reg.get("nycrr_subchapter")
                            nycrr_subchapter_name = reg.get("nycrr_subchapter_name")
                            nycrr_article = reg.get("nycrr_article")
                            nycrr_article_name = reg.get("nycrr_article_name")
                            nycrr_part = reg.get("nycrr_part")
                            nycrr_part_name = reg.get("nycrr_part_name")
                            nycrr_subpart = reg.get("nycrr_subpart")
                            nycrr_subpart_name = reg.get("nycrr_subpart_name")
                            nycrr_section = reg.get("nycrr_section")
                            nycrr_section_name = reg.get("nycrr_section_name")
                            scraped_from_url = reg.get("scraped_from_url")

                            # Insert regulatory document
                            cur.execute("""
                                INSERT INTO regulatory_documents
                                (source_index, type, state, title, url, url_type, content,
                                 hierarchy_level, hierarchy_path,
                                 nycrr_title, nycrr_title_name,
                                 nycrr_subtitle, nycrr_subtitle_name,
                                 nycrr_chapter, nycrr_chapter_name,
                                 nycrr_subchapter, nycrr_subchapter_name,
                                 nycrr_article, nycrr_article_name,
                                 nycrr_part, nycrr_part_name,
                                 nycrr_subpart, nycrr_subpart_name,
                                 nycrr_section, nycrr_section_name,
                                 scraped_from_url)
                                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                                ON CONFLICT (state, source_index, type) DO UPDATE SET
                                    title = EXCLUDED.title,
                                    url = EXCLUDED.url,
                                    content = EXCLUDED.content,
                                    hierarchy_level = EXCLUDED.hierarchy_level,
                                    hierarchy_path = EXCLUDED.hierarchy_path,
                                    nycrr_title = EXCLUDED.nycrr_title,
                                    nycrr_title_name = EXCLUDED.nycrr_title_name,
                                    nycrr_subtitle = EXCLUDED.nycrr_subtitle,
                                    nycrr_subtitle_name = EXCLUDED.nycrr_subtitle_name,
                                    nycrr_chapter = EXCLUDED.nycrr_chapter,
                                    nycrr_chapter_name = EXCLUDED.nycrr_chapter_name,
                                    nycrr_subchapter = EXCLUDED.nycrr_subchapter,
                                    nycrr_subchapter_name = EXCLUDED.nycrr_subchapter_name,
                                    nycrr_article = EXCLUDED.nycrr_article,
                                    nycrr_article_name = EXCLUDED.nycrr_article_name,
                                    nycrr_part = EXCLUDED.nycrr_part,
                                    nycrr_part_name = EXCLUDED.nycrr_part_name,
                                    nycrr_subpart = EXCLUDED.nycrr_subpart,
                                    nycrr_subpart_name = EXCLUDED.nycrr_subpart_name,
                                    nycrr_section = EXCLUDED.nycrr_section,
                                    nycrr_section_name = EXCLUDED.nycrr_section_name,
                                    scraped_from_url = EXCLUDED.scraped_from_url
                                RETURNING id
                            """, (
                                source_index,
                                "regulation",
                                state,
                                title,
                                url,
                                url_type,
                                content,
                                hierarchy_level,
                                hierarchy_path,
                                nycrr_title,
                                nycrr_title_name,
                                nycrr_subtitle,
                                nycrr_subtitle_name,
                                nycrr_chapter,
                                nycrr_chapter_name,
                                nycrr_subchapter,
                                nycrr_subchapter_name,
                                nycrr_article,
                                nycrr_article_name,
                                nycrr_part,
                                nycrr_part_name,
                                nycrr_subpart,
                                nycrr_subpart_name,
                                nycrr_section,
                                nycrr_section_name,
                                scraped_from_url
                            ))

                            doc_id = cur.fetchone()[0]
                            doc_ids.append(doc_id)
                            total_documents += 1

                        except Exception as e:
                            print(f"  ✗ Error inserting regulation {reg_idx}: {e}")
                            raise

                    # Now create one analysis for the section covering all its regulations
                    if doc_ids:
                        try:
                            # Mark previous analyses as not current
                            cur.execute("""
                                UPDATE analyses SET is_current = FALSE
                                WHERE document_id = ANY(%s)
                            """, (doc_ids,))

                            # Use the first document as the "primary" for analysis
                            primary_doc_id = doc_ids[0]

                            # Insert analysis
                            cur.execute("""
                                INSERT INTO analyses
                                (document_id, model_version, has_implementation_issues,
                                 overall_complexity, summary, requires_technical_review,
                                 has_reporting_requirement, max_severity, num_flags)
                                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                                RETURNING id
                            """, (
                                primary_doc_id,
                                "claude-3-5-sonnet-20241022",
                                section.get("has_implementation_issues", False),
                                section.get("overall_complexity"),
                                section.get("summary"),
                                section.get("requires_technical_review", False),
                                section.get("has_reporting_requirement", False),
                                section.get("max_severity", 0),
                                section.get("num_flags", 0)
                            ))

                            analysis_id = cur.fetchone()[0]
                            total_analyses += 1

                        except Exception as e:
                            print(f"  ✗ Error inserting analysis for section: {e}")
                            raise

                    # Insert red flags for this analysis
                    if analysis_id is not None:
                        red_flags = section.get("red_flags", [])
                        if red_flags:
                            try:
                                flag_data = [
                                    (
                                        analysis_id,
                                        flag.get("category"),
                                        flag.get("explanation"),
                                        flag.get("severity"),
                                        flag.get("complexity"),
                                        flag.get("matched_phrases", []),
                                        flag.get("implementation_approach"),
                                        flag.get("effort_estimate"),
                                        flag.get("text_examples", [])
                                    )
                                    for flag in red_flags
                                ]
                                cur.executemany("""
                                    INSERT INTO red_flags
                                    (analysis_id, category, explanation, severity, complexity,
                                     matched_phrases, implementation_approach, effort_estimate,
                                     text_examples)
                                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                                """, flag_data)
                                total_flags += len(flag_data)

                            except Exception as e:
                                print(f"  ✗ Error inserting red flags: {e}")
                                raise

                    if (section_idx + 1) % 50 == 0:
                        print(f"  ✓ Processed {section_idx + 1} sections...")
                        conn.commit()

                except Exception as e:
                    print(f"  ✗ Error processing section {section_idx}: {e}")
                    conn.rollback()
                    raise

        conn.commit()

    print(f"\n✓ Successfully migrated:")
    print(f"  - {total_documents} regulatory documents")
    print(f"  - {total_analyses} analyses")
    print(f"  - {total_flags} red flags")

def migrate_all_individual_regulations(state: str = "NY"):
    """
    Migrate all individual regulation files from individual_regulations directory.
    Uses single inserts with reconnection logic for Neon stability.

    Args:
        state: State code (e.g., 'NY')
    """
    import time

    reg_dir = Path(INDIVIDUAL_REGULATIONS_DIR)
    if not reg_dir.exists():
        print(f"✗ individual_regulations directory not found at {reg_dir}!")
        return 0

    json_files = list(reg_dir.glob("*.json"))
    if not json_files:
        print(f"✗ No JSON files found in {reg_dir}/")
        return 0

    print(f"Found {len(json_files)} individual regulation files")

    insert_sql = """
        INSERT INTO regulatory_documents
        (source_index, type, state, title, url, url_type, content,
         hierarchy_level, hierarchy_path,
         nycrr_title, nycrr_title_name,
         nycrr_subtitle, nycrr_subtitle_name,
         nycrr_chapter, nycrr_chapter_name,
         nycrr_subchapter, nycrr_subchapter_name,
         nycrr_article, nycrr_article_name,
         nycrr_part, nycrr_part_name,
         nycrr_subpart, nycrr_subpart_name,
         nycrr_section, nycrr_section_name,
         scraped_from_url)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (state, source_index, type) DO UPDATE SET
            title = EXCLUDED.title,
            url = EXCLUDED.url,
            content = EXCLUDED.content,
            hierarchy_level = EXCLUDED.hierarchy_level,
            hierarchy_path = EXCLUDED.hierarchy_path,
            nycrr_title = EXCLUDED.nycrr_title,
            nycrr_title_name = EXCLUDED.nycrr_title_name,
            nycrr_subtitle = EXCLUDED.nycrr_subtitle,
            nycrr_subtitle_name = EXCLUDED.nycrr_subtitle_name,
            nycrr_chapter = EXCLUDED.nycrr_chapter,
            nycrr_chapter_name = EXCLUDED.nycrr_chapter_name,
            nycrr_subchapter = EXCLUDED.nycrr_subchapter,
            nycrr_subchapter_name = EXCLUDED.nycrr_subchapter_name,
            nycrr_article = EXCLUDED.nycrr_article,
            nycrr_article_name = EXCLUDED.nycrr_article_name,
            nycrr_part = EXCLUDED.nycrr_part,
            nycrr_part_name = EXCLUDED.nycrr_part_name,
            nycrr_subpart = EXCLUDED.nycrr_subpart,
            nycrr_subpart_name = EXCLUDED.nycrr_subpart_name,
            nycrr_section = EXCLUDED.nycrr_section,
            nycrr_section_name = EXCLUDED.nycrr_section_name,
            scraped_from_url = EXCLUDED.scraped_from_url
    """

    total_documents = 0
    conn = None
    cur = None
    commit_every = 50  # Commit frequently to avoid losing progress

    def get_connection():
        c = get_db_connection()
        # Disable pipelining to avoid SSL issues
        return c

    try:
        conn = get_connection()
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
                        state,
                        reg.get("title", ""),
                        reg.get("url", ""),
                        reg.get("url_type", "regulation"),
                        reg.get("content", ""),
                        reg.get("hierarchy_level"),
                        reg.get("hierarchy_path"),
                        reg.get("nycrr_title"),
                        reg.get("nycrr_title_name"),
                        reg.get("nycrr_subtitle"),
                        reg.get("nycrr_subtitle_name"),
                        reg.get("nycrr_chapter"),
                        reg.get("nycrr_chapter_name"),
                        reg.get("nycrr_subchapter"),
                        reg.get("nycrr_subchapter_name"),
                        reg.get("nycrr_article"),
                        reg.get("nycrr_article_name"),
                        reg.get("nycrr_part"),
                        reg.get("nycrr_part_name"),
                        reg.get("nycrr_subpart"),
                        reg.get("nycrr_subpart_name"),
                        reg.get("nycrr_section"),
                        reg.get("nycrr_section_name"),
                        reg.get("scraped_from_url"),
                    )

                    cur.execute(insert_sql, row)
                    total_documents += 1

                    if total_documents % commit_every == 0:
                        conn.commit()

                    if total_documents % 1000 == 0:
                        print(f"  ✓ Processed {total_documents:,} / {len(json_files):,} regulations...")

                    break  # Success, exit retry loop

                except (psycopg.OperationalError, psycopg.InterfaceError) as e:
                    retries -= 1
                    print(f"  ⚠ Connection error on {json_file.name}, retries left: {retries}")
                    if retries > 0:
                        time.sleep(2)
                        try:
                            if cur:
                                cur.close()
                            if conn:
                                conn.close()
                        except:
                            pass
                        conn = get_connection()
                        cur = conn.cursor()
                    else:
                        raise

                except Exception as e:
                    print(f"  ✗ Error processing {json_file.name}: {e}")
                    raise

        # Final commit
        conn.commit()

    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

    print(f"✓ Successfully migrated {total_documents:,} individual regulatory documents")
    return total_documents


def migrate_nj_individual_regulations():
    """
    Migrate all NJ individual regulation files from nj_individual_regulations directory.
    Uses single inserts with reconnection logic for Neon stability.
    """
    import time
    from config import NJ_INDIVIDUAL_REGULATIONS_DIR

    reg_dir = Path(NJ_INDIVIDUAL_REGULATIONS_DIR)
    if not reg_dir.exists():
        print(f"✗ nj_individual_regulations directory not found at {reg_dir}!")
        return 0

    json_files = list(reg_dir.glob("*.json"))
    if not json_files:
        print(f"✗ No JSON files found in {reg_dir}/")
        return 0

    print(f"Found {len(json_files)} NJ individual regulation files")

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

    total_documents = 0
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
                    total_documents += 1

                    if total_documents % commit_every == 0:
                        conn.commit()

                    if total_documents % 1000 == 0:
                        print(f"  ✓ Processed {total_documents:,} / {len(json_files):,} NJ regulations...")

                    break

                except (psycopg.OperationalError, psycopg.InterfaceError) as e:
                    retries -= 1
                    print(f"  ⚠ Connection error on {json_file.name}, retries left: {retries}")
                    if retries > 0:
                        time.sleep(2)
                        try:
                            if cur:
                                cur.close()
                            if conn:
                                conn.close()
                        except:
                            pass
                        conn = get_db_connection()
                        cur = conn.cursor()
                    else:
                        raise

                except Exception as e:
                    print(f"  ✗ Error processing {json_file.name}: {e}")
                    raise

        conn.commit()

    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

    print(f"✓ Successfully migrated {total_documents:,} NJ regulatory documents")
    return total_documents


def populate_parent_ids(state: str = "NY"):
    """
    Populate parent_id column in regulatory_documents table.

    Reads parent_source_index from JSON files and updates the database
    to set parent_id based on matching source_index values.
    """
    reg_dir = Path(INDIVIDUAL_REGULATIONS_DIR)
    if not reg_dir.exists():
        print(f"✗ individual_regulations directory not found!")
        return

    # Step 1: Load parent mappings from JSON files
    print("Loading parent mappings from JSON files...")
    parent_mappings = {}  # source_index -> parent_source_index
    json_files = list(reg_dir.glob("*.json"))

    for filepath in json_files:
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
            source_index = data.get('source_index')
            parent_source_index = data.get('parent_source_index')
            if source_index is not None:
                parent_mappings[source_index] = parent_source_index
        except Exception:
            continue

    with_parents = sum(1 for v in parent_mappings.values() if v is not None)
    print(f"  Found {len(parent_mappings)} documents, {with_parents} have parent_source_index")

    if not parent_mappings:
        print("No mappings found!")
        return

    # Step 2: Get source_index -> database ID mapping
    print("Building source_index to database ID mapping...")
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, source_index
                FROM regulatory_documents
                WHERE state = %s AND type = 'regulation'
            """, (state,))
            rows = cur.fetchall()
            source_to_db_id = {row[1]: row[0] for row in rows if row[1] is not None}
            print(f"  {len(source_to_db_id)} documents in database with source_index")

            # Step 3: Build and apply updates
            updates = []
            missing_parents = 0

            for source_index, parent_source_index in parent_mappings.items():
                if parent_source_index is None:
                    continue
                child_db_id = source_to_db_id.get(source_index)
                parent_db_id = source_to_db_id.get(parent_source_index)

                if child_db_id is None:
                    continue
                if parent_db_id is None:
                    missing_parents += 1
                    continue

                updates.append((parent_db_id, child_db_id))

            print(f"  Prepared {len(updates)} parent_id updates")
            if missing_parents > 0:
                print(f"  ({missing_parents} documents have parents not in database)")

            # Apply updates in batches
            print("Applying updates...")
            cur.executemany("""
                UPDATE regulatory_documents
                SET parent_id = %s
                WHERE id = %s
            """, updates)
            conn.commit()
            print(f"✓ Updated {len(updates)} documents with parent_id")


def populate_nj_parent_ids():
    """
    Populate parent_id column for NJ regulations.
    """
    from config import NJ_INDIVIDUAL_REGULATIONS_DIR

    reg_dir = Path(NJ_INDIVIDUAL_REGULATIONS_DIR)
    if not reg_dir.exists():
        print(f"✗ nj_individual_regulations directory not found!")
        return

    print("Loading parent mappings from NJ JSON files...")
    parent_mappings = {}
    json_files = list(reg_dir.glob("*.json"))

    for filepath in json_files:
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
            source_index = data.get('source_index')
            parent_source_index = data.get('parent_source_index')
            if source_index is not None:
                parent_mappings[source_index] = parent_source_index
        except Exception:
            continue

    with_parents = sum(1 for v in parent_mappings.values() if v is not None)
    print(f"  Found {len(parent_mappings)} documents, {with_parents} have parent_source_index")

    if not parent_mappings:
        return

    print("Building source_index to database ID mapping...")
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, source_index
                FROM regulatory_documents
                WHERE state = 'NJ' AND type = 'regulation'
            """)
            rows = cur.fetchall()
            source_to_db_id = {row[1]: row[0] for row in rows if row[1] is not None}
            print(f"  {len(source_to_db_id)} documents in database with source_index")

            updates = []
            missing_parents = 0

            for source_index, parent_source_index in parent_mappings.items():
                if parent_source_index is None:
                    continue
                child_db_id = source_to_db_id.get(source_index)
                parent_db_id = source_to_db_id.get(parent_source_index)

                if child_db_id is None:
                    continue
                if parent_db_id is None:
                    missing_parents += 1
                    continue

                updates.append((parent_db_id, child_db_id))

            print(f"  Prepared {len(updates)} parent_id updates")
            if missing_parents > 0:
                print(f"  ({missing_parents} documents have parents not in database)")

            print("Applying updates...")
            cur.executemany("""
                UPDATE regulatory_documents
                SET parent_id = %s
                WHERE id = %s
            """, updates)
            conn.commit()
            print(f"✓ Updated {len(updates)} NJ documents with parent_id")


def main():
    import argparse

    parser = argparse.ArgumentParser(description='Migrate regulations to PostgreSQL')
    parser.add_argument('--state', default='NY', help='State code (default: NY)')
    parser.add_argument('--nj', action='store_true', help='Migrate NJ regulations')
    parser.add_argument('--nj-only', action='store_true', help='Only migrate NJ regulations (skip NY)')
    args = parser.parse_args()

    # NJ-only migration
    if args.nj_only:
        print("Starting NJ migration to PostgreSQL...\n")
        print("Phase 1: Migrating NJ individual regulations")
        print("=" * 50)
        migrate_nj_individual_regulations()

        print("\nPhase 2: Populating NJ parent_id relationships")
        print("=" * 50)
        populate_nj_parent_ids()

        print("\n✓ NJ Migration complete!")
        return

    print("Starting migration to PostgreSQL...\n")

    # First, migrate all individual regulations
    print("Phase 1: Migrating all individual regulations")
    print("=" * 50)
    migrate_all_individual_regulations(state=args.state)

    print("\nPhase 2: Migrating analyzed regulations with red flags")
    print("=" * 50)

    # Find all analysis JSON files in outputs directory
    json_files = list(OUTPUTS_DIR.glob("red_flag_analysis_*.json"))

    if not json_files:
        print(f"✗ No red_flag_analysis_*.json files found in {OUTPUTS_DIR}")
        print("✓ All individual regulations are in the database (without analyses)")
    else:
        # Migrate each JSON file
        for json_file in sorted(json_files):
            try:
                migrate_json_analysis(str(json_file), state=args.state)
            except Exception as e:
                print(f"✗ Failed to migrate {json_file}: {e}")
                raise

    print("\nPhase 3: Populating parent_id relationships")
    print("=" * 50)
    populate_parent_ids(state=args.state)

    # Note: refresh_hierarchy_fields removed - hierarchy fields are now
    # imported directly from JSON files during migration

    # Also migrate NJ if requested
    if args.nj:
        print("\n" + "=" * 50)
        print("Phase 4: Migrating NJ regulations")
        print("=" * 50)
        migrate_nj_individual_regulations()

        print("\nPhase 5: Populating NJ parent_id relationships")
        print("=" * 50)
        populate_nj_parent_ids()

    print("\n✓ Migration complete!")


if __name__ == "__main__":
    main()
