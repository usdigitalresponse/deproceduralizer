#!/usr/bin/env python3
"""
JenAI Importance Filter

Takes ~500 stratified JenAI findings and asks: is this important, fixable,
and actually being enforced? Goal is to get down to ~50 that are all three.

Usage:
  cd backend && source .venv/bin/activate
  python scripts/jenai_importance_filter.py
"""

import json
import os
import asyncio
from pathlib import Path
from collections import Counter
from pydantic import BaseModel, Field
from anthropic import AsyncAnthropic
from dotenv import load_dotenv
import psycopg

PROJECT_ROOT = Path(__file__).parent.parent.parent
load_dotenv(PROJECT_ROOT / "backend" / ".env")

OUTPUT_DIR = PROJECT_ROOT / "backend" / "outputs" / "jenai_strategies"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


class ImportantAndFixable(BaseModel):
    important: bool = Field(
        description="Does this finding describe something that meaningfully "
        "hurts real people (citizens, providers, patients, students) RIGHT "
        "NOW? Not hypothetically, not 'could be confusing' — actually causing "
        "harm, blocking access, wasting money, or preventing better outcomes."
    )
    important_reasoning: str = Field(
        description="One sentence: who is being hurt and how? "
        "If not important, say why."
    )
    fixable: bool = Field(
        description="Could this be fixed by EDITING EXISTING TEXT — deleting "
        "a word, replacing a term, adding one sentence? The fix must be a "
        "TEXT CHANGE to an existing regulation, not creating a new program, "
        "not adding funding, not building a system, not requiring legislation. "
        "If the fix requires the word 'establish', 'create', 'fund', or "
        "'appropriate', it is NOT fixable. If it requires coordination across "
        "multiple agencies, it is NOT fixable."
    )
    fix_description: str = Field(
        description="The EXACT text edit in one sentence. Good: 'Replace "
        "ICD-9 with ICD-10 in 10 NYCRR 85.6'. Good: 'Add after subsection "
        "(a): Programs serving fewer than 6 children are exempt from "
        "paragraphs (3) through (8).' Bad: 'Create a grant program.' "
        "Bad: 'Establish a reimbursement mechanism.' If you can't describe "
        "it as a specific edit to specific text, mark fixable=false."
    )
    enforced: bool = Field(
        description="Is this requirement likely being actively enforced or "
        "followed? A regulation about 'computer tape' that nobody reads is "
        "NOT enforced. A paper-only application process that agencies "
        "actually use IS enforced. Medicaid billing codes are enforced. "
        "Childcare licensing requirements are enforced."
    )
    keep: bool = Field(
        description="TRUE only if ALL THREE: important AND fixable AND "
        "enforced. This is a high bar — we want ~10% of findings to pass."
    )


SYSTEM = """\
You are helping identify the ~50 most important, easily fixable regulatory \
problems in New York State.

We have 21,000 findings from an AI analysis of NY regulations. Most are real \
but either not important enough, too hard to fix, or not actually enforced. \
We need the ones that are ALL THREE.

EXAMPLES OF WHAT WE WANT (important + fixable + enforced):
- Medicaid billing still requires ICD-9 codes — every hospital hits this, \
easy text fix, actively enforced in claims processing
- Childcare licensing requires 32 identical recordkeeping items for a \
4-child home and a 200-child center — crushes small providers, could add \
one exemption sentence, actively inspected by OCFS
- Hospital construction standards mandate film darkrooms when all radiology \
is digital — blocks renovation projects, just update the word, building \
inspectors check this
- A paper-only application process that thousands of people use annually — \
real access barrier, just authorize electronic submission, agencies enforce \
the paper requirement
- Mandatory 50% bed surge capacity same for 20-bed rural hospital and \
500-bed urban hospital — impossible for rural, add size tiering, enforced \
in emergency preparedness reviews

EXAMPLES OF WHAT WE DON'T WANT:
- A regulation says "INS" instead of "USCIS" — cosmetic, nobody is confused
- "No success metrics defined" — true but abstract, not a text fix
- A 1977 deadline that expired — dead letter, not enforced
- "Regulation is complex" — observation, not fixable
- Dead URLs in old guidance — webmaster issue, not regulatory reform
- A regulation references a renamed agency — cosmetic name change
- "Training requirements are unfunded" — real but fix requires NEW MONEY, \
not a text edit. Mark fixable=false.
- "No sliding scale for fees" — adding a sliding scale is a new policy \
design, not a text edit. Mark fixable=false.
- "No appeal mechanism exists" — creating an appeal process is new policy, \
not editing existing text. Mark fixable=false.
- "No timeline for agency response" — adding a deemed-approved provision is \
reasonable IF the regulation already describes the process; mark fixable=true \
only if you can point to the specific subsection to edit.

THE BAR: If you showed this finding to a state official and said "you could \
fix this by changing 1-3 sentences in this specific regulation," would they \
agree? If the response would be "that's not how rulemaking works" or "that \
would require a whole new program," mark fixable=false.

BE VERY STRICT. We want ~5-10% to pass. If in doubt, mark keep=false."""


