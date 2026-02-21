#!/usr/bin/env python3
"""
run_extraction.py - Main entry point for cross-reference extraction

This script orchestrates the full pipeline:
1. Fetch documents from database
2. Extract references using patterns
3. Resolve references to document IDs
4. Output results (JSON, console, or database)

USAGE:
    # Extract from 50 NY documents, output to JSON for review
    python run_extraction.py --state NY --limit 50 --output json

    # Extract and show console summary only
    python run_extraction.py --state NJ --limit 100 --output console

    # Extract from specific title
    python run_extraction.py --state NY --title 18 --output json

    # Write directly to database (Phase 3)
    python run_extraction.py --state NY --output db

    # Dry run - show what would be written without actually writing
    python run_extraction.py --state NY --limit 100 --output db --dry-run
"""

import argparse
import json
import os
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional

import psycopg
from dotenv import load_dotenv

from cross_references.extractor import ReferenceExtractor, DocumentExtractionResult
from cross_references.resolver import ReferenceResolver
from cross_references.db_writer import write_to_database

# Load environment from main project if not in worktree
load_dotenv()
if not os.getenv("DATABASE_URL"):
    load_dotenv(Path(__file__).parent.parent.parent.parent / ".env")


# =============================================================================
# DATABASE QUERIES
# =============================================================================

