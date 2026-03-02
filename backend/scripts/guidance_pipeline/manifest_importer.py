"""Check coverage of client-requested guidance documents against the DB.

Reads a curated manifest JSON listing specific URLs with metadata, and
checks which ones are already in the guidance_documents or regulatory_documents
tables vs missing.

Scraping/fetching is handled by the nys-documents repo pipeline
(scrape → merge → download → extract). This module only does coverage
analysis against the DB.
"""

import json
from collections import Counter

from lib.db import get_db_connection


def load_manifest(manifest_path: str) -> list[dict]:
    """Load and validate the manifest JSON file.

    Filters out comment entries (those with _comment key).
    """
    with open(manifest_path) as f:
        entries = json.load(f)

    docs = [e for e in entries if "url" in e]
    print(f"Loaded {len(docs)} documents from manifest")
    return docs


def _build_url_index(cur, table: str) -> tuple[dict[str, tuple[int, str]], dict[str, tuple[int, str]]]:
    """Build exact and normalized URL indexes from a table."""
    cur.execute(f"SELECT id, title, url FROM {table} WHERE url IS NOT NULL")
    exact: dict[str, tuple[int, str]] = {}
    normalized: dict[str, tuple[int, str]] = {}
    for row_id, row_title, row_url in cur.fetchall():
        exact[row_url] = (row_id, row_title)
        norm = row_url.replace("https://", "").replace("http://", "").replace("www.", "").lower()
        normalized[norm] = (row_id, row_title)
    return exact, normalized


def _find_in_index(
    url: str,
    exact: dict[str, tuple[int, str]],
    normalized: dict[str, tuple[int, str]],
) -> tuple[int, str] | None:
    """Look up a URL in the index, trying exact then normalized match."""
    row = exact.get(url)
    if row:
        return row
    url_fragment = url.replace("https://", "").replace("http://", "").replace("www.", "").lower()
    for norm_url, db_entry in normalized.items():
        if url_fragment in norm_url or norm_url in url_fragment:
            return db_entry
    return None


def preview_manifest(manifest_path: str, group: str | None = None) -> None:
    """Show manifest contents and check DB coverage for each entry."""
    docs = load_manifest(manifest_path)
    if group:
        docs = [d for d in docs if d.get("group") == group]
        print(f"Filtered to group {group}: {len(docs)} documents")

    by_group = Counter(d.get("group", "?") for d in docs)
    by_agency = Counter(d.get("agency", "?") for d in docs)
    by_type = Counter(d.get("file_type", "?") for d in docs)

    print(f"\nManifest: {len(docs)} documents")
    print("\nBy group:")
    for g, count in sorted(by_group.items()):
        print(f"  {g}: {count}")
    print("\nBy agency:")
    for agency, count in sorted(by_agency.items(), key=lambda x: -x[1]):
        print(f"  {agency}: {count}")
    print("\nBy file type:")
    for ft, count in sorted(by_type.items()):
        print(f"  {ft}: {count}")

    # Check DB coverage
    conn = get_db_connection()
    if not conn:
        print("\nWARNING: Could not connect to DB — skipping coverage check")
        return

    cur = conn.cursor()
    found = 0
    missing = 0
    missing_docs: list[dict] = []

    # Build in-memory URL indexes from both tables
    gd_exact, gd_norm = _build_url_index(cur, "guidance_documents")
    rd_exact, rd_norm = _build_url_index(cur, "regulatory_documents")

    print("\n--- DB Coverage Check ---")
    for entry in docs:
        url = entry["url"]
        title = entry["title"]

        # Check guidance_documents first
        row = _find_in_index(url, gd_exact, gd_norm)
        table_label = "gd"

        # If not in guidance_documents, check regulatory_documents
        if not row:
            row = _find_in_index(url, rd_exact, rd_norm)
            table_label = "rd"

        if row:
            found += 1
            print(f"  IN DB  [{table_label}:{row[0]}] {title[:60]}")
        else:
            missing += 1
            missing_docs.append(entry)
            print(f"  MISSING        {title[:60]}")
            print(f"                 {url}")

    cur.close()
    conn.close()

    print(f"\n--- Summary: {found} in DB, {missing} missing ---")

    if missing_docs:
        missing_by_group = Counter(d.get("group", "?") for d in missing_docs)
        print("\nMissing by group:")
        for g, count in sorted(missing_by_group.items()):
            print(f"  {g}: {count}")
        print(
            "\nTo acquire missing docs, run the nys-documents pipeline:\n"
            "  cd ../nys-documents\n"
            "  npm run scrape -- --scraper=curated-manifest\n"
            "  npm run merge\n"
            "  npm run download\n"
            "  npm run extract\n"
            "\nThen import:\n"
            "  cd backend\n"
            "  python3 -m scripts.guidance_pipeline --execute"
        )
