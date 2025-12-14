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
from scripts.ny_regulations_scraper import get_hierarchy_info

load_dotenv(PROJECT_ROOT / '.env')

def parse_nycrr_info(url: str) -> Tuple[Optional[int], Optional[str], Optional[str]]:
    """
    Extract NYCRR title, part, and section from a Cornell Law URL.
    Uses the comprehensive get_hierarchy_info parser.
    Returns: (title, part, section)
    """
    hierarchy = get_hierarchy_info(url)
    return (
        hierarchy.get('nycrr_title'),
        hierarchy.get('nycrr_part'),
        hierarchy.get('nycrr_section')
    )

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
                            nycrr_title, nycrr_part, nycrr_section = parse_nycrr_info(url)

                            # Insert regulatory document
                            cur.execute("""
                                INSERT INTO regulatory_documents
                                (source_index, type, state, title, url, url_type, content,
                                 hierarchy_level, hierarchy_path, nycrr_title, nycrr_part, nycrr_section)
                                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                                ON CONFLICT (state, source_index, type) DO UPDATE SET
                                    title = EXCLUDED.title,
                                    url = EXCLUDED.url,
                                    content = EXCLUDED.content,
                                    hierarchy_level = EXCLUDED.hierarchy_level
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
                                nycrr_part,
                                nycrr_section
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
    Migrate all individual regulation files from individual_regulations directory

    Args:
        state: State code (e.g., 'NY')
    """
    reg_dir = Path(INDIVIDUAL_REGULATIONS_DIR)
    if not reg_dir.exists():
        print(f"✗ individual_regulations directory not found at {reg_dir}!")
        return 0

    json_files = list(reg_dir.glob("*.json"))
    if not json_files:
        print(f"✗ No JSON files found in {reg_dir}/")
        return 0

    print(f"Found {len(json_files)} individual regulation files")

    total_documents = 0

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            for file_idx, json_file in enumerate(sorted(json_files)):
                try:
                    with open(json_file) as f:
                        reg = json.load(f)

                    title = reg.get("title", "")
                    url = reg.get("url", "")
                    content = reg.get("content", "")
                    url_type = reg.get("url_type", "regulation")
                    source_index = reg.get("source_index")
                    hierarchy_level = reg.get("hierarchy_level")
                    hierarchy_path = reg.get("hierarchy_path")
                    nycrr_title, nycrr_part, nycrr_section = parse_nycrr_info(url)

                    cur.execute("""
                        INSERT INTO regulatory_documents
                        (source_index, type, state, title, url, url_type, content,
                         hierarchy_level, hierarchy_path, nycrr_title, nycrr_part, nycrr_section)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (state, source_index, type) DO UPDATE SET
                            title = EXCLUDED.title,
                            url = EXCLUDED.url,
                            content = EXCLUDED.content,
                            hierarchy_level = EXCLUDED.hierarchy_level
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
                        nycrr_part,
                        nycrr_section
                    ))

                    total_documents += 1
                    if (file_idx + 1) % 1000 == 0:
                        print(f"  ✓ Processed {file_idx + 1} regulations...")
                        conn.commit()

                except Exception as e:
                    print(f"  ✗ Error processing {json_file.name}: {e}")
                    raise

        conn.commit()

    print(f"✓ Successfully migrated {total_documents} individual regulatory documents")
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


def refresh_hierarchy_fields(state: str = "NY"):
    """
    Re-parse all URLs and update hierarchy fields in the database.

    This fixes any documents that were imported with the old, simpler parser
    by re-parsing with the improved get_hierarchy_info function.
    """
    print("Refreshing hierarchy fields for all documents...")

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            # Get all documents
            cur.execute("""
                SELECT id, url FROM regulatory_documents
                WHERE state = %s AND type = 'regulation'
            """, (state,))
            docs = cur.fetchall()
            print(f"  Found {len(docs):,} documents to process")

            # Re-parse and collect updates
            updates = []
            for i, (doc_id, url) in enumerate(docs):
                if (i + 1) % 10000 == 0:
                    print(f"  Processing {i + 1:,}/{len(docs):,}...")

                hierarchy = get_hierarchy_info(url)
                updates.append((
                    hierarchy.get('hierarchy_level'),
                    hierarchy.get('hierarchy_path'),
                    hierarchy.get('nycrr_title'),
                    hierarchy.get('nycrr_part'),
                    hierarchy.get('nycrr_section'),
                    doc_id
                ))

            # Apply updates
            print(f"  Updating {len(updates):,} documents...")
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

            # Report results
            cur.execute("""
                SELECT
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE hierarchy_level IS NOT NULL) as has_level,
                    COUNT(*) FILTER (WHERE nycrr_title IS NOT NULL) as has_title,
                    COUNT(*) FILTER (WHERE nycrr_part IS NOT NULL) as has_part,
                    COUNT(*) FILTER (WHERE nycrr_section IS NOT NULL) as has_section
                FROM regulatory_documents
                WHERE state = %s AND type = 'regulation'
            """, (state,))
            row = cur.fetchone()
            total = row[0]
            print(f"\n✓ Hierarchy fields refreshed:")
            print(f"  hierarchy_level: {row[1]:,} ({100*row[1]/total:.1f}%)")
            print(f"  nycrr_title:     {row[2]:,} ({100*row[2]/total:.1f}%)")
            print(f"  nycrr_part:      {row[3]:,} ({100*row[3]/total:.1f}%)")
            print(f"  nycrr_section:   {row[4]:,} ({100*row[4]/total:.1f}%)")


def main():
    import argparse

    parser = argparse.ArgumentParser(description='Migrate regulations to PostgreSQL')
    parser.add_argument('--refresh-hierarchy', action='store_true',
                        help='Only refresh hierarchy fields (re-parse URLs)')
    parser.add_argument('--state', default='NY', help='State code (default: NY)')
    args = parser.parse_args()

    if args.refresh_hierarchy:
        print("Running hierarchy refresh only...\n")
        refresh_hierarchy_fields(state=args.state)
        print("\n✓ Done!")
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

    print("\nPhase 4: Refreshing hierarchy fields")
    print("=" * 50)
    refresh_hierarchy_fields(state=args.state)

    print("\n✓ Migration complete!")


if __name__ == "__main__":
    main()
