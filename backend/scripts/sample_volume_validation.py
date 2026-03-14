"""Sample fines records and compare Haiku vs Sonnet+web search volume estimates.

Two sampling modes:
- Random per-bucket: stratified sample across volume buckets (default)
- Impact-scored: top N records by amount x volume midpoint

Usage:
    cd backend
    python3 -m scripts.sample_volume_validation --dry-run
    python3 -m scripts.sample_volume_validation --execute --per-bucket 10
    python3 -m scripts.sample_volume_validation --impact-top 50 --execute
"""

import argparse
import asyncio
import csv
import re
import time
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

from lib.db import get_db_connection
from lib.llm import get_async_anthropic_client
from lib.stats import format_time
from scripts.fines_shared import VolumeMagnitude, VOLUME_BUCKETS, VOLUME_ORDER
from scripts.research_pipeline.tiers.web_search import (
    get_web_search_tool,
    extract_web_search_response,
)


class VolumeReestimate(BaseModel):
    """Sonnet+web search re-estimate of annual payer volume."""
    estimated_annual_payers: Optional[VolumeMagnitude] = Field(
        None,
        description="Order-of-magnitude estimate of annual payers in NY state.",
    )
    volume_reasoning: str = Field(
        description="1-2 sentences explaining the estimate, citing specific data sources found.",
    )
    confidence: Literal["low", "medium", "high"] = Field(
        description="How confident are you in this estimate based on the data found?",
    )
    sources_found: bool = Field(
        description="Did web search find specific data (licensee counts, registrant numbers, etc.)?",
    )


SYSTEM_PROMPT = """You are validating volume estimates for fines/fees/penalties in New York State regulations.

For each record, you will receive:
- The penalty/fee details (type, amount, who pays, agency, violation)
- The CURRENT volume estimate from a prior model run
- Regulatory context

Your job: Use web search to find real data on how many entities actually pay this
specific charge per year in New York State. Then provide your own estimate.

Volume scale:
- "tens" = ~10-99/year
- "hundreds" = ~100-999/year
- "thousands" = ~1,000-9,999/year
- "ten_thousands" = ~10,000-99,999/year
- "hundred_thousands" = ~100,000+/year

Key guidance:
- For FEES (application, renewal, licensing): estimate how many actually file and pay annually
- For FINES/PENALTIES: estimate how many are actually fined per year — NOT the total
  regulated population, just those who incur the penalty
- Search for the specific agency's data: licensee counts, annual reports, enforcement stats
- If you can't find specific data, say so — don't guess"""


def fetch_sample(per_bucket: int = 20) -> list[dict]:
    """Fetch a random sample of records from each volume bucket."""
    conn = get_db_connection()
    if not conn:
        raise ConnectionError("Could not connect to database")

    try:
        cur = conn.cursor()
        all_rows = []
        for bucket in VOLUME_BUCKETS:
            cur.execute("""
                SELECT f.id, f.who_pays, f.violation_description, f.penalty_type,
                       f.responsible_agency, f.amount, f.amount_min, f.amount_max,
                       f.per_unit, f.context, f.activity_category,
                       f.estimated_annual_payers, f.justification,
                       rd.nycrr_part_name, rd.nycrr_title_name, rd.applies_to,
                       rd.summary as doc_summary
                FROM fines_fees_penalties f
                LEFT JOIN regulatory_documents rd ON f.document_id = rd.id
                WHERE f.estimated_annual_payers = %s
                ORDER BY RANDOM()
                LIMIT %s
            """, (bucket, per_bucket))
            columns = [desc[0] for desc in cur.description]
            rows = [dict(zip(columns, row)) for row in cur.fetchall()]
            all_rows.extend(rows)
            print(f"  {bucket}: sampled {len(rows)}")

        return all_rows
    finally:
        conn.close()


VOLUME_MIDPOINTS = {
    "tens": 50, "hundreds": 500, "thousands": 5000,
    "ten_thousands": 50000, "hundred_thousands": 500000,
}


