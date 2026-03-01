#!/usr/bin/env python3
"""
NYC Statutes (Charter + Administrative Code) - Parse HTML, Migrate to DB

Parses the American Legal Publishing HTML export of NYC law into structured
statute records for the `statutes` table.

Source: newyorkcity-ny-1.html (from ALP export)
  - Charter (lines 1-~3947): ~1,200 sections, numbered "Section 1", "Section 1057-g"
  - Admin Code (lines ~3948-~70794): ~14,000 sections across 74 titles, numbered "§ 1-101"
  - Appendix A (line ~70795+): Historical Local Laws — skipped

Citation formats:
  - Sections:    "NYC Charter 8", "NYC Admin 23-1201"
  - Containers:  "doc:NYCCharter", "NYC Admin Title:1", "NYC Charter Chapter:1"

Pipeline:
1. Parse HTML with BeautifulSoup to extract sections
2. Save to JSON file
3. Migrate sections to statutes table (upsert ON CONFLICT)
4. Create hierarchy container rows (doc, titles, chapters)
5. Populate parent_id relationships

Usage:
    cd backend && python scripts/nyc_statutes.py                  # Full pipeline
    cd backend && python scripts/nyc_statutes.py --parse-only     # Only parse + save JSON
    cd backend && python scripts/nyc_statutes.py --skip-parse     # Use cached JSON
    cd backend && python scripts/nyc_statutes.py --skip-db        # Skip database operations
    cd backend && python scripts/nyc_statutes.py --hierarchy-only # Only update parent_id
    cd backend && python scripts/nyc_statutes.py --charter-only   # Only Charter sections
    cd backend && python scripts/nyc_statutes.py --admin-only     # Only Admin Code sections
"""

import json
import re
import sys
import time
import argparse
from pathlib import Path
from typing import Optional

# Ensure backend/ is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from bs4 import BeautifulSoup, Tag

from config import (
    PROJECT_ROOT,
    NYC_HTML_FILE,
    NYC_STATUTES_OUTPUT_DIR,
    NYC_STATUTES_COMPLETE_FILE,
    ensure_data_dirs,
)
import psycopg
from lib.db import get_db_connection
from lib.stats import format_time
from dotenv import load_dotenv

load_dotenv(PROJECT_ROOT / '.env')


# =============================================================================
# HTML PARSING
# =============================================================================

def parse_nyc_html(
    html_path: Path,
    charter_only: bool = False,
    admin_only: bool = False,
) -> list[dict]:
    """
    Parse the NYC Charter + Administrative Code HTML file.

    The HTML contains three documents in sequence:
      1. NYC Charter (class="rbox Title" with "CHARTER")
      2. NYC Administrative Code (class="rbox Title" with "ADMINISTRATIVE CODE")
      3. Appendix A (class="rbox Title" with "Appendix A") — skipped

    Returns list of statute records ready for DB insertion.
    """
    print(f"Loading HTML from {html_path}...")
    start_time = time.time()

    with open(html_path, 'r', encoding='utf-8') as f:
        content = f.read()

    elapsed = time.time() - start_time
    print(f"  Loaded {len(content):,} chars in {format_time(elapsed)}")

    print("Parsing HTML with BeautifulSoup...")
    start_time = time.time()
    soup = BeautifulSoup(content, 'html.parser')
    elapsed = time.time() - start_time
    print(f"  Parsed in {format_time(elapsed)}")

    # Find the document boundaries by looking for Title-level elements
    title_divs = soup.find_all('div', class_='Title')
    print(f"  Found {len(title_divs)} Title-level elements")

    # Identify document boundaries
    charter_root = None
    admin_code_root = None
    appendix_root = None

    for div in title_divs:
        text = div.get_text(strip=True)
        if 'CHARTER' in text and 'ADMINISTRATIVE' not in text and not charter_root:
            charter_root = div.parent  # The wrapping div
        elif 'ADMINISTRATIVE CODE' in text and not admin_code_root:
            admin_code_root = div.parent
        elif 'Appendix A' in text.replace('\xa0', ' ') and not appendix_root:
            appendix_root = div.parent

    records = []

    # Parse Charter
    if not admin_only:
        if charter_root:
            print("\nParsing NYC Charter...")
            charter_records = _parse_document(soup, 'charter', charter_root, admin_code_root)
            records.extend(charter_records)
            print(f"  Charter: {len(charter_records)} records")
        else:
            print("WARNING: Could not find Charter section in HTML")

    # Parse Admin Code
    if not charter_only:
        if admin_code_root:
            print("\nParsing NYC Administrative Code...")
            admin_records = _parse_document(soup, 'admin_code', admin_code_root, appendix_root)
            records.extend(admin_records)
            print(f"  Admin Code: {len(admin_records)} records")
        else:
            print("WARNING: Could not find Administrative Code section in HTML")

    return records


