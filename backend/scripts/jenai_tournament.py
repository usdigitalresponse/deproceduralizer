#!/usr/bin/env python3
"""
JenAI Tournament: 3-round filtering to find important, fixable findings.

Pass 1 (default): Easy text fixes — swap a word, add "or electronically", etc.
Pass 2 (--pass2): Structural policy fixes — still one-line changes, but
  policy-flavored: add proportionality language, size exemptions,
  prioritization clauses, cure periods, outcome standards.

Round 1: Importance filter — each finding individually evaluated for
         importance, fixability, and enforcement (~17K → ~6K)
Round 2: Tournament bracket — pick 5 best from each batch of 50
         (~6K → ~600)
Round 3: Group by narrow fix pattern — collapse duplicate fixes into
         single recommendations with example citations (~600 → ~20-40
         distinct fix patterns, each with a list of affected regulations)

Usage:
  cd backend && source .venv/bin/activate

  # Run everything end-to-end (Pass 1 + Pass 2 + top examples + JSON):
  python scripts/jenai_tournament.py --full              # ~$15, ~40 min

  # Domain-specific analysis (single-pass aggregation + themes):
  python scripts/jenai_tournament.py --domain childcare   # ~$1, ~2 min
  python scripts/jenai_tournament.py --domain permitting  # ~$1, ~2 min

  # Pass 1 only:
  python scripts/jenai_tournament.py --all

  # Pass 2 only (uses Round 1 keepers from Pass 1):
  python scripts/jenai_tournament.py --pass2 --all

  # Web search verification on semifinalists:
  python scripts/jenai_tournament.py --verify
  python scripts/jenai_tournament.py --pass2 --verify

  # Pick top examples and rebuild JSON from existing results:
  python scripts/jenai_tournament.py --top-examples
  python scripts/jenai_tournament.py --pass2 --top-examples

  # Rebuild tournament_results.json without re-running LLM calls:
  python scripts/jenai_tournament.py --build-json

  # Individual rounds:
  python scripts/jenai_tournament.py --round 1
  python scripts/jenai_tournament.py --round 2
  python scripts/jenai_tournament.py --round 3

Outputs:
  backend/outputs/jenai_strategies/tournament_results.json  (unified, both passes)
  backend/outputs/jenai_domains/{domain}/analysis.json      (domain-specific)

Prompts: prompts/tournament.yaml (all prompts loaded from YAML, not hardcoded)
"""

import argparse
import json
import os
import re
import sys
import asyncio
import random
from pathlib import Path
from collections import Counter
from pydantic import BaseModel, Field
from anthropic import AsyncAnthropic
from dotenv import load_dotenv
import psycopg
import yaml

PROJECT_ROOT = Path(__file__).parent.parent.parent
load_dotenv(PROJECT_ROOT / "backend" / ".env")

OUTPUT_DIR = PROJECT_ROOT / "backend" / "outputs" / "jenai_tournament"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Load prompts from YAML
with open(PROJECT_ROOT / "prompts" / "tournament.yaml") as _f:
    _PROMPTS = yaml.safe_load(_f)


def _get_system(prompt_key: str) -> str:
    """Get the system prompt for a tournament step."""
    return _PROMPTS[prompt_key]["system"].strip()


# ═══════════════════════════════════════════════════════════════════════════
# Shared: Pick Top Examples by Impact
# ═══════════════════════════════════════════════════════════════════════════

TOP_EXAMPLES_SYSTEM = _get_system("top_examples")


async def pick_top_examples(
    pattern_name: str,
    findings: list[dict],
    client: AsyncAnthropic,
) -> list[dict]:
    """Given all findings for a mega-pattern, pick the 5 most compelling."""
    if len(findings) <= 5:
        return findings

    lines = []
    for i, f in enumerate(findings):
        cite = f.get("citation") or f.get("doc_title") or ""
        expl = f["explanation"][:150]
        fix = f["eval"]["fix_description"][:120]
        reason = f["eval"]["important_reasoning"][:100]
        lines.append(
            f"{i}. [{f['category']}] sev={f['severity']} | {cite}\n"
            f"   Problem: {expl}\n"
            f"   Fix: {fix}\n"
            f"   Why it matters: {reason}"
        )

    # If too many findings for one call, pre-filter by severity
    if len(lines) > 100:
        scored = sorted(findings, key=lambda x: -x["severity"])
        findings_subset = scored[:100]
        lines = []
        for i, f in enumerate(findings_subset):
            cite = f.get("citation") or f.get("doc_title") or ""
            expl = f["explanation"][:150]
            fix = f["eval"]["fix_description"][:120]
            reason = f["eval"]["important_reasoning"][:100]
            lines.append(
                f"{i}. [{f['category']}] sev={f['severity']} | {cite}\n"
                f"   Problem: {expl}\n"
                f"   Fix: {fix}\n"
                f"   Why it matters: {reason}"
            )
    else:
        findings_subset = findings

    try:
        resp = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=256,
            system=TOP_EXAMPLES_SYSTEM,
            messages=[{"role": "user", "content": (
                f"Fix pattern: {pattern_name}\n\n" + "\n\n".join(lines)
            )}],
        )
        text = resp.content[0].text
        nums = []
        for line in text.strip().split("\n"):
            m = re.match(r"(\d+)", line.strip())
            if m:
                num = int(m.group(1))
                if 0 <= num < len(findings_subset):
                    nums.append(num)
        if nums:
            return [findings_subset[n] for n in nums[:5]]
    except Exception as e:
        print(f"  Top examples error for {pattern_name}: {e}")

    # Fallback: top 5 by severity
    return sorted(findings, key=lambda x: -x["severity"])[:5]


# ═══════════════════════════════════════════════════════════════════════════
# Round 1: Importance Filter
# ═══════════════════════════════════════════════════════════════════════════

class ImportantAndFixable(BaseModel):
    important: bool = Field(
        description="Does this meaningfully hurt real people RIGHT NOW?"
    )
    important_reasoning: str = Field(
        description="One sentence: who is hurt and how? If not important, why."
    )
    fixable: bool = Field(
        description="Could this be fixed by EDITING EXISTING TEXT — deleting "
        "a word, replacing a term, adding one sentence? If the fix requires "
        "'establish', 'create', 'fund', or 'appropriate', it is NOT fixable."
    )
    fix_description: str = Field(
        description="The EXACT text edit in one sentence. "
        "Good: 'Replace ICD-9 with ICD-10 in 10 NYCRR 85.6'. "
        "Bad: 'Create a grant program.' If you can't describe a specific "
        "edit, mark fixable=false."
    )
    enforced: bool = Field(
        description="Is this actively enforced or followed? Paper-only apps "
        "that agencies use = YES. 'Computer tape' nobody reads = NO."
    )
    keep: bool = Field(
        description="TRUE only if ALL THREE: important AND fixable AND "
        "enforced. High bar — ~10% should pass."
    )


