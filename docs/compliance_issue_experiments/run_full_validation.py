#!/usr/bin/env python3
"""
Full Tier 2 Validation Study - ALL 115 items

Runs ALL Tier 2 completed items through Tier 3 verification.
"""

import asyncio
import csv
import json
import os
import sys
from datetime import datetime
from pathlib import Path

import anthropic
import psycopg2
from dotenv import load_dotenv

load_dotenv()

VERIFICATION_SYSTEM_PROMPT = """You are verifying a regulatory burden classification.

Given a document and its previous Tier 2 classification, determine if the classification is correct.

## Your Task

1. Read the full document content carefully
2. Determine if this document genuinely represents the issue type
3. Classify as:
   - **unrelated**: The matched text does not represent this issue type
   - **justified**: The burden exists but is clearly necessary (statutory mandate, safety, child protection)
   - **burdensome**: The burden exists without adequate justification

## Key Context

- For child welfare/safety regulations, physical logs and documentation often have legitimate justification
- "Raised seal" and "embossed seal" are synonyms
- A requirement exists even if it's not the primary purpose of the regulation
- Consider whether electronic alternatives are available (e.g., remote notarization since 2021)

## Response Format

Return ONLY valid JSON:
```json
{
  "classification": "unrelated|justified|burdensome",
  "agrees_with_tier2": true|false,
  "confidence": 0.0-1.0,
  "reasoning": "2-3 sentence explanation with specific document quotes",
  "what_tier2_missed": "If disagreeing, specific text or context Tier 2 missed",
  "key_quote": "The most relevant verbatim quote from the document"
}
```"""


async def run_verification(client: anthropic.AsyncAnthropic, doc: dict, tier2: dict) -> dict:
    """Run a single verification through Claude."""

    user_prompt = f"""## Document Under Analysis
Citation: {doc['citation']}
Title: {doc['title']}

## Full Content
{doc['content']}

## Previous Tier 2 Analysis
Issue Type: {tier2['issue_type']}
Classification: {tier2['classification']}
Confidence: {tier2['confidence']}

---

Verify if this Tier 2 classification is correct. Return your assessment as JSON."""

    response = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2000,
        system=VERIFICATION_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}],
    )

    text = response.content[0].text

    # Parse JSON from response
    try:
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]
        return json.loads(text.strip())
    except json.JSONDecodeError:
        return {
            "classification": "error",
            "agrees_with_tier2": None,
            "confidence": 0,
            "reasoning": f"Parse error: {text[:200]}",
            "what_tier2_missed": None,
            "key_quote": None
        }