def _parse_document(
    soup: BeautifulSoup,
    doc_type: str,
    start_element: Tag,
    stop_element: Optional[Tag],
) -> list[dict]:
    """
    Parse sections from a document region of the HTML.

    Walks siblings from start_element, collecting Section elements
    and tracking current chapter/title context.

    Args:
        soup: The full parsed HTML
        doc_type: 'charter' or 'admin_code'
        start_element: The div containing the document's Title
        stop_element: The div where the next document starts (stop before this)
    """
    records = []
    current_chapter = None
    current_chapter_name = None
    current_title = None
    current_title_name = None
    source_index = 0

    # Add document container record
    if doc_type == 'charter':
        doc_citation = 'doc:NYCCharter'
        doc_title = 'NYC Charter'
    else:
        doc_citation = 'doc:NYCAdmin'
        doc_title = 'NYC Administrative Code'

    records.append({
        'citation': doc_citation,
        'state': 'NYC',
        'title': doc_title,
        'content': '',
        'nyc_doc_type': doc_type,
        'nyc_title': None,
        'nyc_chapter': None,
        'nyc_section': None,
        'nyc_section_name': None,
        'hierarchy_level': 'law',
        'hierarchy_path': doc_title,
        'source_index': 0,
        '_parent_citation': None,
    })

    # Walk all siblings starting from the start element's parent container
    # The HTML structure is a flat sequence of top-level divs
    current = start_element
    start_time = time.time()

    while current:
        # Stop if we've reached the next document
        if stop_element and current is stop_element:
            break

        if not isinstance(current, Tag):
            current = current.next_sibling
            continue

        # Check for Title elements (Admin Code titles like "Title 1: General Provisions")
        title_div = current.find('div', class_='Title')
        if title_div:
            anchor = title_div.find('a', attrs={'name': True})
            title_text = title_div.get_text(strip=True)

            # Skip the document-level title itself
            if anchor and anchor.get('name', '').startswith('JD_T'):
                title_id = anchor.get('title', '')
                # Extract title number from ID like "T01" -> "1", "T16-a" -> "16-A"
                title_num_match = re.match(r'T(\d+)(-[a-zA-Z])?', title_id)
                if title_num_match:
                    current_title = title_num_match.group(1).lstrip('0') or '0'
                    if title_num_match.group(2):
                        current_title += title_num_match.group(2).upper()
                else:
                    current_title = title_id

                # Reset chapter when entering a new title
                current_chapter = None
                current_chapter_name = None

                # Extract title name from text like "Title 1: General Provisions"
                name_match = re.match(r'Title\s+[\w-]+:\s*(.*)', title_text)
                current_title_name = name_match.group(1).strip() if name_match else title_text

                # Add title container record
                title_citation = f"NYC Admin Title:{current_title}"
                records.append({
                    'citation': title_citation,
                    'state': 'NYC',
                    'title': f"NYC Admin Code Title {current_title} - {current_title_name}",
                    'content': '',
                    'nyc_doc_type': doc_type,
                    'nyc_title': current_title,
                    'nyc_chapter': None,
                    'nyc_section': None,
                    'nyc_section_name': None,
                    'hierarchy_level': 'title',
                    'hierarchy_path': f"NYC Administrative Code > Title {current_title} - {current_title_name}",
                    'source_index': source_index,
                    '_parent_citation': doc_citation,
                })
                source_index += 1

                # Also check for chapter within same div
                chapter_div = current.find('div', class_='Chapter')
                if chapter_div:
                    _process_chapter(chapter_div, doc_type, doc_citation,
                                     current_title, records, source_index)
                    ch_text = chapter_div.get_text(strip=True)
                    ch_anchor = chapter_div.find('a', attrs={'name': True})
                    if ch_anchor:
                        ch_match = re.match(r'Chapter\s+([\w.-]+)(?::\s*(.*))?', ch_text)
                        if ch_match:
                            current_chapter = ch_match.group(1)
                            current_chapter_name = ch_match.group(2) or ''
                    source_index += 1

            current = current.next_sibling
            continue

        # Check for Chapter elements
        chapter_div = current.find('div', class_='Chapter')
        if chapter_div and not current.find('div', class_='Section'):
            ch_text = chapter_div.get_text(strip=True)
            ch_anchor = chapter_div.find('a', attrs={'name': True})

            ch_match = re.match(r'Chapter\s+([\w.-]+)(?::\s*(.*))?', ch_text)
            if ch_match:
                current_chapter = ch_match.group(1)
                current_chapter_name = ch_match.group(2) or ''

                _process_chapter(chapter_div, doc_type, doc_citation,
                                 current_title, records, source_index)
                source_index += 1
            elif not ch_text.startswith('Chapter'):
                # Non-chapter containers (e.g., "Introductory", "Preamble")
                current_chapter = ch_text
                current_chapter_name = ch_text

                # Create a container record for this non-standard chapter
                if doc_type == 'charter':
                    ch_citation = f"NYC Charter Chapter:{current_chapter}"
                    ch_title = f"NYC Charter Chapter {current_chapter}"
                    ch_path = f"NYC Charter > Chapter {current_chapter}"
                    ch_parent = doc_citation
                else:
                    ch_citation = f"NYC Admin Chapter:{current_title or '?'}-{current_chapter}"
                    ch_title = f"NYC Admin Code Title {current_title} Chapter {current_chapter}"
                    ch_path = f"NYC Administrative Code > Title {current_title} > Chapter {current_chapter}"
                    ch_parent = f"NYC Admin Title:{current_title}" if current_title else doc_citation

                records.append({
                    'citation': ch_citation,
                    'state': 'NYC',
                    'title': ch_title,
                    'content': '',
                    'nyc_doc_type': doc_type,
                    'nyc_title': current_title,
                    'nyc_chapter': current_chapter,
                    'nyc_section': None,
                    'nyc_section_name': None,
                    'hierarchy_level': 'chapter',
                    'hierarchy_path': ch_path,
                    'source_index': source_index,
                    '_parent_citation': ch_parent,
                })
                source_index += 1

            current = current.next_sibling
            continue

        # Check for Section elements
        section_div = current.find('div', class_='Section')
        if section_div:
            record = _parse_section(current, section_div, doc_type,
                                     current_title, current_chapter,
                                     source_index, doc_citation)
            if record:
                records.append(record)
                source_index += 1

                if source_index % 500 == 0:
                    elapsed = time.time() - start_time
                    print(f"    Parsed {source_index} records ({format_time(elapsed)})")

        current = current.next_sibling

    return records


