#!/usr/bin/env python3
"""
Import red flags and definitions from local JSON files into the database.
Skips records that already exist.
"""

import json
import sys
from pathlib import Path
from dotenv import load_dotenv
from tqdm import tqdm

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))
load_dotenv(Path(__file__).parent.parent.parent / '.env')

from shared_utils import get_db_connection

# Valid red flag categories (must match backend/scripts/red_flags.py enum)
VALID_CATEGORIES = {
    'complexity_policy_debt',
    'options_become_requirements',
    'policy_implementation_separation',
    'overwrought_legalese',
    'cascade_of_rigidity',
    'mandated_steps_not_outcomes',
    'administrative_burdens',
    'no_feedback_loops',
    'process_worship_oversight',
    'zero_risk_language',
    'frozen_technology',
    'implementation_opportunity',
    'reporting_requirement',
}

# Known typos/variants to normalize
CATEGORY_ALIASES = {
    'admin_burdens': 'administrative_burdens',
}


def normalize_category(category: str) -> str:
    """Normalize category to lowercase and fix known typos."""
    if not category:
        return 'unknown'

    normalized = category.lower().strip()

    # Fix known aliases/typos
    if normalized in CATEGORY_ALIASES:
        normalized = CATEGORY_ALIASES[normalized]

    # Warn if category is not in valid set
    if normalized not in VALID_CATEGORIES and normalized != 'unknown':
        tqdm.write(f"  Warning: Unknown category '{normalized}'")

    return normalized


def import_red_flags_from_json(json_path: str, state: str = 'NY'):
    """Import red flags from a JSON file into the database."""

    print(f"\n=== Importing {json_path} ===")

    with open(json_path, 'r') as f:
        records = json.load(f)

    print(f"Found {len(records)} records in file")

    conn = get_db_connection()
    if not conn:
        print("ERROR: Could not connect to database")
        return

    imported = 0
    skipped = 0
    errors = 0

    for record in tqdm(records, desc="Importing", unit="rec"):
        try:
            source_index = record.get('source_index')
            if source_index is None:
                skipped += 1
                continue

            # Check if already exists
            existing = conn.execute("""
                SELECT a.id FROM analyses a
                JOIN regulatory_documents rd ON a.document_id = rd.id
                WHERE rd.source_index = %s AND rd.state = %s
            """, (source_index, state)).fetchone()

            if existing:
                skipped += 1
                continue

            # Insert/update regulatory document
            doc_result = conn.execute("""
                INSERT INTO regulatory_documents
                (source_index, type, state, title, url, content)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (state, source_index, type) DO UPDATE SET
                    title = EXCLUDED.title,
                    url = EXCLUDED.url,
                    content = EXCLUDED.content
                RETURNING id
            """, (
                source_index,
                'regulation',
                state,
                record.get('title', ''),
                record.get('url', ''),
                record.get('content', '')
            ))
            doc_id = doc_result.fetchone()[0]

            # Insert analysis
            red_flags = record.get('red_flags', [])
            analysis_result = conn.execute("""
                INSERT INTO analyses
                (document_id, model_version, has_implementation_issues,
                 overall_complexity, summary, max_severity, num_flags, is_current)
                VALUES (%s, %s, %s, %s, %s, %s, %s, TRUE)
                RETURNING id
            """, (
                doc_id,
                'gpt-5-nano',
                record.get('has_implementation_issues', False),
                record.get('overall_complexity'),
                record.get('summary'),
                record.get('max_severity', 0),
                len(red_flags)
            ))
            analysis_id = analysis_result.fetchone()[0]

            # Insert red flags
            for flag in red_flags:
                conn.execute("""
                    INSERT INTO red_flags
                    (analysis_id, category, explanation, severity, complexity,
                     matched_phrases, implementation_approach, effort_estimate, text_examples)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    analysis_id,
                    normalize_category(flag.get('category', 'unknown')),
                    flag.get('explanation', ''),
                    flag.get('severity', 5),
                    flag.get('complexity', 'MEDIUM'),
                    flag.get('matched_phrases', []),
                    flag.get('implementation_approach', ''),
                    flag.get('effort_estimate'),
                    flag.get('text_examples', [])
                ))

            imported += 1

        except Exception as e:
            errors += 1
            tqdm.write(f"Error on source_index {source_index}: {e}")

    conn.commit()
    conn.close()

    print(f"\nResults: {imported} imported, {skipped} skipped, {errors} errors")


def main():
    outputs_dir = Path(__file__).parent.parent.parent / 'data' / 'outputs'

    # List all red flag JSON files
    json_files = sorted(outputs_dir.glob('red_flag*.json'))

    print("=== RED FLAG JSON FILES ===")
    for f in json_files:
        with open(f) as file:
            count = len(json.load(file))
        print(f"  {f.name}: {count} records")

    print("\nImporting all files...")

    for json_file in json_files:
        # Determine state from filename
        state = 'NJ' if '_NJ_' in json_file.name else 'NY'
        import_red_flags_from_json(str(json_file), state)

    # Final count
    conn = get_db_connection()
    result = conn.execute('SELECT COUNT(*) FROM analyses')
    print(f"\n=== FINAL DATABASE STATUS ===")
    print(f"Total analyses: {result.fetchone()[0]}")
    result = conn.execute('SELECT COUNT(*) FROM red_flags')
    print(f"Total red flags: {result.fetchone()[0]}")
    conn.close()


if __name__ == '__main__':
    main()