def get_documents(
    jurisdiction: str,
    title: Optional[str] = None,
    limit: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """
    Fetch documents from database for processing.

    Args:
        jurisdiction: 'NY', 'NJ', or 'NYC'
        title: Optional title number filter
        limit: Optional max documents to fetch

    Returns:
        List of document dicts with id, title, content, state, citation
    """
    conn = psycopg.connect(os.getenv("DATABASE_URL"))

    conditions = [
        "state = %s",
        "content IS NOT NULL",
        "content != ''",
        "LENGTH(content) > 100",  # Skip very short docs
    ]
    params = [jurisdiction.upper()]

    # Title filter
    if title:
        if jurisdiction.upper() == 'NY':
            conditions.append("nycrr_title = %s")
            params.append(int(title))
        elif jurisdiction.upper() == 'NYC':
            conditions.append("rcny_title = %s")
            params.append(title)
        else:  # NJ
            conditions.append("njac_title = %s")
            params.append(title)

    where_clause = " AND ".join(conditions)
    limit_clause = f"LIMIT {limit}" if limit else ""

    query = f"""
        SELECT
            id,
            title,
            content,
            state,
            citation,
            nycrr_title,
            nycrr_part,
            nycrr_section,
            njac_title,
            njac_chapter
        FROM regulatory_documents
        WHERE {where_clause}
        ORDER BY id
        {limit_clause}
    """

    rows = conn.execute(query, params).fetchall()
    conn.close()

    return [
        {
            'id': row[0],
            'title': row[1],
            'content': row[2],
            'state': row[3],
            'citation': row[4],
            'nycrr_title': row[5],
            'nycrr_part': row[6],
            'nycrr_section': row[7],
            'njac_title': row[8],
            'njac_chapter': row[9],
        }
        for row in rows
    ]


# =============================================================================
# OUTPUT FUNCTIONS
# =============================================================================

def output_json(
    results: List[DocumentExtractionResult],
    output_dir: Path,
    jurisdiction: str
) -> Path:
    """
    Save results to JSON file for review.

    Returns path to output file.
    """
    output_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"crossrefs_{jurisdiction}_{timestamp}.json"
    output_path = output_dir / filename

    # Compute aggregate stats
    total_refs = sum(r.total_count for r in results)
    resolved_count = sum(r.resolved_count for r in results)
    unresolved_count = sum(r.unresolved_count for r in results)

    # Convert to serializable format
    data = {
        'metadata': {
            'state': jurisdiction,
            'extracted_at': datetime.now().isoformat(),
            'document_count': len(results),
            'total_references': total_refs,
            'resolved_count': resolved_count,
            'unresolved_count': unresolved_count,
            'resolution_rate': f"{resolved_count / total_refs * 100:.1f}%" if total_refs else "N/A",
        },
        'documents': [r.to_dict() for r in results if r.total_count > 0]
    }

    with open(output_path, 'w') as f:
        json.dump(data, f, indent=2)

    return output_path


def output_console(results: List[DocumentExtractionResult]):
    """Print summary to console."""

    total_docs = len(results)
    docs_with_refs = sum(1 for r in results if r.total_count > 0)
    total_refs = sum(r.total_count for r in results)
    total_resolved = sum(r.resolved_count for r in results)
    total_unresolved = sum(r.unresolved_count for r in results)

    # Count by type
    nycrr_count = sum(r.nycrr_count for r in results)
    njac_count = sum(r.njac_count for r in results)
    ny_short_form_count = sum(r.ny_short_form_count for r in results)
    same_section_count = sum(r.same_section_count for r in results)

    # Count resolvable refs (exclude same-section which are always "resolved")
    resolvable_refs = nycrr_count + njac_count + ny_short_form_count
    resolved_external = total_resolved - same_section_count

    print(f"\n{'=' * 60}")
    print("EXTRACTION SUMMARY")
    print(f"{'=' * 60}")
    print(f"\nDocuments processed: {total_docs}")
    print(f"Documents with refs: {docs_with_refs}")
    print(f"Total references found: {total_refs}")
    print(f"  - NYCRR (full-form): {nycrr_count}")
    print(f"  - NJAC (full-form): {njac_count}")
    print(f"  - NY short-form: {ny_short_form_count}")
    print(f"  - Same-section (internal): {same_section_count}")

    if resolvable_refs > 0:
        print(f"\nResolution (external refs only):")
        print(f"  - Resolved: {resolved_external}/{resolvable_refs} ({resolved_external / resolvable_refs * 100:.1f}%)")
        print(f"  - Unresolved: {resolvable_refs - resolved_external}")

    # Show top documents by reference count
    print(f"\n{'─' * 60}")
    print("TOP 10 DOCUMENTS BY REFERENCE COUNT")
    print(f"{'─' * 60}")

    sorted_results = sorted(results, key=lambda r: r.total_count, reverse=True)
    for r in sorted_results[:10]:
        if r.total_count > 0:
            citation_display = r.source_citation or r.source_title[:50]
            print(f"  [{r.total_count:3d} refs] {citation_display}")

    # Show some unresolved examples
    unresolved_examples = []
    for r in results:
        for ref in r.references:
            if not ref.is_resolved and ref.ref_type.value in ('nycrr', 'njac', 'ny_short_form'):
                unresolved_examples.append((ref.ref_type.value, ref.normalized_citation, ref.raw_text))
                if len(unresolved_examples) >= 15:
                    break
        if len(unresolved_examples) >= 15:
            break

    if unresolved_examples:
        print(f"\n{'─' * 60}")
        print("SAMPLE UNRESOLVED CITATIONS")
        print(f"{'─' * 60}")
        for ref_type, norm, raw in unresolved_examples[:15]:
            type_label = f"[{ref_type}]"
            if norm != raw:
                print(f"  {type_label} {norm} (raw: '{raw}')")
            else:
                print(f"  {type_label} {norm}")

    # Show some resolved examples
    resolved_examples = []
    for r in results:
        for ref in r.references:
            if ref.is_resolved and ref.target_document_id and ref.ref_type.value in ('nycrr', 'njac', 'ny_short_form'):
                resolved_examples.append((ref.ref_type.value, ref.normalized_citation, ref.raw_text, ref.target_document_id, ref.target_title))
                if len(resolved_examples) >= 8:
                    break
        if len(resolved_examples) >= 8:
            break

    if resolved_examples:
        print(f"\n{'─' * 60}")
        print("SAMPLE RESOLVED CITATIONS")
        print(f"{'─' * 60}")
        for ref_type, norm, raw, doc_id, title in resolved_examples[:8]:
            title_short = (title[:50] + "...") if title and len(title) > 50 else title
            type_label = f"[{ref_type}]"
            print(f"  {type_label} '{raw}' -> doc {doc_id}")
            print(f"      \"{title_short}\"")


# =============================================================================
# MAIN
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Extract internal cross-references from regulatory documents",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
EXAMPLES:
    # Extract from 50 NY documents, save to JSON
    python run_extraction.py --state NY --limit 50 --output json

    # Quick console summary of NJ refs
    python run_extraction.py --state NJ --limit 100 --output console

    # Extract from specific title
    python run_extraction.py --state NY --title 18 --output json

    # Write directly to database
    python run_extraction.py --state NY --output db

    # Dry run (test without writing)
    python run_extraction.py --state NY --limit 100 --output db --dry-run
        """
    )

    parser.add_argument(
        "--state",
        required=True,
        choices=["NY", "NJ", "NYC"],
        help="State/jurisdiction to process (NY, NJ, or NYC)"
    )
    parser.add_argument(
        "--title",
        help="Filter by title number (e.g., 18 for NY, 8 for NJ)"
    )
    parser.add_argument(
        "--limit",
        type=int,
        help="Maximum number of documents to process"
    )
    parser.add_argument(
        "--output",
        choices=["json", "console", "both", "db"],
        default="both",
        help="Output format: json, console, both, or db (write to database)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="When using --output db, don't actually write to database"
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path(__file__).parent / "outputs",
        help="Directory for JSON output (default: ./outputs)"
    )

    args = parser.parse_args()

    # Header
    print("=" * 60)
    print("INTERNAL CROSS-REFERENCE EXTRACTION")
    print("=" * 60)
    print(f"\nStarted: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"State: {args.state}")
    if args.title:
        print(f"Title filter: {args.title}")
    if args.limit:
        print(f"Limit: {args.limit}")

    # Step 1: Fetch documents
    print(f"\n[1/3] Fetching documents from database...")

    documents = get_documents(
        jurisdiction=args.state,
        title=args.title,
        limit=args.limit,
    )

    if not documents:
        print("      No documents found matching criteria.")
        return

    print(f"      Found {len(documents)} documents to process")

    # Step 2: Extract references
    print(f"\n[2/3] Extracting cross-references...")

    extractor = ReferenceExtractor(context_chars=50)
    results = extractor.extract_batch(documents)

    total_refs = sum(r.total_count for r in results)
    print(f"      Extracted {total_refs} references")

    # Step 3: Resolve references
    print(f"\n[3/3] Resolving citations to document IDs...")

    resolver = ReferenceResolver()
    results = resolver.resolve_batch(results)
    resolver.close()

    total_resolved = sum(r.resolved_count for r in results)
    print(f"      Resolved {total_resolved}/{total_refs} references")

    # Output
    if args.output == "db":
        # Write directly to database
        db_stats = write_to_database(results, jurisdiction=args.state, dry_run=args.dry_run)
        output_console(results)  # Also show console summary
    else:
        if args.output in ("json", "both"):
            output_path = output_json(results, args.output_dir, jurisdiction=args.state)
            print(f"\n✓ JSON saved to: {output_path}")

        if args.output in ("console", "both"):
            output_console(results)

    print(f"\nCompleted: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")


if __name__ == "__main__":
    main()
