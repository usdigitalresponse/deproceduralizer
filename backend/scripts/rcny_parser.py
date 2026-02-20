#!/usr/bin/env python3
"""
RCNY (Rules of the City of New York) - Parse XML, Migrate to DB

Parses the American Legal Publishing XML export of the RCNY into structured
regulation records for the `regulatory_documents` table.

Source: XML.zip from ALP export at codelibrary.amlegal.com
  - Extract to data/rcny_xml/XML/ (XML files, split at the chapter level)
  - Each file is a DOCUMENT with nested LEVEL elements
  - Hierarchy levels: Title > Chapter > Subchapter > Subtitle > Part > Subpart > Section > Normal Level
  - Only Title, Chapter, and Section levels are extracted as DB records
  - Files are split at the Chapter level, so most files start with a Chapter
    LEVEL rather than a Title LEVEL. Title info is extracted from DESTINATION
    names (e.g. T01C003 = Title 1, Chapter 3).

Pipeline:
1. Parse all XML files to extract titles, chapters, sections
2. Save to JSON file
3. Migrate to regulatory_documents table (upsert ON CONFLICT)
4. Populate parent_id relationships

Usage:
    cd backend && python scripts/rcny_parser.py                  # Full pipeline
    cd backend && python scripts/rcny_parser.py --parse-only     # Only parse + save JSON
    cd backend && python scripts/rcny_parser.py --skip-parse     # Use cached JSON
    cd backend && python scripts/rcny_parser.py --skip-db        # Skip database operations
    cd backend && python scripts/rcny_parser.py --hierarchy-only # Only update parent_id
    cd backend && python scripts/rcny_parser.py --title 1        # Only parse Title 1
"""

import json
import re
import sys
import time
import argparse
from pathlib import Path
from typing import Optional
from xml.etree import ElementTree as ET

# Ensure backend/ is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config import (
    PROJECT_ROOT,
    RCNY_XML_DIR,
    RCNY_REGULATIONS_COMPLETE_FILE,
    ensure_data_dirs,
)
from lib.db import get_db_connection
from lib.migration import migrate_regulations_to_db, populate_parent_ids
from lib.stats import format_time
from dotenv import load_dotenv

load_dotenv(PROJECT_ROOT / '.env')

# Base URL for RCNY on American Legal Publishing
ALP_BASE_URL = "https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/"


# =============================================================================
# XML PARSING
# =============================================================================

