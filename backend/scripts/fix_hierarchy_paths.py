#!/usr/bin/env python3
"""
Fix hierarchy_path to use raw breadcrumb from Cornell.

The original scrapers built hierarchy_path from parsed components like:
  "Title 8 - HEALTH > Chapter 21 > Subchapter 7 > § 8:21-7.11"

But we want the full raw breadcrumb from Cornell like:
  "LII > State Regulations > New Jersey Administrative Code > N.J. Admin. Code tit. 8 - HEALTH > ..."

This script:
1. For NJ: Uses cached HTML files to extract raw breadcrumb
2. For NY: Re-fetches from Cornell if no cache (with rate limiting)
3. Updates individual JSON files
4. Updates just the hierarchy_path field in the database
"""

import json
import hashlib
import time
import sys
import os
import requests
from pathlib import Path
from typing import Optional, Dict, List
from bs4 import BeautifulSoup
from dotenv import load_dotenv

# Add parent directory to path for config import
sys.path.insert(0, str(Path(__file__).parent.parent))

# Load .env from project root
load_dotenv(Path(__file__).parent.parent.parent / '.env')

from config import (
    DATA_DIR,
    INDIVIDUAL_REGULATIONS_DIR,
    NJ_INDIVIDUAL_REGULATIONS_DIR,
    NJ_SCRAPED_DATA_DIR,
    SCRAPED_DATA_DIR,
)
from shared_utils import get_db_connection


# =============================================================================
# BREADCRUMB PARSING
# =============================================================================

def extract_raw_breadcrumb(html: str) -> Optional[str]:
    """
    Extract the raw breadcrumb path from Cornell HTML.

    Returns something like:
    "LII > State Regulations > New Jersey Administrative Code > N.J. Admin. Code tit. 8 - HEALTH > ..."
    """
    soup = BeautifulSoup(html, 'html.parser')
    breadcrumb = soup.find('ol', class_='breadcrumb')

    if not breadcrumb:
        return None

    items = breadcrumb.find_all('li')
    breadcrumb_parts = []

    for item in items:
        text = item.get_text(strip=True)
        if text:
            breadcrumb_parts.append(text)

    if breadcrumb_parts:
        return ' > '.join(breadcrumb_parts)

    return None


def get_cache_path(url: str, cache_dir: Path) -> Path:
    """Generate cache file path for a URL (same as scraper uses)."""
    url_hash = hashlib.md5(url.encode()).hexdigest()
    return cache_dir / f"{url_hash}.json"


def load_cached_html(url: str, cache_dir: Path) -> Optional[str]:
    """Load cached HTML for a URL if it exists."""
    cache_path = get_cache_path(url, cache_dir)
    if cache_path.exists():
        try:
            with open(cache_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return data.get('html')
        except Exception:
            pass
    return None


def fetch_and_cache_html(url: str, cache_dir: Path, session: requests.Session) -> Optional[str]:
    """Fetch HTML from Cornell and cache it."""
    try:
        response = session.get(url, timeout=30)
        response.raise_for_status()
        html = response.text

        # Cache it
        cache_path = get_cache_path(url, cache_dir)
        cache_dir.mkdir(parents=True, exist_ok=True)
        with open(cache_path, 'w', encoding='utf-8') as f:
            json.dump({'url': url, 'html': html}, f, ensure_ascii=False)

        return html
    except Exception as e:
        print(f"    Error fetching {url}: {e}")
        return None


# =============================================================================
# FIX FUNCTIONS
# =============================================================================

def fix_nj_hierarchy_paths(dry_run: bool = False, limit: Optional[int] = None, force_db: bool = False):
    """
    Fix NJ hierarchy_path using cached HTML.

    Args:
        dry_run: If True, don't write changes
        limit: Max number of records to process (for testing)
        force_db: If True, collect DB updates even for already-good files
    """
    print("=" * 60)
    print("FIXING NJ HIERARCHY PATHS")
    print("=" * 60)

    if not NJ_SCRAPED_DATA_DIR.exists():
        print(f"Error: NJ scraped data not found at {NJ_SCRAPED_DATA_DIR}")
        return

    if not NJ_INDIVIDUAL_REGULATIONS_DIR.exists():
        print(f"Error: NJ individual regulations not found at {NJ_INDIVIDUAL_REGULATIONS_DIR}")
        return

    # Load all individual regulation files
    json_files = sorted(NJ_INDIVIDUAL_REGULATIONS_DIR.glob('*.json'))
    print(f"Found {len(json_files)} NJ individual regulation files")

    if limit:
        json_files = json_files[:limit]
        print(f"Processing first {limit} files only (--limit)")

    updated_count = 0
    missing_cache_count = 0
    no_breadcrumb_count = 0
    already_good_count = 0
    updates_for_db = []  # (source_index, new_hierarchy_path)

    for idx, json_file in enumerate(json_files):
        if (idx + 1) % 1000 == 0:
            print(f"  Processing {idx + 1}/{len(json_files)}...")

        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)

            url = data.get('url')
            current_path = data.get('hierarchy_path', '')
            source_index = data.get('source_index')

            # If already has raw breadcrumb (starts with LII)
            if current_path and current_path.startswith('LII'):
                already_good_count += 1
                # Still collect for DB update if force_db is set
                if force_db and source_index is not None:
                    updates_for_db.append((source_index, current_path))
                continue

            if not url:
                continue

            # Try to get cached HTML
            html = load_cached_html(url, NJ_SCRAPED_DATA_DIR)
            if not html:
                missing_cache_count += 1
                continue

            # Extract raw breadcrumb
            raw_breadcrumb = extract_raw_breadcrumb(html)
            if not raw_breadcrumb:
                no_breadcrumb_count += 1
                continue

            # Update the file
            if not dry_run:
                data['hierarchy_path'] = raw_breadcrumb
                with open(json_file, 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)

            if source_index is not None:
                updates_for_db.append((source_index, raw_breadcrumb))

            updated_count += 1

        except Exception as e:
            print(f"  Error processing {json_file.name}: {e}")
            continue

    print(f"\nResults:")
    print(f"  Updated: {updated_count}")
    print(f"  Already good: {already_good_count}")
    print(f"  Missing cache: {missing_cache_count}")
    print(f"  No breadcrumb found: {no_breadcrumb_count}")

    if dry_run:
        print("\n(Dry run - no changes written)")
    else:
        print(f"\nUpdates ready for database: {len(updates_for_db)}")

    return updates_for_db


