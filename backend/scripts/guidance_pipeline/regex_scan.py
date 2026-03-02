"""Scan guidance documents against compliance issue regex patterns.

Runs the same 41 patterns from prompts/compliance_issues.yaml against
guidance_documents.content. Saves matches to compliance_issues table
using guidance_document_id FK.
"""

import re
import time
import uuid
from pathlib import Path

import yaml

from lib.db import get_db_connection

PROMPTS_PATH = Path(__file__).resolve().parent.parent.parent.parent / "prompts" / "compliance_issues.yaml"

CONTEXT_CHARS = 300  # chars before/after match for context


def _load_patterns() -> dict[str, list[re.Pattern]]:
    """Load compiled regex patterns from compliance_issues.yaml."""
    with open(PROMPTS_PATH) as f:
        data = yaml.safe_load(f)

    result = {}
    for name, config in data.items():
        patterns = config.get("patterns", [])
        if patterns:
            result[name] = [re.compile(p, re.IGNORECASE) for p in patterns]
    return result


def _extract_context(content: str, match: re.Match) -> str:
    """Extract text window around the match."""
    start = max(0, match.start() - CONTEXT_CHARS)
    end = min(len(content), match.end() + CONTEXT_CHARS)
    snippet = content[start:end].strip()
    snippet = re.sub(r'\s+', ' ', snippet)
    if start > 0:
        snippet = "..." + snippet
    if end < len(content):
        snippet = snippet + "..."
    return snippet


def regex_scan(
    agency: str | None = None,
    doc_type: str | None = None,
    execute: bool = False,
) -> None:
    """Scan guidance documents for compliance issue patterns.

    Args:
        agency: Filter to a specific agency
        doc_type: Filter to a specific doc_type
        execute: If True, save matches to compliance_issues table. Otherwise output only.
    """
    conn = get_db_connection()
    if not conn:
        raise ConnectionError("Could not connect to database")

    try:
        cur = conn.cursor()

        # Build query for eligible documents
        conditions = [
            "policy_category IN ('policy_directive', 'informational')",
            "is_attachment = false",
            "content IS NOT NULL",
            "content NOT LIKE '%%PDF-%%'",  # skip raw PDF blobs (text extraction failed)
        ]
        params: list[str] = []
        if agency:
            conditions.append("agency = %s")
            params.append(agency)
        if doc_type:
            conditions.append("doc_type = %s")
            params.append(doc_type)

        where = " AND ".join(conditions)
        cur.execute(f"SELECT id, doc_type, title, url, content FROM guidance_documents WHERE {where}", params)
        docs = cur.fetchall()

        print(f"Scanning {len(docs)} guidance documents...")
        if not docs:
            print("No documents match filters. Run --classify first?")
            return

        patterns = _load_patterns()
        print(f"Loaded {len(patterns)} issue types with patterns")

        if execute:
            run_id = f"guidance_{uuid.uuid4().hex[:8]}"
            # Check for existing guidance matches
            cur.execute("SELECT COUNT(*) FROM compliance_issues WHERE guidance_document_id IS NOT NULL")
            existing = cur.fetchone()[0]
            if existing > 0:
                print(f"Clearing {existing} existing guidance matches...")
                cur.execute("DELETE FROM compliance_issues WHERE guidance_document_id IS NOT NULL")
                # NOT committing here — delete + inserts commit atomically at end of scan.
                # On error, conn.close() in finally block auto-rolls back, preserving old data.
            print(f"Run ID: {run_id}")
        else:
            print("(dry run — use --execute to save to DB)")

        print()

        # Scan
        start = time.time()
        hits_by_issue: dict[str, int] = {}
        docs_by_issue: dict[str, set[int]] = {}
        total_docs_with_hits: set[int] = set()
        saved = 0

        for i, (doc_id, dt, title, url, content) in enumerate(docs):
            if (i + 1) % 2000 == 0:
                elapsed = time.time() - start
                rate = (i + 1) / elapsed
                eta = (len(docs) - i - 1) / rate
                print(f"  Processed {i + 1}/{len(docs)}, ETA: {eta:.0f}s")

            for issue_name, compiled in patterns.items():
                for pat in compiled:
                    m = pat.search(content)
                    if m:
                        hits_by_issue[issue_name] = hits_by_issue.get(issue_name, 0) + 1
                        if issue_name not in docs_by_issue:
                            docs_by_issue[issue_name] = set()
                        docs_by_issue[issue_name].add(doc_id)
                        total_docs_with_hits.add(doc_id)

                        if execute:
                            context = _extract_context(content, m)
                            cur.execute(
                                """
                                INSERT INTO compliance_issues
                                (guidance_document_id, issue_type, occurrence_number,
                                 regex_match_pattern, regex_match_context, url,
                                 state, run_id)
                                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                                ON CONFLICT DO NOTHING
                                """,
                                (
                                    doc_id,
                                    issue_name,
                                    1,  # one match per issue type per doc
                                    pat.pattern,
                                    context,
                                    url or '',
                                    'NY',
                                    run_id,
                                ),
                            )
                            saved += 1

                        break  # one match per issue type per doc is enough

        if execute:
            conn.commit()

        elapsed = time.time() - start
        print(f"\nScan complete in {elapsed:.1f}s")
        print(f"Documents with any hit: {len(total_docs_with_hits)}/{len(docs)} ({100 * len(total_docs_with_hits) / len(docs):.1f}%)")
        if execute:
            print(f"Saved {saved} matches to compliance_issues")
        print()

        # Print results sorted by hit count
        print(f"{'issue_type':35} | {'docs_hit':>8} | {'hit_rate':>8}")
        print("-" * 58)
        for issue_name in sorted(hits_by_issue, key=lambda k: -hits_by_issue[k]):
            count = hits_by_issue[issue_name]
            rate = 100 * count / len(docs)
            print(f"{issue_name:35} | {count:>8} | {rate:>7.1f}%")

        no_hits = [name for name in patterns if name not in hits_by_issue]
        if no_hits:
            print(f"\n{len(no_hits)} issue types with zero hits: {', '.join(sorted(no_hits))}")

    finally:
        conn.close()
