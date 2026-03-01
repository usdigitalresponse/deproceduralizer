#!/usr/bin/env python3
"""
New Jersey Statutes (N.J.S.A.) - Parse, Migrate, and Link

Pipeline:
1. Parse bulk statutes file from pub.njleg.gov/statutes/STATUTES-TEXT.zip
2. Save to JSON files (complete + individual)
3. Verify database schema (parent_id column must exist from migration 0010)
4. Migrate to statutes table in database
5. Create title and chapter container rows for hierarchy
6. Populate parent_id relationships (section -> chapter -> title)
7. Create regulation_statute_links crosswalk table

Citation format: N.J.S.A. Title:Chapter-Section (e.g., 52:27D-119)

Usage:
    python nj_statutes.py              # Full pipeline
    python nj_statutes.py --parse-only # Just parse to JSON
    python nj_statutes.py --skip-parse # Skip parsing, use existing JSON
    python nj_statutes.py --skip-db    # Skip database operations
    python nj_statutes.py --hierarchy-only # Only update hierarchy (titles, chapters, parent_id)
"""

import json
import re
import time
import argparse
from pathlib import Path
from typing import Optional, Dict, List, Tuple

from config import (
    PROJECT_ROOT,
    NJ_STATUTES_INPUT_FILE,
    NJ_STATUTES_OUTPUT_DIR,
    NJ_STATUTES_INDIVIDUAL_DIR,
    NJ_STATUTES_COMPLETE_FILE,
)
from lib.db import get_db_connection
from lib.stats import format_time
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

# Pattern to strip subsection letter from section number (e.g., "1e" -> "1", "119.1a" -> "119.1")
SUBSECTION_LETTER_PATTERN = re.compile(r'^(\d+(?:\.\d+)?)[a-z]+$')