def fix_ny_hierarchy_paths(dry_run: bool = False, limit: Optional[int] = None, refetch: bool = False):
    """
    Fix NY hierarchy_path.

    Args:
        dry_run: If True, don't write changes
        limit: Max number of records to process (for testing)
        refetch: If True, fetch from Cornell when cache is missing
    """
    print("=" * 60)
    print("FIXING NY HIERARCHY PATHS")
    print("=" * 60)

    if not INDIVIDUAL_REGULATIONS_DIR.exists():
        print(f"Error: NY individual regulations not found at {INDIVIDUAL_REGULATIONS_DIR}")
        return

    # Create cache dir if needed
    cache_dir = SCRAPED_DATA_DIR
    cache_dir.mkdir(parents=True, exist_ok=True)

    # Load all individual regulation files
    json_files = sorted(INDIVIDUAL_REGULATIONS_DIR.glob('*.json'))
    print(f"Found {len(json_files)} NY individual regulation files")

    if limit:
        json_files = json_files[:limit]
        print(f"Processing first {limit} files only (--limit)")

    if refetch:
        print("Will fetch from Cornell when cache is missing (rate-limited)")
        session = requests.Session()
        session.headers.update({
            'User-Agent': 'deproceduralizer/1.0 (+https://github.com/usdigitalresponse/deproceduralizer)'
        })
    else:
        session = None

    updated_count = 0
    missing_cache_count = 0
    fetched_count = 0
    no_breadcrumb_count = 0
    already_good_count = 0
    updates_for_db = []

    for idx, json_file in enumerate(json_files):
        if (idx + 1) % 1000 == 0:
            print(f"  Processing {idx + 1}/{len(json_files)}...")

        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)

            url = data.get('url')
            current_path = data.get('hierarchy_path', '')
            source_index = data.get('source_index')

            # Skip if already has raw breadcrumb
            if current_path and current_path.startswith('LII'):
                already_good_count += 1
                continue

            if not url:
                continue

            # Try cache first
            html = load_cached_html(url, cache_dir)

            if not html and refetch:
                # Rate limit: 0.5 second between requests
                time.sleep(0.5)
                html = fetch_and_cache_html(url, cache_dir, session)
                if html:
                    fetched_count += 1

            if not html:
                missing_cache_count += 1
                continue

            # Extract raw breadcrumb
            raw_breadcrumb = extract_raw_breadcrumb(html)
            if not raw_breadcrumb:
                no_breadcrumb_count += 1
                continue

            # Update the file
            if not dry_run:
                data['hierarchy_path'] = raw_breadcrumb
                with open(json_file, 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)

            if source_index is not None:
                updates_for_db.append((source_index, raw_breadcrumb))

            updated_count += 1

        except Exception as e:
            print(f"  Error processing {json_file.name}: {e}")
            continue

    print(f"\nResults:")
    print(f"  Updated: {updated_count}")
    print(f"  Already good: {already_good_count}")
    print(f"  Fetched from Cornell: {fetched_count}")
    print(f"  Missing cache (not fetched): {missing_cache_count}")
    print(f"  No breadcrumb found: {no_breadcrumb_count}")

    if dry_run:
        print("\n(Dry run - no changes written)")
    else:
        print(f"\nUpdates ready for database: {len(updates_for_db)}")

    return updates_for_db