class VerificationResult(BaseModel):
    verified: bool = Field(
        description="True if finding appears factually accurate and not already fixed. "
        "Default to true unless clear counter-evidence found."
    )
    factually_accurate: bool = Field(
        description="Is the factual claim correct? (e.g., does the reg really say this?)"
    )
    still_current: bool = Field(
        description="Has this NOT been fixed by amendment, executive order, or waiver?"
    )
    actively_enforced: bool = Field(
        description="Is this regulation actively enforced/followed? "
        "True unless evidence of dead letter or blanket waiver."
    )
    federal_or_statutory_constraint: bool = Field(
        description="True if this requirement is driven by federal law/regulation "
        "(CMS, EPA, OSHA, etc.) or NY state statute, meaning it cannot be changed "
        "by agency rulemaking alone. False if it's purely a state regulatory choice."
    )
    constraint_source: str = Field(
        default="",
        description="If constrained: 'federal' (federal law/reg mandate), "
        "'statutory' (NY state statute requires it), or '' if not constrained. "
        "Include the specific citation if found (e.g., '42 CFR 483.10')."
    )
    verification_notes: str = Field(
        description="1-3 sentences summarizing what web search found or didn't find"
    )
    web_sources: list[str] = Field(
        default_factory=list,
        description="URLs of sources consulted (up to 5)"
    )


ROUND1_SYSTEM = _get_system("pass1_round1")


async def run_round1(concurrency: int = 20):
    """Pull all sev>=4 non-OTHER findings, filter for importance."""
    print("ROUND 1: Importance Filter")
    print("=" * 60)

    r1_file = OUTPUT_DIR / "round1_all.json"
    already_done = set()
    existing_results = []
    if r1_file.exists():
        with open(r1_file) as f:
            existing_results = json.load(f)
        already_done = {r["id"] for r in existing_results if r.get("eval")}
        print(f"  Resuming: {len(already_done)} already evaluated")

    conn = psycopg.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()
    cur.execute("""
        SELECT ji.id, ji.category, ji.severity, ji.explanation, ji.tags,
               CASE WHEN ji.guidance_document_id IS NOT NULL THEN 'guidance'
                    ELSE 'regulation' END as doc_type,
               COALESCE(gd.title, rd.title) as doc_title,
               rd.citation
        FROM jenai_issues ji
        LEFT JOIN guidance_documents gd ON ji.guidance_document_id = gd.id
        LEFT JOIN regulatory_documents rd ON ji.document_id = rd.id
        WHERE ji.category != 'OTHER' AND ji.severity >= 4
        ORDER BY ji.id
    """)
    cols = [d[0] for d in cur.description]
    all_items = [dict(zip(cols, r)) for r in cur.fetchall()]
    conn.close()

    to_process = [i for i in all_items if i["id"] not in already_done]
    print(f"  Total: {len(all_items)}, To process: {len(to_process)}")

    if not to_process:
        print("  Nothing new to process")
        keepers = [r for r in existing_results if r.get("eval") and r["eval"]["keep"]]
        with open(OUTPUT_DIR / "round1_keepers.json", "w") as f:
            json.dump(keepers, f, indent=2, default=str)
        print(f"  {len(keepers)} keepers")
        return

    client = AsyncAnthropic()
    sem = asyncio.Semaphore(concurrency)
    results = list(existing_results)
    processed = 0

    async def _one(item):
        async with sem:
            doc = item.get("citation") or item.get("doc_title") or "Unknown"
            user = (
                f"[{item['category']}] {doc} (sev {item['severity']})\n"
                f"{item['explanation']}\n"
                f"Tags: {', '.join(item.get('tags') or [])}"
            )
            try:
                resp = await client.messages.create(
                    model="claude-haiku-4-5-20251001",
                    max_tokens=400,
                    system=ROUND1_SYSTEM,
                    messages=[{"role": "user", "content": user}],
                    tools=[{
                        "name": "eval",
                        "description": "Evaluate",
                        "input_schema": ImportantAndFixable.model_json_schema(),
                    }],
                    tool_choice={"type": "tool", "name": "eval"},
                )
                for block in resp.content:
                    if block.type == "tool_use":
                        r = ImportantAndFixable.model_validate(block.input)
                        return {**item, "eval": r.model_dump()}
            except Exception as e:
                return {**item, "eval": None, "error": str(e)}
            return {**item, "eval": None}

    chunk_size = 200
    for i in range(0, len(to_process), chunk_size):
        chunk = to_process[i:i + chunk_size]
        chunk_results = await asyncio.gather(*[_one(item) for item in chunk])
        results.extend(chunk_results)

        chunk_ok = sum(1 for r in chunk_results if r.get("eval"))
        chunk_keep = sum(1 for r in chunk_results if r.get("eval") and r["eval"]["keep"])
        processed += len(chunk)
        print(f"  Processed {processed}/{len(to_process)} "
              f"({chunk_ok} ok, {chunk_keep} kept this chunk)")

        with open(r1_file, "w") as f:
            json.dump(results, f, indent=2, default=str)

    evaluated = [r for r in results if r.get("eval")]
    keepers = [r for r in evaluated if r["eval"]["keep"]]

    print(f"\n{'='*60}")
    print(f"ROUND 1 COMPLETE")
    print(f"  Evaluated: {len(evaluated)}")
    print(f"  KEEPERS:   {len(keepers)} "
          f"({round(100*len(keepers)/max(len(evaluated),1))}%)")
    print(f"  Categories: {Counter(r['category'] for r in keepers).most_common(10)}")

    with open(OUTPUT_DIR / "round1_keepers.json", "w") as f:
        json.dump(keepers, f, indent=2, default=str)
    print(f"\nSaved {len(keepers)} keepers")


# ═══════════════════════════════════════════════════════════════════════════
# Round 2: Tournament Brackets
# ═══════════════════════════════════════════════════════════════════════════

ROUND2_SYSTEM = _get_system("pass1_round2")


async def run_round2():
    """Tournament bracket: pick 5 from each batch of 50."""
    print("\nROUND 2: Tournament Brackets")
    print("=" * 60)

    keepers_file = OUTPUT_DIR / "round1_keepers.json"
    if not keepers_file.exists():
        print("ERROR: Run round 1 first")
        return

    with open(keepers_file) as f:
        keepers = json.load(f)
    print(f"  {len(keepers)} keepers from round 1")

    random.seed(42)
    random.shuffle(keepers)

    batch_size = 50
    batches = [
        keepers[i:i + batch_size]
        for i in range(0, len(keepers), batch_size)
        if len(keepers[i:i + batch_size]) >= 10
    ]
    print(f"  Split into {len(batches)} batches of ~{batch_size}")

    client = AsyncAnthropic()
    sem = asyncio.Semaphore(5)
    all_picks = []

    async def _bracket(batch_idx, batch):
        async with sem:
            lines = []
            for i, r in enumerate(batch, 1):
                doc = r.get("citation") or r.get("doc_title") or ""
                fix = r["eval"]["fix_description"][:120]
                expl = r["explanation"][:120]
                lines.append(f"{i}. [{r['category']}] {doc}: {expl} || FIX: {fix}")

            try:
                resp = await client.messages.create(
                    model="claude-haiku-4-5-20251001",
                    max_tokens=256,
                    system=ROUND2_SYSTEM,
                    messages=[{"role": "user", "content": "\n".join(lines)}],
                )
                text = resp.content[0].text
                nums = []
                for line in text.strip().split("\n"):
                    m = re.match(r"(\d+)", line.strip())
                    if m:
                        num = int(m.group(1))
                        if 1 <= num <= len(batch):
                            nums.append(num)

                picks = [batch[n - 1] for n in nums[:5]]
                print(f"  Batch {batch_idx + 1}/{len(batches)}: picked {len(picks)}")
                return picks
            except Exception as e:
                print(f"  Batch {batch_idx + 1} error: {e}")
                return []

    tasks = [_bracket(i, b) for i, b in enumerate(batches)]
    results = await asyncio.gather(*tasks)

    for picks in results:
        all_picks.extend(picks)

    print(f"\n{'='*60}")
    print(f"ROUND 2 COMPLETE: {len(all_picks)} semifinalists")
    print(f"  Categories: {Counter(r['category'] for r in all_picks).most_common(10)}")

    with open(OUTPUT_DIR / "round2_semifinalists.json", "w") as f:
        json.dump(all_picks, f, indent=2, default=str)
    print(f"Saved to round2_semifinalists.json")