def pull_sample(n: int = 500) -> list[dict]:
    conn = psycopg.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()
    cur.execute("""
        WITH ranked AS (
            SELECT ji.id, ji.category, ji.severity, ji.explanation, ji.tags,
                   CASE WHEN ji.guidance_document_id IS NOT NULL THEN 'guidance'
                        ELSE 'regulation' END as doc_type,
                   COALESCE(gd.title, rd.title) as doc_title,
                   rd.citation,
                   ROW_NUMBER() OVER (
                       PARTITION BY ji.category ORDER BY RANDOM()
                   ) as rn
            FROM jenai_issues ji
            LEFT JOIN guidance_documents gd ON ji.guidance_document_id = gd.id
            LEFT JOIN regulatory_documents rd ON ji.document_id = rd.id
            WHERE ji.category != 'OTHER' AND ji.severity >= 4
        )
        SELECT id, category, severity, explanation, tags, doc_type,
               doc_title, citation
        FROM ranked WHERE rn <= 30
        ORDER BY category, severity DESC
        LIMIT %s
    """, (n,))
    cols = [d[0] for d in cur.description]
    rows = [dict(zip(cols, r)) for r in cur.fetchall()]
    conn.close()
    return rows


async def evaluate_batch(items: list[dict]) -> list[dict]:
    client = AsyncAnthropic()
    sem = asyncio.Semaphore(15)

    async def _one(item):
        async with sem:
            doc = item.get("citation") or item.get("doc_title") or "Unknown"
            user = (
                f"CATEGORY: {item['category']}\n"
                f"FINDING (severity {item['severity']}):\n"
                f"{item['explanation']}\n\n"
                f"SOURCE: {doc} ({item['doc_type']})\n"
                f"TAGS: {', '.join(item.get('tags') or [])}"
            )
            try:
                resp = await client.messages.create(
                    model="claude-haiku-4-5-20251001",
                    max_tokens=512,
                    system=SYSTEM,
                    messages=[{"role": "user", "content": user}],
                    tools=[{
                        "name": "evaluate",
                        "description": "Evaluate finding",
                        "input_schema": ImportantAndFixable.model_json_schema(),
                    }],
                    tool_choice={"type": "tool", "name": "evaluate"},
                )
                for block in resp.content:
                    if block.type == "tool_use":
                        r = ImportantAndFixable.model_validate(block.input)
                        return {**item, "eval": r.model_dump()}
            except Exception as e:
                print(f"  Error {item['id']}: {e}")
            return {**item, "eval": None}

    return await asyncio.gather(*[_one(i) for i in items])


async def main():
    print("Pulling 500 stratified findings...")
    items = pull_sample(500)
    print(f"  {len(items)} findings across {len(set(i['category'] for i in items))} categories")

    print("\nEvaluating importance + fixability + enforcement...")
    results = await evaluate_batch(items)

    evaluated = [r for r in results if r.get("eval")]
    keepers = [r for r in evaluated if r["eval"]["keep"]]
    important = [r for r in evaluated if r["eval"]["important"]]
    fixable = [r for r in evaluated if r["eval"]["fixable"]]
    enforced = [r for r in evaluated if r["eval"]["enforced"]]

    print(f"\n{'='*60}")
    print(f"RESULTS ({len(evaluated)} evaluated)")
    print(f"  Important: {len(important)} ({round(100*len(important)/len(evaluated))}%)")
    print(f"  Fixable:   {len(fixable)} ({round(100*len(fixable)/len(evaluated))}%)")
    print(f"  Enforced:  {len(enforced)} ({round(100*len(enforced)/len(evaluated))}%)")
    print(f"  ALL THREE: {len(keepers)} ({round(100*len(keepers)/len(evaluated))}%)")

    print(f"\n{'='*60}")
    print(f"THE LIST ({len(keepers)} findings):")
    print(f"By category: {Counter(r['category'] for r in keepers).most_common()}")
    print()

    for r in sorted(keepers, key=lambda x: -x["severity"]):
        doc = r.get("citation") or r.get("doc_title") or ""
        e = r["eval"]
        print(f"[sev {r['severity']}] {r['category']} | {doc}")
        print(f"  {r['explanation'][:200]}")
        print(f"  WHY:  {e['important_reasoning']}")
        print(f"  FIX:  {e['fix_description']}")
        print()

    # Save all results
    with open(OUTPUT_DIR / "important_fixable_enforced.json", "w") as f:
        json.dump(results, f, indent=2, default=str)
    print(f"Saved full results to {OUTPUT_DIR}/important_fixable_enforced.json")

    # Save just the keepers
    with open(OUTPUT_DIR / "keepers.json", "w") as f:
        json.dump(keepers, f, indent=2, default=str)
    print(f"Saved {len(keepers)} keepers to {OUTPUT_DIR}/keepers.json")


if __name__ == "__main__":
    asyncio.run(main())
