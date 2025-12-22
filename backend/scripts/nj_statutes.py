#!/usr/bin/env python3
"""
New Jersey Statutes (N.J.S.A.) - Parse, Migrate, and Link

Pipeline:
1. Parse bulk statutes file from pub.njleg.gov/statutes/STATUTES-TEXT.zip
2. Save to JSON files (complete + individual)
3. Migrate to statutes table in database
4. Create regulation_statute_links crosswalk table

Citation format: N.J.S.A. Title:Chapter-Section (e.g., 52:27D-119)

Usage:
    python nj_statutes.py              # Full pipeline
    python nj_statutes.py --parse-only # Just parse to JSON
    python nj_statutes.py --skip-parse # Skip parsing, use existing JSON
    python nj_statutes.py --skip-db    # Skip database operations
"""

import json
import re
import sys
import time
import argparse
from pathlib import Path
from typing import Optional, Dict, List, Tuple

# Add parent directory to path for config import
sys.path.insert(0, str(Path(__file__).parent.parent))
from config import (
    PROJECT_ROOT,
    NJ_STATUTES_INPUT_FILE,
    NJ_STATUTES_OUTPUT_DIR,
    NJ_STATUTES_INDIVIDUAL_DIR,
    NJ_STATUTES_COMPLETE_FILE,
)
from shared_utils import get_db_connection, format_time
from dotenv import load_dotenv

load_dotenv(PROJECT_ROOT / '.env')


# =============================================================================
# PARSING PATTERNS
# =============================================================================

# Pattern for TITLE headers: "TITLE 1         ACTS, LAWS AND STATUTES"
TITLE_PATTERN = re.compile(
    r'^TITLE\s+(\d+[A-Za-z]?)\s+([A-Z][A-Z\s,\-\'\"\(\)0-9]+)$'
)

# Pattern for section citations: "52:27D-119.  Short title"
SECTION_PATTERN = re.compile(
    r'^(\d+[A-Za-z]?):(\d+[A-Za-z]?)-(\d+(?:\.\d+)?[a-z]?)\.?\s+(.*)$'
)

# Pattern for amendment history at end of sections
AMENDMENT_PATTERN = re.compile(
    r'^(?:amended|L\.\d{4}|P\.L\.\d{4})',
    re.IGNORECASE
)

# Pattern for N.J.S.A. citations in regulation text
NJSA_CITATION_PATTERN = re.compile(
    r'N\.J\.S\.A\.\s*(\d+[A-Za-z]?):(\d+[A-Za-z]?)-(\d+(?:\.\d+)?[a-z]?)',
    re.IGNORECASE
)


# =============================================================================
# PARSING FUNCTIONS
# =============================================================================

def build_hierarchy_path(title_num: str, title_name: str, chapter: str, section: str, section_name: str) -> str:
    """Build a hierarchy path string for a statute section."""
    parts = []
    if title_num:
        parts.append(f"Title {title_num}" + (f" - {title_name}" if title_name else ""))
    if chapter:
        parts.append(f"Chapter {chapter}")
    if section:
        parts.append(f"{title_num}:{chapter}-{section}" + (f" - {section_name}" if section_name else ""))
    return ' > '.join(parts)


