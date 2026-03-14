"""Compare volume estimates across prompt versions for a fixed set of records.

Reads record IDs from a Sonnet+web search validation CSV (ground truth),
re-runs them through Haiku with a new prompt, and outputs a 3-way comparison.

Usage:
    cd backend
    python3 -m scripts.compare_volume_prompts --dry-run
    python3 -m scripts.compare_volume_prompts --execute
    python3 -m scripts.compare_volume_prompts --execute --batch
"""

import argparse
import csv
import os

from lib.enrichment import EnrichmentRunner
from scripts.fines_shared import (
    VolumeEstimate,
    VOLUME_BUCKETS,
    VOLUME_ORDER,
    SYSTEM_PROMPT_V2,
    build_fines_prompt,
    fetch_fines_with_context,
)


def load_ground_truth(csv_path: str) -> dict:
    """Load Sonnet+web search results as ground truth."""
    truth = {}
    with open(csv_path) as f:
        for row in csv.DictReader(f):
            truth[int(row["id"])] = {
                "sonnet_estimate": row["sonnet_estimate"] or None,
                "sonnet_reasoning": row["sonnet_reasoning"],
                "sonnet_confidence": row["sonnet_confidence"],
                "sources_found": row["sources_found"],
                "haiku_v1_estimate": row["haiku_estimate"],
            }
    return truth


def fetch_records(record_ids: list[int]) -> list[dict]:
    """Fetch specific records by ID with full doc text."""
    placeholders = ",".join(str(int(rid)) for rid in record_ids)
    return fetch_fines_with_context(f"f.id IN ({placeholders})")


def print_comparison(ground_truth: dict, new_results: dict):
    """Print 3-way comparison table."""
    print(f"\n{'='*100}")
    print(f"3-WAY COMPARISON: Original Haiku (V1) vs New Haiku (V2) vs Sonnet+WebSearch (ground truth)")
    print(f"{'='*100}")

    v1_correct = 0
    v2_correct = 0
    v1_closer = 0
    v2_closer = 0
    total = 0
    by_bucket = {}

    for record_id, truth in ground_truth.items():
        sonnet = truth["sonnet_estimate"]
        v1 = truth["haiku_v1_estimate"]
        v2_data = new_results.get(record_id)
        v2 = v2_data["estimate"] if v2_data else None

        if not sonnet:
            continue

        total += 1
        s_ord = VOLUME_ORDER.get(sonnet, -1)
        v1_ord = VOLUME_ORDER.get(v1, -1)
        v2_ord = VOLUME_ORDER.get(v2, -1) if v2 else -1

        v1_match = (v1 == sonnet)
        v2_match = (v2 == sonnet)
        v1_dist = abs(v1_ord - s_ord)
        v2_dist = abs(v2_ord - s_ord) if v2 else 99

        if v1_match:
            v1_correct += 1
        if v2_match:
            v2_correct += 1
        if v2_dist < v1_dist:
            v2_closer += 1
        elif v1_dist < v2_dist:
            v1_closer += 1

        bucket = v1
        if bucket not in by_bucket:
            by_bucket[bucket] = {"v1_correct": 0, "v2_correct": 0, "total": 0}
        by_bucket[bucket]["total"] += 1
        if v1_match:
            by_bucket[bucket]["v1_correct"] += 1
        if v2_match:
            by_bucket[bucket]["v2_correct"] += 1

    pct = lambda n: f"{100*n/total:.0f}%" if total > 0 else "N/A"

    print(f"\n  Total records with Sonnet ground truth: {total}")
    print(f"\n  Exact match with Sonnet:")
    print(f"    V1 (original prompt): {v1_correct}/{total} ({pct(v1_correct)})")
    print(f"    V2 (improved prompt): {v2_correct}/{total} ({pct(v2_correct)})")
    print(f"\n  Closer to Sonnet (when not exact):")
    print(f"    V2 closer: {v2_closer}")
    print(f"    V1 closer: {v1_closer}")

    print(f"\n  By original bucket:")
    for bucket in VOLUME_BUCKETS:
        d = by_bucket.get(bucket, {"v1_correct": 0, "v2_correct": 0, "total": 0})
        if d["total"] == 0:
            continue
        v1p = f"{100*d['v1_correct']/d['total']:.0f}%"
        v2p = f"{100*d['v2_correct']/d['total']:.0f}%"
        print(f"    {bucket:20s}: V1={d['v1_correct']}/{d['total']} ({v1p})  "
              f"V2={d['v2_correct']}/{d['total']} ({v2p})")

    print(f"\n  Records where V2 changed from V1:")
    for record_id, truth in sorted(ground_truth.items()):
        sonnet = truth["sonnet_estimate"]
        v1 = truth["haiku_v1_estimate"]
        v2_data = new_results.get(record_id)
        v2 = v2_data["estimate"] if v2_data else None

        if v1 != v2 and sonnet:
            s_ord = VOLUME_ORDER.get(sonnet, -1)
            v1_ord = VOLUME_ORDER.get(v1, -1)
            v2_ord = VOLUME_ORDER.get(v2, -1) if v2 else -1
            v2_better = abs(v2_ord - s_ord) < abs(v1_ord - s_ord)
            marker = "+" if v2_better else ("=" if abs(v2_ord - s_ord) == abs(v1_ord - s_ord) else "-")
            print(f"    {marker} id={record_id}: V1={v1} -> V2={v2} (truth={sonnet})")