def parse_rcny_xml(
    xml_dir: Path,
    title_filter: Optional[str] = None,
) -> list[dict]:
    """
    Parse all RCNY XML files into regulation records.

    Two-pass approach:
      Pass 1: Scan files to collect title info (number -> name)
      Pass 2: Process all files to extract chapters and sections

    Returns list of regulation records ready for DB insertion.
    """
    xml_files = sorted(xml_dir.glob('*.xml'))
    print(f"Found {len(xml_files):,} XML files in {xml_dir}")

    if not xml_files:
        print("ERROR: No XML files found")
        return []

    start_time = time.time()

    # Pass 1: Collect title info from Title-level files
    print("  Pass 1: Collecting title info...")
    title_info = {}  # title_num -> title_name
    pass1_parse_errors = 0
    for xml_file in xml_files:
        try:
            tree = ET.parse(xml_file)
        except ET.ParseError as e:
            pass1_parse_errors += 1
            print(f"  WARNING: Pass 1 failed to parse {xml_file.name}: {e}")
            continue
        root = tree.getroot()
        for level in root.iter('LEVEL'):
            if level.get('style-name') == 'Title':
                title_num, title_name = _extract_title_info(level)
                if title_num and title_num not in title_info:
                    title_info[title_num] = title_name

    print(f"  Found {len(title_info)} titles" + (f" ({pass1_parse_errors} XML parse errors)" if pass1_parse_errors else ""))

    # Pass 2: Process all files
    print("  Pass 2: Extracting records...")
    records = []
    source_index = 0
    seen_titles = {}    # title_num -> source_index
    seen_chapters = {}  # (title_num, chapter_num) -> source_index
    skipped_no_title = 0
    skipped_sections = 0

    for i, xml_file in enumerate(xml_files):
        try:
            tree = ET.parse(xml_file)
        except ET.ParseError as e:
            print(f"  WARNING: Failed to parse {xml_file.name}: {e}")
            continue

        root = tree.getroot()

        # Determine the title for this file
        file_title_num = _get_file_title_num(root)
        if not file_title_num:
            skipped_no_title += 1
            print(f"  WARNING: Could not determine title for {xml_file.name}, skipping")
            continue

        # Apply title filter
        if title_filter is not None and file_title_num != title_filter:
            continue

        file_title_name = title_info.get(file_title_num, '')

        # Ensure title record exists
        if file_title_num not in seen_titles:
            record_id = _get_title_record_id(root, file_title_num)
            records.append({
                'source_index': source_index,
                'type': 'regulation',
                'state': 'NYC',
                'title': f"RCNY Title {file_title_num}: {file_title_name}",
                'url': f"{ALP_BASE_URL}{record_id}" if record_id else f"rcny://title/{file_title_num}",
                'url_type': 'title',
                'content': '',
                'hierarchy_level': 'title',
                'hierarchy_path': f"RCNY > Title {file_title_num} - {file_title_name}",
                'rcny_title': file_title_num,
                'rcny_title_name': file_title_name,
                'rcny_chapter': None,
                'rcny_chapter_name': None,
                'rcny_section': None,
                'rcny_section_name': None,
                'parent_source_index': None,
                'scraped_from_url': str(xml_file),
            })
            seen_titles[file_title_num] = source_index
            source_index += 1

        title_si = seen_titles[file_title_num]

        # Process chapters and sections
        for level in root.iter('LEVEL'):
            style = level.get('style-name', '')

            if style == 'Chapter':
                ch_num, ch_name = _extract_chapter_info(level)
                if not ch_num:
                    continue

                ch_key = (file_title_num, ch_num)
                if ch_key not in seen_chapters:
                    record_id = _get_record_id(level)
                    records.append({
                        'source_index': source_index,
                        'type': 'regulation',
                        'state': 'NYC',
                        'title': f"RCNY Title {file_title_num} Chapter {ch_num}" + (f": {ch_name}" if ch_name else ''),
                        'url': f"{ALP_BASE_URL}{record_id}" if record_id else f"rcny://title/{file_title_num}/chapter/{ch_num}",
                        'url_type': 'title',
                        'content': '',
                        'hierarchy_level': 'chapter',
                        'hierarchy_path': f"RCNY > Title {file_title_num} - {file_title_name} > Chapter {ch_num}" + (f" - {ch_name}" if ch_name else ''),
                        'rcny_title': file_title_num,
                        'rcny_title_name': file_title_name,
                        'rcny_chapter': ch_num,
                        'rcny_chapter_name': ch_name,
                        'rcny_section': None,
                        'rcny_section_name': None,
                        'parent_source_index': title_si,
                        'scraped_from_url': None,
                    })
                    seen_chapters[ch_key] = source_index
                    source_index += 1

            elif style == 'Section':
                sec_record = _parse_section_level(
                    level, root, file_title_num, file_title_name,
                    seen_titles, seen_chapters, source_index,
                )
                if sec_record:
                    records.append(sec_record)
                    source_index += 1
                else:
                    skipped_sections += 1

        if (i + 1) % 100 == 0:
            elapsed = time.time() - start_time
            rate = (i + 1) / elapsed if elapsed > 0 else 0
            remaining = (len(xml_files) - (i + 1)) / rate if rate > 0 else 0
            print(f"  Processed {i+1:,}/{len(xml_files):,} files, {source_index:,} records ({format_time(elapsed)}, ETA: {format_time(remaining)})")

    elapsed = time.time() - start_time
    print(f"  Processed {len(xml_files):,} files in {format_time(elapsed)}")
    if skipped_no_title:
        print(f"  WARNING: {skipped_no_title} files skipped (could not determine title)")
    if skipped_sections:
        print(f"  WARNING: {skipped_sections} sections skipped (no record/section_id/title)")

    return records