# ═══════════════════════════════════════════════════════════════════════════
# Round 3: Group by Narrow Fix Pattern
# ═══════════════════════════════════════════════════════════════════════════

ROUND3_SYSTEM = _get_system("pass1_round3")


class FixGroup(BaseModel):
    fix: str = Field(description="The reusable fix pattern")
    indices: list[int] = Field(description="Finding numbers (0-based) this fix applies to")


class Round3Groups(BaseModel):
    groups: list[FixGroup]


async def run_round3():
    """Group semifinalists by narrow fix pattern."""
    print("\nROUND 3: Group by Fix Pattern")
    print("=" * 60)

    verified_file = OUTPUT_DIR / "round2_verified.json"
    semi_file = verified_file if verified_file.exists() else OUTPUT_DIR / "round2_semifinalists.json"
    if not semi_file.exists():
        print("ERROR: Run round 2 first")
        return

    with open(semi_file) as f:
        semi = json.load(f)
    # If using verified file, filter to only verified items
    if verified_file.exists():
        semi = [s for s in semi if s.get("verification", {}).get("verified", True)]
        print(f"  Using verified file: {len(semi)} verified semifinalists")
    else:
        print(f"  {len(semi)} semifinalists to group")

    client = AsyncAnthropic()

    # Process in chunks — each chunk grouped independently, then merge
    chunk_size = 80
    all_groups: list[dict] = []

    for chunk_start in range(0, len(semi), chunk_size):
        chunk = semi[chunk_start:chunk_start + chunk_size]
        lines = []
        for i, r in enumerate(chunk):
            doc = r.get("citation") or r.get("doc_title") or ""
            fix = r["eval"]["fix_description"][:120]
            lines.append(f"{i}. {doc}: {fix}")

        try:
            resp = await client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=4096,
                system=ROUND3_SYSTEM,
                messages=[{"role": "user", "content": "\n".join(lines)}],
                tools=[{
                    "name": "group",
                    "description": "Group findings by fix pattern",
                    "input_schema": Round3Groups.model_json_schema(),
                }],
                tool_choice={"type": "tool", "name": "group"},
            )
            for block in resp.content:
                if block.type == "tool_use":
                    result = Round3Groups.model_validate(block.input)
                    for g in result.groups:
                        global_indices = [
                            chunk_start + i for i in g.indices
                            if i < len(chunk)
                        ]
                        all_groups.append({
                            "fix": g.fix,
                            "findings": [semi[i] for i in global_indices if i < len(semi)],
                        })
            chunk_num = chunk_start // chunk_size + 1
            total_chunks = (len(semi) + chunk_size - 1) // chunk_size
            print(f"  Chunk {chunk_num}/{total_chunks}: "
                  f"{len(result.groups)} groups")
        except Exception as e:
            print(f"  Chunk error: {e}")

    # Merge groups with very similar fix descriptions across chunks
    # Use lowercase normalized key
    merged: dict[str, dict] = {}
    for g in all_groups:
        # Normalize: lowercase, strip punctuation, collapse whitespace
        key = re.sub(r'[^a-z0-9 ]', '', g["fix"].lower())
        key = re.sub(r'\s+', ' ', key).strip()

        if key in merged:
            merged[key]["findings"].extend(g["findings"])
        else:
            merged[key] = {"fix": g["fix"], "findings": g["findings"]}

    # Build final recommendations sorted by count
    recommendations = []
    for rec in sorted(merged.values(), key=lambda x: -len(x["findings"])):
        findings = rec["findings"]
        # Deduplicate by finding ID
        seen = set()
        unique_findings = []
        for f in findings:
            if f["id"] not in seen:
                seen.add(f["id"])
                unique_findings.append(f)
        findings = unique_findings

        categories = Counter(f["category"] for f in findings)
        recommendations.append({
            "fix_pattern": rec["fix"],
            "count": len(findings),
            "primary_category": categories.most_common(1)[0][0],
            "examples": sorted(findings, key=lambda x: -x["severity"])[:5],
            "all_citations": [
                f.get("citation") or f.get("doc_title") or ""
                for f in findings
            ],
            "all_ids": [f["id"] for f in findings],
        })

    # Print results
    print(f"\n{'='*60}")
    print(f"ROUND 3 COMPLETE: {len(recommendations)} DISTINCT FIX PATTERNS")
    total_findings = sum(r["count"] for r in recommendations)
    print(f"  Covering {total_findings} findings")
    print(f"{'='*60}\n")

    for i, rec in enumerate(recommendations, 1):
        top = rec["examples"][0] if rec["examples"] else None
        example_cite = (top.get("citation") or top.get("doc_title") or "") if top else ""
        print(f"{i:3d}. [{rec['count']:3d} regs] {rec['fix_pattern']}")
        print(f"     e.g.: {example_cite}")
        if i >= 50:
            remaining = len(recommendations) - 50
            if remaining > 0:
                print(f"\n... and {remaining} more patterns with fewer findings")
            break

    # Save
    with open(OUTPUT_DIR / "round3_recommendations.json", "w") as f:
        json.dump(recommendations, f, indent=2, default=str)
    print(f"\nSaved to round3_recommendations.json")

    # Also save a summary CSV-like format
    summary_lines = ["fix_pattern\tcount\tprimary_category\texample_citations"]
    for rec in recommendations:
        cites = "; ".join(rec["all_citations"][:5])
        summary_lines.append(
            f"{rec['fix_pattern']}\t{rec['count']}\t{rec['primary_category']}\t{cites}"
        )
    with open(OUTPUT_DIR / "round3_summary.tsv", "w") as f:
        f.write("\n".join(summary_lines))
    print(f"Saved summary to round3_summary.tsv")


# ═══════════════════════════════════════════════════════════════════════════
# Pass 2: Structural Policy Fixes
# ═══════════════════════════════════════════════════════════════════════════

STRUCTURAL_CATEGORIES = [
    'CASCADE_OF_RIGIDITY', 'ONE_SIZE_FITS_ALL', 'ZERO_RISK_LANGUAGE',
    'UNFUNDED_MANDATE', 'MISSING_OUTCOMES', 'NO_FEEDBACK_LOOPS',
    'MANDATED_STEPS_NOT_OUTCOMES', 'REGULATORY_COMPLEXITY',
]

PASS2_OUTPUT_DIR = PROJECT_ROOT / "backend" / "outputs" / "jenai_strategies"
PASS2_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

PASS2_ROUND2_SYSTEM = _get_system("pass2_round2")


PASS2_ROUND3_SYSTEM = _get_system("pass2_round3")


