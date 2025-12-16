#!/usr/bin/env python3
"""
Overnight refresh script for New York regulations.
Runs the complete pipeline:
1. Scrape NY regulations (ny_regulations_scraper.py)
2. Migrate/update individual regulations to database
3. Populate parent_id relationships
4. Refresh all hierarchy stats

This script updates existing data where applicable (via ON CONFLICT)
rather than dropping and recreating the database.

Uses caffeinate to prevent system sleep during the run.

Usage:
    python overnight_refresh_ny.py
    python overnight_refresh_ny.py --test    # Test mode (100 pages)
    python overnight_refresh_ny.py --small   # Small run (1000 pages)
"""

import sys
import time
import subprocess
import os
from pathlib import Path
from dotenv import load_dotenv

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))
from config import PROJECT_ROOT
from shared_utils import get_db_connection

# Import functions from other scripts
from ny_regulations_scraper import main as run_ny_scraper
from migrate_to_postgres import (
    migrate_all_individual_regulations,
    populate_parent_ids,
)
from refresh_hierarchy_stats import refresh_all_stats

# Load .env
load_dotenv(PROJECT_ROOT / '.env')


def run_pipeline(scraper_args=None):
    """Run the complete overnight refresh pipeline for NY."""
    state = "NY"

    print("=" * 60)
    print("Starting overnight refresh for NEW YORK")
    print("=" * 60)

    pipeline_start = time.time()

    try:
        # Phase 0: Scrape NY regulations
        print("\nPhase 0: Scraping NY regulations")
        print("-" * 60)
        # Monkey-patch sys.argv for the scraper function
        original_argv = sys.argv
        try:
            if scraper_args:
                sys.argv = [sys.argv[0]] + scraper_args + ['-y']  # Add -y to skip confirmation
            else:
                sys.argv = [sys.argv[0], '-y']  # Auto-confirm
            run_ny_scraper()
        finally:
            sys.argv = original_argv

        # Phase 1: Migrate/update individual regulations
        print("\nPhase 1: Migrating/updating individual regulations")
        print("-" * 60)
        migrate_all_individual_regulations(state=state)

        # Phase 2: Populate parent_id relationships
        print("\nPhase 2: Populating parent_id relationships")
        print("-" * 60)
        populate_parent_ids(state=state)

        # Phase 3: Refresh all hierarchy stats
        print("\nPhase 3: Refreshing hierarchy stats")
        print("-" * 60)
        with get_db_connection() as conn:
            refresh_all_stats(conn, state)

        # Summary
        total_elapsed = time.time() - pipeline_start
        print("\n" + "=" * 60)
        print(f"✓ Pipeline complete in {total_elapsed:.1f}s")
        print("=" * 60)

    except Exception as e:
        print(f"\n✗ Pipeline failed: {e}")
        print("=" * 60)
        sys.exit(1)


def main():
    """Parse args, ensure caffeinate is running, then execute pipeline."""
    import argparse

    parser = argparse.ArgumentParser(description='Overnight NY regulations refresh pipeline')
    parser.add_argument('--test', action='store_true', help='Test mode: limit to 100 pages')
    parser.add_argument('--small', action='store_true', help='Small run: limit to 1000 pages')
    parser.add_argument('--no-caffeinate', action='store_true', help='Skip caffeinate (for testing)')

    args = parser.parse_args()

    # Build scraper args based on flags
    scraper_args = []
    if args.test:
        scraper_args.append('--test')
    elif args.small:
        scraper_args.append('--small')

    # Check if already running under caffeinate
    if os.environ.get('CAFFEINATE_RUNNING') == '1' or args.no_caffeinate:
        run_pipeline(scraper_args=scraper_args if scraper_args else None)
        return

    # Re-execute under caffeinate
    env = os.environ.copy()
    env['CAFFEINATE_RUNNING'] = '1'

    print("Launching under caffeinate to prevent sleep...\n")
    cmd = ['caffeinate', '-i', sys.executable, __file__] + sys.argv[1:]
    result = subprocess.run(cmd, env=env)
    sys.exit(result.returncode)


if __name__ == "__main__":
    main()
