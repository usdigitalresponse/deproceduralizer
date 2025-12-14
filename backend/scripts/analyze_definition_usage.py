#!/usr/bin/env python3
"""
Analyze how many times extracted definitions appear across all regulations.

For each definition in the database, shows:
- Global count: How many times the term appears across ALL 60k regulations
- Same-section count: How many times it appears in regulations from the SAME nycrr_title+nycrr_part
- Usage ratio: percentage of regulations in its section that use the term

This helps validate:
- Are these definitions actually used widely? (global count)
- Are they scoped correctly? (same-section usage)
- Are we extracting definitions that matter? (usage ratio)
"""

import json
import re
import sys
import os
import argparse
from pathlib import Path
from typing import Dict, List, Tuple, Optional
import psycopg
from psycopg import Connection
from dotenv import load_dotenv

# Add parent directory to path for config import
sys.path.insert(0, str(Path(__file__).parent.parent))
from config import INDIVIDUAL_REGULATIONS_DIR, PROJECT_ROOT

load_dotenv(PROJECT_ROOT / '.env')


def get_db_connection() -> Optional[Connection]:
    """Create connection to Neon PostgreSQL"""
    try:
        database_url = os.getenv("DATABASE_URL")
        if not database_url:
            print("ERROR: DATABASE_URL not set")
            return None
        conn = psycopg.connect(database_url, connect_timeout=30)
        return conn
    except Exception as e:
        print(f"ERROR: Could not connect to database: {e}")
        return None


def load_all_regulations() -> Dict[str, Dict]:
    """Load all regulation JSON files into memory.

    Returns:
        Dict mapping source_index to regulation data
    """
    print("Loading all regulation files...")
    regulations = {}

    reg_dir = Path(INDIVIDUAL_REGULATIONS_DIR)

    if not reg_dir.exists() or not reg_dir.is_dir():
        print(f"  ERROR: Could not find individual_regulations directory at {reg_dir}")
        return {}

    json_files = list(reg_dir.glob("*.json"))

    for i, filepath in enumerate(json_files):
        if i % 10000 == 0:
            print(f"  Loaded {i}/{len(json_files)}...")

        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
                source_index = data.get('source_index')
                if source_index is not None:
                    regulations[source_index] = data
        except Exception as e:
            continue

    print(f"  ✓ Loaded {len(regulations)} regulations")
    return regulations


def normalize_term(term: str) -> str:
    """Normalize a term for searching (lowercase, basic cleanup)"""
    return term.lower().strip()


def count_term_in_text(term: str, text: str) -> int:
    """Count how many times a term appears in text (case-insensitive, word boundaries)"""
    # Create a regex pattern with word boundaries
    pattern = r'\b' + re.escape(term) + r'\b'
    matches = re.findall(pattern, text, re.IGNORECASE)
    return len(matches)