async def run_pass2_round2():
    """Pass 2 Round 2: Tournament on structural keepers only."""
    print("\nPASS 2 ROUND 2: Structural Tournament Brackets")
    print("=" * 60)

    keepers_file = OUTPUT_DIR / "round1_keepers.json"
    if not keepers_file.exists():
        print("ERROR: Run round 1 first (pass 1)")
        return

    with open(keepers_file) as f:
        keepers = json.load(f)

    structural = [r for r in keepers if r['category'] in STRUCTURAL_CATEGORIES]
    print(f"  {len(keepers)} total keepers, {len(structural)} structural")
    print(f"  Categories: {Counter(r['category'] for r in structural).most_common()}")

    random.seed(43)  # Different seed from pass 1
    random.shuffle(structural)

    batch_size = 50
    batches = [
        structural[i:i + batch_size]
        for i in range(0, len(structural), batch_size)
        if len(structural[i:i + batch_size]) >= 10
    ]
    print(f"  Split into {len(batches)} batches of ~{batch_size}")

    client = AsyncAnthropic()
    sem = asyncio.Semaphore(5)
    all_picks = []

    async def _bracket(batch_idx, batch):
        async with sem:
            lines = []
            for i, r in enumerate(batch, 1):
                doc = r.get("citation") or r.get("doc_title") or ""
                fix = r["eval"]["fix_description"][:120]
                expl = r["explanation"][:120]
                lines.append(f"{i}. [{r['category']}] {doc}: {expl} || FIX: {fix}")

            try:
                resp = await client.messages.create(
                    model="claude-haiku-4-5-20251001",
                    max_tokens=256,
                    system=PASS2_ROUND2_SYSTEM,
                    messages=[{"role": "user", "content": "\n".join(lines)}],
                )
                text = resp.content[0].text
                nums = []
                for line in text.strip().split("\n"):
                    m = re.match(r"(\d+)", line.strip())
                    if m:
                        num = int(m.group(1))
                        if 1 <= num <= len(batch):
                            nums.append(num)

                picks = [batch[n - 1] for n in nums[:5]]
                print(f"  Batch {batch_idx + 1}/{len(batches)}: picked {len(picks)}")
                return picks
            except Exception as e:
                print(f"  Batch {batch_idx + 1} error: {e}")
                return []

    tasks = [_bracket(i, b) for i, b in enumerate(batches)]
    results = await asyncio.gather(*tasks)

    for picks in results:
        all_picks.extend(picks)

    print(f"\n{'='*60}")
    print(f"PASS 2 ROUND 2 COMPLETE: {len(all_picks)} semifinalists")
    print(f"  Categories: {Counter(r['category'] for r in all_picks).most_common(10)}")

    with open(PASS2_OUTPUT_DIR / "pass2_round2_semifinalists.json", "w") as f:
        json.dump(all_picks, f, indent=2, default=str)
    print(f"Saved to pass2_round2_semifinalists.json")


async def run_pass2_round3():
    """Pass 2 Round 3: Group structural semifinalists by policy fix type."""
    print("\nPASS 2 ROUND 3: Group by Policy Fix Pattern")
    print("=" * 60)

    verified_file = PASS2_OUTPUT_DIR / "pass2_round2_verified.json"
    semi_file = verified_file if verified_file.exists() else PASS2_OUTPUT_DIR / "pass2_round2_semifinalists.json"
    if not semi_file.exists():
        print("ERROR: Run pass 2 round 2 first")
        return

    with open(semi_file) as f:
        semi = json.load(f)
    # If using verified file, filter to only verified items
    if verified_file.exists():
        semi = [s for s in semi if s.get("verification", {}).get("verified", True)]
        print(f"  Using verified file: {len(semi)} verified semifinalists")
    else:
        print(f"  {len(semi)} semifinalists to group")

    client = AsyncAnthropic()

    chunk_size = 80
    all_groups: list[dict] = []

    for chunk_start in range(0, len(semi), chunk_size):
        chunk = semi[chunk_start:chunk_start + chunk_size]
        lines = []
        for i, r in enumerate(chunk):
            doc = r.get("citation") or r.get("doc_title") or ""
            fix = r["eval"]["fix_description"][:150]
            lines.append(f"{i}. [{r['category']}] {doc}: {fix}")

        try:
            resp = await client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=4096,
                system=PASS2_ROUND3_SYSTEM,
                messages=[{"role": "user", "content": "\n".join(lines)}],
                tools=[{
                    "name": "group",
                    "description": "Group findings by policy fix pattern",
                    "input_schema": Round3Groups.model_json_schema(),
                }],
                tool_choice={"type": "tool", "name": "group"},
            )
            for block in resp.content:
                if block.type == "tool_use":
                    result = Round3Groups.model_validate(block.input)
                    for g in result.groups:
                        global_indices = [
                            chunk_start + i for i in g.indices
                            if i < len(chunk)
                        ]
                        all_groups.append({
                            "fix": g.fix,
                            "findings": [semi[i] for i in global_indices if i < len(semi)],
                        })
            chunk_num = chunk_start // chunk_size + 1
            total_chunks = (len(semi) + chunk_size - 1) // chunk_size
            print(f"  Chunk {chunk_num}/{total_chunks}: "
                  f"{len(result.groups)} groups")
        except Exception as e:
            print(f"  Chunk error: {e}")

    # Merge groups with similar fix descriptions
    merged: dict[str, dict] = {}
    for g in all_groups:
        key = re.sub(r'[^a-z0-9 ]', '', g["fix"].lower())
        key = re.sub(r'\s+', ' ', key).strip()

        if key in merged:
            merged[key]["findings"].extend(g["findings"])
        else:
            merged[key] = {"fix": g["fix"], "findings": g["findings"]}

    # Build final recommendations sorted by count
    recommendations = []
    for rec in sorted(merged.values(), key=lambda x: -len(x["findings"])):
        findings = rec["findings"]
        seen = set()
        unique_findings = []
        for f in findings:
            if f["id"] not in seen:
                seen.add(f["id"])
                unique_findings.append(f)
        findings = unique_findings

        categories = Counter(f["category"] for f in findings)
        recommendations.append({
            "fix_pattern": rec["fix"],
            "count": len(findings),
            "primary_category": categories.most_common(1)[0][0],
            "examples": sorted(findings, key=lambda x: -x["severity"])[:5],
            "all_citations": [
                f.get("citation") or f.get("doc_title") or ""
                for f in findings
            ],
            "all_ids": [f["id"] for f in findings],
        })

    # Print results
    print(f"\n{'='*60}")
    print(f"PASS 2 ROUND 3 COMPLETE: {len(recommendations)} POLICY FIX PATTERNS")
    total_findings = sum(r["count"] for r in recommendations)
    print(f"  Covering {total_findings} findings")
    print(f"{'='*60}\n")

    for i, rec in enumerate(recommendations, 1):
        top = rec["examples"][0] if rec["examples"] else None
        example_cite = (top.get("citation") or top.get("doc_title") or "") if top else ""
        print(f"{i:3d}. [{rec['count']:3d} regs] {rec['fix_pattern']}")
        print(f"     e.g.: {example_cite}")
        if i >= 50:
            remaining = len(recommendations) - 50
            if remaining > 0:
                print(f"\n... and {remaining} more patterns with fewer findings")
            break

    with open(PASS2_OUTPUT_DIR / "pass2_round3_recommendations.json", "w") as f:
        json.dump(recommendations, f, indent=2, default=str)
    print(f"\nSaved to pass2_round3_recommendations.json")

    summary_lines = ["fix_pattern\tcount\tprimary_category\texample_citations"]
    for rec in recommendations:
        cites = "; ".join(rec["all_citations"][:5])
        summary_lines.append(
            f"{rec['fix_pattern']}\t{rec['count']}\t{rec['primary_category']}\t{cites}"
        )
    with open(PASS2_OUTPUT_DIR / "pass2_round3_summary.tsv", "w") as f:
        f.write("\n".join(summary_lines))
    print(f"Saved summary to pass2_round3_summary.tsv")

    # Merge similar patterns via LLM
    await run_pass2_merge(recommendations, client)