def parse_dollar_amount(amt_str: str) -> float | None:
    """Extract the first dollar figure from an amount string like '$1,000' or '$10 per annum'."""
    if not amt_str:
        return None
    m = re.search(r"\$?([\d,]+(?:\.\d+)?)", amt_str)
    if m:
        try:
            return float(m.group(1).replace(",", ""))
        except ValueError:
            return None
    return None


def fetch_by_impact(top_n: int = 50) -> list[dict]:
    """Fetch the top N records by impact score (amount x volume midpoint)."""
    conn = get_db_connection()
    if not conn:
        raise ConnectionError("Could not connect to database")

    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT f.id, f.who_pays, f.violation_description, f.penalty_type,
                   f.responsible_agency, f.amount, f.amount_min, f.amount_max,
                   f.per_unit, f.context, f.activity_category,
                   f.estimated_annual_payers, f.justification,
                   rd.nycrr_part_name, rd.nycrr_title_name, rd.applies_to,
                   rd.summary as doc_summary
            FROM fines_fees_penalties f
            LEFT JOIN regulatory_documents rd ON f.document_id = rd.id
            WHERE f.estimated_annual_payers IS NOT NULL
              AND f.amount IS NOT NULL
        """)
        columns = [desc[0] for desc in cur.description]
        all_rows = [dict(zip(columns, row)) for row in cur.fetchall()]
    finally:
        conn.close()

    # Score and sort
    scored = []
    for row in all_rows:
        vol = row["estimated_annual_payers"]
        midpoint = VOLUME_MIDPOINTS.get(vol)
        if not midpoint:
            continue
        dollar = None
        if row.get("amount_max"):
            dollar = parse_dollar_amount(str(row["amount_max"]))
        if not dollar:
            dollar = parse_dollar_amount(row.get("amount") or "")
        if not dollar and row.get("amount_min"):
            dollar = parse_dollar_amount(str(row["amount_min"]))
        if dollar and dollar > 0:
            row["_impact_score"] = dollar * midpoint
            scored.append(row)

    scored.sort(key=lambda r: -r["_impact_score"])
    selected = scored[:top_n]

    # Print summary
    for r in selected:
        dollar = r["_impact_score"] / VOLUME_MIDPOINTS[r["estimated_annual_payers"]]
        print(f"  id={r['id']:>6}  ${dollar:>12,.0f} x {r['estimated_annual_payers']:>18s} = {r['_impact_score']:>15,.0f}  {(r.get('who_pays') or '')[:40]}")

    return selected


def build_prompt(record: dict) -> str:
    """Build prompt for volume re-estimation with current estimate context."""
    parts = []
    parts.append(f"CURRENT ESTIMATE: {record.get('estimated_annual_payers')}")
    parts.append(f"CURRENT REASONING: {record.get('justification', 'none')}")
    parts.append("")

    if record.get('penalty_type'):
        parts.append(f"penalty_type: {record['penalty_type']}")
    if record.get('amount'):
        parts.append(f"amount: {record['amount']}")
    if record.get('per_unit'):
        parts.append(f"per_unit: {record['per_unit']}")
    if record.get('who_pays'):
        parts.append(f"who_pays: {record['who_pays'][:100]}")
    if record.get('responsible_agency'):
        parts.append(f"responsible_agency: {record['responsible_agency']}")
    if record.get('violation_description'):
        parts.append(f"violation_description: {record['violation_description'][:300]}")
    if record.get('activity_category'):
        parts.append(f"activity_category: {record['activity_category']}")
    if record.get('nycrr_part_name'):
        parts.append(f"regulation_part: {record['nycrr_part_name']}")
    if record.get('nycrr_title_name'):
        parts.append(f"regulation_agency: {record['nycrr_title_name']}")
    if record.get('applies_to'):
        applies = record['applies_to']
        if isinstance(applies, list):
            applies = ', '.join(applies)
        parts.append(f"applies_to: {applies}")
    if record.get('doc_summary'):
        parts.append(f"doc_summary: {record['doc_summary'][:300]}")

    ctx = (record.get('context') or '')[:500]
    if ctx:
        parts.append(f"context: {ctx}")

    return "\n".join(parts)


async def run_web_search_estimate(client, record: dict) -> dict:
    """Run a single Sonnet+web search re-estimation with multi-turn loop.

    Lets Sonnet do web searches first, then submit its estimate via tool_use.
    """
    prompt = build_prompt(record)
    web_tool = get_web_search_tool("NY", max_uses=3)
    tools = [
        web_tool,
        {
            "name": "submit_estimate",
            "description": (VolumeReestimate.__doc__ or "")
                + "\n\nCall this tool AFTER completing your web searches to submit your final estimate.",
            "input_schema": VolumeReestimate.model_json_schema(),
        },
    ]

    messages = [{"role": "user", "content": prompt
        + "\n\nFirst search the web for relevant data, then call submit_estimate with your findings."}]
    all_queries = []
    total_input = 0
    total_output = 0
    parsed = None

    # Multi-turn: let model search, then submit
    for turn in range(5):  # max 5 turns to avoid runaway
        response = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            system=[{"type": "text", "text": SYSTEM_PROMPT}],
            tools=tools,
            messages=messages,
        )

        # Accumulate usage
        resp_usage = getattr(response, 'usage', None)
        if resp_usage:
            total_input += getattr(resp_usage, 'input_tokens', 0)
            total_output += getattr(resp_usage, 'output_tokens', 0)

        # Collect web search queries from this turn
        web_response = extract_web_search_response(response)
        all_queries.extend(q.query for q in web_response.queries)

        # Check if model called submit_estimate
        for block in response.content:
            if getattr(block, 'type', None) == 'tool_use' and block.name == 'submit_estimate':
                parsed = VolumeReestimate.model_validate(block.input)
                break

        if parsed or response.stop_reason == 'end_turn':
            break

        # Continue conversation: add assistant response + tool results
        messages.append({"role": "assistant", "content": response.content})
        tool_results = []
        for block in response.content:
            if getattr(block, 'type', None) == 'tool_use' and block.name != 'submit_estimate':
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": "Search completed. Now call submit_estimate with your findings.",
                })
        if tool_results:
            messages.append({"role": "user", "content": tool_results})

    return {
        "id": record["id"],
        "penalty_type": record.get("penalty_type"),
        "amount": record.get("amount"),
        "who_pays": (record.get("who_pays") or "")[:60],
        "responsible_agency": record.get("responsible_agency"),
        "activity_category": record.get("activity_category"),
        "haiku_estimate": record["estimated_annual_payers"],
        "haiku_reasoning": record.get("justification", ""),
        "sonnet_estimate": parsed.estimated_annual_payers if parsed else None,
        "sonnet_reasoning": parsed.volume_reasoning if parsed else "",
        "sonnet_confidence": parsed.confidence if parsed else None,
        "sources_found": parsed.sources_found if parsed else None,
        "changed": (parsed.estimated_annual_payers != record["estimated_annual_payers"]) if parsed else None,
        "search_queries": "; ".join(all_queries),
        "input_tokens": total_input,
        "output_tokens": total_output,
    }


async def run_all(rows: list[dict]) -> list[dict]:
    """Run web search estimates for all sampled records."""
    client = get_async_anthropic_client()
    results = []
    total = len(rows)
    start = time.time()

    for i, row in enumerate(rows):
        elapsed = time.time() - start
        if i > 0:
            rate = i / elapsed
            eta = format_time((total - i) / rate) if rate > 0 else "..."
        else:
            eta = "..."

        bucket = row["estimated_annual_payers"]
        label = (row.get("violation_description") or row.get("penalty_type") or "")[:50]
        print(f"  [{i+1}/{total}] id={row['id']} [{bucket}] {label}... ", end="", flush=True)

        try:
            result = await run_web_search_estimate(client, row)
            changed = "CHANGED" if result["changed"] else "same"
            print(f"→ {result['sonnet_estimate']} ({changed}) ETA: {eta}")
            results.append(result)
        except Exception as e:
            print(f"→ ERROR: {str(e)[:80]}")

    return results


def write_csv(results: list[dict], path: str):
    """Write comparison results to CSV."""
    if not results:
        return
    fieldnames = list(results[0].keys())
    with open(path, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(results)
    print(f"\nResults written to {path}")


def print_summary(results: list[dict]):
    """Print comparison summary."""
    total = len(results)
    changed = sum(1 for r in results if r.get("changed"))
    sources = sum(1 for r in results if r.get("sources_found"))

    print(f"\n{'='*70}")
    print(f"COMPARISON SUMMARY: {total} records")
    print(f"{'='*70}")
    pct = lambda n: f"{100*n/total:.0f}%" if total > 0 else "N/A"
    print(f"  Changed estimate: {changed}/{total} ({pct(changed)})")
    print(f"  Found real sources: {sources}/{total} ({pct(sources)})")

    # Direction of changes by bucket
    print(f"\n  Changes by original bucket:")
    for bucket in VOLUME_BUCKETS:
        bucket_results = [r for r in results if r["haiku_estimate"] == bucket]
        if not bucket_results:
            continue
        bucket_changed = sum(1 for r in bucket_results if r.get("changed"))
        up = sum(1 for r in bucket_results if r.get("changed") and r.get("sonnet_estimate")
                 and VOLUME_ORDER.get(r["sonnet_estimate"], -1) > VOLUME_ORDER.get(r["haiku_estimate"], -1))
        down = sum(1 for r in bucket_results if r.get("changed") and r.get("sonnet_estimate")
                   and VOLUME_ORDER.get(r["sonnet_estimate"], -1) < VOLUME_ORDER.get(r["haiku_estimate"], -1))
        print(f"    {bucket:20s}: {bucket_changed}/{len(bucket_results)} changed "
              f"(↑{up} ↓{down})")

    # Cost
    total_input = sum(r.get("input_tokens", 0) for r in results)
    total_output = sum(r.get("output_tokens", 0) for r in results)
    # Sonnet pricing: $3/1M input, $15/1M output
    cost = (total_input * 3 + total_output * 15) / 1_000_000
    print(f"\n  Total cost: ${cost:.2f} ({total_input:,} input + {total_output:,} output tokens)")


def main():
    parser = argparse.ArgumentParser(
        description="Sample volume validation: Haiku vs Sonnet+web search"
    )
    parser.add_argument("--execute", action="store_true", help="Run Sonnet+web search")
    parser.add_argument("--dry-run", action="store_true", help="Preview sample only")
    parser.add_argument("--per-bucket", type=int, default=20, help="Records per volume bucket")
    parser.add_argument("--impact-top", type=int, default=0, help="Select top N records by impact score (amount x volume) instead of random sampling")
    args = parser.parse_args()

    if args.impact_top > 0:
        print(f"Selecting top {args.impact_top} records by impact score (amount x volume)...")
        rows = fetch_by_impact(args.impact_top)
    else:
        print(f"Sampling {args.per_bucket} records from each of {len(VOLUME_BUCKETS)} volume buckets...")
        rows = fetch_sample(args.per_bucket)
    print(f"  Total: {len(rows)} records\n")

    if not args.execute:
        print("DRY RUN — showing sample:\n")
        for bucket in VOLUME_BUCKETS:
            bucket_rows = [r for r in rows if r["estimated_annual_payers"] == bucket]
            print(f"  {bucket} ({len(bucket_rows)} records):")
            for r in bucket_rows[:3]:
                desc = (r.get("violation_description") or r.get("penalty_type") or "")[:80]
                print(f"    id={r['id']} | {r.get('activity_category')} | {desc}")
            if len(bucket_rows) > 3:
                print(f"    ... and {len(bucket_rows)-3} more")
            print()
        print("Run with --execute to call Sonnet+web search.")
        return

    results = asyncio.run(run_all(rows))

    # Write CSV
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    csv_path = f"volume_validation_{timestamp}.csv"
    write_csv(results, csv_path)

    print_summary(results)


if __name__ == "__main__":
    main()