def get_definitions_from_db(conn: Connection) -> List[Dict]:
    """Fetch all definitions from database with document metadata"""
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    d.id,
                    d.term,
                    d.definition,
                    d.scope,
                    rd.source_index,
                    rd.nycrr_title,
                    rd.nycrr_part
                FROM definitions d
                JOIN regulatory_documents rd ON d.document_id = rd.id
                ORDER BY d.term
            """)

            rows = cur.fetchall()
            definitions = []
            for row in rows:
                definitions.append({
                    'id': row[0],
                    'term': row[1],
                    'definition': row[2],
                    'scope': row[3],
                    'source_index': row[4],
                    'nycrr_title': row[5],
                    'nycrr_part': row[6]
                })

            return definitions
    except Exception as e:
        print(f"ERROR fetching definitions: {e}")
        return []


def analyze_definitions(definitions: List[Dict], regulations: Dict[str, Dict]) -> List[Dict]:
    """Analyze usage of each definition across all three scopes: global, title, and section

    Args:
        definitions: List of definitions from DB
        regulations: Dict of all loaded regulations

    Returns:
        List of results with counts for all three scopes
    """

    print(f"\nAnalyzing {len(definitions)} definitions across all scopes...")
    results = []

    for i, defn in enumerate(definitions):
        if i % 100 == 0:
            print(f"  Processing {i}/{len(definitions)}...")

        term = defn['term']
        normalized_term = normalize_term(term)

        # Count GLOBAL occurrences (all 60k regulations)
        global_count = 0
        for reg in regulations.values():
            content = (reg.get('title', '') + ' ' + reg.get('content', '')).lower()
            if count_term_in_text(normalized_term, content) > 0:
                global_count += 1

        # Count TITLE-level occurrences (same NYCRR title)
        title_count = 0
        title_total = 0
        for reg in regulations.values():
            if reg.get('nycrr_title') == defn['nycrr_title']:
                title_total += 1
                content = (reg.get('title', '') + ' ' + reg.get('content', '')).lower()
                if count_term_in_text(normalized_term, content) > 0:
                    title_count += 1

        # Count SECTION-level occurrences (same NYCRR title+part)
        section_count = 0
        section_total = 0
        for reg in regulations.values():
            if (reg.get('nycrr_title') == defn['nycrr_title'] and
                reg.get('nycrr_part') == defn['nycrr_part']):
                section_total += 1
                content = (reg.get('title', '') + ' ' + reg.get('content', '')).lower()
                if count_term_in_text(normalized_term, content) > 0:
                    section_count += 1

        # Calculate percentages
        global_pct = (global_count / len(regulations) * 100) if regulations else 0
        title_pct = (title_count / title_total * 100) if title_total > 0 else 0
        section_pct = (section_count / section_total * 100) if section_total > 0 else 0

        results.append({
            'term': term,
            'definition': defn['definition'][:100],
            'scope': defn['scope'],
            'nycrr_title': defn['nycrr_title'],
            'nycrr_part': defn['nycrr_part'],
            'source_index': defn['source_index'],
            # Global scope
            'global_count': global_count,
            'global_pct': round(global_pct, 2),
            # Title scope
            'title_count': title_count,
            'title_pct': round(title_pct, 2),
            'title_total': title_total,
            # Section scope
            'section_count': section_count,
            'section_pct': round(section_pct, 2),
            'section_total': section_total,
        })

    return results


def main():
    parser = argparse.ArgumentParser(
        description='Analyze definition usage across three scopes: global, title, and section'
    )
    # No scope argument needed - we analyze all three

    args = parser.parse_args()

    print("=" * 150)
    print("DEFINITION USAGE ANALYSIS - ALL SCOPES")
    print("=" * 150)
    print()

    # Connect to database
    db_conn = get_db_connection()
    if not db_conn:
        return

    # Fetch definitions
    definitions = get_definitions_from_db(db_conn)
    db_conn.close()

    if not definitions:
        print("No definitions found in database!")
        return

    print(f"Found {len(definitions)} definitions in database")
    print()

    # Load all regulations
    regulations = load_all_regulations()
    print()

    # Analyze usage (all three scopes at once)
    results = analyze_definitions(definitions, regulations)

    # Sort by global count (most used first)
    results.sort(key=lambda x: x['global_count'], reverse=True)

    # Print results
    print("\n" + "=" * 180)
    print("DEFINITION USAGE BY SCOPE")
    print("=" * 180)
    print()
    header = "NYCRR    | TERM                      | GLOBAL            | TITLE             | SECTION"
    print(header)
    print("         |                           | (N)      (%)      | (N)      (%)      | (N)      (%)")
    print("-" * 180)

    for result in results:
        nycrr = f"{result['nycrr_title']}-{result['nycrr_part']}"
        term = result['term'][:25].ljust(25)

        global_info = f"{result['global_count']:5d} ({result['global_pct']:5.1f}%)"
        title_info = f"{result['title_count']:5d} ({result['title_pct']:5.1f}%)"
        section_info = f"{result['section_count']:5d} ({result['section_pct']:5.1f}%)"

        print(f"{nycrr:8s} | {term} | {global_info} | {title_info} | {section_info}")

    # Summary statistics
    print()
    print("=" * 80)
    print("SUMMARY")
    print("=" * 80)

    total_definitions = len(results)
    wide_usage = sum(1 for r in results if r['global_pct'] >= 1.0)
    high_section_adoption = sum(1 for r in results if r['section_pct'] >= 50.0)
    unused = sum(1 for r in results if r['global_count'] == 0)

    print(f"Total definitions: {total_definitions}")
    print(f"Found in any regulation: {total_definitions - unused}")
    print(f"With wide global usage (≥1% of all regs): {wide_usage}")
    print(f"With high adoption in their section (≥50%): {high_section_adoption}")
    print()

    # Save full results to JSON
    output_file = "definition_usage_analysis.json"
    with open(output_file, 'w') as f:
        json.dump(results, f, indent=2)

    print()
    print(f"Full results saved to: {output_file}")


if __name__ == '__main__':
    main()