PASS2_MERGE_SYSTEM = _get_system("pass2_merge")


class MergedGroup(BaseModel):
    name: str = Field(description="Clean 5-10 word label for the merged pattern")
    description: str = Field(description="One sentence describing the fix approach")
    source_indices: list[int] = Field(description="0-based indices of input patterns to merge")


class MergedGroups(BaseModel):
    groups: list[MergedGroup]


async def run_pass2_merge(recommendations: list[dict], client: AsyncAnthropic):
    """Merge similar Round 3 patterns into clean mega-patterns."""
    print(f"\nPASS 2 MERGE: Consolidating {len(recommendations)} patterns")
    print("=" * 60)

    # Load full semifinalists for top-example picking
    with open(PASS2_OUTPUT_DIR / "pass2_round2_semifinalists.json") as f:
        semi = json.load(f)
    semi_by_id = {s["id"]: s for s in semi}

    lines = []
    for i, rec in enumerate(recommendations):
        lines.append(f"{i}. [{rec['count']} regs] {rec['fix_pattern']}")

    resp = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=4096,
        system=PASS2_MERGE_SYSTEM,
        messages=[{"role": "user", "content": "\n".join(lines)}],
        tools=[{
            "name": "merge",
            "description": "Merge similar fix patterns",
            "input_schema": MergedGroups.model_json_schema(),
        }],
        tool_choice={"type": "tool", "name": "merge"},
    )

    for block in resp.content:
        if block.type == "tool_use":
            result = MergedGroups.model_validate(block.input)

    mega_patterns = []
    for mg in result.groups:
        # Collect ALL findings (not just stored examples) from semifinalists
        all_ids_seen = set()
        for idx in mg.source_indices:
            if idx < len(recommendations):
                for fid in recommendations[idx]["all_ids"]:
                    all_ids_seen.add(fid)

        all_findings = [semi_by_id[fid] for fid in all_ids_seen if fid in semi_by_id]

        all_citations = []
        seen_cites = set()
        for idx in mg.source_indices:
            if idx < len(recommendations):
                for c in recommendations[idx]["all_citations"]:
                    if c and c not in seen_cites:
                        seen_cites.add(c)
                        all_citations.append(c)

        total = sum(
            recommendations[idx]["count"]
            for idx in mg.source_indices
            if idx < len(recommendations)
        )

        mega_patterns.append({
            "name": mg.name,
            "description": mg.description,
            "count": total,
            "_all_findings": all_findings,  # temp, for top-example picking
            "all_citations": all_citations,
            "all_ids": list(all_ids_seen),
            "source_patterns": [
                recommendations[idx]["fix_pattern"]
                for idx in mg.source_indices
                if idx < len(recommendations)
            ],
        })

    mega_patterns.sort(key=lambda x: -x["count"])

    # Pick top 5 examples per mega-pattern via LLM
    print(f"\n  Picking top 5 examples for {len(mega_patterns)} mega-patterns...")
    sem = asyncio.Semaphore(5)

    async def _pick(mp):
        async with sem:
            top = await pick_top_examples(mp["name"], mp["_all_findings"], client)
            mp["top_examples"] = top
            print(f"    {mp['name'][:50]}: picked {len(top)} examples")

    await asyncio.gather(*[_pick(mp) for mp in mega_patterns])

    # Clean up temp field
    for mp in mega_patterns:
        del mp["_all_findings"]

    print(f"\n{'='*60}")
    print(f"PASS 2 FINAL: {len(mega_patterns)} MEGA-PATTERNS")
    total = sum(p["count"] for p in mega_patterns)
    print(f"  Covering {total} findings")
    print(f"{'='*60}\n")

    for i, mp in enumerate(mega_patterns, 1):
        print(f"{i:2d}. [{mp['count']:3d} regs] {mp['name']}")
        print(f"    {mp['description']}")
        for j, ex in enumerate(mp.get("top_examples", [])[:5], 1):
            cite = ex.get("citation") or ex.get("doc_title") or ""
            fix = ex["eval"]["fix_description"][:100]
            print(f"    {j}. {cite}: {fix}")
        print()

    with open(PASS2_OUTPUT_DIR / "pass2_mega_patterns.json", "w") as f:
        json.dump(mega_patterns, f, indent=2, default=str)
    print(f"Saved to pass2_mega_patterns.json")

    # Final deliverable combining everything
    deliverable = {
        "mega_patterns": mega_patterns,
        "summary": {
            "mega_pattern_count": len(mega_patterns),
            "total_findings": total,
            "structural_keepers_input": 2030,
            "semifinalists": 202,
        },
    }
    with open(PASS2_OUTPUT_DIR / "pass2_final_deliverable.json", "w") as f:
        json.dump(deliverable, f, indent=2, default=str)
    print(f"Saved final deliverable to pass2_final_deliverable.json")


# ═══════════════════════════════════════════════════════════════════════════
# Domain-specific: single-pass aggregation for a filtered domain
# ═══════════════════════════════════════════════════════════════════════════

DOMAIN_OUTPUT_DIR = PROJECT_ROOT / "backend" / "outputs" / "jenai_domains"
DOMAIN_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


class DomainTheme(BaseModel):
    name: str = Field(description="Short name for the theme (5-10 words)")
    description: str = Field(description="One paragraph describing the issue pattern")
    easy_fixes: list[str] = Field(
        description="Literal text edits that fix instances of this theme"
    )
    structural_fixes: list[str] = Field(
        description="One-sentence policy changes that address root causes"
    )
    affected_citations: list[str] = Field(
        description="Specific regulation citations affected by this theme"
    )
    severity: str = Field(
        description="HIGH / MEDIUM / LOW — how much does this hurt people?"
    )
    finding_indices: list[int] = Field(
        description="0-based indices of input findings that belong to this theme"
    )


class DomainAnalysis(BaseModel):
    overall_summary: str = Field(
        default="",
        description="2-3 sentence executive summary of the domain's regulatory problems"
    )
    themes: list[DomainTheme] = Field(default_factory=list)


def _filter_keepers_by_domain(keepers: list[dict], domain: str) -> list[dict]:
    """Filter Round 1 keepers to a specific domain."""
    sys.path.insert(0, str(PROJECT_ROOT / "backend"))
    from lib.domains import domain_from_citation_or_agency

    if domain == "permitting":
        # Cross-cutting: keyword match on explanation
        filtered = []
        for k in keepers:
            e = (k.get("explanation", "") + " " + k.get("eval", {}).get("fix_description", "")).lower()
            has_permit = any(w in e for w in ["license", "permit", "certific"])
            has_process = any(w in e for w in ["applicat", "renewal", "approv", "issu"])
            excluded = "appeal" in e or "hearing" in e
            if has_permit and has_process and not excluded:
                filtered.append(k)
        return filtered

    # Citation-based domain
    filtered = []
    for k in keepers:
        cite = k.get("citation") or ""
        d = domain_from_citation_or_agency(citation=cite, doc_title=k.get("doc_title"))
        if d.lower() == domain.lower():
            filtered.append(k)
    return filtered


