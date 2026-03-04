"""
Backfill prompt_templates from historical batch request files.

Reads requests.json / requests.jsonl files from the research pipeline batches
directory, stores deduplicated prompt templates in the DB, and links them to
compliance_issue_analyses rows via tier*_prompt_id FKs.

Usage:
    cd backend
    python3 -m scripts.backfill_prompt_templates [--dry-run]
"""

import argparse
import json
import sys
from pathlib import Path

# Ensure backend/ is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env", override=False)

from lib.db import get_db_connection
from lib.prompt_store import store_prompt_batch


BATCHES_DIR = Path(__file__).resolve().parent / "research_pipeline" / "batches"


def parse_custom_id(custom_id: str) -> tuple[str, int, str]:
    """Parse custom_id into (issue_type, document_id, source_type)."""
    source_type = "regulation"
    id_str = custom_id
    if custom_id.startswith("g_"):
        source_type = "guidance"
        id_str = custom_id[2:]
    parts = id_str.rsplit("_", 1)
    if len(parts) != 2:
        raise ValueError(f"Invalid custom_id: {custom_id}")
    return parts[0], int(parts[1]), source_type


def load_requests_from_dir(batch_dir: Path) -> list[dict]:
    """Load requests from a batch directory (supports .json and .jsonl)."""
    requests = []

    json_file = batch_dir / "requests.json"
    jsonl_file = batch_dir / "requests.jsonl"

    if json_file.exists():
        with open(json_file) as f:
            data = json.load(f)
        # Dict keyed by custom_id
        if isinstance(data, dict):
            for cid, req in data.items():
                if isinstance(req, dict) and "params" in req:
                    requests.append(req)
        elif isinstance(data, list):
            requests = data
    elif jsonl_file.exists():
        with open(jsonl_file) as f:
            for line in f:
                line = line.strip()
                if line:
                    requests.append(json.loads(line))

    return requests


def get_tier_from_dir_name(dir_name: str) -> int | None:
    """Extract tier number from batch directory name."""
    for part in dir_name.split("_"):
        if part.startswith("tier") and len(part) == 5 and part[-1].isdigit():
            return int(part[-1])
    return None


def main():
    parser = argparse.ArgumentParser(description="Backfill prompt_templates from batch files")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be done without DB writes")
    args = parser.parse_args()

    if not BATCHES_DIR.exists():
        print(f"Batches directory not found: {BATCHES_DIR}")
        return

    batch_dirs = sorted([d for d in BATCHES_DIR.iterdir() if d.is_dir()])
    print(f"Found {len(batch_dirs)} batch directories in {BATCHES_DIR}")

    conn = None if args.dry_run else get_db_connection()

    total_requests = 0
    total_templates_stored = 0
    total_cia_updated = 0
    total_cia_not_found = 0
    errors = 0

    for batch_dir in batch_dirs:
        dir_name = batch_dir.name
        tier = get_tier_from_dir_name(dir_name)
        if tier is None:
            print(f"  Skipping {dir_name} (no tier found in name)")
            continue

        # Load batch_info for metadata
        info_file = batch_dir / "batch_info.json"
        batch_api_id = None
        if info_file.exists():
            with open(info_file) as f:
                info = json.load(f)
                batch_api_id = info.get("batch_api_id")

        requests = load_requests_from_dir(batch_dir)
        if not requests:
            continue

        total_requests += len(requests)
        prompt_id_attr = f"tier{tier}_prompt_id"

        if args.dry_run:
            print(f"  {dir_name}: {len(requests)} requests (tier {tier})")
            continue

        # Store prompt templates
        try:
            prompt_ids = store_prompt_batch(requests, pipeline="research", tier=tier, conn=conn)
            unique_templates = len(set(prompt_ids.values()))
            total_templates_stored += unique_templates

            # Update CIA rows
            updated = 0
            not_found = 0
            with conn.cursor() as cur:
                for custom_id, prompt_id in prompt_ids.items():
                    try:
                        issue_type, doc_id, source_type = parse_custom_id(custom_id)
                    except ValueError:
                        errors += 1
                        continue

                    id_col = "guidance_document_id" if source_type == "guidance" else "document_id"
                    cur.execute(f"""
                        UPDATE compliance_issue_analyses
                        SET {prompt_id_attr} = %s
                        WHERE {id_col} = %s AND issue_type = %s AND {prompt_id_attr} IS NULL
                    """, (prompt_id, doc_id, issue_type))

                    if cur.rowcount > 0:
                        updated += 1
                    else:
                        not_found += 1

                conn.commit()

            total_cia_updated += updated
            total_cia_not_found += not_found
            print(f"  {dir_name}: {len(requests)} req → {unique_templates} templates, {updated} CIA updated, {not_found} not matched")

        except Exception as e:
            print(f"  {dir_name}: ERROR: {e}")
            errors += 1
            conn.rollback()

    if conn:
        conn.close()

    print(f"\n{'='*60}")
    print(f"BACKFILL SUMMARY")
    print(f"{'='*60}")
    print(f"Total batch requests processed: {total_requests}")
    print(f"Unique prompt templates stored:  {total_templates_stored}")
    print(f"CIA rows updated:                {total_cia_updated}")
    print(f"CIA rows not matched:            {total_cia_not_found}")
    print(f"Errors:                          {errors}")


if __name__ == "__main__":
    main()
