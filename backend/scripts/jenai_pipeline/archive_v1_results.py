#!/usr/bin/env python3
"""Archive existing JenAI v1 results before migration drops them.

Run once before applying migration 0051_jenai_single_pass.sql:
    cd backend && python3 -m scripts.jenai_pipeline.archive_v1_results
"""

import json
import os
import sys
from datetime import datetime

from dotenv import load_dotenv


def archive():
    load_dotenv()

    from lib.db import get_db_connection

    conn = get_db_connection()
    if not conn:
        print("ERROR: Could not connect to database.")
        sys.exit(1)

    try:
        with conn.cursor() as cur:
            # Archive jenai_analyses
            cur.execute("""
                SELECT * FROM jenai_analyses ORDER BY id
            """)
            columns = [desc[0] for desc in cur.description]
            analyses = [dict(zip(columns, row)) for row in cur.fetchall()]

            # Archive jenai_issues
            cur.execute("""
                SELECT * FROM jenai_issues ORDER BY id
            """)
            columns = [desc[0] for desc in cur.description]
            issues = [dict(zip(columns, row)) for row in cur.fetchall()]

        conn.close()
    except Exception as e:
        print(f"ERROR: {e}")
        conn.close()
        sys.exit(1)

    archive_data = {
        "archived_at": datetime.now().isoformat(),
        "reason": "Pre-migration archive before collapsing to single-pass pipeline (0051)",
        "analyses_count": len(analyses),
        "issues_count": len(issues),
        "analyses": analyses,
        "issues": issues,
    }

    # Write to data/outputs/
    output_dir = os.path.join(
        os.path.dirname(__file__), "..", "..", "..", "data", "outputs"
    )
    os.makedirs(output_dir, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = os.path.join(output_dir, f"jenai_v1_archive_{timestamp}.json")

    with open(output_path, "w") as f:
        json.dump(archive_data, f, indent=2, default=str)

    print(f"Archived {len(analyses)} analyses and {len(issues)} issues")
    print(f"Output: {output_path}")


if __name__ == "__main__":
    archive()