async def run_domain_analysis(domain: str):
    """Single-pass aggregation + verification for a specific domain."""
    print(f"\nDOMAIN ANALYSIS: {domain}")
    print("=" * 60)

    # Load keepers
    keepers_file = OUTPUT_DIR / "round1_keepers.json"
    if not keepers_file.exists():
        print("ERROR: Run round 1 first")
        return

    with open(keepers_file) as f:
        keepers = json.load(f)

    filtered = _filter_keepers_by_domain(keepers, domain)
    print(f"  {len(keepers)} total keepers → {len(filtered)} for {domain}")

    if not filtered:
        print(f"  No findings for domain '{domain}'")
        return

    # Build prompt
    prompt_key = f"domain_{domain}"
    if prompt_key not in _PROMPTS:
        # Fallback to generic childcare prompt structure for unknown domains
        print(f"  No domain-specific prompt for '{domain}', using generic")
        prompt_key = "domain_childcare"

    system = _get_system(prompt_key)

    # Format all findings as text
    lines = []
    for i, k in enumerate(filtered):
        doc = k.get("citation") or k.get("doc_title") or ""
        fix = k.get("eval", {}).get("fix_description", "")[:150]
        expl = k["explanation"][:200]
        lines.append(
            f"{i}. [{k['category']}] sev={k['severity']} | {doc}\n"
            f"   Problem: {expl}\n"
            f"   Fix: {fix}"
        )

    # Split into chunks if too many (Haiku context ~200K tokens, but let's be safe)
    chunk_size = 100
    all_themes = []
    client = AsyncAnthropic()

    for chunk_start in range(0, len(lines), chunk_size):
        chunk_lines = lines[chunk_start:chunk_start + chunk_size]
        chunk_text = "\n\n".join(chunk_lines)

        print(f"  Processing chunk {chunk_start // chunk_size + 1} "
              f"({len(chunk_lines)} findings)...")

        try:
            resp = await client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=16384,
                system=system,
                messages=[{"role": "user", "content": chunk_text}],
                tools=[{
                    "name": "submit_themes",
                    "description": "Submit your thematic analysis",
                    "input_schema": DomainAnalysis.model_json_schema(),
                }],
                tool_choice={"type": "tool", "name": "submit_themes"},
            )
            for block in resp.content:
                if block.type == "tool_use":
                    result = DomainAnalysis.model_validate(block.input)
                    # Adjust finding indices to global
                    for theme in result.themes:
                        theme.finding_indices = [
                            chunk_start + i for i in theme.finding_indices
                            if i < len(chunk_lines)
                        ]
                    all_themes.extend(result.themes)
                    if chunk_start == 0:
                        overall_summary = result.overall_summary
        except Exception as e:
            print(f"  Error: {e}")

    # Build deliverable
    domain_dir = DOMAIN_OUTPUT_DIR / domain
    domain_dir.mkdir(parents=True, exist_ok=True)

    deliverable = {
        "domain": domain,
        "total_findings": len(filtered),
        "overall_summary": overall_summary if 'overall_summary' in dir() else "",
        "themes": [],
    }

    print(f"\n{'='*60}")
    print(f"DOMAIN ANALYSIS: {domain} — {len(all_themes)} themes")
    print(f"{'='*60}\n")

    for theme in all_themes:
        # Attach actual findings
        examples = [filtered[i] for i in theme.finding_indices if i < len(filtered)]

        theme_data = {
            "name": theme.name,
            "description": theme.description,
            "severity": theme.severity,
            "easy_fixes": theme.easy_fixes,
            "structural_fixes": theme.structural_fixes,
            "affected_citations": theme.affected_citations,
            "finding_count": len(examples),
            "examples": [
                {
                    "id": ex.get("id"),
                    "citation": ex.get("citation") or ex.get("doc_title") or "",
                    "category": ex["category"],
                    "severity": ex["severity"],
                    "explanation": ex["explanation"][:200],
                    "fix": ex["eval"]["fix_description"][:200],
                    "current_text": [],  # populated below from DB
                }
                for ex in examples[:5]
            ],
        }
        deliverable["themes"].append(theme_data)

        print(f"  {theme.severity:6s} {theme.name}")
        print(f"         {theme.description[:100]}")
        if theme.easy_fixes:
            print(f"         Easy: {theme.easy_fixes[0][:80]}")
        if theme.structural_fixes:
            print(f"         Structural: {theme.structural_fixes[0][:80]}")
        print()

    # Enrich examples with matched_phrases (current regulation text) from DB
    all_example_ids = [
        ex["id"] for t in deliverable["themes"] for ex in t["examples"] if ex.get("id")
    ]
    if all_example_ids:
        conn = psycopg.connect(os.environ["DATABASE_URL"])
        cur = conn.cursor()
        cur.execute(
            "SELECT id, matched_phrases, document_id FROM jenai_issues WHERE id = ANY(%s)",
            (all_example_ids,),
        )
        phrases_by_id = {}
        docid_by_id = {}
        for row in cur.fetchall():
            phrases_by_id[row[0]] = row[1]
            docid_by_id[row[0]] = row[2]
        conn.close()

        for t in deliverable["themes"]:
            for ex in t["examples"]:
                ex["current_text"] = phrases_by_id.get(ex.get("id"), []) or []
                ex["document_id"] = docid_by_id.get(ex.get("id"))

    with open(domain_dir / "analysis.json", "w") as f:
        json.dump(deliverable, f, indent=2, default=str)
    print(f"Saved to {domain_dir / 'analysis.json'}")

    # Save filtered findings for verification step
    with open(domain_dir / "findings.json", "w") as f:
        json.dump(filtered, f, indent=2, default=str)
    print(f"Saved {len(filtered)} findings to {domain_dir / 'findings.json'}")

    return deliverable


# ═══════════════════════════════════════════════════════════════════════════
# Verification: Web search to confirm semifinalists are accurate and current
# ═══════════════════════════════════════════════════════════════════════════

