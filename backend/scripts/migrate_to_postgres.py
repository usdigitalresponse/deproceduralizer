#!/usr/bin/env python3
"""
Migration script to import regulations and LLM-analyzed red flags into PostgreSQL
"""

import json
import sys
import psycopg
from pathlib import Path
from typing import Dict, List, Any
import os
from dotenv import load_dotenv
import re
import time

# Add parent directory to path for config import
sys.path.insert(0, str(Path(__file__).parent.parent))
from config import OUTPUTS_DIR, PROJECT_ROOT, INDIVIDUAL_REGULATIONS_DIR
from shared_utils import get_db_connection

load_dotenv(PROJECT_ROOT / '.env')

def parse_nycrr_info(url: str) -> tuple[int | None, str | None, str | None]:
    """
    Extract NYCRR title, part, and section from a Cornell Law URL.
    Example: https://www.law.cornell.edu/regulations/new-york/9-NYCRR-5320.1
    Returns: (title, part, section)
    """
    match = re.search(r'(\d+)-NYCRR-(\d+)(?:\.(\d+))?', url)
    if match:
        return int(match.group(1)), match.group(2), match.group(3)
    return None, None, None

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

                    if (section_idx + 1) % 5 == 0:
                        print(f"  ✓ Processed {section_idx + 1} sections...")
                        conn.commit()
                        time.sleep(0.5)

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
                    if (file_idx + 1) % 10 == 0:
                        print(f"  ✓ Processed {file_idx + 1} regulations (total: {total_documents})...")
                        conn.commit()
                        time.sleep(0.5)  # Small delay between commits

                except Exception as e:
                    print(f"  ✗ Error processing {json_file.name}: {e}")
                    raise

        conn.commit()

    print(f"✓ Successfully migrated {total_documents} individual regulatory documents")
    return total_documents

def main():
    print("Starting migration to PostgreSQL...\n")

    # First, migrate all individual regulations
    print("Phase 1: Migrating all individual regulations")
    print("=" * 50)
    migrate_all_individual_regulations(state="NY")

    print("\nPhase 2: Migrating analyzed regulations with red flags")
    print("=" * 50)

    # Find all analysis JSON files in outputs directory
    json_files = list(OUTPUTS_DIR.glob("red_flag_analysis_*.json"))

    if not json_files:
        print(f"✗ No red_flag_analysis_*.json files found in {OUTPUTS_DIR}")
        print("✓ All individual regulations are in the database (without analyses)")
        return

    # Migrate each JSON file
    for json_file in sorted(json_files):
        try:
            migrate_json_analysis(str(json_file), state="NY")
        except Exception as e:
            print(f"✗ Failed to migrate {json_file}: {e}")
            raise

    print("\n✓ Migration complete!")

if __name__ == "__main__":
    main()
