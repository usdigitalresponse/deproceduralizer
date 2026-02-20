#!/usr/bin/env python3
"""
NYC Health Code - Parse HTML, Migrate to DB

Parses the American Legal Publishing HTML export of the NYC Health Code into
structured regulation records for the `regulatory_documents` table.

Source: newyorkcity-ny-1_health.html (manual download from ALP)
  Download: https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-1
  Navigate to "New York City Health Code", save full page HTML.

  - Title I-V (class="Subchapter") containing Articles (class="Part") and Sections (class="Section")
  - Hierarchy: Title (I-V) → Article (1-205) → Section (§ X.YZ)

The Health Code is part of RCNY Title 24 but has its own hierarchy. Records use
the same `rcny_*` DB fields as RCNY data, with `source_index` offset at 100,000
to avoid collision with existing RCNY records.

Citation formats:
  - Sections:  "NYC Health Code § 47.01"
  - Articles:  "NYC Health Code Article 47"
  - Titles:    "NYC Health Code Title III"

Pipeline:
1. Parse HTML with BeautifulSoup to extract titles, articles, sections
2. Save to JSON file
3. Migrate to regulatory_documents table (upsert ON CONFLICT)
4. Populate parent_id relationships

Usage:
    cd backend && python scripts/health_code_parser.py              # Full pipeline
    cd backend && python scripts/health_code_parser.py --parse-only # Only parse + save JSON
    cd backend && python scripts/health_code_parser.py --skip-parse # Use cached JSON
    cd backend && python scripts/health_code_parser.py --skip-db    # Skip database operations
    cd backend && python scripts/health_code_parser.py --title III  # Only Title III
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
from scripts.scraper_utils import convert_tables_to_markdown

from config import (
    PROJECT_ROOT,
    NYC_HEALTH_CODE_HTML_FILE,
    NYC_HEALTH_CODE_COMPLETE_FILE,
    ensure_data_dirs,
)
from lib.migration import migrate_regulations_to_db, populate_parent_ids
from lib.stats import format_time
from dotenv import load_dotenv

load_dotenv(PROJECT_ROOT / '.env')

# source_index offset to avoid collision with RCNY records (max ~7,777)
SOURCE_INDEX_OFFSET = 100_000


# =============================================================================
# HTML PARSING
# =============================================================================

ROMAN_MAP = {
    'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5,
    'VI': 6, 'VII': 7, 'VIII': 8, 'IX': 9, 'X': 10,
}


def _roman_to_int(roman: str) -> int:
    """Convert roman numeral to int for title numbering."""
    return ROMAN_MAP.get(roman.upper(), 0)


def parse_health_code_html(
    html_path: Path,
    title_filter: Optional[str] = None,
) -> list[dict]:
    """
    Parse the NYC Health Code HTML file into regulation records.

    The HTML has a flat structure of top-level divs:
      - class="Subchapter" = Title (I-V)
      - class="Part" = Article (1, 3, 5, ...)
      - class="Section" = Section (§ 47.01, etc.)
      - class="Normal-Level" = Body text for preceding section

    Args:
        html_path: Path to the Health Code HTML file
        title_filter: Optional roman numeral to filter to a single title (e.g. "III")

    Returns:
        List of regulation records ready for DB insertion.
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

    # Collect all top-level content divs (direct children of body)
    body = soup.find('body')
    if not body:
        print("ERROR: No <body> element found")
        return []

    records = []
    source_index = SOURCE_INDEX_OFFSET

    current_title_roman = None
    current_title_name = None
    current_title_num = None
    current_title_si = None

    current_article_num = None
    current_article_name = None
    current_article_si = None

    section_count = 0
    start_time = time.time()

    # Walk all top-level divs. The HTML is a flat sequence of siblings.
    for top_div in body.children:
        if not isinstance(top_div, Tag):
            continue

        # Check for Title (Subchapter class)
        subchapter_div = top_div.find('div', class_='Subchapter')
        if subchapter_div:
            anchor = subchapter_div.find('a', attrs={'name': True})
            text = subchapter_div.get_text(strip=True)

            # Match "Title X: Name" pattern
            title_match = re.match(r'Title\s+([IVXLC]+):\s*(.*)', text)
            if title_match:
                roman = title_match.group(1)
                name = title_match.group(2).strip()

                # Apply title filter
                if title_filter and roman.upper() != title_filter.upper():
                    current_title_roman = None
                    current_title_num = None
                    current_title_si = None
                    current_article_num = None
                    current_article_si = None
                    continue

                current_title_roman = roman
                current_title_name = name
                current_title_num = str(_roman_to_int(roman))
                current_article_num = None
                current_article_name = None
                current_article_si = None

                records.append({
                    'source_index': source_index,
                    'type': 'regulation',
                    'state': 'NYC',
                    'title': f"NYC Health Code Title {roman} - {name}",
                    'url': f"healthcode://title/{roman}",
                    'url_type': 'title',
                    'content': '',
                    'hierarchy_level': 'title',
                    'hierarchy_path': f"NYC Health Code > Title {roman} - {name}",
                    'rcny_title': current_title_num,
                    'rcny_title_name': f"Health Code Title {roman} - {name}",
                    'rcny_chapter': None,
                    'rcny_chapter_name': None,
                    'rcny_section': None,
                    'rcny_section_name': None,
                    'parent_source_index': None,
                    'scraped_from_url': str(html_path),
                })
                current_title_si = source_index
                source_index += 1

            continue

        # Skip if we're filtering and not in the target title
        if title_filter and current_title_roman is None:
            continue

        # Check for Article (Part class)
        part_div = top_div.find('div', class_='Part')
        if part_div:
            anchor = part_div.find('a', attrs={'name': True})
            text = part_div.get_text(strip=True)

            # Extract article number from anchor name: JD_T24HC_47.00 -> 47
            article_num = None
            if anchor:
                anchor_name = anchor.get('name', '')
                art_match = re.search(r'JD_T24HC_([\dA-Za-z-]+)\.00', anchor_name)
                if art_match:
                    article_num = art_match.group(1)
                    # Normalize: 48A -> 48-A for display consistency
                    article_num = re.sub(r'(\d)([A-Za-z])', r'\1-\2', article_num)

            # Extract article name: "Article 47: Child Care Programs..."
            article_name = ''
            name_match = re.match(r'Article\s+[\w-]+(?::\s*|\s+)(.*)', text)
            if name_match:
                article_name = name_match.group(1).strip()

            if not article_num:
                # Fallback: extract from text "Article 47..."
                num_match = re.match(r'Article\s+(\d+)', text)
                if num_match:
                    article_num = num_match.group(1)

            if article_num:
                current_article_num = article_num
                current_article_name = article_name

                # Detect repealed articles
                is_repealed = '[Repealed]' in text or '[Terminated' in text

                record = {
                    'source_index': source_index,
                    'type': 'regulation',
                    'state': 'NYC',
                    'title': f"NYC Health Code Article {article_num}" + (f": {article_name}" if article_name else ''),
                    'url': f"healthcode://article/{article_num}",
                    'url_type': 'title',
                    'content': '',
                    'hierarchy_level': 'chapter',
                    'hierarchy_path': _build_hierarchy_path(current_title_roman, current_title_name, article_num, article_name),
                    'rcny_title': current_title_num,
                    'rcny_title_name': f"Health Code Title {current_title_roman} - {current_title_name}" if current_title_roman else None,
                    'rcny_chapter': article_num,
                    'rcny_chapter_name': article_name,
                    'rcny_section': None,
                    'rcny_section_name': None,
                    'parent_source_index': current_title_si,
                    'scraped_from_url': None,
                }
                if is_repealed:
                    record['regulatory_status'] = 'repealed'

                records.append(record)
                current_article_si = source_index
                source_index += 1

            continue

        # Check for Section
        section_div = top_div.find('div', class_='Section')
        if section_div:
            record = _parse_section(
                top_div, section_div,
                current_title_roman, current_title_name, current_title_num,
                current_article_num, current_article_name,
                current_title_si, current_article_si,
                source_index,
            )
            if record:
                records.append(record)
                source_index += 1
                section_count += 1

                if section_count % 100 == 0:
                    elapsed = time.time() - start_time
                    print(f"    Parsed {section_count} sections ({format_time(elapsed)})")

            continue

    elapsed = time.time() - start_time
    print(f"  Parsed {len(records):,} total records in {format_time(elapsed)}")
    return records


