#!/usr/bin/env python3
"""Sample ~50 guidance docs for audience classification quality check.

Runs realtime (not batch) for fast feedback. Outputs results as a table
for posting to GitHub issue #281.

Usage:
    cd backend
    python3 -m scripts.guidance_pipeline.sample_audience [--limit 50]
"""

import argparse
import json
import sys
from typing import Optional

from lib.db import get_db_connection
from lib.llm import get_anthropic_client, call_llm_parse
from .summarize import (
    GuidanceSummaryResponse,
    SYSTEM_PROMPT,
    _build_user_prompt,
)
from scripts.research_pipeline.context.guidance_context import (
    fetch_cited_document_summaries,
    build_guidance_batch_context,
)

MODEL = "claude-haiku-4-5-20251001"
ESCALATION_MODEL = "claude-sonnet-4-5-20241022"


def fetch_diverse_sample(limit: int = 50) -> list[dict]:
    """Fetch a diverse sample across agencies and doc types."""
    conn = get_db_connection()
    if not conn:
        raise ConnectionError("Could not connect to database")

    try:
        cur = conn.cursor()
        # Get a stratified sample: pick from different agencies/doc_types
        cur.execute("""
            WITH ranked AS (
                SELECT id, canonical_ref, title, agency, doc_type, domain,
                       date_published, distribution_to, policy_category, content,
                       ROW_NUMBER() OVER (PARTITION BY agency, doc_type ORDER BY random()) as rn
                FROM guidance_documents
                WHERE content IS NOT NULL
                  AND LENGTH(content) > 100
                  AND COALESCE(policy_category, '') NOT IN ('data_dump', 'non_policy')
                  AND COALESCE(is_attachment, false) = false
            )
            SELECT id, canonical_ref, title, agency, doc_type, domain,
                   date_published, distribution_to, policy_category, content
            FROM ranked
            WHERE rn <= 3
            ORDER BY random()
            LIMIT %s
        """, (limit,))

        docs = []
        for row in cur.fetchall():
            docs.append({
                "id": row[0],
                "canonical_ref": row[1],
                "title": row[2],
                "agency": row[3],
                "doc_type": row[4],
                "domain": row[5],
                "date_published": str(row[6]) if row[6] else None,
                "distribution_to": row[7],
                "policy_category": row[8],
                "content": row[9],
            })
        return docs
    finally:
        conn.close()


def classify_doc(client, doc: dict, cited_context: str) -> Optional[dict]:
    """Run realtime classification with model escalation on validation failure.

    Tries Haiku first (3 retries). If all fail validation, escalates to Sonnet
    for one attempt.
    """
    user_prompt = _build_user_prompt(doc, cited_context)

    # Truncate to avoid token limits on Haiku
    if len(user_prompt) > 40_000:
        user_prompt = user_prompt[:40_000] + "\n\n[... truncated ...]"

    parsed = call_llm_parse(
        client=client,
        prompt=user_prompt,
        response_format=GuidanceSummaryResponse,
        model=MODEL,
        system=SYSTEM_PROMPT,
        max_tokens=64000,
    )

    if parsed is not None:
        return parsed.model_dump()

    # Escalate to Sonnet on Haiku failure
    print(f"      ↑ Escalating doc {doc['id']} to {ESCALATION_MODEL}")
    parsed = call_llm_parse(
        client=client,
        prompt=user_prompt,
        response_format=GuidanceSummaryResponse,
        model=ESCALATION_MODEL,
        system=SYSTEM_PROMPT,
        max_tokens=64000,
        max_retries=1,
    )

    if parsed is not None:
        result = parsed.model_dump()
        result["_escalated"] = True
        return result
    return None


def main():
    parser = argparse.ArgumentParser(description="Sample audience classification")
    parser.add_argument("--limit", type=int, default=50)
    parser.add_argument("--json-output", type=str, help="Write raw JSON results to file")
    args = parser.parse_args()

    print(f"Fetching {args.limit} diverse guidance docs...")
    docs = fetch_diverse_sample(args.limit)
    print(f"Got {len(docs)} docs across {len(set(d['agency'] for d in docs))} agencies")

    # Fetch cited regulation summaries
    doc_ids = [d["id"] for d in docs]
    cited_summaries = fetch_cited_document_summaries(doc_ids)

    client = get_anthropic_client()
    results = []
    errors = 0

    for i, doc in enumerate(docs):
        doc_id = doc["id"]
        cited = cited_summaries.get(doc_id, [])
        cited_context = build_guidance_batch_context(doc_id, cited)

        try:
            result = classify_doc(client, doc, cited_context)
            if result is None:
                errors += 1
                print(f"  [{i+1}/{len(docs)}] FAILED doc {doc_id}")
                continue
            result["_doc_id"] = doc_id
            result["_agency"] = doc["agency"]
            result["_doc_type"] = doc["doc_type"]
            result["_title"] = doc["title"]
            results.append(result)

            direction = result.get("audience_direction", "?")
            expertise = result.get("audience_expertise", "?")
            audience = result.get("target_audience", [])
            explanation = result.get("audience_explanation", "")[:80]

            print(f"  [{i+1}/{len(docs)}] {doc['agency']}/{doc['doc_type']} id={doc_id}")
            print(f"    direction={direction} expertise={expertise} audience={audience}")
            print(f"    {explanation}")

        except Exception as e:
            errors += 1
            print(f"  [{i+1}/{len(docs)}] ERROR doc {doc_id}: {e}")

    # Save raw JSON if requested
    if args.json_output:
        with open(args.json_output, "w") as f:
            json.dump(results, f, indent=2)
        print(f"\nRaw JSON saved to {args.json_output}")

    # Print summary table
    escalated = sum(1 for r in results if r.get("_escalated"))
    print(f"\n{'='*80}")
    print(f"RESULTS: {len(results)} classified, {errors} errors, {escalated} escalated to Sonnet")
    print(f"{'='*80}")

    # Direction distribution
    print("\n## Audience Direction")
    from collections import Counter
    directions = Counter(r.get("audience_direction") for r in results)
    for d, c in directions.most_common():
        print(f"  {d}: {c}")

    # Expertise distribution
    print("\n## Audience Expertise")
    expertise = Counter(r.get("audience_expertise") for r in results)
    for e, c in expertise.most_common():
        print(f"  {e}: {c}")

    # Audience tag distribution
    print("\n## Target Audience Tags")
    tags = Counter()
    for r in results:
        for t in r.get("target_audience", []):
            tags[t] += 1
    for t, c in tags.most_common():
        print(f"  {t}: {c}")

    # Print markdown table for GitHub
    print(f"\n{'='*80}")
    print("## Markdown Table (for GitHub issue)")
    print(f"{'='*80}")
    print()
    print("| Agency | Type | Direction | Expertise | Audience Tags | Explanation |")
    print("|--------|------|-----------|-----------|---------------|-------------|")
    for r in results[:50]:
        agency = r.get("_agency", "?")
        dtype = r.get("_doc_type", "?")
        direction = r.get("audience_direction", "?")
        exp = r.get("audience_expertise", "?")
        tags_str = ", ".join(r.get("target_audience", []))
        expl = r.get("audience_explanation", "")[:100].replace("|", "/")
        print(f"| {agency} | {dtype} | {direction} | {exp} | {tags_str} | {expl} |")


if __name__ == "__main__":
    main()