def _process_chapter(
    chapter_div: Tag,
    doc_type: str,
    doc_citation: str,
    current_title: Optional[str],
    records: list[dict],
    source_index: int,
):
    """Add a chapter container record."""
    ch_text = chapter_div.get_text(strip=True)
    ch_match = re.match(r'Chapter\s+([\w.-]+)(?::\s*(.*))?', ch_text)
    if not ch_match:
        return

    ch_num = ch_match.group(1)
    ch_name = ch_match.group(2) or ''

    if doc_type == 'charter':
        citation = f"NYC Charter Chapter:{ch_num}"
        parent = doc_citation
        title_str = f"NYC Charter Chapter {ch_num}"
        path = f"NYC Charter > Chapter {ch_num}"
    else:
        citation = f"NYC Admin Chapter:{current_title or '?'}-{ch_num}"
        parent = f"NYC Admin Title:{current_title}" if current_title else doc_citation
        title_str = f"NYC Admin Code Title {current_title} Chapter {ch_num}"
        path = f"NYC Administrative Code > Title {current_title} > Chapter {ch_num}"

    if ch_name:
        title_str += f" - {ch_name}"
        path += f" - {ch_name}"

    records.append({
        'citation': citation,
        'state': 'NYC',
        'title': title_str,
        'content': '',
        'nyc_doc_type': doc_type,
        'nyc_title': current_title,
        'nyc_chapter': ch_num,
        'nyc_section': None,
        'nyc_section_name': None,
        'hierarchy_level': 'chapter',
        'hierarchy_path': path,
        'source_index': source_index,
        '_parent_citation': parent,
    })


