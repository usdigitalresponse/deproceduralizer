#!/usr/bin/env python3
"""
Update NJ regulation fields in database from JSON files.
Fixes: njac_section, url_type
"""

import json
import psycopg
from dotenv import load_dotenv
from pathlib import Path
import os
import sys

# Load .env
load_dotenv(Path(__file__).parent.parent.parent / '.env')

def main():
    db_url = os.environ.get('DATABASE_URL')
    if not db_url:
        print("Error: DATABASE_URL not set")
        sys.exit(1)

    files = list(Path('data/nj_individual_regulations').glob('*.json'))
    print(f"Loading {len(files)} NJ regulation files...")

    # Build updates: (njac_section, url_type, source_index)
    updates = []
    for f in files:
        data = json.load(open(f))
        si = data.get('source_index')
        if si is not None:
            updates.append((
                data.get('njac_section'),
                data.get('url_type'),
                si
            ))

    print(f"Updating {len(updates)} records in database...")

    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            batch_size = 500
            updated = 0
            for i in range(0, len(updates), batch_size):
                batch = updates[i:i+batch_size]
                for njac_section, url_type, source_index in batch:
                    cur.execute("""
                        UPDATE regulatory_documents
                        SET njac_section = %s, url_type = %s
                        WHERE state = 'NJ' AND source_index = %s
                    """, (njac_section, url_type, source_index))
                    updated += cur.rowcount

                if (i + batch_size) % 10000 == 0:
                    print(f"  Processed {i + batch_size}...")
                    conn.commit()

            conn.commit()
            print(f"✓ Updated {updated} database records")

if __name__ == '__main__':
    main()
