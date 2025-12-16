#!/usr/bin/env python3
"""
Import NJ wet signature analysis into compliance_issues table.

This script reads the NJ wet signature analysis JSON and imports flagged items
into the compliance_issues table, linking them to regulatory_documents by source_index.

Usage:
    python import_compliance_issues.py --state NJ                    # Import NJ data
    python import_compliance_issues.py --file <path> --state NJ      # Import from custom file
"""

import json
import sys
import argparse
import os
from pathlib import Path
from typing import Optional

# Add parent directory to path for config import
sys.path.insert(0, str(Path(__file__).parent.parent))
from config import OUTPUTS_DIR, PROJECT_ROOT
from dotenv import load_dotenv

# Load .env
load_dotenv(PROJECT_ROOT / '.env')

from shared_utils import get_db_connection


def import_nj_wet_signatures(file_path: Optional[str] = None, state: str = 'NJ') -> int:
    """
    Import NJ wet signature analysis into compliance_issues table.

    Args:
        file_path: Path to NJ analysis JSON (default: latest in OUTPUTS_DIR)
        state: State code (default: 'NJ')

    Returns:
        Number of records imported
    """

    # Find analysis file
    if not file_path:
        # Look for latest nj_wet_signature_analysis.json
        analysis_file = Path(OUTPUTS_DIR) / 'nj_wet_signature_analysis.json'
        if not analysis_file.exists():
            print(f"Error: No analysis file found at {analysis_file}")
            return 0
        file_path = str(analysis_file)

    print(f"Loading analysis from {file_path}...")

    # Load analysis data
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            analysis_data = json.load(f)
    except Exception as e:
        print(f"Error reading file: {e}")
        return 0

    if not isinstance(analysis_data, list):
        print(f"Error: Expected list, got {type(analysis_data)}")
        return 0

    print(f"Loaded {len(analysis_data)} records")

    # Filter for flagged items (has_wet_signature_requirement = true)
    flagged = [
        item for item in analysis_data
        if item.get('llm_analysis', {}).get('has_wet_signature_requirement') is True
    ]

    print(f"Found {len(flagged)} flagged items (wet_signature_requirement = true)")

    if not flagged:
        print("No flagged items to import")
        return 0

    # Connect to database
    conn = get_db_connection()
    if not conn:
        print("Failed to connect to database")
        return 0

    imported = 0
    failed = 0

    try:
        with conn.cursor() as cur:
            for item in flagged:
                try:
                    source_index = item.get('source_index')
                    if not source_index:
                        print(f"  ⚠️  Missing source_index for {item.get('title', 'unknown')}")
                        failed += 1
                        continue

                    # Look up document_id from source_index
                    cur.execute(
                        """
                        SELECT id FROM regulatory_documents
                        WHERE source_index = %s AND state = %s
                        LIMIT 1
                        """,
                        (source_index, state)
                    )

                    result = cur.fetchone()
                    if not result:
                        print(f"  ⚠️  No document found for source_index {source_index}")
                        failed += 1
                        continue

                    document_id = result[0]

                    # Insert into compliance_issues
                    cur.execute(
                        """
                        INSERT INTO compliance_issues
                        (document_id, issue_type, term_matched, context, requirement_quote,
                         from_statute, statute_citation, llm_confirmed, state)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT DO NOTHING
                        """,
                        (
                            document_id,
                            'wet_signature',
                            item.get('term_matched'),
                            item.get('context'),
                            item.get('llm_analysis', {}).get('requirement_quote'),
                            item.get('llm_analysis', {}).get('from_statute'),
                            None,  # statute_citation - not in analysis data yet
                            True,  # llm_confirmed
                            state
                        )
                    )

                    imported += 1

                    if imported % 10 == 0:
                        print(f"  Imported {imported}/{len(flagged)}...")

                except Exception as e:
                    print(f"  ❌ Error importing {item.get('title', 'unknown')}: {e}")
                    failed += 1
                    continue

            # Commit all changes
            conn.commit()

    except Exception as e:
        print(f"Error during import: {e}")
        try:
            conn.rollback()
        except:
            pass
        return imported
    finally:
        try:
            conn.close()
        except:
            pass

    print(f"\n=== Import Summary ===")
    print(f"✓ Imported: {imported}")
    print(f"✗ Failed: {failed}")
    print(f"Total: {imported + failed}")

    return imported


def main():
    parser = argparse.ArgumentParser(
        description='Import compliance issues (wet signatures) from analysis JSON'
    )
    parser.add_argument(
        '--file',
        type=str,
        help='Path to analysis JSON file (default: latest nj_wet_signature_analysis.json)'
    )
    parser.add_argument(
        '--state',
        type=str,
        default='NJ',
        choices=['NY', 'NJ'],
        help='State code (default: NJ)'
    )

    args = parser.parse_args()

    import_nj_wet_signatures(file_path=args.file, state=args.state)


if __name__ == '__main__':
    main()