def _parse_section(
    container: Tag,
    section_div: Tag,
    doc_type: str,
    current_title: Optional[str],
    current_chapter: Optional[str],
    source_index: int,
    doc_citation: str,
) -> Optional[dict]:
    """
    Parse a single section element into a statute record.

    Charter sections: <a name="JD_8" title="8">Section 8. <span>General powers.</span>
    Admin sections:   <a name="JD_1-101" title="1-101">§ 1-101 <span>Short title.</span>
    """
    # Find the anchor tag with the section ID
    anchor = section_div.find('a', attrs={'name': True})
    if not anchor:
        return None

    section_id = anchor.get('title', '')
    if not section_id:
        return None

    # Extract section name from bold span
    section_name = ''
    bold_span = section_div.find('span', style=lambda s: s and 'font-weight: bold' in s)
    if bold_span:
        section_name = bold_span.get_text(strip=True).rstrip('. ')

    # If no bold span, try to extract name from the section div text
    if not section_name:
        section_text = section_div.get_text(strip=True)
        # Try: "Section X. Name" or "§ X-XXX Name"
        name_match = re.search(r'(?:Section\s+\S+\.?\s*|§\s*\S+\s+)(.*)', section_text)
        if name_match:
            section_name = name_match.group(1).strip().rstrip('.')

    # Collect body text from Normal-Level divs following the section
    body_parts = []
    for normal_div in container.find_all('div', class_='Normal-Level'):
        # Skip editor's notes
        if normal_div.find(class_='EdNoteSm'):
            continue
        text = normal_div.get_text(strip=True)
        # Clean up non-breaking spaces
        text = text.replace('\xa0', ' ').strip()
        if text:
            body_parts.append(text)

    body_text = '\n'.join(body_parts)

    # Build citation and metadata
    if doc_type == 'charter':
        citation = f"NYC Charter {section_id}"
        display_title = f"NYC Charter Section {section_id}"
        if section_name:
            display_title += f" - {section_name}"
        parent_citation = f"NYC Charter Chapter:{current_chapter}" if current_chapter else doc_citation
        hierarchy_path = f"NYC Charter"
        if current_chapter:
            hierarchy_path += f" > Chapter {current_chapter}"
        hierarchy_path += f" > Section {section_id}"
    else:
        citation = f"NYC Admin {section_id}"
        display_title = f"NYC Admin Code § {section_id}"
        if section_name:
            display_title += f" - {section_name}"
        parent_citation = (f"NYC Admin Chapter:{current_title or '?'}-{current_chapter}"
                          if current_chapter and current_title
                          else f"NYC Admin Title:{current_title}" if current_title
                          else doc_citation)
        hierarchy_path = f"NYC Administrative Code"
        if current_title:
            hierarchy_path += f" > Title {current_title}"
        if current_chapter:
            hierarchy_path += f" > Chapter {current_chapter}"
        hierarchy_path += f" > § {section_id}"

    return {
        'citation': citation,
        'state': 'NYC',
        'title': display_title,
        'content': body_text,
        'nyc_doc_type': doc_type,
        'nyc_title': current_title if doc_type == 'admin_code' else None,
        'nyc_chapter': current_chapter,
        'nyc_section': section_id,
        'nyc_section_name': section_name,
        'hierarchy_level': 'section',
        'hierarchy_path': hierarchy_path,
        'source_index': source_index,
        '_parent_citation': parent_citation,
    }


