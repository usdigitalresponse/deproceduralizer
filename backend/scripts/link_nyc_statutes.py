#!/usr/bin/env python3
"""
Link NY regulations (NYCRR) to NYC statutes (Charter + Administrative Code).

Scans regulation text for citations to NYC law using regex patterns,
matches them to statutes in the DB, classifies link types, and
inserts into the regulation_statute_links table.

NY regulations cite NYC law in patterns like:
  - "section 11-1902 of the administrative code [of the city of New York]"
  - "section 19-107 of the New York City Administrative Code"
  - "Administrative Code of the City of New York, § 11-1916"
  - "New York City Administrative Code section 23-1201"
  - "section 1057-g of the [New York city] charter"
  - "[city] charter section 1057-g"

Usage:
    cd backend && python scripts/link_nyc_statutes.py                # Full scan
    cd backend && python scripts/link_nyc_statutes.py --dry-run      # Preview without writing
    cd backend && python scripts/link_nyc_statutes.py --title 18     # Only scan NYCRR Title 18
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
from lib.link_classification import classify_link_type
from lib.stats import format_time
from dotenv import load_dotenv

load_dotenv(PROJECT_ROOT / '.env')


# =============================================================================
# CITATION REGEX PATTERNS
# =============================================================================

# Admin Code section number: optional letter prefix, digits-digits, optional decimal/letter/parens
# Examples: "11-1902", "23-1201", "1-101", "28-105.1", "J51-2.5", "19-107(ii)"
_ADMIN_SECTION = r'([A-Z]?\d+-\d+(?:\.\d+)?(?:\([a-z0-9]+\))?[a-z]?)'

# Charter section number: digits, optional hyphen+letter suffix
# Examples: "8", "1057-g", "197-a", "1150", "1802"
_CHARTER_SECTION = r'(\d+(?:-[a-z])?\S*?)'

# Pattern 1: "section X of the [New York City] administrative code [of the city of New York]"
PATTERN_ADMIN_SECTION_OF = re.compile(
    r'(?:section|§)\s*' + _ADMIN_SECTION +
    r'\s+of\s+(?:the\s+)?(?:New\s+York\s+(?:City\s+)?)?'
    r'administrative\s+code(?:\s+of\s+the\s+city\s+of\s+New\s+York)?',
    re.IGNORECASE,
)

# Pattern 2: "[New York City] Administrative Code [of the City of New York][,] section/§ X"
PATTERN_ADMIN_CODE_SECTION = re.compile(
    r'(?:New\s+York\s+(?:City\s+)?)?'
    r'administrative\s+code(?:\s+of\s+the\s+city\s+of\s+New\s+York)?'
    r'[,]?\s+(?:section|§§?)\s*' + _ADMIN_SECTION,
    re.IGNORECASE,
)

# Pattern 3: "Section X of [the New York City] Administrative Code" — with NYC before admin code
PATTERN_ADMIN_NYC_SECTION_OF = re.compile(
    r'(?:Section|§)\s*' + _ADMIN_SECTION +
    r'(?:\([a-z0-9]+\))?\s+of\s+the\s+New\s+York\s+City\s+administrative\s+code',
    re.IGNORECASE,
)

# Pattern 4: "section X of the [New York] [city] charter"
PATTERN_CHARTER_SECTION_OF = re.compile(
    r'(?:section|§)\s*' + _CHARTER_SECTION +
    r'\s+of\s+(?:the\s+)?(?:New\s+York\s+)?(?:city\s+|City\s+)?charter',
    re.IGNORECASE,
)

# Pattern 5: "[New York] [city] charter [,] section X"
PATTERN_CHARTER_SECTION = re.compile(
    r'(?:New\s+York\s+)?(?:city\s+|City\s+)?charter[,]?\s+(?:section|§)\s*' + _CHARTER_SECTION,
    re.IGNORECASE,
)

# All patterns: (pattern, section_group, doc_type)
CITATION_PATTERNS = [
    (PATTERN_ADMIN_SECTION_OF, 1, 'admin_code'),
    (PATTERN_ADMIN_CODE_SECTION, 1, 'admin_code'),
    (PATTERN_ADMIN_NYC_SECTION_OF, 1, 'admin_code'),
    (PATTERN_CHARTER_SECTION_OF, 1, 'charter'),
    (PATTERN_CHARTER_SECTION, 1, 'charter'),
]


# =============================================================================
# CITATION EXTRACTION
# =============================================================================

def extract_nyc_citations(text: str) -> list[dict]:
    """
    Extract all NYC statute citations from regulation text.

    Returns list of dicts with keys:
        section_num: str (e.g., "23-1201", "1057-g")
        doc_type: str ('charter' or 'admin_code')
        citation: str (e.g., "NYC Admin 23-1201", "NYC Charter 1057-g")
        context: str (±150 chars around match)
        link_type: str (classified from context)
        match_start: int (position in text)
    """
    results = []
    seen = set()  # (doc_type, section_num) dedup within same text

    for pattern, section_group, doc_type in CITATION_PATTERNS:
        for match in pattern.finditer(text):
            section_num = match.group(section_group).strip()

            # Clean trailing punctuation and parenthetical subdivisions
            # e.g., "11-1916(a)" -> "11-1916", "19-107(ii)" -> "19-107"
            section_num = re.sub(r'\([a-z0-9]+\)$', '', section_num)
            section_num = section_num.rstrip('.,;:)')

            # Build citation in DB format
            if doc_type == 'charter':
                citation = f"NYC Charter {section_num}"
            else:
                citation = f"NYC Admin {section_num}"

            # Dedup
            dedup_key = (doc_type, section_num)
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
                'doc_type': doc_type,
                'citation': citation,
                'context': context,
                'link_type': link_type,
                'match_start': match.start(),
            })

    return results


# =============================================================================
# MAIN LINKING LOGIC
# =============================================================================

def link_nyc_statutes(
    dry_run: bool = False,
    filter_title: Optional[str] = None,
) -> dict:
    """
    Scan NY regulations for NYC statute citations and create links.

    Args:
        dry_run: If True, only report what would be done without writing to DB
        filter_title: Only scan regulations in this NYCRR title (e.g., "18")

    Returns:
        Stats dict with counts
    """
    print("\n" + "=" * 60)
    print("NYC STATUTE LINKING")
    print("Scan NYCRR for NYC Charter/Admin Code citations")
    print("=" * 60)
    if dry_run:
        print("  ** DRY RUN — no database writes **")
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

        # Load NYC statutes for matching
        print("Loading NYC statutes...")
        statute_rows = conn.execute(
            "SELECT id, citation FROM statutes WHERE state = 'NYC'"
        ).fetchall()
        statute_lookup = {row[1]: row[0] for row in statute_rows}
        print(f"  Found {len(statute_lookup):,} NYC statutes")

        if not statute_lookup:
            print("\n  WARNING: No NYC statutes in DB. Run nyc_statutes.py first.")

        # Load existing links to preserve reviewed ones
        print("Loading existing links...")
        existing = conn.execute("""
            SELECT regulation_id, citation, reviewed_at IS NOT NULL as is_reviewed
            FROM regulation_statute_links
            WHERE regulation_id IN (
                SELECT id FROM regulatory_documents WHERE state = 'NY'
            )
            AND citation LIKE 'NYC %%'
        """).fetchall()
        existing_links = {(row[0], row[1]): row[2] for row in existing}
        print(f"  Found {len(existing_links):,} existing NYC links "
              f"({sum(existing_links.values())} reviewed)")

        # Scan regulations
        print("\nScanning regulations for NYC citations...")
        stats = {
            'matched': 0,
            'unmatched': 0,
            'skipped_reviewed': 0,
            'total_citations': 0,
            'regs_with_citations': 0,
        }
        rows_to_upsert = []
        start_time = time.time()

        for i, (reg_id, reg_citation, content) in enumerate(regulations):
            citations = extract_nyc_citations(content)
            if not citations:
                continue

            stats['regs_with_citations'] += 1

            for cit in citations:
                stats['total_citations'] += 1

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
                else:
                    match_status = 'unmatched'
                    stats['unmatched'] += 1

                rows_to_upsert.append((
                    reg_id,
                    statute_id,
                    citation,
                    cit['context'],
                    cit['link_type'],
                    match_status,
                    None,  # original_citation
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
        print(f"  Regulations with NYC citations: {stats['regs_with_citations']:,}")
        print(f"  Total citations found: {stats['total_citations']:,}")
        print(f"  Matched to DB: {stats['matched']:,}")
        print(f"  Unmatched (section not in DB): {stats['unmatched']:,}")
        if stats['skipped_reviewed']:
            print(f"  Skipped (reviewed): {stats['skipped_reviewed']:,}")

        # Show link type distribution
        type_counts = {}
        for row in rows_to_upsert:
            lt = row[4]  # link_type
            type_counts[lt] = type_counts.get(lt, 0) + 1
        if type_counts:
            print(f"\n  Link type distribution:")
            for lt, count in sorted(type_counts.items(), key=lambda x: -x[1]):
                print(f"    {lt}: {count:,}")

        # Show doc type distribution
        doc_type_counts = {'charter': 0, 'admin_code': 0}
        for row in rows_to_upsert:
            cit = row[2]  # citation
            if cit.startswith('NYC Charter'):
                doc_type_counts['charter'] += 1
            else:
                doc_type_counts['admin_code'] += 1
        print(f"\n  Document type distribution:")
        print(f"    Charter: {doc_type_counts['charter']:,}")
        print(f"    Admin Code: {doc_type_counts['admin_code']:,}")

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
            with conn.cursor() as cur:
                for j in range(0, len(rows_to_upsert), batch_size):
                    batch = rows_to_upsert[j:j + batch_size]
                    cur.executemany(upsert_sql, batch)
                    conn.commit()
                    done = min(j + batch_size, len(rows_to_upsert))
                    print(f"    Upserted {done:,}/{len(rows_to_upsert):,}...")
            print("  Done.")

        return stats

    finally:
        conn.close()


# =============================================================================
# CLI
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description='Link NY regulations to NYC statutes (Charter + Admin Code)'
    )
    parser.add_argument('--dry-run', action='store_true',
                        help='Preview without writing to database')
    parser.add_argument('--title', type=str, default=None,
                        help='Only scan regulations in this NYCRR title (e.g., 18)')

    args = parser.parse_args()

    link_nyc_statutes(
        dry_run=args.dry_run,
        filter_title=args.title,
    )


if __name__ == "__main__":
    main()