class NJStatutesParser:
    """Parser for New Jersey statutes from the official bulk download."""

    def __init__(self, input_file: Path = None):
        self.input_file = input_file or NJ_STATUTES_INPUT_FILE
        self.statutes = []
        self.current_title_num = None
        self.current_title_name = None
        self.titles_found = {}

    def parse_file(self) -> List[Dict]:
        """Parse the entire statutes file and return list of statute sections."""
        print(f"Parsing {self.input_file}...")

        if not self.input_file.exists():
            print(f"Error: File not found: {self.input_file}")
            return []

        with open(self.input_file, 'r', encoding='utf-8', errors='replace') as f:
            lines = f.readlines()

        print(f"Read {len(lines):,} lines")

        current_section = None
        content_lines = []

        for line_num, line in enumerate(lines):
            # Check for TITLE header
            title_match = TITLE_PATTERN.match(line.strip())
            if title_match:
                if current_section and content_lines:
                    current_section['content'] = self._clean_content(content_lines)
                    self.statutes.append(current_section)
                    content_lines = []
                    current_section = None

                self.current_title_num = title_match.group(1)
                self.current_title_name = title_match.group(2).strip()
                self.titles_found[self.current_title_num] = self.current_title_name
                continue

            # Check for section start
            section_match = SECTION_PATTERN.match(line.strip())
            if section_match:
                if current_section and content_lines:
                    current_section['content'] = self._clean_content(content_lines)
                    self.statutes.append(current_section)
                    content_lines = []

                title = section_match.group(1)
                chapter = section_match.group(2)
                section = section_match.group(3)
                section_name = section_match.group(4).strip()

                if title != self.current_title_num:
                    self.current_title_num = title
                    self.current_title_name = self.titles_found.get(title, '')

                citation = f"{title}:{chapter}-{section}"

                current_section = {
                    'citation': citation,
                    'njsa_title': title,
                    'njsa_title_name': self.current_title_name,
                    'njsa_chapter': chapter,
                    'njsa_section': section,
                    'njsa_section_name': section_name,
                    'hierarchy_level': 'section',
                    'hierarchy_path': build_hierarchy_path(
                        title, self.current_title_name, chapter, section, section_name
                    ),
                    'content': '',
                    'source_line': line_num + 1,
                }
                continue

            if current_section is not None:
                content_lines.append(line)

        # Last section
        if current_section and content_lines:
            current_section['content'] = self._clean_content(content_lines)
            self.statutes.append(current_section)

        print(f"Parsed {len(self.statutes):,} sections from {len(self.titles_found)} titles")
        return self.statutes

    def _clean_content(self, lines: List[str]) -> str:
        """Clean and format content lines."""
        text = ''.join(lines)
        text = re.sub(r'\n\s*\n\s*\n+', '\n\n', text)
        text = re.sub(r'[ \t]+', ' ', text)

        lines = text.split('\n')
        cleaned = []
        for line in lines:
            stripped = line.strip()
            if stripped:
                cleaned.append(stripped)
            elif cleaned and cleaned[-1] != '':
                cleaned.append('')

        return '\n'.join(cleaned).strip()

    def add_source_indices(self):
        """Add source_index to all statutes."""
        for idx, statute in enumerate(self.statutes):
            statute['source_index'] = idx

    def save_complete(self, output_file: Path = None):
        """Save all statutes to a single JSON file."""
        output_file = output_file or NJ_STATUTES_COMPLETE_FILE
        output_file.parent.mkdir(parents=True, exist_ok=True)

        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(self.statutes, f, indent=2, ensure_ascii=False)

        print(f"Saved {len(self.statutes):,} statutes to {output_file}")

    def save_individual_files(self, output_dir: Path = None):
        """Save each statute section as an individual JSON file."""
        output_dir = output_dir or NJ_STATUTES_INDIVIDUAL_DIR
        output_dir.mkdir(parents=True, exist_ok=True)

        for statute in self.statutes:
            citation = statute['citation'].replace(':', '_').replace('-', '_')
            filename = f"{statute['source_index']:06d}_{citation}.json"

            file_path = output_dir / filename
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(statute, f, indent=2, ensure_ascii=False)

        print(f"Saved {len(self.statutes):,} individual files to {output_dir}")

    def find_statute(self, citation: str) -> Optional[Dict]:
        """Find a statute by its citation string."""
        for statute in self.statutes:
            if statute['citation'] == citation:
                return statute
        return None


# =============================================================================
# DATABASE MIGRATION
# =============================================================================

def migrate_statutes_to_db() -> int:
    """Migrate all NJ statutes from JSON file to statutes table."""
    if not NJ_STATUTES_COMPLETE_FILE.exists():
        print(f"Error: Statutes file not found: {NJ_STATUTES_COMPLETE_FILE}")
        return 0

    print(f"Loading statutes from {NJ_STATUTES_COMPLETE_FILE}...")
    with open(NJ_STATUTES_COMPLETE_FILE) as f:
        statutes = json.load(f)

    print(f"Found {len(statutes):,} statutes")

    conn = get_db_connection()
    if not conn:
        print("ERROR: Could not connect to database")
        return 0

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
    start_time = time.time()

    try:
        for statute in statutes:
            citation = statute.get("citation", "")
            if not citation:
                continue

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

            conn.execute(insert_sql, row)
            total += 1

            if total % 1000 == 0:
                conn.commit()
                elapsed = time.time() - start_time
                print(f"  Migrated {total:,} / {len(statutes):,} ({format_time(elapsed)})")

        conn.commit()

    finally:
        conn.close()

    elapsed = time.time() - start_time
    print(f"Migrated {total:,} statutes in {format_time(elapsed)}")
    return total


