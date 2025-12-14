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

# Add backend directory to path for config import (two levels up from analyze/)
sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from config import INDIVIDUAL_REGULATIONS_DIR, PROJECT_ROOT, OUTPUTS_DIR
from shared_utils import get_db_connection

load_dotenv(PROJECT_ROOT / '.env')


def get_regulations_from_db(conn: Connection) -> Dict[str, Dict]:
    """Get all regulations with their metadata from database.

    Returns:
        Dict mapping source_index to regulation data
    """
    print("Loading regulations from database...")
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    source_index,
                    title,
                    content,
                    nycrr_title,
                    nycrr_part
                FROM regulatory_documents
                WHERE type = 'regulation'
            """)

            regulations = {}
            for row in cur.fetchall():
                source_index = row[0]
                if source_index is not None:
                    regulations[source_index] = {
                        'title': row[1],
                        'content': row[2],
                        'nycrr_title': row[3],
                        'nycrr_part': row[4]
                    }

            print(f"  ✓ Loaded {len(regulations)} regulations from database")
            return regulations
    except Exception as e:
        print(f"ERROR loading regulations: {e}")
        return {}


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

    if not definitions:
        print("No definitions found in database!")
        return

    print(f"Found {len(definitions)} definitions in database")
    print()

    # Load all regulations from database (much faster than loading JSON files)
    regulations = get_regulations_from_db(db_conn)
    db_conn.close()
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

    # Scope breakdown analysis
    print()
    print("=" * 80)
    print("DEFINITION SCOPE BREAKDOWN - What do they apply to?")
    print("=" * 80)

    scope_counts = {}
    for result in results:
        scope = result['scope'] or 'unknown'
        scope_counts[scope] = scope_counts.get(scope, 0) + 1

    print(f"\nDefinitions by scope (total: {len(results)}):")
    for scope, count in sorted(scope_counts.items(), key=lambda x: -x[1]):
        pct = (count / len(results) * 100) if results else 0
        print(f"  {scope:40s}: {count:5d} ({pct:5.1f}%)")

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
    OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
    output_file = OUTPUTS_DIR / "definition_usage_analysis.json"

    output_data = {
        'total_definitions': total_definitions,
        'scope_breakdown': scope_counts,
        'statistics': {
            'found_in_any_regulation': total_definitions - unused,
            'wide_global_usage': wide_usage,
            'high_section_adoption': high_section_adoption,
            'unused': unused
        },
        'definitions': results
    }

    with open(output_file, 'w') as f:
        json.dump(output_data, f, indent=2)

    print()
    print(f"Full results saved to: {output_file}")


if __name__ == '__main__':
    main()