def _get_file_title_num(root: ET.Element) -> Optional[str]:
    """
    Determine the RCNY title number for an XML file.

    Strategy (tried in order):
    1. If the file contains a Title LEVEL, extract from its heading
    2. Extract from DESTINATION names (e.g. T01C003 -> Title 1)
    3. Extract from chapter headings like "Title 16-A Chapter 1..."
    """
    # Check for Title LEVEL
    for level in root.iter('LEVEL'):
        if level.get('style-name') == 'Title':
            title_num, _ = _extract_title_info(level)
            if title_num:
                return title_num

    # Extract from DESTINATION names
    for dest in root.iter('DESTINATION'):
        name = dest.get('name', '')
        m = re.match(r'T(\d+)C', name)
        if m:
            return m.group(1).lstrip('0') or '0'

    # Extract from chapter heading like "Title 16-A Chapter 1..."
    for level in root.iter('LEVEL'):
        if level.get('style-name') == 'Chapter':
            rec = level.find('RECORD')
            if rec is not None:
                heading = rec.findtext('HEADING', '')
                m = re.match(r'Title\s+([\w-]+)\s+Chapter', heading)
                if m:
                    return m.group(1)

    return None


def _get_title_record_id(root: ET.Element, title_num: str) -> Optional[str]:
    """Get the record ID for a title from its LEVEL element."""
    for level in root.iter('LEVEL'):
        if level.get('style-name') == 'Title':
            num, _ = _extract_title_info(level)
            if num == title_num:
                return _get_record_id(level)
    return None


def _extract_title_info(level: ET.Element) -> tuple[Optional[str], str]:
    """Extract title number and name from a Title LEVEL element."""
    rec = level.find('RECORD')
    if rec is None:
        return None, ''

    heading = rec.findtext('HEADING', '').strip()
    if not heading:
        return None, ''

    # Match "Title N: Name" or "Title N-A: Name" (e.g. "Title 38-A: ...")
    m = re.match(r'Title\s+([\w-]+)(?::\s*(.*))?', heading)
    if m:
        title_num = m.group(1)
        title_name = (m.group(2) or '').strip()
        # Skip roman numeral sub-titles (Health Code Title I-V within Title 24)
        if re.match(r'^[IVXLC]+$', title_num):
            return None, ''
        return title_num, title_name

    return None, ''


def _extract_chapter_info(level: ET.Element) -> tuple[Optional[str], str]:
    """Extract chapter number and name from a Chapter LEVEL element."""
    rec = level.find('RECORD')
    if rec is None:
        return None, ''

    heading = rec.findtext('HEADING', '').strip()
    # Standard: "Chapter N: Name"
    m = re.match(r'Chapter\s+([\w.-]+)(?::\s*(.*))?', heading)
    if m:
        return m.group(1), (m.group(2) or '').strip()
    # Special: "Title 16-A Chapter 1 ..." (chapter heading includes title prefix)
    m = re.match(r'Title\s+[\w-]+\s+Chapter\s+([\w.-]+)\s*(.*)', heading)
    if m:
        return m.group(1), m.group(2).strip()
    return None, ''


def _get_record_id(level: ET.Element) -> Optional[str]:
    """Get the record ID for URL construction."""
    rec = level.find('RECORD')
    if rec is not None:
        return rec.get('id')
    return None


def _extract_text_from_level(level: ET.Element) -> str:
    """Extract all text content from Normal Level children of a Section.

    Uses findall instead of iter to avoid processing nested Normal Level
    elements multiple times (iter returns descendants recursively).
    """
    parts = []
    # Get RECORD/PARA from the section itself
    for rec in level.findall('RECORD'):
        for para in rec.iter('PARA'):
            text = _get_para_text(para)
            if text:
                parts.append(text)
    # Get RECORD/PARA from direct Normal Level children only
    for child_level in level.findall('LEVEL'):
        if child_level.get('style-name') != 'Normal Level':
            continue
        for rec in child_level.iter('RECORD'):
            for para in rec.iter('PARA'):
                text = _get_para_text(para)
                if text:
                    parts.append(text)
    return '\n'.join(parts)


def _get_para_text(para: ET.Element) -> str:
    """Extract text from a PARA element, handling CHARFORMAT, TAB, LINEBRK etc."""
    parts = []

    def _walk(el):
        # Skip hidden text and ALP markers
        if el.tag == 'CHARFORMAT' and el.get('hidden') == '1':
            return
        if el.tag == 'HIGHLIGHTER':
            return
        if el.tag == 'IMAGE':
            return

        if el.tag == 'TAB':
            parts.append(' ')
        elif el.tag == 'LINEBRK':
            parts.append('\n')
        elif el.tag == 'LINK':
            if el.text:
                parts.append(el.text)
        else:
            if el.text:
                parts.append(el.text)

        for child in el:
            _walk(child)

        if el.tail:
            parts.append(el.tail)

    _walk(para)
    text = ''.join(parts).strip()
    text = re.sub(r' {2,}', ' ', text)
    return text


