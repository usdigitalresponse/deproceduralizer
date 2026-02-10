#!/usr/bin/env python3
"""
Link NY regulations (NYCRR) to NY statutes (NYCLS).

Scans regulation text for statute citations using regex patterns,
matches them to statutes in the DB, classifies link types, and
inserts into the regulation_statute_links table.

NY regulations cite statutes in natural language:
  - "section 488 of the Social Services Law"
  - "Education Law section 4401"
  - "Public Health Law § 2801"
  - "subdivision (a) of section 413 of the Social Services Law"

Usage:
    python backend/scripts/link_ny_statutes.py                 # Full scan
    python backend/scripts/link_ny_statutes.py --dry-run       # Preview without writing
    python backend/scripts/link_ny_statutes.py --law SOS       # Only links to SOS statutes
    python backend/scripts/link_ny_statutes.py --title 18      # Only scan NYCRR Title 18
"""

import re
import sys
import time
import argparse
from pathlib import Path
from typing import Optional

# Ensure backend/ is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config import PROJECT_ROOT
from lib.db import get_db_connection
from lib.stats import format_time
from lib.ny_law_names import resolve_law_id
from dotenv import load_dotenv

load_dotenv(PROJECT_ROOT / '.env')


# =============================================================================
# CITATION REGEX PATTERNS
# =============================================================================

# Law name: 1-8 words where each word starts with a capital letter (or is "and"/"&"/","/"-")
# Non-greedy so we don't grab preceding context. The final word must be capitalized.
# Examples: "Social Services", "Vehicle and Traffic", "Arts and Cultural Affairs",
#           "Racing, Pari-Mutuel Wagering and Breeding"
_LAW_NAME = r'((?:[A-Z][a-z\']+[\s,&\-]+(?:and\s+|of\s+)?)*[A-Z][a-z\']+)'

# Section number: digits, optional hyphen+letter suffix, optional decimal
# Examples: "488", "296-a", "2801-a", "119.1", "17-a"
_SECTION_NUM = r'(\d+(?:-[a-zA-Z](?:\.\d+)?)?(?:\.\d+)?)'

# Pattern 1: "section 488 of the Social Services Law"
#             "section 296-a of the Executive Law"
PATTERN_SECTION_OF_LAW = re.compile(
    r'(?:section|§)\s*' + _SECTION_NUM + r'\s+of\s+the\s+' + _LAW_NAME + r'\s+Law\b'
)

# Pattern 2: "Education Law section 4401" / "Education Law § 4401"
#             "Public Health Law § 2801"
PATTERN_LAW_SECTION = re.compile(
    _LAW_NAME + r'\s+Law\s+(?:section|§)\s*' + _SECTION_NUM
)

# Pattern 3: "subdivision (a) of section 413 of the Social Services Law"
#             "paragraph (2) of subdivision (a) of section 413 of the Social Services Law"
PATTERN_SUBDIV_SECTION_OF_LAW = re.compile(
    r'(?:subdivision|paragraph|subparagraph)\s+\([a-z0-9]+\)\s+'
    r'(?:of\s+(?:subdivision|paragraph)\s+\([a-z0-9]+\)\s+)*'
    r'of\s+(?:section|§)\s*' + _SECTION_NUM + r'\s+of\s+the\s+' + _LAW_NAME + r'\s+Law\b'
)

# All patterns with their group extraction order: (section_group, law_name_group)
CITATION_PATTERNS = [
    # Most specific first (subdivision pattern)
    (PATTERN_SUBDIV_SECTION_OF_LAW, 1, 2),
    # "section X of the Y Law"
    (PATTERN_SECTION_OF_LAW, 1, 2),
    # "Y Law section X" (groups are reversed)
    (PATTERN_LAW_SECTION, 2, 1),
]


# =============================================================================
# LINK TYPE CLASSIFICATION
# =============================================================================