# =============================================================================
# SAVE TO JSON
# =============================================================================

def save_statutes(records: list[dict]):
    """Save statute records to JSON file."""
    ensure_data_dirs()

    # Strip internal fields for JSON output, but keep _parent_citation
    # which is needed later for parent ID population from the JSON fallback path
    keep_internal = {'_parent_citation'}
    clean_records = []
    for rec in records:
        clean = {k: v for k, v in rec.items() if not k.startswith('_') or k in keep_internal}
        clean_records.append(clean)

    with open(NYC_STATUTES_COMPLETE_FILE, 'w', encoding='utf-8') as f:
        json.dump(clean_records, f, indent=2, ensure_ascii=False)
    print(f"\nSaved {len(clean_records):,} records to {NYC_STATUTES_COMPLETE_FILE}")

    # Summary stats
    sections = [r for r in clean_records if r['hierarchy_level'] == 'section']
    containers = [r for r in clean_records if r['hierarchy_level'] != 'section']
    charter = [r for r in sections if r.get('nyc_doc_type') == 'charter']
    admin = [r for r in sections if r.get('nyc_doc_type') == 'admin_code']
    print(f"  Sections: {len(sections):,} ({len(charter):,} Charter, {len(admin):,} Admin Code)")
    print(f"  Containers: {len(containers):,}")


# =============================================================================
# DATABASE MIGRATION
# =============================================================================

def migrate_nyc_statutes_to_db(records: Optional[list[dict]] = None) -> int:
    """
    Migrate NYC statutes from records (or JSON file) to statutes table.

    Uses upsert (ON CONFLICT jurisdiction+citation) to allow re-runs.
    """
    if records is None:
        if not NYC_STATUTES_COMPLETE_FILE.exists():
            print(f"Error: Statutes file not found: {NYC_STATUTES_COMPLETE_FILE}")
            return 0

        print(f"Loading statutes from {NYC_STATUTES_COMPLETE_FILE}...")
        with open(NYC_STATUTES_COMPLETE_FILE) as f:
            records = json.load(f)

    print(f"Migrating {len(records):,} NYC statutes to database...")

    conn = get_db_connection()
    if not conn:
        print("ERROR: Could not connect to database")
        return 0

    insert_sql = """
        INSERT INTO statutes
        (citation, jurisdiction, title, content,
         nyc_doc_type, nyc_title, nyc_chapter, nyc_section, nyc_section_name,
         hierarchy_level, hierarchy_path, source_index)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (jurisdiction, citation) DO UPDATE SET
            title = EXCLUDED.title,
            content = EXCLUDED.content,
            nyc_doc_type = EXCLUDED.nyc_doc_type,
            nyc_title = EXCLUDED.nyc_title,
            nyc_chapter = EXCLUDED.nyc_chapter,
            nyc_section = EXCLUDED.nyc_section,
            nyc_section_name = EXCLUDED.nyc_section_name,
            hierarchy_level = EXCLUDED.hierarchy_level,
            hierarchy_path = EXCLUDED.hierarchy_path,
            source_index = EXCLUDED.source_index
    """

    total = 0
    errors = 0
    start_time = time.time()

    # Build all rows up front, skipping records without citations
    all_rows = []
    for rec in records:
        citation = rec.get('citation', '')
        if not citation:
            continue
        all_rows.append((
            citation,
            'NYC',
            rec.get('title', ''),
            rec.get('content', ''),
            rec.get('nyc_doc_type'),
            rec.get('nyc_title'),
            rec.get('nyc_chapter'),
            rec.get('nyc_section'),
            rec.get('nyc_section_name'),
            rec.get('hierarchy_level', 'section'),
            rec.get('hierarchy_path', ''),
            rec.get('source_index'),
        ))

    BATCH = 1000
    try:
        with conn.cursor() as cur:
            for i in range(0, len(all_rows), BATCH):
                batch = all_rows[i:i + BATCH]
                try:
                    cur.executemany(insert_sql, batch)
                    conn.commit()
                    total += len(batch)
                except Exception:
                    conn.rollback()
                    # Fall back to row-by-row to identify bad rows
                    for row in batch:
                        try:
                            cur.execute(insert_sql, row)
                            conn.commit()
                            total += 1
                        except Exception as row_err:
                            conn.rollback()
                            errors += 1
                            print(f"  ERROR inserting {row[0]}: {row_err}")

                elapsed = time.time() - start_time
                done = total + errors
                if done % 1000 == 0 or done == len(all_rows):
                    print(f"  Migrated {total:,} / {len(all_rows):,} ({format_time(elapsed)})")

    finally:
        conn.close()

    if errors:
        print(f"WARNING: {errors:,} rows failed to insert")

    elapsed = time.time() - start_time
    print(f"Migrated {total:,} statutes in {format_time(elapsed)}")
    return total