def _parse_section_level(
    level: ET.Element,
    root: ET.Element,
    file_title_num: str,
    file_title_name: str,
    seen_titles: dict,
    seen_chapters: dict,
    source_index: int,
) -> Optional[dict]:
    """Parse a Section LEVEL element into a regulation record."""
    rec = level.find('RECORD')
    if rec is None:
        return None

    heading = rec.findtext('HEADING', '').strip()
    record_id = rec.get('id')

    # Extract section ID from DESTINATION name like "T01C003_3-01"
    section_id = None
    para = rec.find('PARA')
    if para is not None:
        dest = para.find('DESTINATION')
        if dest is not None:
            dest_name = dest.get('name', '')
            sec_match = re.search(r'_(.+)$', dest_name)
            if sec_match:
                section_id = sec_match.group(1)

    # Fallback: extract from heading "§ 3-01 Name"
    if not section_id:
        sec_match = re.match(r'§\s*([\w.-]+)', heading)
        if sec_match:
            section_id = sec_match.group(1)

    if not section_id:
        return None

    # Extract section name from heading
    section_name = ''
    name_match = re.match(r'§\s*[\w.-]+\s+(.*)', heading)
    if name_match:
        section_name = name_match.group(1).strip().rstrip('.')

    # Determine chapter from DESTINATION name or by walking ancestors
    ch_num = None
    ch_name = ''
    if para is not None:
        dest = para.find('DESTINATION')
        if dest is not None:
            dest_name = dest.get('name', '')
            ch_match = re.match(r'T\d+C(\d+)', dest_name)
            if ch_match:
                ch_num_raw = ch_match.group(1).lstrip('0') or '0'
                ch_key = (file_title_num, ch_num_raw)
                if ch_key in seen_chapters:
                    ch_num = ch_num_raw

    # Fallback: find Chapter ancestor within same file
    if ch_num is None:
        # Walk up through parent levels in this file
        parent_map = {}
        for parent in root.iter():
            for child in parent:
                parent_map[child] = parent
        current = level
        while current in parent_map:
            current = parent_map[current]
            if current.tag == 'LEVEL' and current.get('style-name') == 'Chapter':
                ch_num, ch_name = _extract_chapter_info(current)
                break

    # Look up parent source_index
    title_si = seen_titles.get(file_title_num)
    if title_si is None:
        return None

    if ch_num:
        parent_si = seen_chapters.get((file_title_num, ch_num), title_si)
    else:
        parent_si = title_si

    # Collect body text
    body_text = _extract_text_from_level(level)

    # Detect repealed/terminated sections
    is_repealed = any(marker in heading for marker in ['[Repealed]', '[Terminated', '[Rescinded]', '[Revoked]'])

    # Build hierarchy path
    path_parts = ["RCNY", f"Title {file_title_num} - {file_title_name}"]
    if ch_num:
        ch_part = f"Chapter {ch_num}"
        if ch_name:
            ch_part += f" - {ch_name}"
        path_parts.append(ch_part)
    path_parts.append(f"§ {section_id}")

    display_title = f"RCNY § {section_id}"
    if section_name:
        display_title += f" {section_name}"

    result = {
        'source_index': source_index,
        'type': 'regulation',
        'state': 'NYC',
        'title': display_title,
        'url': f"{ALP_BASE_URL}{record_id}" if record_id else f"rcny://title/{file_title_num}/section/{section_id}",
        'url_type': 'regulation',
        'content': body_text,
        'hierarchy_level': 'section',
        'hierarchy_path': ' > '.join(path_parts),
        'rcny_title': file_title_num,
        'rcny_title_name': file_title_name,
        'rcny_chapter': ch_num,
        'rcny_chapter_name': ch_name,
        'rcny_section': section_id,
        'rcny_section_name': section_name,
        'parent_source_index': parent_si,
        'scraped_from_url': None,
    }

    if is_repealed:
        result['regulatory_status'] = 'repealed'

    return result


# =============================================================================
# SAVE TO JSON
# =============================================================================