def create_regulation_statute_links() -> int:
    """
    Parse NJ regulations for N.J.S.A. citations and create links.

    Uses regulation_statute_links crosswalk table to link
    regulatory_documents to statutes.
    """
    print("\nCreating regulation-statute links...")

    conn = get_db_connection()
    if not conn:
        print("ERROR: Could not connect to database")
        return 0

    try:
        # Get all NJ regulations
        print("  Loading NJ regulations...")
        regulations = conn.execute("""
            SELECT id, content FROM regulatory_documents
            WHERE state = 'NJ' AND type = 'regulation'
        """).fetchall()
        print(f"  Found {len(regulations):,} regulations")

        # Get all statutes and build citation lookup
        print("  Loading NJ statutes...")
        statute_rows = conn.execute("""
            SELECT id, citation FROM statutes
            WHERE state = 'NJ'
        """).fetchall()
        statute_lookup = {row[1]: row[0] for row in statute_rows}
        print(f"  Found {len(statute_lookup):,} statutes")

        # Clear existing links
        print("  Clearing existing links...")
        conn.execute("DELETE FROM regulation_statute_links WHERE TRUE")

        # Process regulations
        links_created = 0
        regs_with_links = 0
        unmatched_citations = set()
        start_time = time.time()

        insert_sql = """
            INSERT INTO regulation_statute_links (regulation_id, statute_id, citation, context)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (regulation_id, statute_id, citation) DO NOTHING
        """

        for reg_id, content in regulations:
            if not content:
                continue

            matches = list(NJSA_CITATION_PATTERN.finditer(content))
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

                    conn.execute(insert_sql, (reg_id, statute_id, citation, context))
                    links_created += 1
                    reg_had_link = True
                else:
                    unmatched_citations.add(citation)

            if reg_had_link:
                regs_with_links += 1

            if regs_with_links % 1000 == 0 and regs_with_links > 0:
                conn.commit()

        conn.commit()

        elapsed = time.time() - start_time
        print(f"  Created {links_created:,} links from {regs_with_links:,} regulations")
        print(f"  Unmatched citations: {len(unmatched_citations):,}")
        print(f"  Time: {format_time(elapsed)}")

    finally:
        conn.close()

    return links_created


# =============================================================================
# MAIN PIPELINE
# =============================================================================

def run_full_pipeline(skip_parse: bool = False, skip_db: bool = False, parse_only: bool = False):
    """Run the full NJ statutes pipeline."""
    print("=" * 60)
    print("NJ STATUTES PIPELINE")
    print("Parse -> JSON -> Database -> Links")
    print("=" * 60)
    print()

    start_time = time.time()

    # Step 1: Parse statutes file
    if not skip_parse:
        print("STEP 1: PARSING STATUTES FILE")
        print("-" * 40)
        parser = NJStatutesParser()
        statutes = parser.parse_file()

        if not statutes:
            print("ERROR: No statutes parsed!")
            return False

        parser.add_source_indices()
        parser.save_complete()
        parser.save_individual_files()

        print(f"  Titles found: {len(parser.titles_found)}")
        print()
    else:
        print("[SKIPPED] Step 1: Parsing (--skip-parse)")
        print()

    if parse_only:
        print("[SKIPPED] Steps 2-3: Database operations (--parse-only)")
        elapsed = time.time() - start_time
        print(f"\nPipeline complete in {format_time(elapsed)}")
        return True

    if skip_db:
        print("[SKIPPED] Steps 2-3: Database operations (--skip-db)")
        elapsed = time.time() - start_time
        print(f"\nPipeline complete in {format_time(elapsed)}")
        return True

    # Step 2: Migrate to database
    print("STEP 2: MIGRATING TO DATABASE")
    print("-" * 40)
    migrated = migrate_statutes_to_db()
    if migrated == 0:
        print("WARNING: No statutes migrated")
    print()

    # Step 3: Create regulation-statute links
    print("STEP 3: CREATING REGULATION-STATUTE LINKS")
    print("-" * 40)
    links = create_regulation_statute_links()
    print()

    elapsed = time.time() - start_time
    print("=" * 60)
    print("PIPELINE COMPLETE")
    print("=" * 60)
    print(f"Statutes migrated: {migrated:,}")
    print(f"Links created: {links:,}")
    print(f"Total time: {format_time(elapsed)}")

    return True


def main():
    parser = argparse.ArgumentParser(
        description='NJ Statutes - Parse, Migrate, and Link'
    )
    parser.add_argument('--parse-only', action='store_true',
                        help='Only parse to JSON, skip database operations')
    parser.add_argument('--skip-parse', action='store_true',
                        help='Skip parsing, use existing JSON files')
    parser.add_argument('--skip-db', action='store_true',
                        help='Skip database operations')
    parser.add_argument('--find', type=str,
                        help='Find a specific citation (e.g., 52:27D-119)')

    args = parser.parse_args()

    # Handle --find query
    if args.find:
        if not NJ_STATUTES_COMPLETE_FILE.exists():
            print(f"Error: Run pipeline first to create {NJ_STATUTES_COMPLETE_FILE}")
            return

        with open(NJ_STATUTES_COMPLETE_FILE) as f:
            statutes = json.load(f)

        for statute in statutes:
            if statute['citation'] == args.find:
                print(f"Found: {args.find}")
                print(f"  Title: {statute['njsa_title']} - {statute['njsa_title_name']}")
                print(f"  Section: {statute['njsa_section_name']}")
                print(f"  Content preview:")
                content = statute['content'][:500]
                for line in content.split('\n')[:10]:
                    print(f"    {line}")
                return

        print(f"Not found: {args.find}")
        return

    # Run pipeline
    run_full_pipeline(
        skip_parse=args.skip_parse,
        skip_db=args.skip_db,
        parse_only=args.parse_only
    )


if __name__ == "__main__":
    main()