# Patterns to skip false positive N.J.S.A. citations
# Court rules (R. 2:2-3, R. 4:42-11) misidentified as statutes
COURT_RULE_SKIP = re.compile(
    r'(?:court rule|rules of court|R\.\s*N\.J\.S\.A\.|R\.N\.J\.S\.A\.)',
    re.IGNORECASE
)
# Recodification editorial notes ("Recodified to N.J.S.A. 10:166-3.21")
RECODIFICATION_SKIP = re.compile(
    r'recodified\s+(?:to|from)\s+N\.J\.S\.A\.',
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
# DATABASE SCHEMA MIGRATION
# =============================================================================

def ensure_schema() -> bool:
    """
    Verify the statutes table has all required columns.
    Returns True if schema is ready, False if parent_id column is missing.

    Note: parent_id is created by migration 0010_create_statutes_table.sql.
    This function only verifies — it does not ALTER TABLE.
    """
    print("Checking database schema...")
    conn = get_db_connection()
    if not conn:
        print("ERROR: Could not connect to database")
        return False

    try:
        # Check if parent_id column exists
        result = conn.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'statutes' AND column_name = 'parent_id'
        """).fetchone()

        if result:
            print("  parent_id column exists")
            print("  Schema ready")
            return True
        else:
            print("  ERROR: parent_id column missing from statutes table.")
            print("  Run migration 0010_create_statutes_table.sql first:")
            print("    psql $DATABASE_URL -f frontend/packages/database/migrations/0010_create_statutes_table.sql")
            return False

    except Exception as e:
        print(f"ERROR checking schema: {e}")
        return False
    finally:
        conn.close()


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
        (citation, jurisdiction, title, content,
         njsa_title, njsa_title_name, njsa_chapter, njsa_section, njsa_section_name,
         hierarchy_level, hierarchy_path, source_index)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (jurisdiction, citation) DO UPDATE SET
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


# =============================================================================
# LINK TYPE CLASSIFICATION PATTERNS
# =============================================================================

LINK_TYPE_PATTERNS = {
    'enabling_authority': [
        re.compile(r'CHAPTER AUTHORITY:?\s*\n?\s*N\.J\.S\.A\.', re.IGNORECASE),
        re.compile(r'(?:pursuant|according) to.{0,60}N\.J\.S\.A\.', re.IGNORECASE),
        re.compile(r'established (?:by|pursuant to).{0,30}N\.J\.S\.A\.', re.IGNORECASE),
        re.compile(r'authorized (?:by|under|pursuant to).{0,30}N\.J\.S\.A\.', re.IGNORECASE),
        re.compile(r'authority (?:of|under|granted by).{0,30}N\.J\.S\.A\.', re.IGNORECASE),
        re.compile(r'created.{0,30}N\.J\.S\.A\.', re.IGNORECASE),
    ],
    'definition': [
        re.compile(r'as defined (?:by|in|pursuant to|under).{0,20}N\.J\.S\.A\.', re.IGNORECASE),
        re.compile(r'(?:means|shall mean).{0,80}N\.J\.S\.A\.', re.IGNORECASE),
        re.compile(r'definition.{0,30}N\.J\.S\.A\.', re.IGNORECASE),
        re.compile(r'the meaning (?:given|set forth|provided).{0,30}N\.J\.S\.A\.', re.IGNORECASE),
    ],
    'requirement': [
        re.compile(r'as required (?:by|under|pursuant to).{0,20}N\.J\.S\.A\.', re.IGNORECASE),
        re.compile(r'in accordance with.{0,20}N\.J\.S\.A\.', re.IGNORECASE),
        re.compile(r'in compliance with.{0,20}N\.J\.S\.A\.', re.IGNORECASE),
        re.compile(r'subject to (?:the )?(?:provisions of )?.{0,20}N\.J\.S\.A\.', re.IGNORECASE),
        re.compile(r'shall comply with.{0,20}N\.J\.S\.A\.', re.IGNORECASE),
    ],
}


def classify_link_type(context: str) -> str:
    """Classify the link type based on surrounding context."""
    for link_type, patterns in LINK_TYPE_PATTERNS.items():
        for pattern in patterns:
            if pattern.search(context):
                return link_type
    return 'reference'


def strip_subsection_letter(citation: str) -> Optional[str]:
    """
    Strip trailing subsection letter from a citation.

    Examples:
        "52:14B-1e" -> "52:14B-1"
        "52:27D-119.1a" -> "52:27D-119.1"
        "52:27D-119" -> None (no letter to strip)

    Returns the stripped citation, or None if no letter was found.
    """
    # Parse the citation into title:chapter-section
    parts = citation.split('-', 1)
    if len(parts) != 2:
        return None

    prefix, section = parts[0], parts[1]
    match = SUBSECTION_LETTER_PATTERN.match(section)
    if match:
        return f"{prefix}-{match.group(1)}"
    return None


def create_regulation_statute_links() -> dict:
    """
    Parse NJ regulations for N.J.S.A. citations and create links.

    Uses regulation_statute_links crosswalk table to link
    regulatory_documents to statutes.

    Features:
    - Auto-detects link_type (enabling_authority, definition, requirement, reference)
    - Tracks unmatched citations with match_status='unmatched'
    - Detects likely repealed sections (chapter exists but section doesn't) as 'obsolete'
    - Uses upsert to preserve existing reviewed links
    """
    print("\nCreating regulation-statute links...")

    conn = get_db_connection()
    if not conn:
        print("ERROR: Could not connect to database")
        return {'matched': 0, 'unmatched': 0, 'corrected': 0, 'obsolete': 0}

    try:
        # Get all NJ regulations (sections only, with content)
        print("  Loading NJ regulations...")
        regulations = conn.execute("""
            SELECT id, content FROM regulatory_documents
            WHERE jurisdiction = 'NJ' AND hierarchy_level = 'section' AND content IS NOT NULL
        """).fetchall()
        print(f"  Found {len(regulations):,} regulations")

        # Get all statutes and build citation lookup
        print("  Loading NJ statutes...")
        statute_rows = conn.execute("""
            SELECT id, citation FROM statutes
            WHERE jurisdiction = 'NJ'
        """).fetchall()
        statute_lookup = {row[1]: row[0] for row in statute_rows}
        print(f"  Found {len(statute_lookup):,} statutes")

        # Build chapter lookup to detect repealed sections
        # A section is likely repealed if its chapter exists but the section doesn't
        chapter_rows = conn.execute("""
            SELECT DISTINCT njsa_title || ':' || njsa_chapter as chapter_citation
            FROM statutes
            WHERE jurisdiction = 'NJ' AND njsa_chapter IS NOT NULL
        """).fetchall()
        existing_chapters = {row[0] for row in chapter_rows}
        print(f"  Found {len(existing_chapters):,} chapters (for obsolete detection)")

        # Get existing links to avoid overwriting reviewed ones
        print("  Loading existing links...")
        existing = conn.execute("""
            SELECT regulation_id, citation, reviewed_at IS NOT NULL as is_reviewed
            FROM regulation_statute_links
        """).fetchall()
        existing_links = {(row[0], row[1]): row[2] for row in existing}
        print(f"  Found {len(existing_links):,} existing links ({sum(existing_links.values())} reviewed)")

        # Process regulations - collect all rows first, then batch insert
        stats = {'matched': 0, 'unmatched': 0, 'corrected': 0, 'obsolete': 0, 'skipped_reviewed': 0, 'skipped_false_positive': 0, 'updated': 0}

        # Clean up existing false positive links (court rules, recodification notes)
        cleanup_result = conn.execute("""
            DELETE FROM regulation_statute_links
            WHERE id IN (
                SELECT l.id FROM regulation_statute_links l
                JOIN regulatory_documents rd ON rd.id = l.regulation_id
                WHERE rd.jurisdiction = 'NJ' AND (
                    l.context ~* '(?:court rule|rules of court|R\\.\\s*N\\.J\\.S\\.A\\.|R\\.N\\.J\\.S\\.A\\.)'
                    OR l.context ~* 'recodified\\s+(?:to|from)\\s+N\\.J\\.S\\.A\\.'
                )
                AND l.reviewed_at IS NULL
            )
        """)
        cleaned = cleanup_result.rowcount
        if cleaned > 0:
            conn.commit()
            print(f"  Cleaned up {cleaned} false positive links (court rules, recodification notes)")
        start_time = time.time()

        print("  Scanning regulations for citations...")
        rows_to_upsert = []

        def get_chapter_from_citation(cit: str) -> Optional[str]:
            """Extract chapter citation from full citation (e.g., '2A:58-1' -> '2A:58')."""
            parts = cit.split('-', 1)
            if len(parts) == 2:
                return parts[0]  # e.g., "2A:58"
            return None

        for reg_id, content in regulations:
            if not content:
                continue

            matches = list(NJSA_CITATION_PATTERN.finditer(content))
            if not matches:
                continue

            # Dedupe citations within same regulation
            seen_citations = set()

            for match in matches:
                original_citation = f"{match.group(1)}:{match.group(2)}-{match.group(3)}"

                # Skip if already processed this citation in this regulation
                if original_citation in seen_citations:
                    continue
                seen_citations.add(original_citation)

                # Skip if this link has been reviewed
                if existing_links.get((reg_id, original_citation), False):
                    stats['skipped_reviewed'] += 1
                    continue

                # Extract context (150 chars before and after for better classification)
                start = max(0, match.start() - 150)
                end = min(len(content), match.end() + 150)
                context = content[start:end]

                # Skip false positives: court rules and recodification notes
                if COURT_RULE_SKIP.search(context):
                    stats['skipped_false_positive'] += 1
                    continue
                if RECODIFICATION_SKIP.search(context):
                    stats['skipped_false_positive'] += 1
                    continue

                # Classify link type
                link_type = classify_link_type(context)

                # Look up statute - try direct match first
                statute_id = statute_lookup.get(original_citation)
                citation = original_citation
                stored_original = None  # Only set if we correct
                correction_notes = None
                match_status = 'matched'

                if statute_id:
                    stats['matched'] += 1
                else:
                    # Try stripping subsection letter (e.g., "52:14B-1e" -> "52:14B-1")
                    stripped = strip_subsection_letter(original_citation)
                    if stripped:
                        statute_id = statute_lookup.get(stripped)
                        if statute_id:
                            # Found via stripping - store as corrected
                            citation = stripped  # Store the matched citation
                            stored_original = original_citation  # Keep original in separate column
                            match_status = 'corrected'
                            correction_notes = f"Subsection letter stripped: {original_citation} -> {stripped}"
                            stats['corrected'] += 1
                        else:
                            # Check if chapter exists but section doesn't (likely repealed)
                            chapter = get_chapter_from_citation(stripped)
                            if chapter and chapter in existing_chapters:
                                match_status = 'obsolete'
                                correction_notes = f"Section not found; chapter {chapter} exists - likely repealed"
                                stats['obsolete'] += 1
                            else:
                                match_status = 'unmatched'
                                stats['unmatched'] += 1
                    else:
                        # No subsection to strip - check if chapter exists
                        chapter = get_chapter_from_citation(original_citation)
                        if chapter and chapter in existing_chapters:
                            match_status = 'obsolete'
                            correction_notes = f"Section not found; chapter {chapter} exists - likely repealed"
                            stats['obsolete'] += 1
                        else:
                            match_status = 'unmatched'
                            stats['unmatched'] += 1

                rows_to_upsert.append((
                    reg_id, statute_id, citation, context, link_type, match_status, stored_original, correction_notes
                ))

                if (reg_id, citation) in existing_links:
                    stats['updated'] += 1

        scan_time = time.time() - start_time
        print(f"  Scanned {len(regulations):,} regulations in {format_time(scan_time)}")
        print(f"  Found {len(rows_to_upsert):,} citations to upsert")

        # Batch upsert
        if rows_to_upsert:
            print("  Upserting to database...")
            upsert_sql = """
                INSERT INTO regulation_statute_links
                    (regulation_id, statute_id, citation, context, link_type, match_status, original_citation, correction_notes)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (regulation_id, citation) DO UPDATE SET
                    statute_id = EXCLUDED.statute_id,
                    context = EXCLUDED.context,
                    link_type = EXCLUDED.link_type,
                    match_status = EXCLUDED.match_status,
                    original_citation = EXCLUDED.original_citation,
                    correction_notes = EXCLUDED.correction_notes
                WHERE regulation_statute_links.reviewed_at IS NULL
            """

            batch_size = 1000
            for i in range(0, len(rows_to_upsert), batch_size):
                batch = rows_to_upsert[i:i + batch_size]
                for row in batch:
                    conn.execute(upsert_sql, row)
                conn.commit()
                if (i + batch_size) % 5000 == 0 or i + batch_size >= len(rows_to_upsert):
                    print(f"    Upserted {min(i + batch_size, len(rows_to_upsert)):,}/{len(rows_to_upsert):,}...")

        conn.commit()

        elapsed = time.time() - start_time
        print(f"\n  Results:")
        print(f"    Matched (direct): {stats['matched']:,}")
        print(f"    Matched (via subsection strip): {stats['corrected']:,}")
        print(f"    Obsolete (chapter exists, section repealed): {stats['obsolete']:,}")
        print(f"    Unmatched (unknown): {stats['unmatched']:,}")
        print(f"    Skipped (reviewed): {stats['skipped_reviewed']:,}")
        print(f"    Skipped (false positive): {stats['skipped_false_positive']:,}")
        print(f"    Updated existing: {stats['updated']:,}")
        print(f"    Time: {format_time(elapsed)}")

        # Show match status distribution
        result = conn.execute("""
            SELECT match_status, COUNT(*)
            FROM regulation_statute_links
            GROUP BY match_status
            ORDER BY COUNT(*) DESC
        """)
        print(f"\n  Match status distribution:")
        for row in result:
            print(f"    {row[0]}: {row[1]:,}")

        # Show link type distribution
        result = conn.execute("""
            SELECT link_type, COUNT(*)
            FROM regulation_statute_links
            GROUP BY link_type
            ORDER BY COUNT(*) DESC
        """)
        print(f"\n  Link type distribution:")
        for row in result:
            print(f"    {row[0]}: {row[1]:,}")

        # Show sample corrected citations
        result = conn.execute("""
            SELECT citation, original_citation, COUNT(*) as cnt
            FROM regulation_statute_links
            WHERE match_status = 'corrected' AND original_citation IS NOT NULL
            GROUP BY citation, original_citation
            ORDER BY cnt DESC
            LIMIT 10
        """)
        corrected_sample = result.fetchall()
        if corrected_sample:
            print(f"\n  Sample corrected citations (subsection stripped):")
            for row in corrected_sample:
                print(f"    {row[1]} → {row[0]}: {row[2]} occurrences")

        # Show sample obsolete citations
        result = conn.execute("""
            SELECT citation, correction_notes, COUNT(*) as cnt
            FROM regulation_statute_links
            WHERE match_status = 'obsolete'
            GROUP BY citation, correction_notes
            ORDER BY cnt DESC
            LIMIT 10
        """)
        obsolete_sample = result.fetchall()
        if obsolete_sample:
            print(f"\n  Sample obsolete citations (likely repealed):")
            for row in obsolete_sample:
                print(f"    {row[0]}: {row[2]} occurrences")

        # Show unmatched sample
        result = conn.execute("""
            SELECT citation, COUNT(*) as cnt
            FROM regulation_statute_links
            WHERE match_status = 'unmatched'
            GROUP BY citation
            ORDER BY cnt DESC
            LIMIT 10
        """)
        unmatched_sample = result.fetchall()
        if unmatched_sample:
            print(f"\n  Top unmatched citations:")
            for row in unmatched_sample:
                print(f"    {row[0]}: {row[1]} occurrences")

        # Cleanup: Delete stale unmatched records that have been superseded
        print("\n  Cleaning up stale unmatched records...")
        total_stale_deleted = 0

        # Case 1: Unmatched citation has a corrected sibling (e.g., "52:14B-1e" -> corrected "52:14B-1")
        result = conn.execute("""
            DELETE FROM regulation_statute_links old
            WHERE old.match_status = 'unmatched'
              AND EXISTS (
                SELECT 1 FROM regulation_statute_links new
                WHERE new.regulation_id = old.regulation_id
                  AND new.original_citation = old.citation
                  AND new.match_status = 'corrected'
              )
        """)
        total_stale_deleted += result.rowcount

        # Case 2: Unmatched subsection citation has a direct match sibling
        # (e.g., "52:13D-13i" unmatched but "52:13D-13" is directly matched in same regulation)
        result = conn.execute("""
            DELETE FROM regulation_statute_links old
            WHERE old.match_status = 'unmatched'
              AND EXISTS (
                SELECT 1 FROM regulation_statute_links new
                WHERE new.regulation_id = old.regulation_id
                  AND new.match_status = 'matched'
                  AND new.citation = REGEXP_REPLACE(old.citation, '[a-z]+$', '')
              )
        """)
        total_stale_deleted += result.rowcount

        # Case 3: Unmatched subsection citation has a corrected sibling with different original
        # (e.g., "52:13D-13i" unmatched but "52:13D-13" exists as corrected from "52:13D-13g")
        result = conn.execute("""
            DELETE FROM regulation_statute_links old
            WHERE old.match_status = 'unmatched'
              AND EXISTS (
                SELECT 1 FROM regulation_statute_links new
                WHERE new.regulation_id = old.regulation_id
                  AND new.match_status = 'corrected'
                  AND new.citation = REGEXP_REPLACE(old.citation, '[a-z]+$', '')
              )
        """)
        total_stale_deleted += result.rowcount

        conn.commit()
        if total_stale_deleted > 0:
            print(f"    Deleted {total_stale_deleted:,} stale records superseded by matched/corrected links")
        else:
            print(f"    No stale records to clean up")

    finally:
        conn.close()

    return stats


# =============================================================================
# HIERARCHY MANAGEMENT
# =============================================================================

def create_hierarchy_containers() -> Tuple[int, int]:
    """
    Create title and chapter container rows for hierarchy navigation.

    Returns (titles_created, chapters_created).

    The hierarchy is:
    - Title (e.g., "1" for Title 1)
    - Chapter (e.g., "1:1" for Title 1, Chapter 1)
    - Section (e.g., "1:1-1" for Title 1, Chapter 1, Section 1)
    """
    print("\nCreating hierarchy containers...")

    conn = get_db_connection()
    if not conn:
        print("ERROR: Could not connect to database")
        return (0, 0)

    try:
        # Get all unique titles and chapters from existing sections
        print("  Analyzing existing sections...")
        sections = conn.execute("""
            SELECT DISTINCT njsa_title, njsa_title_name, njsa_chapter
            FROM statutes
            WHERE jurisdiction = 'NJ' AND hierarchy_level = 'section'
            ORDER BY njsa_title, njsa_chapter
        """).fetchall()

        # Build unique titles and chapters
        titles = {}  # {title_num: title_name}
        chapters = {}  # {(title_num, chapter_num): title_name}

        for row in sections:
            title_num, title_name, chapter_num = row
            if title_num:
                titles[title_num] = title_name or ''
                if chapter_num:
                    chapters[(title_num, chapter_num)] = title_name or ''

        print(f"  Found {len(titles)} unique titles, {len(chapters)} unique chapters")

        # Check which titles already exist
        existing_titles = set()
        result = conn.execute("""
            SELECT citation FROM statutes
            WHERE jurisdiction = 'NJ' AND hierarchy_level = 'title'
        """).fetchall()
        existing_titles = {row[0] for row in result}

        # Check which chapters already exist
        existing_chapters = set()
        result = conn.execute("""
            SELECT citation FROM statutes
            WHERE jurisdiction = 'NJ' AND hierarchy_level = 'chapter'
        """).fetchall()
        existing_chapters = {row[0] for row in result}

        titles_created = 0
        chapters_created = 0

        # Insert missing titles
        for title_num, title_name in titles.items():
            citation = f"title:{title_num}"
            if citation in existing_titles:
                continue

            display_title = f"Title {title_num}"
            if title_name:
                display_title += f" - {title_name}"

            conn.execute("""
                INSERT INTO statutes (citation, jurisdiction, title, content, njsa_title, njsa_title_name,
                                      hierarchy_level, hierarchy_path)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (jurisdiction, citation) DO NOTHING
            """, (
                citation,
                'NJ',
                display_title,
                '',  # No content for container
                title_num,
                title_name,
                'title',
                f"Title {title_num}" + (f" - {title_name}" if title_name else ""),
            ))
            titles_created += 1

        conn.commit()

        # Insert missing chapters
        for (title_num, chapter_num), title_name in chapters.items():
            citation = f"{title_num}:{chapter_num}"
            if citation in existing_chapters:
                continue

            display_title = f"N.J.S.A. Chapter {title_num}:{chapter_num}"

            conn.execute("""
                INSERT INTO statutes (citation, jurisdiction, title, content, njsa_title, njsa_title_name,
                                      njsa_chapter, hierarchy_level, hierarchy_path)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (jurisdiction, citation) DO NOTHING
            """, (
                citation,
                'NJ',
                display_title,
                '',  # No content for container
                title_num,
                title_name,
                chapter_num,
                'chapter',
                f"Title {title_num}" + (f" - {title_name}" if title_name else "") + f" > Chapter {chapter_num}",
            ))
            chapters_created += 1

        conn.commit()
        print(f"  Created {titles_created} titles, {chapters_created} chapters")
        return (titles_created, chapters_created)

    except Exception as e:
        print(f"ERROR creating hierarchy containers: {e}")
        import traceback
        traceback.print_exc()
        return (0, 0)
    finally:
        conn.close()


def populate_parent_ids() -> int:
    """
    Populate parent_id relationships for all statutes using bulk SQL.

    Relationships:
    - Sections (1:1-1) -> parent is chapter (1:1)
    - Chapters (1:1) -> parent is title (title:1)
    - Titles (title:1) -> no parent (NULL)

    Returns count of rows updated.
    """
    print("\nPopulating parent_id relationships...")

    conn = get_db_connection()
    if not conn:
        print("ERROR: Could not connect to database")
        return 0

    try:
        total_updated = 0

        # Update sections: parent = chapter with citation "{title}:{chapter}"
        print("  Setting section parents (section -> chapter)...")
        result = conn.execute("""
            UPDATE statutes s
            SET parent_id = c.id
            FROM statutes c
            WHERE s.jurisdiction = 'NJ'
              AND s.hierarchy_level = 'section'
              AND c.jurisdiction = 'NJ'
              AND c.hierarchy_level = 'chapter'
              AND c.citation = CONCAT(s.njsa_title, ':', s.njsa_chapter)
              AND (s.parent_id IS NULL OR s.parent_id != c.id)
        """)
        sections_updated = result.rowcount
        conn.commit()
        print(f"    Updated {sections_updated:,} sections")
        total_updated += sections_updated

        # Update chapters: parent = title with citation "title:{title}"
        print("  Setting chapter parents (chapter -> title)...")
        result = conn.execute("""
            UPDATE statutes s
            SET parent_id = t.id
            FROM statutes t
            WHERE s.jurisdiction = 'NJ'
              AND s.hierarchy_level = 'chapter'
              AND t.jurisdiction = 'NJ'
              AND t.hierarchy_level = 'title'
              AND t.citation = CONCAT('title:', s.njsa_title)
              AND (s.parent_id IS NULL OR s.parent_id != t.id)
        """)
        chapters_updated = result.rowcount
        conn.commit()
        print(f"    Updated {chapters_updated:,} chapters")
        total_updated += chapters_updated

        print(f"  Total: {total_updated:,} parent relationships set")
        return total_updated

    except Exception as e:
        print(f"ERROR populating parent_ids: {e}")
        import traceback
        traceback.print_exc()
        return 0
    finally:
        conn.close()


# =============================================================================
# MAIN PIPELINE
# =============================================================================

def run_full_pipeline(skip_parse: bool = False, skip_db: bool = False, parse_only: bool = False,
                      hierarchy_only: bool = False):
    """Run the full NJ statutes pipeline."""
    print("=" * 60)
    print("NJ STATUTES PIPELINE")
    print("Parse -> JSON -> Schema -> Database -> Hierarchy -> Links")
    print("=" * 60)
    print()

    start_time = time.time()

    # If hierarchy-only, skip to hierarchy steps
    if hierarchy_only:
        print("[SKIPPED] Steps 1-3: Parse/Migrate (--hierarchy-only)")
        print()

        print("STEP 4: ENSURING SCHEMA")
        print("-" * 40)
        if not ensure_schema():
            print("ERROR: Schema setup failed")
            return False
        print()

        print("STEP 5: CREATING HIERARCHY CONTAINERS")
        print("-" * 40)
        titles, chapters = create_hierarchy_containers()
        print()

        print("STEP 6: POPULATING PARENT IDS")
        print("-" * 40)
        parent_updates = populate_parent_ids()
        print()

        elapsed = time.time() - start_time
        print("=" * 60)
        print("HIERARCHY UPDATE COMPLETE")
        print("=" * 60)
        print(f"Titles created: {titles:,}")
        print(f"Chapters created: {chapters:,}")
        print(f"Parent relationships set: {parent_updates:,}")
        print(f"Total time: {format_time(elapsed)}")
        return True

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
        print("[SKIPPED] Steps 2-6: Database operations (--parse-only)")
        elapsed = time.time() - start_time
        print(f"\nPipeline complete in {format_time(elapsed)}")
        return True

    if skip_db:
        print("[SKIPPED] Steps 2-6: Database operations (--skip-db)")
        elapsed = time.time() - start_time
        print(f"\nPipeline complete in {format_time(elapsed)}")
        return True

    # Step 2: Ensure schema
    print("STEP 2: ENSURING SCHEMA")
    print("-" * 40)
    if not ensure_schema():
        print("ERROR: Schema setup failed")
        return False
    print()

    # Step 3: Migrate to database
    print("STEP 3: MIGRATING SECTIONS TO DATABASE")
    print("-" * 40)
    migrated = migrate_statutes_to_db()
    if migrated == 0:
        print("WARNING: No statutes migrated")
    print()

    # Step 4: Create hierarchy containers (titles, chapters)
    print("STEP 4: CREATING HIERARCHY CONTAINERS")
    print("-" * 40)
    titles_created, chapters_created = create_hierarchy_containers()
    print()

    # Step 5: Populate parent_id relationships
    print("STEP 5: POPULATING PARENT IDS")
    print("-" * 40)
    parent_updates = populate_parent_ids()
    print()

    # Step 6: Create regulation-statute links
    print("STEP 6: CREATING REGULATION-STATUTE LINKS")
    print("-" * 40)
    links = create_regulation_statute_links()
    print()

    elapsed = time.time() - start_time
    print("=" * 60)
    print("PIPELINE COMPLETE")
    print("=" * 60)
    print(f"Sections migrated: {migrated:,}")
    print(f"Titles created: {titles_created:,}")
    print(f"Chapters created: {chapters_created:,}")
    print(f"Parent relationships set: {parent_updates:,}")
    matched = links.get('matched', 0) + links.get('corrected', 0)
    print(f"Links: {matched:,} matched ({links.get('corrected', 0):,} via subsection strip)")
    print(f"       {links.get('obsolete', 0):,} obsolete, {links.get('unmatched', 0):,} unmatched")
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
    parser.add_argument('--hierarchy-only', action='store_true',
                        help='Only update hierarchy (titles, chapters, parent_id)')
    parser.add_argument('--links-only', action='store_true',
                        help='Only update regulation-statute links (with link_type classification)')
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

    # Handle --links-only
    if args.links_only:
        print("=" * 60)
        print("REGULATION-STATUTE LINKS UPDATE")
        print("=" * 60)
        start_time = time.time()
        stats = create_regulation_statute_links()
        elapsed = time.time() - start_time
        print()
        print("=" * 60)
        print("COMPLETE")
        print("=" * 60)
        print(f"Matched (direct): {stats.get('matched', 0):,}")
        print(f"Matched (subsection strip): {stats.get('corrected', 0):,}")
        print(f"Obsolete (likely repealed): {stats.get('obsolete', 0):,}")
        print(f"Unmatched: {stats.get('unmatched', 0):,}")
        print(f"Total time: {format_time(elapsed)}")
        return

    # Run pipeline
    run_full_pipeline(
        skip_parse=args.skip_parse,
        skip_db=args.skip_db,
        parse_only=args.parse_only,
        hierarchy_only=args.hierarchy_only
    )


if __name__ == "__main__":
    main()