LINK_TYPE_PATTERNS = {
    'enabling_authority': [
        re.compile(r'(?:pursuant|according)\s+to', re.IGNORECASE),
        re.compile(r'established\s+(?:by|pursuant\s+to)', re.IGNORECASE),
        re.compile(r'authorized\s+(?:by|under|pursuant\s+to)', re.IGNORECASE),
        re.compile(r'authority\s+(?:of|under|granted\s+by)', re.IGNORECASE),
        re.compile(r'(?:enacted|promulgated)\s+(?:under|pursuant)', re.IGNORECASE),
        re.compile(r'CHAPTER\s+AUTHORITY', re.IGNORECASE),
        re.compile(r'STATUTORY\s+AUTHORITY', re.IGNORECASE),
    ],
    'definition': [
        re.compile(r'as\s+defined\s+(?:by|in|pursuant\s+to|under)', re.IGNORECASE),
        re.compile(r'(?:means|shall\s+mean)', re.IGNORECASE),
        re.compile(r'definition', re.IGNORECASE),
        re.compile(r'the\s+meaning\s+(?:given|set\s+forth|provided)', re.IGNORECASE),
    ],
    'requirement': [
        re.compile(r'as\s+required\s+(?:by|under|pursuant\s+to)', re.IGNORECASE),
        re.compile(r'in\s+accordance\s+with', re.IGNORECASE),
        re.compile(r'in\s+compliance\s+with', re.IGNORECASE),
        re.compile(r'subject\s+to\s+(?:the\s+)?(?:provisions\s+of\s+)?', re.IGNORECASE),
        re.compile(r'shall\s+comply\s+with', re.IGNORECASE),
    ],
}


def classify_link_type(context: str) -> str:
    """Classify the link type based on surrounding context text."""
    for link_type, patterns in LINK_TYPE_PATTERNS.items():
        for pattern in patterns:
            if pattern.search(context):
                return link_type
    return 'reference'


# =============================================================================
# CITATION EXTRACTION
# =============================================================================

def extract_citations(text: str) -> list[dict]:
    """
    Extract all statute citations from regulation text.

    Returns list of dicts with keys:
        section_num: str (e.g., "488", "296-a")
        law_name: str (e.g., "Social Services", "Education")
        law_id: str | None (e.g., "SOS", "EDN")
        citation: str (e.g., "SOS 488")
        context: str (±150 chars around match)
        link_type: str (classified from context)
        match_start: int (position in text)
    """
    results = []
    seen = set()  # (law_id, section_num) dedup within same text

    for pattern, section_group, law_name_group in CITATION_PATTERNS:
        for match in pattern.finditer(text):
            section_num = match.group(section_group).strip()
            law_name = match.group(law_name_group).strip()

            # Resolve law name to ID
            law_id = resolve_law_id(law_name)

            # Build citation in DB format
            if law_id:
                citation = f"{law_id} {section_num}"
            else:
                citation = f"?{law_name} {section_num}"

            # Dedup: same (law_id or law_name, section) in same regulation
            dedup_key = (law_id or law_name.lower(), section_num)
            if dedup_key in seen:
                continue
            seen.add(dedup_key)

            # Extract context (±150 chars)
            start = max(0, match.start() - 150)
            end = min(len(text), match.end() + 150)
            context = text[start:end]

            # Classify link type from context
            link_type = classify_link_type(context)

            results.append({
                'section_num': section_num,
                'law_name': law_name,
                'law_id': law_id,
                'citation': citation,
                'context': context,
                'link_type': link_type,
                'match_start': match.start(),
            })

    return results


# =============================================================================
# MAIN LINKING LOGIC
# =============================================================================