def save_regulations(records: list[dict]):
    """Save regulation records to JSON file."""
    ensure_data_dirs()

    try:
        with open(RCNY_REGULATIONS_COMPLETE_FILE, 'w', encoding='utf-8') as f:
            json.dump(records, f, indent=2, ensure_ascii=False)
    except OSError as e:
        print(f"ERROR: Failed to save regulations to {RCNY_REGULATIONS_COMPLETE_FILE}: {e}")
        raise
    print(f"\nSaved {len(records):,} records to {RCNY_REGULATIONS_COMPLETE_FILE}")

    sections = [r for r in records if r['hierarchy_level'] == 'section']
    chapters = [r for r in records if r['hierarchy_level'] == 'chapter']
    titles = [r for r in records if r['hierarchy_level'] == 'title']
    repealed = [r for r in sections if r.get('regulatory_status') == 'repealed']
    print(f"  Titles: {len(titles):,}")
    print(f"  Chapters: {len(chapters):,}")
    print(f"  Sections: {len(sections):,} ({len(repealed):,} repealed)")


# =============================================================================
# DATABASE MIGRATION
# =============================================================================

def migrate_rcny_to_db(records: Optional[list[dict]] = None) -> int:
    """Migrate RCNY records to regulatory_documents table."""
    if records is None:
        if not RCNY_REGULATIONS_COMPLETE_FILE.exists():
            print(f"Error: File not found: {RCNY_REGULATIONS_COMPLETE_FILE}")
            return 0
        print(f"Loading regulations from {RCNY_REGULATIONS_COMPLETE_FILE}...")
        try:
            with open(RCNY_REGULATIONS_COMPLETE_FILE) as f:
                records = json.load(f)
        except (json.JSONDecodeError, OSError) as e:
            print(f"ERROR: Failed to load {RCNY_REGULATIONS_COMPLETE_FILE}: {e}")
            return 0

    return migrate_regulations_to_db('NYC', regulations=records)


def populate_rcny_parent_ids(records: Optional[list[dict]] = None):
    """Populate parent_id for RCNY regulations.

    Uses two strategies:
    1. Source-index based (from parsed records) — standard approach
    2. SQL-based matching on rcny_title/rcny_chapter/rcny_section columns —
       catches any RCNY docs that lost parent_ids (e.g., after Health Code
       parser clears NYC parents)
    """
    if records is None:
        if RCNY_REGULATIONS_COMPLETE_FILE.exists():
            try:
                with open(RCNY_REGULATIONS_COMPLETE_FILE) as f:
                    records = json.load(f)
            except (json.JSONDecodeError, OSError) as e:
                print(f"ERROR: Failed to load {RCNY_REGULATIONS_COMPLETE_FILE}: {e}")
                return
        else:
            print(f"Error: File not found: {RCNY_REGULATIONS_COMPLETE_FILE}")
            return
    populate_parent_ids('NYC', regulations=records)

    # SQL-based fallback: fix any RCNY orphans using rcny_* column matching
    _fix_rcny_orphan_parents()


def _fix_rcny_orphan_parents():
    """Fix RCNY docs with no parent_id using rcny_title/chapter/section matching.

    This catches cases where parent_ids were cleared (e.g., by another NYC parser)
    or where source_index-based linking missed some records.
    """
    conn = get_db_connection()
    if not conn:
        return

    # Link RCNY chapters to their RCNY titles
    result = conn.execute("""
        UPDATE regulatory_documents c
        SET parent_id = t.id
        FROM regulatory_documents t
        WHERE c.state = 'NYC' AND c.hierarchy_level = 'chapter'
          AND c.parent_id IS NULL
          AND c.title LIKE 'RCNY%'
          AND t.state = 'NYC' AND t.hierarchy_level = 'title'
          AND t.rcny_title = c.rcny_title
          AND t.title LIKE 'RCNY%'
    """)
    ch_count = result.rowcount

    # Link RCNY sections to their RCNY chapters
    result = conn.execute("""
        UPDATE regulatory_documents s
        SET parent_id = c.id
        FROM regulatory_documents c
        WHERE s.state = 'NYC' AND s.hierarchy_level = 'section'
          AND s.parent_id IS NULL
          AND s.title LIKE 'RCNY%'
          AND c.state = 'NYC' AND c.hierarchy_level = 'chapter'
          AND c.rcny_title = s.rcny_title
          AND s.rcny_section LIKE c.rcny_chapter || '-%'
          AND c.title LIKE 'RCNY%'
    """)
    sec_ch_count = result.rowcount

    # Link remaining RCNY sections directly to titles (no matching chapter)
    result = conn.execute("""
        UPDATE regulatory_documents s
        SET parent_id = t.id
        FROM regulatory_documents t
        WHERE s.state = 'NYC' AND s.hierarchy_level = 'section'
          AND s.parent_id IS NULL
          AND s.title LIKE 'RCNY%'
          AND t.state = 'NYC' AND t.hierarchy_level = 'title'
          AND t.rcny_title = s.rcny_title
          AND t.title LIKE 'RCNY%'
    """)
    sec_t_count = result.rowcount

    conn.commit()
    conn.close()

    total = ch_count + sec_ch_count + sec_t_count
    if total > 0:
        print(f"  Fixed {total:,} RCNY orphan parent_ids ({ch_count} chapters, {sec_ch_count} sections→chapters, {sec_t_count} sections→titles)")