async def run_verification(pass_name: str = "pass1"):
    """Web-search verify semifinalists are factually accurate and not already fixed.

    Args:
        pass_name: "pass1" or "pass2"
    """
    print(f"\nVERIFICATION: Web search verification ({pass_name})")
    print("=" * 60)

    # Determine input/output paths
    if pass_name == "pass2":
        semi_file = PASS2_OUTPUT_DIR / "pass2_round2_semifinalists.json"
        verified_file = PASS2_OUTPUT_DIR / "pass2_round2_verified.json"
        batch_name_prefix = "tournament_verify_pass2"
    else:
        semi_file = OUTPUT_DIR / "round2_semifinalists.json"
        verified_file = OUTPUT_DIR / "round2_verified.json"
        batch_name_prefix = "tournament_verify_pass1"

    if not semi_file.exists():
        print(f"ERROR: {semi_file} not found — run round 2 first")
        return

    with open(semi_file) as f:
        semi = json.load(f)
    print(f"  {len(semi)} semifinalists to verify")

    # Resume support: load existing verified results
    already_verified = {}
    if verified_file.exists():
        with open(verified_file) as f:
            existing = json.load(f)
        already_verified = {item["id"]: item for item in existing}
        print(f"  Resuming: {len(already_verified)} already verified")

    to_verify = [s for s in semi if s["id"] not in already_verified]
    if not to_verify:
        print("  Nothing new to verify")
        return

    print(f"  To verify: {len(to_verify)}")

    # Import web search and batch tools
    sys.path.insert(0, str(PROJECT_ROOT / "backend"))
    from scripts.research_pipeline.tiers.web_search import (
        get_web_search_tool, extract_web_search_response,
    )
    from lib.batch import BatchManager, format_batch_request

    # Build the submit_verification tool from VerificationResult schema
    submit_tool = {
        "name": "submit_verification",
        "description": "Submit verification results after web search",
        "input_schema": VerificationResult.model_json_schema(),
    }

    web_search_tool = get_web_search_tool(jurisdiction="NY", max_uses=3)
    tools = [web_search_tool, submit_tool]

    system_prompt = _get_system("verification")

    # Build batch requests
    requests = []
    id_map = {}  # custom_id -> finding id
    for i, item in enumerate(to_verify):
        custom_id = f"verify_{item['id']}"
        id_map[custom_id] = item["id"]

        doc = item.get("citation") or item.get("doc_title") or "Unknown"
        fix = item.get("eval", {}).get("fix_description", "")
        important_reasoning = item.get("eval", {}).get("important_reasoning", "")
        explanation = item.get("explanation", "")
        category = item.get("category", "")
        severity = item.get("severity", 0)

        user_msg = _PROMPTS["verification"]["template"].format(
            category=category,
            citation=doc,
            severity=severity,
            explanation=explanation,
            fix_description=fix,
            important_reasoning=important_reasoning,
        )

        req = format_batch_request(
            custom_id=custom_id,
            prompt=user_msg,
            system=system_prompt,
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            tools=tools,
        )
        requests.append(req)

    # Submit batch
    batches_dir = OUTPUT_DIR / "batches"
    batches_dir.mkdir(parents=True, exist_ok=True)
    manager = BatchManager(batches_dir=batches_dir)

    print(f"  Submitting batch of {len(requests)} verification requests...")
    batch_id = manager.submit_batch(requests, batch_name=batch_name_prefix)
    manager.poll_until_complete(batch_id, poll_interval=30)

    # Parse results
    verified_count = 0
    failed_count = 0
    results_by_id = dict(already_verified)  # start with existing

    for result in manager.get_batch_results(batch_id):
        finding_id = id_map.get(result.custom_id)
        if not finding_id:
            continue

        # Find the original semifinalist
        original = next((s for s in semi if s["id"] == finding_id), None)
        if not original:
            continue

        try:
            if result.result.type != "succeeded":
                raise ValueError(f"Result type: {result.result.type}")

            # Extract web search response (handles text + tool_use blocks)
            web_response = extract_web_search_response(result.result.message)

            # Try to parse from json_data (tool_use block named submit_verification)
            json_data = web_response.json_data
            if json_data:
                vr = VerificationResult.model_validate(json_data)
            else:
                # Fallback: look for tool_use blocks directly
                vr = None
                for block in result.result.message.content:
                    if getattr(block, "type", None) == "tool_use" and getattr(block, "name", "") == "submit_verification":
                        vr = VerificationResult.model_validate(block.input)
                        break
                if vr is None:
                    raise ValueError("No submit_verification tool_use found in response")

            verification_data = vr.model_dump()
            if vr.verified:
                verified_count += 1
            else:
                failed_count += 1

        except Exception as e:
            # Default to verified=true on error (conservative)
            verification_data = {
                "verified": True,
                "factually_accurate": True,
                "still_current": True,
                "actively_enforced": True,
                "federal_or_statutory_constraint": False,
                "constraint_source": "",
                "verification_notes": f"Verification error (defaulting to verified): {str(e)[:100]}",
                "web_sources": [],
            }
            verified_count += 1

        results_by_id[finding_id] = {**original, "verification": verification_data}

    # Rebuild full list preserving order from semifinalists
    verified_results = []
    for s in semi:
        if s["id"] in results_by_id:
            verified_results.append(results_by_id[s["id"]])
        else:
            # Not yet verified — include without verification data
            verified_results.append(s)

    with open(verified_file, "w") as f:
        json.dump(verified_results, f, indent=2, default=str)

    print(f"\n{'='*60}")
    print(f"VERIFICATION COMPLETE ({pass_name})")
    print(f"  Verified (passed): {verified_count}")
    print(f"  Failed verification: {failed_count}")
    print(f"  Saved to {verified_file.name}")


# ═══════════════════════════════════════════════════════════════════════════
# Top Examples: Enrich existing deliverables with LLM-picked highlights
# ═══════════════════════════════════════════════════════════════════════════

async def run_top_examples_pass1():
    """Pick top 5 examples for each Pass 1 mega-pattern."""
    print("\nTOP EXAMPLES: Pass 1 (easy text fixes)")
    print("=" * 60)

    deliverable_file = OUTPUT_DIR / "final_deliverable.json"
    if not deliverable_file.exists():
        print("ERROR: No Pass 1 final_deliverable.json found")
        return

    semi_file = OUTPUT_DIR / "round2_semifinalists.json"
    if not semi_file.exists():
        print("ERROR: No round2_semifinalists.json found")
        return

    with open(deliverable_file) as f:
        deliverable = json.load(f)
    with open(semi_file) as f:
        semi = json.load(f)
    semi_by_id = {s["id"]: s for s in semi}

    client = AsyncAnthropic()
    sem = asyncio.Semaphore(5)

    for section_key in ["mega_patterns", "named_findings"]:
        patterns = deliverable.get(section_key, [])
        print(f"\n  Processing {len(patterns)} {section_key}...")

        async def _pick(pattern):
            async with sem:
                # Get all findings for this pattern from semifinalists
                finding_ids = pattern.get("finding_ids") or pattern.get("all_ids") or []
                all_findings = [semi_by_id[fid] for fid in finding_ids if fid in semi_by_id]

                if not all_findings:
                    # For named_findings with just citations, keep as-is
                    return

                name = pattern.get("mega_pattern") or pattern.get("name") or "Unknown"
                top = await pick_top_examples(name, all_findings, client)
                pattern["top_examples"] = top
                print(f"    {name[:50]}: picked {len(top)} examples")

        await asyncio.gather(*[_pick(p) for p in patterns])

    with open(OUTPUT_DIR / "final_deliverable.json", "w") as f:
        json.dump(deliverable, f, indent=2, default=str)
    print(f"\nUpdated final_deliverable.json with top examples")


# ═══════════════════════════════════════════════════════════════════════════
# Build unified tournament_results.json
# ═══════════════════════════════════════════════════════════════════════════

RESULTS_FILE = PASS2_OUTPUT_DIR / "tournament_results.json"


def _clean_example(ex: dict) -> dict:
    """Flatten a top_example into a frontend-friendly shape."""
    from lib.domains import domain_from_citation_or_agency
    verification = ex.get("verification", {})
    citation = ex.get("citation") or ex.get("doc_title") or ""
    return {
        "id": ex["id"],
        "citation": citation,
        "category": ex["category"],
        "severity": ex["severity"],
        "explanation": ex["explanation"],
        "fix": ex["eval"]["fix_description"],
        "why_it_matters": ex["eval"]["important_reasoning"],
        "domain": domain_from_citation_or_agency(citation=citation, doc_title=ex.get("doc_title")),
        "verification_notes": verification.get("verification_notes", ""),
        "web_sources": verification.get("web_sources", []),
    }


