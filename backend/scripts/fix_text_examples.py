#!/usr/bin/env python3
"""
Fix paraphrased text_examples by re-extracting verbatim quotes.

Finds barrier_issues where text_examples don't match the regulation content,
then uses LLM to extract proper verbatim quotes.

Usage:
  cd backend && source .venv/bin/activate

  # Preview what needs fixing:
  python scripts/fix_text_examples.py

  # Submit batch to fix all (~4,455 issues, ~$3 Haiku batch):
  python scripts/fix_text_examples.py --execute

  # Check batch status / import results:
  python scripts/fix_text_examples.py --poll

  # Limit to a subset:
  python scripts/fix_text_examples.py --execute --limit 100
"""

import argparse
import json
import os
import sys
from difflib import SequenceMatcher
from pathlib import Path
from dotenv import load_dotenv
import psycopg

PROJECT_ROOT = Path(__file__).parent.parent.parent
load_dotenv(PROJECT_ROOT / "backend" / ".env")

sys.path.insert(0, str(PROJECT_ROOT / "backend"))
from lib.batch import BatchManager, format_batch_request

VERBATIM_THRESHOLD = 0.6
BATCH_DIR = PROJECT_ROOT / "backend" / "outputs" / "fix_text_examples"
BATCH_DIR.mkdir(parents=True, exist_ok=True)

SYSTEM_PROMPT = """\
You previously analyzed a regulatory section and found an issue. Your text_examples \
were paraphrased instead of verbatim. Now provide ONLY verbatim text excerpts from \
the section text that illustrate the issue.

CRITICAL RULES:
- Every excerpt MUST be copied VERBATIM from the section text below
- Do NOT paraphrase, summarize, or create hypothetical scenarios
- Do NOT generate examples of what "could happen" — only quote actual regulatory text
- Copy the exact words, punctuation, and capitalization from the section text
- Each excerpt should be 1-3 sentences that illustrate the regulatory problem
- If you cannot find a verbatim excerpt that illustrates the issue, return an empty list

Call submit_examples with your verbatim excerpts."""

SUBMIT_TOOL = {
    "name": "submit_examples",
    "description": "Submit verbatim text excerpts from the regulation",
    "input_schema": {
        "type": "object",
        "properties": {
            "text_examples": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Verbatim excerpts from the section text (1-5 excerpts)",
            },
        },
        "required": ["text_examples"],
    },
}