def get_already_updated(state: str) -> set:
    """Get source_indices that already have correct hierarchy_path in DB."""
    conn = get_db_connection()
    if not conn:
        return set()

    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT source_index FROM regulatory_documents
                WHERE state = %s AND type = 'regulation'
                AND hierarchy_path LIKE 'LII > %%'
            """, (state,))
            rows = cur.fetchall()
            return {row[0] for row in rows if row[0] is not None}
    except Exception as e:
        print(f"  Error checking existing records: {e}")
        return set()
    finally:
        conn.close()


def update_database(updates: List[tuple], state: str):
    """
    Update hierarchy_path in database for the given state.
    Automatically resumes by skipping records already updated.

    Args:
        updates: List of (source_index, new_hierarchy_path) tuples
        state: 'NY' or 'NJ'
    """
    if not updates:
        print(f"No {state} updates to apply to database")
        return

    # Check which are already done
    print(f"\nChecking for already-updated {state} records...")
    already_done = get_already_updated(state)
    print(f"  Found {len(already_done)} records already updated in DB")

    # Filter to only updates that need to be done
    pending_updates = [(idx, path) for idx, path in updates if idx not in already_done]
    print(f"  {len(pending_updates)} records remaining to update")

    if not pending_updates:
        print(f"  All {state} records already up to date!")
        return

    print(f"\nUpdating {len(pending_updates)} {state} records in database...")

    conn = get_db_connection()
    if not conn:
        print("  Error: Could not connect to database")
        return

    try:
        with conn.cursor() as cur:
            # Update in batches
            batch_size = 100
            updated = 0

            for i in range(0, len(pending_updates), batch_size):
                batch = pending_updates[i:i + batch_size]

                for source_index, hierarchy_path in batch:
                    cur.execute("""
                        UPDATE regulatory_documents
                        SET hierarchy_path = %s
                        WHERE state = %s AND source_index = %s AND type = 'regulation'
                    """, (hierarchy_path, state, source_index))
                    updated += cur.rowcount

                conn.commit()

                if (i + batch_size) % 1000 == 0:
                    print(f"    Updated {min(i + batch_size, len(pending_updates))}/{len(pending_updates)}...")

        print(f"  Successfully updated {updated} {state} database records")

    except Exception as e:
        print(f"  Error updating database: {e}")
        print(f"  Progress was saved - run again to resume")
        try:
            conn.rollback()
        except:
            pass
    finally:
        try:
            conn.close()
        except:
            pass


# =============================================================================
# MAIN
# =============================================================================

def main():
    import argparse

    parser = argparse.ArgumentParser(description='Fix hierarchy_path to use raw breadcrumb')
    parser.add_argument('--dry-run', action='store_true', help='Preview changes without writing')
    parser.add_argument('--limit', type=int, help='Limit number of records to process (for testing)')
    parser.add_argument('--nj-only', action='store_true', help='Only fix NJ')
    parser.add_argument('--ny-only', action='store_true', help='Only fix NY')
    parser.add_argument('--refetch', action='store_true', help='Fetch from Cornell when cache is missing')
    parser.add_argument('--skip-db', action='store_true', help='Skip database update')
    parser.add_argument('--force-db', action='store_true', help='Push to DB even for already-fixed files')

    args = parser.parse_args()

    if args.dry_run:
        print("DRY RUN MODE - No changes will be written\n")

    nj_updates = []
    ny_updates = []

    # Fix NJ
    if not args.ny_only:
        nj_updates = fix_nj_hierarchy_paths(
            dry_run=args.dry_run,
            limit=args.limit,
            force_db=args.force_db
        ) or []

    # Fix NY
    if not args.nj_only:
        ny_updates = fix_ny_hierarchy_paths(
            dry_run=args.dry_run,
            limit=args.limit,
            refetch=args.refetch
        ) or []

    # Update database
    if not args.dry_run and not args.skip_db:
        if nj_updates:
            update_database(nj_updates, 'NJ')
        if ny_updates:
            update_database(ny_updates, 'NY')

    print("\nDone!")


if __name__ == "__main__":
    main()