def _parse_section(
    container: Tag,
    section_div: Tag,
    title_roman: Optional[str],
    title_name: Optional[str],
    title_num: Optional[str],
    article_num: Optional[str],
    article_name: Optional[str],
    title_si: Optional[int],
    article_si: Optional[int],
    source_index: int,
) -> Optional[dict]:
    """Parse a single section element into a regulation record."""
    # Extract section ID from anchor: JD_T24HC_47.01 -> 47.01
    anchor = section_div.find('a', attrs={'name': True})
    if not anchor:
        return None

    anchor_name = anchor.get('name', '')
    sec_match = re.search(r'JD_T24HC_([\dA-Za-z.-]+)', anchor_name)
    if not sec_match:
        return None

    section_id = sec_match.group(1)
    # Normalize: 48A.01 -> 48-A.01 for display consistency
    section_id = re.sub(r'(\d)([A-Za-z])', r'\1-\2', section_id)

    # Extract section name from bold span
    section_name = ''
    bold_span = section_div.find('span', style=lambda s: s and 'font-weight: bold' in s)
    if bold_span:
        section_name = bold_span.get_text(strip=True).rstrip('. ')

    # Convert any HTML tables to markdown before extracting text
    convert_tables_to_markdown(container)

    # Collect body text from Normal-Level divs within this container
    body_parts = []
    for normal_div in container.find_all('div', class_='Normal-Level'):
        text = normal_div.get_text(strip=True)
        # Clean up non-breaking spaces
        text = text.replace('\xa0', ' ').strip()
        if text:
            body_parts.append(text)

    body_text = '\n'.join(body_parts)

    # Detect repealed sections
    section_text = section_div.get_text(strip=True)
    is_repealed = '[Repealed]' in section_text or '[Terminated' in section_text

    # Build display title
    display_title = f"NYC Health Code § {section_id}"
    if section_name:
        display_title += f" {section_name}"

    # Build hierarchy path
    path_parts = ["NYC Health Code"]
    if title_roman:
        path_parts.append(f"Title {title_roman} - {title_name}")
    if article_num:
        art_part = f"Article {article_num}"
        if article_name:
            art_part += f" - {article_name}"
        path_parts.append(art_part)
    path_parts.append(f"§ {section_id}")

    # Parent: article if available, else title
    parent_si = article_si if article_si is not None else title_si

    record = {
        'source_index': source_index,
        'type': 'regulation',
        'state': 'NYC',
        'title': display_title,
        'url': f"healthcode://section/{section_id}",
        'url_type': 'regulation',
        'content': body_text,
        'hierarchy_level': 'section',
        'hierarchy_path': ' > '.join(path_parts),
        'rcny_title': title_num,
        'rcny_title_name': f"Health Code Title {title_roman} - {title_name}" if title_roman else None,
        'rcny_chapter': article_num,
        'rcny_chapter_name': article_name,
        'rcny_section': section_id,
        'rcny_section_name': section_name,
        'parent_source_index': parent_si,
        'scraped_from_url': None,
    }

    if is_repealed:
        record['regulatory_status'] = 'repealed'

    return record