def best_match_ratio(example: str, content: str) -> float:
    """Find the best fuzzy match ratio for an example in the content."""
    ex = example.strip().lower()
    c = content.lower()
    if ex[:40] in c:
        return 1.0
    ex_snippet = ex[:80]
    ex_len = len(ex)
    best = 0.0
    step = max(1, ex_len // 4)
    for start in range(0, len(c) - min(ex_len, len(c)) + 1, step):
        window = c[start:start + ex_len + 20]
        ratio = SequenceMatcher(None, ex_snippet, window[:80]).ratio()
        if ratio > best:
            best = ratio
        if best > 0.85:
            break
    return best


def find_bad_issues(conn, limit: int = 0) -> list[dict]:
    """Find issues where text_examples are paraphrased."""
    cur = conn.cursor()
    limit_clause = f"LIMIT {limit}" if limit else ""
    cur.execute(f"""
        SELECT ji.id, ji.category, ji.explanation, ji.text_examples,
               rd.content, rd.citation
        FROM barrier_issues ji
        JOIN regulatory_documents rd ON ji.document_id = rd.id
        WHERE ji.text_examples IS NOT NULL
          AND array_length(ji.text_examples, 1) > 0
          AND rd.content IS NOT NULL
        ORDER BY ji.id
        {limit_clause}
    """)

    bad = []
    for row in cur.fetchall():
        issue_id, category, explanation, examples, content, citation = row
        has_bad = any(
            best_match_ratio(ex, content) < VERBATIM_THRESHOLD
            for ex in (examples or [])
            if ex
        )
        if has_bad:
            bad.append({
                "id": issue_id,
                "category": category,
                "explanation": explanation,
                "old_examples": examples,
                "content": content,
                "citation": citation,
            })
    return bad


def build_batch_requests(bad_issues: list[dict]) -> list[dict]:
    """Build batch API requests for re-extracting text_examples."""
    requests = []
    for issue in bad_issues:
        user_msg = (
            f"Issue found: [{issue['category']}] {issue['explanation'][:300]}\n"
            f"Citation: {issue['citation']}\n\n"
            f"SECTION TEXT:\n{issue['content']}"
        )
        req = format_batch_request(
            custom_id=f"fix_{issue['id']}",
            prompt=user_msg,
            system=SYSTEM_PROMPT,
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            tools=[SUBMIT_TOOL],
        )
        requests.append(req)
    return requests


def import_results(conn, manager: BatchManager, batch_id: str, bad_issues: list[dict]):
    """Parse batch results and update DB."""
    issue_map = {f"fix_{i['id']}": i for i in bad_issues}
    cur = conn.cursor()

    updated = 0
    empty = 0
    errors = 0

    for result in manager.get_batch_results(batch_id):
        issue = issue_map.get(result.custom_id)
        if not issue:
            continue

        try:
            if result.result.type != "succeeded":
                raise ValueError(f"Result type: {result.result.type}")

            # Extract tool_use block
            new_examples = None
            for block in result.result.message.content:
                if getattr(block, "type", None) == "tool_use" and getattr(block, "name", "") == "submit_examples":
                    new_examples = block.input.get("text_examples", [])
                    break

            if new_examples is None:
                raise ValueError("No submit_examples tool call found")

            # Validate: check new examples are actually verbatim
            content = issue["content"]
            verified = [
                ex for ex in new_examples
                if ex and best_match_ratio(ex, content) >= VERBATIM_THRESHOLD
            ]

            if verified:
                cur.execute(
                    "UPDATE barrier_issues SET text_examples = %s, is_verbatim = true WHERE id = %s",
                    (verified, issue["id"]),
                )
                updated += 1
            else:
                # No good verbatim quotes — keep existing text_examples as summaries
                # (don't clear them, just ensure is_verbatim=false)
                cur.execute(
                    "UPDATE barrier_issues SET is_verbatim = false WHERE id = %s",
                    (issue["id"],),
                )
                empty += 1

        except Exception as e:
            errors += 1
            if errors <= 3:
                print(f"  Error for {result.custom_id}: {e}")

        # Commit every 100 updates to avoid connection timeout
        if (updated + empty) % 100 == 0 and (updated + empty) > 0:
            conn.commit()

    conn.commit()
    print(f"\nImported: {updated} fixed, {empty} cleared (no good quotes), {errors} errors")


def main():
    parser = argparse.ArgumentParser(description="Fix paraphrased text_examples")
    parser.add_argument("--execute", action="store_true", help="Submit batch to fix")
    parser.add_argument("--poll", action="store_true", help="Poll batch and import results")
    parser.add_argument("--limit", type=int, default=0, help="Limit issues to check")
    args = parser.parse_args()

    conn = psycopg.connect(os.environ["DATABASE_URL"])
    manager = BatchManager(batches_dir=BATCH_DIR)

    if args.poll:
        # Find the most recent batch
        batch_file = BATCH_DIR / "latest_batch_id.txt"
        if not batch_file.exists():
            print("ERROR: No batch to poll. Run --execute first.")
            return
        batch_id = batch_file.read_text().strip()
        print(f"Polling batch {batch_id}...")

        manager.poll_until_complete(batch_id, poll_interval=30)

        # Need to re-find bad issues to map results
        print("Finding issues to map results...")
        bad = find_bad_issues(conn, limit=args.limit)
        import_results(conn, manager, batch_id, bad)
        conn.close()
        return

    # Find bad issues
    print("Scanning for paraphrased text_examples...")
    bad = find_bad_issues(conn, limit=args.limit)
    print(f"Found {len(bad)} issues with paraphrased text_examples")

    if not bad:
        print("Nothing to fix!")
        conn.close()
        return

    if not args.execute:
        print("\nSample issues:")
        for issue in bad[:5]:
            print(f"  id={issue['id']} {issue['citation']}")
            for ex in issue['old_examples'][:1]:
                print(f"    \"{ex[:100]}\"")
        print(f"\nDry run — use --execute to submit batch (~${len(bad) * 0.0007:.2f} Haiku batch)")
        conn.close()
        return

    # Build and submit batch
    requests = build_batch_requests(bad)
    print(f"Submitting batch of {len(requests)} requests...")
    batch_id = manager.submit_batch(requests, batch_name="fix_text_examples")

    # Save batch ID for --poll
    (BATCH_DIR / "latest_batch_id.txt").write_text(batch_id)
    print(f"Batch submitted: {batch_id}")
    print(f"Run --poll to check status and import results")

    # Poll and import
    print("Polling...")
    manager.poll_until_complete(batch_id, poll_interval=30)
    import_results(conn, manager, batch_id, bad)
    conn.close()


if __name__ == "__main__":
    main()