async def main():
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()
    client = anthropic.AsyncAnthropic()

    # Get ALL items with Tier 2 classification
    cur.execute("""
        SELECT cia.document_id, cia.issue_type, cia.tier2_classification,
               cia.tier2_confidence, rd.citation, rd.title, rd.content,
               LENGTH(rd.content) as doc_len
        FROM compliance_issue_analyses cia
        JOIN regulatory_documents rd ON rd.id = cia.document_id
        WHERE cia.tier2_classification IS NOT NULL
        ORDER BY cia.tier2_classification, cia.document_id
    """)

    rows = cur.fetchall()
    total = len(rows)

    print(f"Starting FULL validation of {total} items...")
    print("=" * 70)

    results = []
    start_time = datetime.now()

    for i, row in enumerate(rows, 1):
        doc_id, issue_type, tier2_class, tier2_conf, citation, title, content, doc_len = row

        doc = {
            "id": doc_id,
            "citation": citation or f"Document {doc_id}",
            "title": title or "Untitled",
            "content": (content or "")[:15000]
        }

        tier2 = {
            "issue_type": issue_type,
            "classification": tier2_class,
            "confidence": tier2_conf,
        }

        try:
            result = await run_verification(client, doc, tier2)
        except Exception as e:
            result = {
                "classification": "error",
                "agrees_with_tier2": None,
                "confidence": 0,
                "reasoning": str(e),
                "what_tier2_missed": None,
                "key_quote": None
            }

        results.append({
            "doc_id": doc_id,
            "issue_type": issue_type,
            "citation": (citation or "")[:40],
            "tier2_classification": tier2_class,
            "tier2_confidence": tier2_conf,
            "tier3_classification": result["classification"],
            "tier3_agrees": result.get("agrees_with_tier2"),
            "tier3_confidence": result.get("confidence", 0),
            "tier3_reasoning": (result.get("reasoning") or "")[:200],
            "what_tier2_missed": (result.get("what_tier2_missed") or "")[:200],
            "key_quote": (result.get("key_quote") or "")[:150],
            "doc_length": doc_len or 0
        })

        agrees = "✓" if result.get("agrees_with_tier2") else "✗"
        elapsed = (datetime.now() - start_time).total_seconds()
        rate = i / elapsed if elapsed > 0 else 0
        eta = (total - i) / rate if rate > 0 else 0

        cite = (citation or f"Doc {doc_id}")[:30]
        print(f"[{i:3}/{total}] {agrees} {cite:30} | {issue_type:18} | T2:{tier2_class:12} → T3:{result['classification']:12} | ETA: {eta/60:.1f}m")

        # Save incrementally every 10 items
        if i % 10 == 0:
            output_path = Path(__file__).parent / "full_validation_data.csv"
            with open(output_path, "w", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=results[0].keys())
                writer.writeheader()
                writer.writerows(results)

    # Final save
    output_path = Path(__file__).parent / "full_validation_data.csv"
    with open(output_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=results[0].keys())
        writer.writeheader()
        writer.writerows(results)

    print("\n" + "=" * 70)
    print(f"Results saved to: {output_path}")

    # Summary statistics
    by_tier2 = {}
    for r in results:
        t2 = r["tier2_classification"]
        if t2 not in by_tier2:
            by_tier2[t2] = {"total": 0, "agree": 0, "transitions": {}}
        by_tier2[t2]["total"] += 1
        if r["tier3_agrees"]:
            by_tier2[t2]["agree"] += 1
        t3 = r["tier3_classification"]
        if t3 not in by_tier2[t2]["transitions"]:
            by_tier2[t2]["transitions"][t3] = []
        by_tier2[t2]["transitions"][t3].append(r)

    print("\n" + "=" * 70)
    print("DETAILED RESULTS BY TIER 2 CLASSIFICATION")
    print("=" * 70)

    for t2, data in sorted(by_tier2.items()):
        agree_pct = 100 * data["agree"] / data["total"] if data["total"] > 0 else 0
        print(f"\n### {t2.upper()} ({data['total']} items)")
        print(f"    Agreement: {data['agree']}/{data['total']} ({agree_pct:.1f}%)")
        print(f"    Error Rate: {100 - agree_pct:.1f}%")

        for t3, items in data["transitions"].items():
            if t2 != t3:  # Only show disagreements
                print(f"\n    {t2} → {t3}: {len(items)} items")
                for item in items[:5]:  # Show first 5 examples
                    print(f"      - Doc {item['doc_id']} ({item['issue_type']}): {item['citation']}")
                    if item['key_quote']:
                        print(f"        Quote: \"{item['key_quote'][:80]}...\"")
                    if item['what_tier2_missed']:
                        print(f"        Missed: {item['what_tier2_missed'][:80]}...")
                if len(items) > 5:
                    print(f"      ... and {len(items) - 5} more")

    # Cost analysis
    print("\n" + "=" * 70)
    print("COST ANALYSIS AT SCALE")
    print("=" * 70)

    total_agree = sum(1 for r in results if r["tier3_agrees"])
    total_disagree = sum(1 for r in results if r["tier3_agrees"] is False)
    error_rate = 100 * total_disagree / len(results)

    # Costs per 1000 items (estimated)
    tier2_cost = 3.00  # ~$3 per 1000 items
    tier3_cost = 3.50  # ~$3.50 per 1000 items (more context)

    print(f"\nCurrent Error Rate: {error_rate:.1f}%")
    print(f"\nAt 5,000 docs/state × 50 states = 250,000 docs:")
    print(f"  Tier 2 only:     ${250 * tier2_cost:,.0f} total, {error_rate:.1f}% error = ~{int(250000 * error_rate/100):,} wrong classifications")
    print(f"  Tier 2 + Tier 3: ${250 * (tier2_cost + tier3_cost):,.0f} total, ~5% error = ~{int(250000 * 0.05):,} wrong classifications")
    print(f"  Savings:         ~{int(250000 * (error_rate - 5)/100):,} correct classifications for ${250 * tier3_cost:,.0f}")

    conn.close()


if __name__ == "__main__":
    asyncio.run(main())