def _build_hierarchy_path(
    title_roman: Optional[str],
    title_name: Optional[str],
    article_num: str,
    article_name: str,
) -> str:
    """Build hierarchy path for an article."""
    parts = ["NYC Health Code"]
    if title_roman:
        parts.append(f"Title {title_roman} - {title_name}")
    art_part = f"Article {article_num}"
    if article_name:
        art_part += f" - {article_name}"
    parts.append(art_part)
    return ' > '.join(parts)


# =============================================================================
# SAVE TO JSON
# =============================================================================

def save_records(records: list[dict]):
    """Save regulation records to JSON file."""
    ensure_data_dirs()

    with open(NYC_HEALTH_CODE_COMPLETE_FILE, 'w', encoding='utf-8') as f:
        json.dump(records, f, indent=2, ensure_ascii=False)
    print(f"\nSaved {len(records):,} records to {NYC_HEALTH_CODE_COMPLETE_FILE}")

    sections = [r for r in records if r['hierarchy_level'] == 'section']
    articles = [r for r in records if r['hierarchy_level'] == 'chapter']
    titles = [r for r in records if r['hierarchy_level'] == 'title']
    repealed = [r for r in records if r.get('regulatory_status') == 'repealed']
    print(f"  Titles: {len(titles):,}")
    print(f"  Articles: {len(articles):,}")
    print(f"  Sections: {len(sections):,}")
    print(f"  Repealed: {len(repealed):,}")


