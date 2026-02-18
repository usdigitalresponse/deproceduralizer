#!/usr/bin/env python3
"""
Tier 2 Validation Study Script

Runs items through a Tier 3 verification prompt to validate Tier 2 classifications.
Results are saved to tier2_validation_data.csv.
"""

import asyncio
import csv
import json
import os
import sys
from datetime import datetime
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "backend"))

import anthropic
import psycopg2
from dotenv import load_dotenv

load_dotenv()

# Study sample document IDs
UNRELATED_ITEMS = [
    (99102, "mail_only"), (100534, "mail_only"), (101122, "mail_only"),
    (102320, "certified_mail"), (109504, "notarization"), (111142, "mandated_reports"),
    (112289, "wet_signature"), (121563, "obsolete_comm"), (155936, "obsolete_media"),
    (156889, "carbon_copy"), (169248, "mandated_reports"), (179120, "mandated_reports"),
    (180947, "in_person_hearing"), (182010, "physical_inspection"), (186224, "mail_only"),
    (188532, "mandated_reports"), (200952, "physical_inspection"), (202907, "embossed_seal"),
    (209549, "physical_inspection"), (209837, "obsolete_media"),
]

JUSTIFIED_ITEMS = [
    (201904, "mandated_reports"), (160961, "certified_mail"), (100574, "notarization"),
    (120877, "physical_inspection"), (154742, "in_person_hearing"), (178857, "notarization"),
    (209764, "notarization"), (202907, "certified_mail"), (133457, "mandated_reports"),
    (210884, "certified_mail"), (202135, "in_person_hearing"), (109613, "physical_log"),
    (128283, "newspaper"), (165502, "letterhead"), (102788, "notarization"),
]

BURDENSOME_ITEMS = [
    (142117, "notarization"), (147292, "letterhead"), (139057, "physical_log"),
    (138305, "physical_log"), (154734, "physical_log"), (127432, "physical_log"),
    (101340, "physical_log"), (154100, "physical_log"), (209278, "physical_log"),
    (101878, "mail_only"), (98801, "mail_only"), (126154, "obsolete_comm"),
    (117222, "check_payment"), (121563, "wet_signature"), (115563, "check_payment"),
]