# =============================================================================
# HIERARCHY / PARENT ID
# =============================================================================

def populate_nyc_parent_ids(records: Optional[list[dict]] = None) -> int:
    """
    Populate parent_id for NYC statutes using _parent_citation from parse.

    If records with _parent_citation are provided, uses those mappings.
    Otherwise uses JSON file.
    """
    print("\nPopulating parent_id for NYC statutes...")

    if records is None:
        if NYC_STATUTES_COMPLETE_FILE.exists():
            with open(NYC_STATUTES_COMPLETE_FILE) as f:
                records = json.load(f)

    conn = get_db_connection()
    if not conn:
        print("ERROR: Could not connect to database")
        return 0

    try:
        if not records:
            print("  No records available for parent mapping")
            return 0

        # Build parent mapping: child_citation -> parent_citation
        parent_map: dict[str, str] = {}
        for rec in records:
            citation = rec.get('citation', '')
            parent_cit = rec.get('_parent_citation')
            if citation and parent_cit:
                parent_map[citation] = parent_cit

        print(f"  Built {len(parent_map):,} parent relationships from parse data")

        # Use temp table + batch UPDATE
        conn.execute("CREATE TEMP TABLE _parent_map (child_citation TEXT, parent_citation TEXT)")

        items = list(parent_map.items())
        BATCH = 1000
        with conn.cursor() as cur:
            for i in range(0, len(items), BATCH):
                batch = items[i:i + BATCH]
                cur.executemany(
                    "INSERT INTO _parent_map (child_citation, parent_citation) VALUES (%s, %s)",
                    batch,
                )
        conn.commit()

        result = conn.execute("""
            UPDATE statutes s
            SET parent_id = p.id
            FROM _parent_map m
            JOIN statutes p ON p.jurisdiction = 'NYC' AND p.citation = m.parent_citation
            WHERE s.jurisdiction = 'NYC' AND s.citation = m.child_citation
              AND (s.parent_id IS NULL OR s.parent_id != p.id)
        """)
        total_updated = result.rowcount
        conn.commit()

        conn.execute("DROP TABLE IF EXISTS _parent_map")
        conn.commit()

        print(f"  Updated {total_updated:,} parent relationships")
        return total_updated

    except psycopg.Error as e:
        print(f"ERROR populating parent_ids: {e}")
        import traceback
        traceback.print_exc()
        return -1
    finally:
        conn.close()