# =============================================================================
# DATABASE MIGRATION
# =============================================================================

def migrate_health_code_to_db(records: Optional[list[dict]] = None) -> int:
    """Migrate Health Code records to regulatory_documents table."""
    if records is None:
        if not NYC_HEALTH_CODE_COMPLETE_FILE.exists():
            print(f"Error: File not found: {NYC_HEALTH_CODE_COMPLETE_FILE}")
            return 0
        print(f"Loading records from {NYC_HEALTH_CODE_COMPLETE_FILE}...")
        with open(NYC_HEALTH_CODE_COMPLETE_FILE) as f:
            records = json.load(f)

    return migrate_regulations_to_db('NYC', regulations=records)


def populate_health_code_parent_ids(records: Optional[list[dict]] = None):
    """Populate parent_id for Health Code regulations."""
    if records is None:
        if NYC_HEALTH_CODE_COMPLETE_FILE.exists():
            with open(NYC_HEALTH_CODE_COMPLETE_FILE) as f:
                records = json.load(f)
        else:
            print(f"Error: File not found: {NYC_HEALTH_CODE_COMPLETE_FILE}")
            return
    populate_parent_ids('NYC', regulations=records)


# =============================================================================
# MAIN PIPELINE
# =============================================================================

def run_pipeline(
    parse_only: bool = False,
    skip_parse: bool = False,
    skip_db: bool = False,
    title_filter: Optional[str] = None,
):
    """Run the NYC Health Code parsing pipeline."""
    print("=" * 60)
    print("NYC HEALTH CODE PARSER")
    print("Parse HTML -> JSON -> Database -> Hierarchy")
    print("=" * 60)
    print()

    start_time = time.time()
    ensure_data_dirs()

    records = None
    if not skip_parse:
        print("STEP 1: PARSING HTML")
        print("-" * 40)

        if not NYC_HEALTH_CODE_HTML_FILE.exists():
            print(f"ERROR: HTML file not found: {NYC_HEALTH_CODE_HTML_FILE}")
            return False

        records = parse_health_code_html(
            NYC_HEALTH_CODE_HTML_FILE,
            title_filter=title_filter,
        )

        if not records:
            print("ERROR: No records parsed!")
            return False

        print(f"\nParsed {len(records):,} total records")

        print("\nSTEP 2: SAVING TO JSON")
        print("-" * 40)
        save_records(records)
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
    migrated = migrate_health_code_to_db(records)
    if migrated == 0:
        print("WARNING: No records migrated")
    print()

    print("STEP 4: POPULATING PARENT IDS")
    print("-" * 40)
    populate_health_code_parent_ids(records)
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
        description='NYC Health Code - Parse HTML and migrate to DB'
    )
    parser.add_argument('--parse-only', action='store_true',
                        help='Only parse HTML and save JSON, skip database operations')
    parser.add_argument('--skip-parse', action='store_true',
                        help='Skip HTML parsing, use existing cached JSON')
    parser.add_argument('--skip-db', action='store_true',
                        help='Skip database operations')
    parser.add_argument('--title', type=str, default=None,
                        help='Only parse a specific title (roman numeral, e.g., --title III)')

    args = parser.parse_args()

    success = run_pipeline(
        parse_only=args.parse_only,
        skip_parse=args.skip_parse,
        skip_db=args.skip_db,
        title_filter=args.title,
    )

    if not success:
        sys.exit(1)


if __name__ == "__main__":
    main()