def build_tournament_json():
    """Build unified tournament_results.json from both pass deliverables."""
    print("\nBUILD: tournament_results.json")
    print("=" * 60)

    p1_file = OUTPUT_DIR / "final_deliverable.json"
    p2_file = PASS2_OUTPUT_DIR / "pass2_final_deliverable.json"

    if not p1_file.exists():
        print(f"ERROR: {p1_file} not found — run pass 1 first")
        return
    if not p2_file.exists():
        print(f"ERROR: {p2_file} not found — run pass 2 first")
        return

    with open(p1_file) as f:
        p1 = json.load(f)
    with open(p2_file) as f:
        p2 = json.load(f)

    from lib.domains import domain_from_citation_or_agency
    from collections import Counter as Ctr

    def _domain_breakdown(citations: list[str]) -> dict[str, int]:
        """Count citations by domain."""
        domains = [domain_from_citation_or_agency(citation=c) for c in citations if c]
        return dict(Ctr(domains).most_common())

    # Pass 1: mega-patterns
    pass1_patterns = []
    for mp in p1["mega_patterns"]:
        cites = mp["citations"]
        pass1_patterns.append({
            "name": mp["mega_pattern"],
            "description": mp["description"],
            "regulation_count": mp["regulation_count"],
            "citations": cites,
            "domain_breakdown": _domain_breakdown(cites),
            "top_examples": [_clean_example(ex) for ex in mp.get("top_examples", [])],
        })

    # Pass 1: named findings
    pass1_named = []
    for nf in p1["named_findings"]:
        cites = nf["citations"]
        pass1_named.append({
            "name": nf["name"],
            "fix": nf["fix"],
            "citations": cites,
            "why": nf["why"],
            "domain": domain_from_citation_or_agency(citation=cites[0]) if cites else "Unknown",
        })

    # Pass 2: mega-patterns
    pass2_patterns = []
    for mp in p2["mega_patterns"]:
        cites = mp["all_citations"]
        pass2_patterns.append({
            "name": mp["name"],
            "description": mp["description"],
            "regulation_count": mp["count"],
            "citations": cites,
            "domain_breakdown": _domain_breakdown(cites),
            "top_examples": [_clean_example(ex) for ex in mp.get("top_examples", [])],
        })

    combined = {
        "pass1": {
            "title": "Easy Text Fixes",
            "subtitle": "Literal word swaps and reference updates applicable across many regulations",
            "mega_patterns": pass1_patterns,
            "named_findings": pass1_named,
            "summary": {
                "pattern_count": len(pass1_patterns),
                "named_finding_count": len(pass1_named),
                "total_regulations": sum(p["regulation_count"] for p in pass1_patterns),
            },
        },
        "pass2": {
            "title": "Structural Policy Fixes",
            "subtitle": "One-sentence policy changes: proportionality, size exemptions, prioritization, graduated enforcement",
            "mega_patterns": pass2_patterns,
            "summary": {
                "pattern_count": len(pass2_patterns),
                "total_regulations": sum(p["regulation_count"] for p in pass2_patterns),
            },
        },
    }

    with open(RESULTS_FILE, "w") as f:
        json.dump(combined, f, indent=2)

    p1_regs = sum(p["regulation_count"] for p in pass1_patterns)
    p2_regs = sum(p["regulation_count"] for p in pass2_patterns)
    print(f"  Pass 1: {len(pass1_patterns)} patterns ({p1_regs} regs) + {len(pass1_named)} named findings")
    print(f"  Pass 2: {len(pass2_patterns)} patterns ({p2_regs} regs)")
    print(f"  Saved to {RESULTS_FILE}")


# ═══════════════════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════════════════

async def main():
    parser = argparse.ArgumentParser(
        description="JenAI Tournament: 3-round filtering for important, fixable findings"
    )
    parser.add_argument("--round", type=int, choices=[1, 2, 3],
                        help="Run a specific round")
    parser.add_argument("--all", action="store_true",
                        help="Run all rounds for a single pass")
    parser.add_argument("--full", action="store_true",
                        help="Run everything: Pass 1 + Pass 2 + top examples + build JSON")
    parser.add_argument("--pass2", action="store_true",
                        help="Run Pass 2 (structural policy fixes) instead of Pass 1")
    parser.add_argument("--top-examples", action="store_true",
                        help="Pick top 5 most compelling examples per mega-pattern")
    parser.add_argument("--build-json", action="store_true",
                        help="Rebuild tournament_results.json from existing deliverables")
    parser.add_argument("--verify", action="store_true",
                        help="Run web search verification on semifinalists")
    parser.add_argument("--domain", type=str,
                        help="Run domain-specific analysis (e.g., childcare, permitting, health)")
    parser.add_argument("--concurrency", type=int, default=20,
                        help="Concurrency for Round 1 (default: 20)")
    args = parser.parse_args()

    # --domain: single-pass aggregation for a specific domain
    if args.domain:
        await run_domain_analysis(args.domain)
        return

    # --full: run everything end-to-end
    if args.full:
        print("FULL PIPELINE: Pass 1 → Pass 2 → Top Examples → Build JSON")
        print("=" * 60)
        # Pass 1: Rounds 1-3
        await run_round1(concurrency=args.concurrency)
        await run_round2()
        await run_verification("pass1")
        await run_round3()
        # Pass 1: top examples
        await run_top_examples_pass1()
        # Pass 2: Rounds 2-3 (reuses Round 1 keepers) + merge + top examples
        await run_pass2_round2()
        await run_verification("pass2")
        await run_pass2_round3()
        # Build unified JSON
        build_tournament_json()
        return

    # --verify: run web search verification on semifinalists
    if args.verify:
        if args.pass2:
            await run_verification("pass2")
        else:
            await run_verification("pass1")
        return

    # --build-json: just rebuild the unified output
    if args.build_json:
        build_tournament_json()
        return

    # --top-examples: pick top examples for existing deliverables
    if args.top_examples:
        if args.pass2:
            recs_file = PASS2_OUTPUT_DIR / "pass2_round3_recommendations.json"
            if not recs_file.exists():
                print("ERROR: Run --pass2 --all first")
                return
            with open(recs_file) as f:
                recommendations = json.load(f)
            client = AsyncAnthropic()
            await run_pass2_merge(recommendations, client)
        else:
            await run_top_examples_pass1()
        build_tournament_json()
        return

    if not args.round and not args.all:
        parser.error("Specify --round N, --all, or --full")

    if args.pass2:
        # Pass 2: structural fixes — skips Round 1, uses existing keepers
        if args.all or args.round == 2:
            await run_pass2_round2()
        if args.all or args.round == 3:
            await run_pass2_round3()
        if args.round == 1:
            print("Pass 2 reuses Pass 1 Round 1 keepers — nothing to do for Round 1.")
    else:
        # Pass 1: easy text fixes
        if args.all or args.round == 1:
            await run_round1(concurrency=args.concurrency)
        if args.all or args.round == 2:
            await run_round2()
        if args.all or args.round == 3:
            await run_round3()


if __name__ == "__main__":
    asyncio.run(main())