def write_comparison_csv(ground_truth: dict, new_results: dict, path: str):
    """Write 3-way comparison CSV."""
    rows = []
    for record_id, truth in sorted(ground_truth.items()):
        v2_data = new_results.get(record_id, {})
        rows.append({
            "id": record_id,
            "haiku_v1": truth["haiku_v1_estimate"],
            "haiku_v2": v2_data.get("estimate"),
            "haiku_v2_reasoning": v2_data.get("reasoning", ""),
            "sonnet_websearch": truth["sonnet_estimate"],
            "sonnet_reasoning": truth["sonnet_reasoning"],
            "sonnet_confidence": truth["sonnet_confidence"],
            "sources_found": truth["sources_found"],
        })

    with open(path, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    print(f"\nComparison CSV written to {path}")


def main():
    parser = argparse.ArgumentParser(
        description="Compare volume estimates: V1 prompt vs V2 prompt vs Sonnet+web search"
    )
    parser.add_argument("--execute", action="store_true", help="Run Haiku with V2 prompt")
    parser.add_argument("--dry-run", action="store_true", help="Preview only")
    parser.add_argument("--batch", action="store_true", help="Use batch API")
    parser.add_argument(
        "--ground-truth", type=str,
        default="volume_validation_20260313_095418.csv",
        help="CSV from sample_volume_validation.py with Sonnet+web search results",
    )
    args = parser.parse_args()

    if not os.path.exists(args.ground_truth):
        print(f"Ground truth CSV not found: {args.ground_truth}")
        return

    print(f"Loading ground truth from {args.ground_truth}...")
    ground_truth = load_ground_truth(args.ground_truth)
    record_ids = list(ground_truth.keys())
    print(f"  {len(record_ids)} records")

    print(f"Fetching records from DB...")
    rows = fetch_records(record_ids)
    print(f"  {len(rows)} records fetched")

    if not args.execute:
        print(f"\nDRY RUN — showing first 3 prompts with V2 system prompt:\n")
        print(f"SYSTEM PROMPT (V2):\n{SYSTEM_PROMPT_V2[:500]}...\n")
        for row in rows[:3]:
            prompt = build_fines_prompt(row, include_activity_category=True)
            print(f"  --- id={row['id']} [{row['penalty_type']}] ---")
            print(f"  {prompt[:300]}")
            print()
        print(f"Run with --execute to classify with V2 prompt.")
        return

    new_results = {}

    def collect_result(row_id, parsed):
        new_results[row_id] = {
            "estimate": parsed.estimated_annual_payers,
            "reasoning": parsed.volume_reasoning,
        }
        return (row_id, parsed.estimated_annual_payers, parsed.volume_reasoning)

    def noop_write(results):
        print(f"  (Skipping DB write — comparison only)")
        return len(results)

    runner = EnrichmentRunner(
        name="volume_v2_compare",
        response_model=VolumeEstimate,
        system_prompt=SYSTEM_PROMPT_V2,
        build_prompt=lambda record: build_fines_prompt(record, include_activity_category=True),
        fetch_rows=lambda limit: rows[:limit] if limit > 0 else rows,
        write_result=collect_result,
        write_batch=noop_write,
        max_tokens=256,
    )
    runner.run(execute=True, batch=args.batch)

    print_comparison(ground_truth, new_results)
    write_comparison_csv(ground_truth, new_results, "volume_comparison_v1_v2.csv")


if __name__ == "__main__":
    main()
