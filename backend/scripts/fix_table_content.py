#!/usr/bin/env python3
"""
One-time script to re-process regulatory documents containing HTML tables.

Re-fetches HTML from source URLs (Cornell Law) for documents whose content
contains markdown tables, re-runs the improved table converter, and updates
the content column in the database.

Usage:
    cd backend && python -m scripts.fix_table_content --dry-run    # Preview what would change
    cd backend && python -m scripts.fix_table_content --execute     # Actually update DB
    cd backend && python -m scripts.fix_table_content --execute --state NY  # Only NY docs
    cd backend && python -m scripts.fix_table_content --execute --id 200391 # Specific doc
"""

import argparse
import sys
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup

# Ensure backend/ is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from lib.db import get_db_connection
from scripts.scraper_utils import (
    convert_tables_to_markdown,
    extract_text_smart,
    clean_regulation_text,
)

CORNELL_DOMAINS = ["law.cornell.edu"]
REQUEST_DELAY = 1.0  # seconds between fetches to be polite


def find_docs_with_tables(conn, state: str = None, doc_id: int = None) -> list:
    """Find section-level docs whose content contains markdown tables."""
    query = """
        SELECT id, url, jurisdiction, title
        FROM regulatory_documents
        WHERE content LIKE '%%| --- |%%'
          AND url_type = 'regulation'
    """
    params = []
    if state:
        query += " AND jurisdiction = %s"
        params.append(state)
    if doc_id:
        query += " AND id = %s"
        params.append(doc_id)
    query += " ORDER BY jurisdiction, id"

    with conn.cursor() as cur:
        cur.execute(query, params)
        return cur.fetchall()


def find_nyc_docs_with_tables(conn) -> list:
    """Find NYC docs that may have tables (no markdown conversion was done)."""
    query = """
        SELECT id, url, jurisdiction, title
        FROM regulatory_documents
        WHERE jurisdiction = 'NYC'
          AND url_type = 'regulation'
          AND content IS NOT NULL
          AND content != ''
    """
    with conn.cursor() as cur:
        cur.execute(query)
        return cur.fetchall()


def extract_content_from_cornell(html: str) -> str:
    """Extract regulation content from Cornell Law HTML, same logic as scrapers."""
    soup = BeautifulSoup(html, "html.parser")

    content = ""
    reg_content = soup.find("div", class_="statereg-text")
    if reg_content:
        # Remove nav/unwanted elements
        for unwanted in reg_content(
            ["nav", "aside", "footer", "script", "style", "noscript", "header"]
        ):
            unwanted.decompose()
        convert_tables_to_markdown(reg_content)
        content = extract_text_smart(reg_content)
    else:
        main_content = soup.find("div", {"id": "content"}) or soup.find("main")
        if main_content:
            for unwanted in main_content(
                ["nav", "aside", "footer", "script", "style", "noscript", "header"]
            ):
                unwanted.decompose()
            convert_tables_to_markdown(main_content)
            content = extract_text_smart(main_content)

    return clean_regulation_text(content)


def fetch_and_reprocess(url: str) -> str | None:
    """Fetch HTML from URL and re-extract content with improved table conversion."""
    try:
        resp = requests.get(url, timeout=30, headers={"User-Agent": "deproceduralizer/1.0"})
        resp.raise_for_status()
        return extract_content_from_cornell(resp.text)
    except requests.RequestException as e:
        print(f"    FETCH ERROR: {e}")
        return None


def update_doc_content(conn, doc_id: int, new_content: str):
    """Update the content column for a document."""
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE regulatory_documents SET content = %s WHERE id = %s",
            (new_content, doc_id),
        )
    conn.commit()


def main():
    parser = argparse.ArgumentParser(description="Re-process docs with HTML tables")
    parser.add_argument("--execute", action="store_true", help="Actually update DB (default is dry-run)")
    parser.add_argument("--dry-run", action="store_true", help="Preview only (default)")
    parser.add_argument("--state", type=str, help="Filter by state (NY, NJ, NYC)")
    parser.add_argument("--id", type=int, help="Process a specific document ID")
    args = parser.parse_args()

    execute = args.execute and not args.dry_run

    conn = get_db_connection()
    if not conn:
        print("Error: Could not connect to database")
        sys.exit(1)

    try:
        # Find NY/NJ docs with existing markdown tables (need re-conversion)
        docs = find_docs_with_tables(conn, state=args.state, doc_id=args.id)
        # Filter to only Cornell Law URLs
        cornell_docs = [
            d for d in docs if d[1] and any(domain in d[1] for domain in CORNELL_DOMAINS)
        ]

        print(f"Found {len(docs)} docs with markdown tables, {len(cornell_docs)} from Cornell Law")

        updated = 0
        skipped = 0
        errors = 0
        total = len(cornell_docs)

        for i, (doc_id, url, state, title) in enumerate(cornell_docs, 1):
            elapsed_pct = f"{i}/{total}"
            print(f"  [{elapsed_pct}] Doc {doc_id} ({state}): {title[:60]}...")

            new_content = fetch_and_reprocess(url)
            if not new_content:
                errors += 1
                continue

            if execute:
                try:
                    update_doc_content(conn, doc_id, new_content)
                    updated += 1
                    print(f"    UPDATED")
                except Exception as e:
                    print(f"    DB ERROR (doc {doc_id}): {e}")
                    errors += 1
                    try:
                        conn.rollback()
                    except Exception:
                        pass
                    continue
            else:
                # Show a preview of table changes
                if "| --- |" in new_content:
                    # Find first table in new content
                    lines = new_content.split("\n")
                    for j, line in enumerate(lines):
                        if line.startswith("| ") and "---" not in line:
                            cols = line.count("|") - 1
                            print(f"    Table found: {cols} columns")
                            break
                print(f"    DRY-RUN (would update)")
                updated += 1

            if i < total:
                time.sleep(REQUEST_DELAY)

        print(f"\nSummary: {updated} {'updated' if execute else 'would update'}, {errors} errors, {skipped} skipped")

    finally:
        conn.close()


if __name__ == "__main__":
    main()