def link_ny_statutes(
    dry_run: bool = False,
    filter_law: Optional[str] = None,
    filter_title: Optional[str] = None,
) -> dict:
    """
    Scan NY regulations for statute citations and create links.

    Args:
        dry_run: If True, only report what would be done without writing to DB
        filter_law: Only create links to this law ID (e.g., "SOS")
        filter_title: Only scan regulations in this NYCRR title (e.g., "18")

    Returns:
        Stats dict with counts of matched, unmatched, unknown_law, etc.
    """
    print("\n" + "=" * 60)
    print("NY STATUTE LINKING")
    print("Scan NYCRR for NYCLS citations -> regulation_statute_links")
    print("=" * 60)
    if dry_run:
        print("  ** DRY RUN — no database writes **")
    if filter_law:
        print(f"  Filter: only links to law {filter_law}")
    if filter_title:
        print(f"  Filter: only scanning NYCRR Title {filter_title}")
    print()

    conn = get_db_connection()
    if not conn:
        print("ERROR: Could not connect to database")
        return {}

    try:
        # Load NY regulations
        print("Loading NY regulations...")
        reg_query = """
            SELECT id, citation, content FROM regulatory_documents
            WHERE state = 'NY' AND hierarchy_level = 'section' AND content IS NOT NULL
        """
        params = []
        if filter_title:
            reg_query += " AND citation LIKE %s"
            params.append(f"{filter_title} NYCRR %")

        regulations = conn.execute(reg_query, params).fetchall()
        print(f"  Found {len(regulations):,} regulation sections")

        # Load NY statutes for matching
        print("Loading NY statutes...")
        statute_query = "SELECT id, citation FROM statutes WHERE state = 'NY'"
        statute_params = []
        if filter_law:
            statute_query += " AND nycls_law_id = %s"
            statute_params.append(filter_law.upper())

        statute_rows = conn.execute(statute_query, statute_params).fetchall()
        statute_lookup = {row[1]: row[0] for row in statute_rows}
        print(f"  Found {len(statute_lookup):,} statutes")

        # Build law-level lookup for detecting "law exists but section doesn't"
        law_ids_in_db = set()
        for cit in statute_lookup:
            if cit.startswith("law:"):
                law_ids_in_db.add(cit[4:])  # "law:SOS" -> "SOS"
            else:
                parts = cit.split(" ", 1)
                if len(parts) == 2:
                    law_ids_in_db.add(parts[0])
        print(f"  Found {len(law_ids_in_db)} distinct laws in DB")

        # Load existing links to preserve reviewed ones
        print("Loading existing links...")
        existing = conn.execute("""
            SELECT regulation_id, citation, reviewed_at IS NOT NULL as is_reviewed
            FROM regulation_statute_links
            WHERE regulation_id IN (
                SELECT id FROM regulatory_documents WHERE state = 'NY'
            )
        """).fetchall()
        existing_links = {(row[0], row[1]): row[2] for row in existing}
        print(f"  Found {len(existing_links):,} existing links "
              f"({sum(existing_links.values())} reviewed)")

        # Scan regulations
        print("\nScanning regulations for citations...")
        stats = {
            'matched': 0,
            'unmatched': 0,
            'unknown_law': 0,
            'skipped_reviewed': 0,
            'skipped_filter': 0,
            'total_citations': 0,
            'regs_with_citations': 0,
        }
        rows_to_upsert = []
        unknown_laws = {}  # law_name -> count (for reporting)
        start_time = time.time()

        for i, (reg_id, reg_citation, content) in enumerate(regulations):
            citations = extract_citations(content)
            if not citations:
                continue

            stats['regs_with_citations'] += 1

            for cit in citations:
                stats['total_citations'] += 1

                # Filter by law if requested
                if filter_law and cit['law_id'] != filter_law.upper():
                    stats['skipped_filter'] += 1
                    continue

                # Unknown law name
                if not cit['law_id']:
                    stats['unknown_law'] += 1
                    unknown_laws[cit['law_name']] = unknown_laws.get(cit['law_name'], 0) + 1
                    continue

                citation = cit['citation']

                # Skip if already reviewed
                if existing_links.get((reg_id, citation), False):
                    stats['skipped_reviewed'] += 1
                    continue

                # Look up statute
                statute_id = statute_lookup.get(citation)

                if statute_id:
                    match_status = 'matched'
                    stats['matched'] += 1
                elif cit['law_id'] in law_ids_in_db:
                    # Law exists but section not found
                    match_status = 'unmatched'
                    stats['unmatched'] += 1
                else:
                    # Law not even in DB yet (not ingested)
                    match_status = 'unmatched'
                    stats['unmatched'] += 1

                rows_to_upsert.append((
                    reg_id,
                    statute_id,
                    citation,
                    cit['context'],
                    cit['link_type'],
                    match_status,
                    None,  # original_citation (no correction needed for NY)
                    None,  # correction_notes
                ))

            if (i + 1) % 2000 == 0:
                elapsed = time.time() - start_time
                rate = (i + 1) / elapsed if elapsed > 0 else 0
                remaining = (len(regulations) - i - 1) / rate if rate > 0 else 0
                print(f"  Scanned {i + 1:,}/{len(regulations):,} regulations "
                      f"({format_time(elapsed)}, ETA: {format_time(remaining)})")

        scan_time = time.time() - start_time
        print(f"\nScan complete in {format_time(scan_time)}")
        print(f"  Regulations with citations: {stats['regs_with_citations']:,}")
        print(f"  Total citations found: {stats['total_citations']:,}")
        print(f"  Matched: {stats['matched']:,}")
        print(f"  Unmatched (section not in DB): {stats['unmatched']:,}")
        print(f"  Unknown law name: {stats['unknown_law']:,}")
        if stats['skipped_reviewed']:
            print(f"  Skipped (reviewed): {stats['skipped_reviewed']:,}")
        if stats['skipped_filter']:
            print(f"  Skipped (filter): {stats['skipped_filter']:,}")

        # Show unknown law names
        if unknown_laws:
            print(f"\n  Top unknown law names (not in mapping):")
            for name, count in sorted(unknown_laws.items(), key=lambda x: -x[1])[:20]:
                print(f"    '{name}': {count}")

        # Show link type distribution
        type_counts = {}
        for row in rows_to_upsert:
            lt = row[4]  # link_type
            type_counts[lt] = type_counts.get(lt, 0) + 1
        if type_counts:
            print(f"\n  Link type distribution:")
            for lt, count in sorted(type_counts.items(), key=lambda x: -x[1]):
                print(f"    {lt}: {count:,}")

        # Write to DB
        if dry_run:
            print(f"\n  DRY RUN: would upsert {len(rows_to_upsert):,} links")
        elif rows_to_upsert:
            print(f"\n  Upserting {len(rows_to_upsert):,} links to database...")
            upsert_sql = """
                INSERT INTO regulation_statute_links
                    (regulation_id, statute_id, citation, context, link_type,
                     match_status, original_citation, correction_notes)
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
            for j in range(0, len(rows_to_upsert), batch_size):
                batch = rows_to_upsert[j:j + batch_size]
                for row in batch:
                    conn.execute(upsert_sql, row)
                conn.commit()
                if (j + batch_size) % 5000 == 0 or j + batch_size >= len(rows_to_upsert):
                    print(f"    Upserted {min(j + batch_size, len(rows_to_upsert)):,}"
                          f"/{len(rows_to_upsert):,}...")

            conn.commit()
            print("  Done.")

        return stats

    finally:
        conn.close()


# =============================================================================
# CLI
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description='Link NY regulations to NY statutes via citation regex scan'
    )
    parser.add_argument('--dry-run', action='store_true',
                        help='Preview without writing to database')
    parser.add_argument('--law', type=str, default=None,
                        help='Only create links to this law ID (e.g., SOS, EDN)')
    parser.add_argument('--title', type=str, default=None,
                        help='Only scan regulations in this NYCRR title (e.g., 18)')

    args = parser.parse_args()

    link_ny_statutes(
        dry_run=args.dry_run,
        filter_law=args.law,
        filter_title=args.title,
    )


if __name__ == "__main__":
    main()
