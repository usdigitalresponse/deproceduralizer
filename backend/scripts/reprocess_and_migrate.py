#!/usr/bin/env python3
"""
Reprocess cached HTML to clean data and migrate to PostgreSQL.

This script:
1. Runs step 2 (process cache to clean JSON) for NJ and NY
2. Runs step 3 (create individual files) for NJ and NY
3. Runs migration to PostgreSQL for both states

Usage:
    python reprocess_and_migrate.py
    python reprocess_and_migrate.py --nj-only
    python reprocess_and_migrate.py --ny-only
    python reprocess_and_migrate.py --skip-migrate
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))


def reprocess_nj():
    """Run steps 2-3 for NJ regulations."""
    from scripts.nj_regulations_scraper import FullPipeline

    print("\n" + "=" * 60)
    print("REPROCESSING NJ REGULATIONS")
    print("=" * 60)

    pipeline = FullPipeline()

    # Step 2: Process cache to clean data
    clean_data = pipeline.step2_process_cache_to_clean_data()
    if not clean_data:
        print("NJ step 2 failed")
        return False

    # Step 3: Create individual files
    success = pipeline.step3_create_individual_files()
    if not success:
        print("NJ step 3 failed")
        return False

    print(f"\n✓ NJ reprocessing complete: {len(clean_data)} regulations")
    return True


def reprocess_ny():
    """Run steps 2-3 for NY regulations."""
    from scripts.ny_regulations_scraper import FullPipeline

    print("\n" + "=" * 60)
    print("REPROCESSING NY REGULATIONS")
    print("=" * 60)

    pipeline = FullPipeline()

    # Step 2: Process cache to clean data
    clean_data = pipeline.step2_process_cache_to_clean_data()
    if not clean_data:
        print("NY step 2 failed")
        return False

    # Step 3: Create individual files
    success = pipeline.step3_create_individual_files()
    if not success:
        print("NY step 3 failed")
        return False

    print(f"\n✓ NY reprocessing complete: {len(clean_data)} regulations")
    return True


def migrate_both():
    """Run migration for both states."""
    from scripts.migrate_regulations import migrate_state

    print("\n" + "=" * 60)
    print("MIGRATING TO POSTGRESQL")
    print("=" * 60)

    migrate_state("NJ")
    migrate_state("NY")

    print("\n✓ Migration complete!")


def main():
    parser = argparse.ArgumentParser(description='Reprocess and migrate regulations')
    parser.add_argument('--nj-only', action='store_true', help='Only process NJ')
    parser.add_argument('--ny-only', action='store_true', help='Only process NY')
    parser.add_argument('--skip-migrate', action='store_true', help='Skip PostgreSQL migration')

    args = parser.parse_args()

    # Determine which states to process
    do_nj = not args.ny_only
    do_ny = not args.nj_only

    # Step 2-3: Reprocess
    if do_nj:
        if not reprocess_nj():
            print("NJ reprocessing failed!")
            return

    if do_ny:
        if not reprocess_ny():
            print("NY reprocessing failed!")
            return

    # Migration
    if not args.skip_migrate:
        from scripts.migrate_regulations import migrate_state

        print("\n" + "=" * 60)
        print("MIGRATING TO POSTGRESQL")
        print("=" * 60)

        if do_nj:
            migrate_state("NJ")
        if do_ny:
            migrate_state("NY")

        print("\n✓ All done!")
    else:
        print("\n✓ Reprocessing done (migration skipped)")


if __name__ == "__main__":
    main()