# =============================================================================
# MAIN PIPELINE
# =============================================================================

def run_pipeline(
    parse_only: bool = False,
    skip_parse: bool = False,
    skip_db: bool = False,
    hierarchy_only: bool = False,
    charter_only: bool = False,
    admin_only: bool = False,
):
    """Run the NYC statutes pipeline."""
    print("=" * 60)
    print("NYC STATUTES PIPELINE (Charter + Administrative Code)")
    print("Parse HTML -> JSON -> Database -> Hierarchy")
    print("=" * 60)
    print()

    start_time = time.time()
    ensure_data_dirs()

    # Hierarchy-only mode
    if hierarchy_only:
        print("[SKIPPED] Parse & migrate steps (--hierarchy-only)")
        print()
        print("STEP: POPULATING PARENT IDS")
        print("-" * 40)
        populate_nyc_parent_ids()
        elapsed = time.time() - start_time
        print(f"\nHierarchy update complete in {format_time(elapsed)}")
        return True

    # Step 1: Parse HTML
    records = None
    if not skip_parse:
        print("STEP 1: PARSING HTML")
        print("-" * 40)

        if not NYC_HTML_FILE.exists():
            print(f"ERROR: HTML file not found: {NYC_HTML_FILE}")
            return False

        records = parse_nyc_html(
            NYC_HTML_FILE,
            charter_only=charter_only,
            admin_only=admin_only,
        )

        if not records:
            print("ERROR: No statutes parsed!")
            return False

        print(f"\nParsed {len(records):,} total records")

        # Save to JSON
        print("\nSTEP 2: SAVING TO JSON")
        print("-" * 40)
        save_statutes(records)
        print()
    else:
        print("[SKIPPED] Steps 1-2: Parse & save (--skip-parse)")
        print()

    if parse_only:
        elapsed = time.time() - start_time
        print(f"\nParse complete in {format_time(elapsed)}")
        return True

    if skip_db:
        elapsed = time.time() - start_time
        print(f"\nPipeline complete (DB skipped) in {format_time(elapsed)}")
        return True

    # Step 3: Migrate to database
    print("STEP 3: MIGRATING TO DATABASE")
    print("-" * 40)
    migrated = migrate_nyc_statutes_to_db(records)
    if migrated == 0:
        print("WARNING: No statutes migrated")
    print()

    # Step 4: Populate parent_id
    print("STEP 4: POPULATING PARENT IDS")
    print("-" * 40)
    parent_updates = populate_nyc_parent_ids(records)
    print()

    elapsed = time.time() - start_time
    print("=" * 60)
    print("PIPELINE COMPLETE")
    print("=" * 60)
    print(f"Records migrated: {migrated:,}")
    print(f"Parent relationships set: {parent_updates:,}")
    print(f"Total time: {format_time(elapsed)}")

    return True


def main():
    parser = argparse.ArgumentParser(
        description='NYC Statutes - Parse Charter + Admin Code HTML and migrate to DB'
    )
    parser.add_argument('--parse-only', action='store_true',
                        help='Only parse HTML and save JSON, skip database operations')
    parser.add_argument('--skip-parse', action='store_true',
                        help='Skip HTML parsing, use existing cached JSON')
    parser.add_argument('--skip-db', action='store_true',
                        help='Skip database operations')
    parser.add_argument('--hierarchy-only', action='store_true',
                        help='Only update parent_id relationships')
    parser.add_argument('--charter-only', action='store_true',
                        help='Only parse Charter sections')
    parser.add_argument('--admin-only', action='store_true',
                        help='Only parse Administrative Code sections')

    args = parser.parse_args()

    run_pipeline(
        parse_only=args.parse_only,
        skip_parse=args.skip_parse,
        skip_db=args.skip_db,
        hierarchy_only=args.hierarchy_only,
        charter_only=args.charter_only,
        admin_only=args.admin_only,
    )


if __name__ == "__main__":
    main()