VERIFICATION_SYSTEM_PROMPT = """You are verifying a regulatory burden classification.

Given a document and its previous Tier 2 classification, determine if the classification is correct.

## Your Task

1. Read the full document content carefully
2. Determine if this document genuinely represents the issue type
3. Classify as:
   - **unrelated**: The matched text does not represent this issue type
   - **justified**: The burden exists but is clearly necessary (statutory mandate, safety)
   - **burdensome**: The burden exists without adequate justification

## Response Format

Return ONLY valid JSON:
```json
{
  "classification": "unrelated|justified|burdensome",
  "agrees_with_tier2": true|false,
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation",
  "what_tier2_missed": "If disagreeing, what did Tier 2 miss?"
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
Reasoning: {tier2['reasoning'][:500] if tier2['reasoning'] else 'N/A'}...

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
        # Handle markdown code blocks
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
            "reasoning": f"Failed to parse: {text[:200]}",
            "what_tier2_missed": None
        }


async def main():
    # Connect to database
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()

    # Initialize Anthropic client
    client = anthropic.AsyncAnthropic()

    # Combine all items
    all_items = [
        ("unrelated", doc_id, issue_type) for doc_id, issue_type in UNRELATED_ITEMS
    ] + [
        ("justified", doc_id, issue_type) for doc_id, issue_type in JUSTIFIED_ITEMS
    ] + [
        ("burdensome", doc_id, issue_type) for doc_id, issue_type in BURDENSOME_ITEMS
    ]

    results = []
    total = len(all_items)

    print(f"Starting validation of {total} items...")
    print("=" * 60)

    for i, (expected_category, doc_id, issue_type) in enumerate(all_items, 1):
        # Get document
        cur.execute("""
            SELECT id, citation, title, content
            FROM regulatory_documents
            WHERE id = %s
        """, (doc_id,))
        doc_row = cur.fetchone()

        if not doc_row:
            print(f"[{i}/{total}] Doc {doc_id} not found, skipping")
            continue

        doc = {
            "id": doc_row[0],
            "citation": doc_row[1],
            "title": doc_row[2],
            "content": doc_row[3][:15000] if doc_row[3] else ""  # Truncate very long docs
        }

        # Get Tier 2 analysis
        cur.execute("""
            SELECT tier2_classification, tier2_confidence, tier2_reasoning
            FROM compliance_issue_analyses
            WHERE document_id = %s AND issue_type = %s
        """, (doc_id, issue_type))
        tier2_row = cur.fetchone()

        if not tier2_row:
            print(f"[{i}/{total}] No Tier 2 for {doc_id}/{issue_type}, skipping")
            continue

        tier2 = {
            "issue_type": issue_type,
            "classification": tier2_row[0],
            "confidence": tier2_row[1],
            "reasoning": tier2_row[2]
        }

        # Run verification
        try:
            result = await run_verification(client, doc, tier2)
        except Exception as e:
            result = {
                "classification": "error",
                "agrees_with_tier2": None,
                "confidence": 0,
                "reasoning": str(e),
                "what_tier2_missed": None
            }

        # Track result
        results.append({
            "doc_id": doc_id,
            "issue_type": issue_type,
            "expected_category": expected_category,
            "tier2_classification": tier2["classification"],
            "tier2_confidence": tier2["confidence"],
            "tier3_classification": result["classification"],
            "tier3_agrees": result["agrees_with_tier2"],
            "tier3_confidence": result.get("confidence", 0),
            "tier3_reasoning": result.get("reasoning", ""),
            "what_tier2_missed": result.get("what_tier2_missed", ""),
            "doc_length": len(doc["content"])
        })

        agrees = "AGREE" if result.get("agrees_with_tier2") else "DISAGREE"
        print(f"[{i}/{total}] {doc['citation'][:25]:25} | {issue_type:20} | T2:{tier2['classification']:12} | T3:{result['classification']:12} | {agrees}")

    # Save results
    output_path = Path(__file__).parent / "tier2_validation_data.csv"
    with open(output_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=results[0].keys())
        writer.writeheader()
        writer.writerows(results)

    print("\n" + "=" * 60)
    print(f"Results saved to: {output_path}")

    # Summary statistics
    agree_count = sum(1 for r in results if r["tier3_agrees"])
    disagree_count = sum(1 for r in results if r["tier3_agrees"] is False)
    error_count = sum(1 for r in results if r["tier3_agrees"] is None)

    print(f"\nSummary:")
    print(f"  Agree: {agree_count}/{len(results)} ({100*agree_count/len(results):.1f}%)")
    print(f"  Disagree: {disagree_count}/{len(results)} ({100*disagree_count/len(results):.1f}%)")
    print(f"  Error: {error_count}")

    # By category
    for category in ["unrelated", "justified", "burdensome"]:
        cat_results = [r for r in results if r["expected_category"] == category]
        cat_agree = sum(1 for r in cat_results if r["tier3_agrees"])
        print(f"\n  {category.upper()}:")
        print(f"    Agree: {cat_agree}/{len(cat_results)} ({100*cat_agree/len(cat_results):.1f}%)")

        # Show disagreements
        disagreements = [r for r in cat_results if r["tier3_agrees"] is False]
        for d in disagreements:
            print(f"    - Doc {d['doc_id']}: T2={d['tier2_classification']} -> T3={d['tier3_classification']}")
            if d["what_tier2_missed"]:
                print(f"      Missed: {d['what_tier2_missed'][:100]}...")

    conn.close()


if __name__ == "__main__":
    asyncio.run(main())
