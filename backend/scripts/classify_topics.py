#!/usr/bin/env python3
"""
Multi-label topic classification for Barrier findings.

Assigns 2-6 topic labels to each finding from a 50-topic taxonomy organized
into 4 groups: agency/domain, process type, affected population, reform theme.

Uses Anthropic Batch API with Haiku for cost-efficient classification.

Usage:
  cd backend && source .venv/bin/activate

  # Dry run — show counts and sample:
  python scripts/classify_topics.py

  # Submit batch to classify all findings (~$3-5):
  python scripts/classify_topics.py --execute

  # Poll batch and import results:
  python scripts/classify_topics.py --poll

  # Limit to a subset for testing:
  python scripts/classify_topics.py --execute --limit 100

  # Re-classify findings that already have topics:
  python scripts/classify_topics.py --execute --force
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path
from pydantic import BaseModel, Field
from dotenv import load_dotenv
import psycopg
import yaml

PROJECT_ROOT = Path(__file__).parent.parent.parent
load_dotenv(PROJECT_ROOT / "backend" / ".env")

sys.path.insert(0, str(PROJECT_ROOT / "backend"))
from lib.batch import BatchManager, format_batch_request

BATCH_DIR = PROJECT_ROOT / "backend" / "outputs" / "topic_classification"
BATCH_DIR.mkdir(parents=True, exist_ok=True)

# Load prompt from YAML
with open(PROJECT_ROOT / "prompts" / "topic_classification.yaml") as f:
    _PROMPTS = yaml.safe_load(f)

SYSTEM_PROMPT = _PROMPTS["classify"]["system"].strip()
TEMPLATE = _PROMPTS["classify"]["template"].strip()

# Extract valid topic labels from the YAML prompt (single source of truth)
VALID_TOPICS = set(re.findall(r'^\s+-\s+(\w+):', SYSTEM_PROMPT, re.MULTILINE))


class TopicLabels(BaseModel):
    topics: list[str] = Field(
        description="2-6 topic labels from the taxonomy"
    )


SUBMIT_TOOL = {
    "name": "submit_topics",
    "description": "Submit topic labels for this finding",
    "input_schema": TopicLabels.model_json_schema(),
}


def get_findings_to_classify(conn, limit: int = 0, force: bool = False) -> list[dict]:
    """Get barrier_issues that need topic classification."""
    cur = conn.cursor()

    where_clause = "WHERE ji.category != 'OTHER'"
    if not force:
        where_clause += " AND (ji.topics IS NULL OR ji.topics = '{}')"

    limit_clause = f"LIMIT {limit}" if limit else ""

    cur.execute(f"""
        SELECT ji.id, ji.category, ji.explanation,
               COALESCE(rd.citation, gd.title) as citation
        FROM barrier_issues ji
        LEFT JOIN regulatory_documents rd ON ji.document_id = rd.id
        LEFT JOIN guidance_documents gd ON ji.guidance_document_id = gd.id
        {where_clause}
        ORDER BY ji.id
        {limit_clause}
    """)

    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]


def _save_id_map(id_map: dict):
    """Persist id_map to disk for crash recovery in --poll mode."""
    with open(BATCH_DIR / "latest_id_map.json", "w") as f:
        json.dump(id_map, f)


def _load_id_map() -> dict | None:
    """Load persisted id_map, or None if not found."""
    path = BATCH_DIR / "latest_id_map.json"
    if not path.exists():
        return None
    with open(path) as f:
        return json.load(f)


def build_batch_requests(findings: list[dict]) -> tuple[list[dict], dict]:
    """Build batch requests for topic classification."""
    requests = []
    id_map = {}

    for f in findings:
        custom_id = f"topic_{f['id']}"
        id_map[custom_id] = f["id"]

        user_msg = TEMPLATE.format(
            citation=f["citation"] or "Unknown",
            category=f["category"],
            explanation=f["explanation"][:500],
        )

        req = format_batch_request(
            custom_id=custom_id,
            prompt=user_msg,
            system=SYSTEM_PROMPT,
            model="claude-haiku-4-5-20251001",
            max_tokens=256,
            tools=[SUBMIT_TOOL],
        )
        requests.append(req)

    return requests, id_map


def import_results(conn, manager: BatchManager, batch_id: str, id_map: dict):
    """Parse batch results and update DB with topic labels."""
    cur = conn.cursor()

    classified = 0
    errors = 0

    for result in manager.get_batch_results(batch_id):
        finding_id = id_map.get(result.custom_id)
        if not finding_id:
            continue

        try:
            if result.result.type != "succeeded":
                raise ValueError(f"Result type: {result.result.type}")

            # Extract tool_use block
            topics = None
            for block in result.result.message.content:
                if getattr(block, "type", None) == "tool_use" and getattr(block, "name", "") == "submit_topics":
                    raw_topics = block.input.get("topics", [])
                    # Validate: only keep known topics
                    topics = [t for t in raw_topics if t in VALID_TOPICS]
                    break

            if topics is None:
                # Fallback: try to parse from text
                for block in result.result.message.content:
                    if getattr(block, "type", None) == "text":
                        found = [t for t in VALID_TOPICS if t in block.text]
                        if found:
                            topics = found[:6]
                            break

            if not topics:
                raise ValueError("No topics found in response")

            cur.execute(
                "UPDATE barrier_issues SET topics = %s WHERE id = %s",
                (topics, finding_id),
            )
            classified += 1

        except Exception as e:
            errors += 1
            if errors <= 5:
                print(f"  Error for {result.custom_id}: {e}")

        # Commit every 500
        if (classified + errors) % 500 == 0:
            conn.commit()
            print(f"  Progress: {classified} classified, {errors} errors...")

    conn.commit()
    print(f"\nImported: {classified} classified, {errors} errors")


def run_topic_classification(limit: int = 0, force: bool = False, submit_only: bool = False):
    """Classify untagged findings. Can be called from other scripts.

    Args:
        submit_only: If True, submit the batch and return immediately without
            polling. Use this when called from within a pipeline to avoid
            blocking. Run ``--poll`` separately to import results.
    """
    conn = psycopg.connect(os.environ["DATABASE_URL"])
    manager = BatchManager(batches_dir=BATCH_DIR)

    findings = get_findings_to_classify(conn, limit=limit, force=force)
    if not findings:
        print("  Topic classification: nothing to classify")
        conn.close()
        return

    print(f"  Topic classification: {len(findings)} findings to classify")
    requests, id_map = build_batch_requests(findings)
    batch_id = manager.submit_batch(requests, batch_name="topic_classification")
    (BATCH_DIR / "latest_batch_id.txt").write_text(batch_id)
    _save_id_map(id_map)

    if submit_only:
        print(f"  Batch submitted: {batch_id}")
        print("  Run 'python scripts/classify_topics.py --poll' to import results")
        conn.close()
        return

    manager.poll_until_complete(batch_id, poll_interval=30)
    import_results(conn, manager, batch_id, id_map)
    conn.close()


def main():
    parser = argparse.ArgumentParser(
        description="Multi-label topic classification for Barrier findings"
    )
    parser.add_argument("--execute", action="store_true",
                        help="Submit batch (default is dry run)")
    parser.add_argument("--poll", action="store_true",
                        help="Poll batch and import results")
    parser.add_argument("--limit", type=int, default=0,
                        help="Limit findings to classify")
    parser.add_argument("--force", action="store_true",
                        help="Re-classify findings that already have topics")
    args = parser.parse_args()

    conn = psycopg.connect(os.environ["DATABASE_URL"])
    manager = BatchManager(batches_dir=BATCH_DIR)

    if args.poll:
        batch_file = BATCH_DIR / "latest_batch_id.txt"
        if not batch_file.exists():
            print("ERROR: No batch to poll. Run --execute first.")
            return
        batch_id = batch_file.read_text().strip()
        print(f"Polling batch {batch_id}...")
        manager.poll_until_complete(batch_id, poll_interval=30)

        # Load persisted id_map (or rebuild from DB as fallback)
        id_map = _load_id_map()
        if id_map is None:
            print("  No saved id_map found, rebuilding from DB...")
            findings = get_findings_to_classify(conn, force=True)
            _, id_map = build_batch_requests(findings)
        import_results(conn, manager, batch_id, id_map)
        conn.close()
        return

    # Find findings to classify
    findings = get_findings_to_classify(conn, limit=args.limit, force=args.force)
    print(f"Found {len(findings)} findings to classify")

    if not findings:
        print("Nothing to classify!")
        conn.close()
        return

    if not args.execute:
        # Show sample
        for f in findings[:5]:
            print(f"  {f['citation'] or '?'}: {f['explanation'][:100]}")
        est = len(findings) * 0.00015  # rough Haiku batch cost
        print(f"\nDry run — use --execute to submit batch (~${est:.2f})")
        conn.close()
        return

    # Build and submit batch
    requests, id_map = build_batch_requests(findings)
    print(f"Submitting batch of {len(requests)} requests...")
    batch_id = manager.submit_batch(requests, batch_name="topic_classification")

    (BATCH_DIR / "latest_batch_id.txt").write_text(batch_id)
    _save_id_map(id_map)
    print(f"Batch submitted: {batch_id}")

    # Poll and import
    print("Polling...")
    manager.poll_until_complete(batch_id, poll_interval=30)
    import_results(conn, manager, batch_id, id_map)
    conn.close()


if __name__ == "__main__":
    main()