# =============================================================================
# MAIN PIPELINE
# =============================================================================

def run_pipeline(
    parse_only: bool = False,
    skip_parse: bool = False,
    skip_db: bool = False,
    hierarchy_only: bool = False,
    title_filter: Optional[str] = None,
):
    """Run the RCNY parsing pipeline."""
    print("=" * 60)
    print("RCNY PARSER (Rules of the City of New York)")
    print("Parse XML -> JSON -> Database -> Hierarchy")
    print("=" * 60)
    print()

    start_time = time.time()
    ensure_data_dirs()

    if hierarchy_only:
        print("[SKIPPED] Parse & migrate steps (--hierarchy-only)")
        print()
        print("STEP: POPULATING PARENT IDS")
        print("-" * 40)
        populate_rcny_parent_ids()
        elapsed = time.time() - start_time
        print(f"\nHierarchy update complete in {format_time(elapsed)}")
        return True

    records = None
    if not skip_parse:
        print("STEP 1: PARSING XML")
        print("-" * 40)

        if not RCNY_XML_DIR.exists():
            print(f"ERROR: XML directory not found: {RCNY_XML_DIR}")
            print(f"  Download XML.zip from codelibrary.amlegal.com -> RCNY -> Download (XML)")
            print(f"  Extract to: {RCNY_XML_DIR.parent}/")
            return False

        records = parse_rcny_xml(RCNY_XML_DIR, title_filter=title_filter)

        if not records:
            print("ERROR: No regulations parsed!")
            return False

        print(f"\nParsed {len(records):,} total records")

        print("\nSTEP 2: SAVING TO JSON")
        print("-" * 40)
        save_regulations(records)
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

    print("STEP 3: MIGRATING TO DATABASE")
    print("-" * 40)
    migrated = migrate_rcny_to_db(records)
    if migrated == 0:
        print("WARNING: No regulations migrated")
    print()

    print("STEP 4: POPULATING PARENT IDS")
    print("-" * 40)
    populate_rcny_parent_ids(records)
    print()

    elapsed = time.time() - start_time
    print("=" * 60)
    print("PIPELINE COMPLETE")
    print("=" * 60)
    print(f"Records migrated: {migrated:,}")
    print(f"Total time: {format_time(elapsed)}")

    return True


def main():
    parser = argparse.ArgumentParser(
        description='RCNY Parser - Parse Rules of the City of New York XML and migrate to DB'
    )
    parser.add_argument('--parse-only', action='store_true',
                        help='Only parse XML and save JSON, skip database operations')
    parser.add_argument('--skip-parse', action='store_true',
                        help='Skip XML parsing, use existing cached JSON')
    parser.add_argument('--skip-db', action='store_true',
                        help='Skip database operations')
    parser.add_argument('--hierarchy-only', action='store_true',
                        help='Only update parent_id relationships')
    parser.add_argument('--title', type=str, default=None,
                        help='Only parse a specific title number (e.g., --title 1)')

    args = parser.parse_args()

    success = run_pipeline(
        parse_only=args.parse_only,
        skip_parse=args.skip_parse,
        skip_db=args.skip_db,
        hierarchy_only=args.hierarchy_only,
        title_filter=args.title,
    )

    if not success:
        sys.exit(1)


if __name__ == "__main__":
    main()
