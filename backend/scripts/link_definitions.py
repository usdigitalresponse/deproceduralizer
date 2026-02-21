#!/usr/bin/env python3
"""
Link definitions to documents where their terms appear in the text.

Uses word-boundary matching (not substring) to avoid false positives:
- 'applicant' matches 'Applicant' but not 'reapplicant'

Stores boolean presence only (not counts or positions) for efficiency.

Commands:
    run     - Process definitions and link to documents where terms appear
    status  - Show linking statistics
    clean   - Remove stale links for deleted definitions/documents

Examples:
    # Link all NY definitions
    python link_definitions.py run --state NY

    # Link specific definitions
    python link_definitions.py run --definition-ids 1,2,3

    # Force reprocessing (ignore cache)
    python link_definitions.py run --state NY --force

    # Show statistics
    python link_definitions.py status

    # Clean up stale links
    python link_definitions.py clean
"""

import argparse
import re
import sys
import time
from typing import Dict, List, Optional, Set, Tuple
from dotenv import load_dotenv

from config import PROJECT_ROOT
from lib.db import get_db_connection
from lib.stats import format_time

load_dotenv(PROJECT_ROOT / '.env')


# ============================================================================
# Term Matching Functions
# ============================================================================

def build_word_boundary_pattern(term: str) -> re.Pattern:
    """
    Build regex for word-boundary matching, escaping special chars.

    Args:
        term: The definition term to match

    Returns:
        Compiled regex pattern with word boundaries
    """
    escaped = re.escape(term)
    return re.compile(r'\b' + escaped + r'\b', re.IGNORECASE)


def term_appears_in_content(term: str, content: str, pattern_cache: Dict[str, re.Pattern] = None) -> bool:
    """
    Check if term appears in content using word-boundary matching.

    Args:
        term: The term to search for
        content: The document content to search in
        pattern_cache: Optional cache of pre-compiled patterns

    Returns:
        True if term appears with word boundaries, False otherwise
    """
    if pattern_cache and term in pattern_cache:
        pattern = pattern_cache[term]
    else:
        pattern = build_word_boundary_pattern(term)
        if pattern_cache is not None:
            pattern_cache[term] = pattern

    return bool(pattern.search(content))


# ============================================================================
# Database Functions
# ============================================================================

def get_definitions_to_process(
    conn,
    jurisdiction: Optional[str] = None,
    definition_ids: Optional[List[int]] = None,
    force: bool = False,
) -> List[Dict]:
    """
    Get definitions that need to be linked to documents.

    Args:
        conn: Database connection
        jurisdiction: Filter by jurisdiction (NJ, NY, or NYC)
        definition_ids: Specific definition IDs to process
        force: If True, reprocess even if already linked

    Returns:
        List of dicts with id, term, normalized_term, document_id, scope_document_id
    """
    conditions = []
    params = []

    if definition_ids:
        conditions.append("d.id = ANY(%s)")
        params.append(definition_ids)

    if jurisdiction:
        # Filter by state using the document's state column via its regulatory_document
        conditions.append("""
            EXISTS (
                SELECT 1 FROM regulatory_documents rd
                WHERE rd.id = d.document_id AND rd.state = %s
            )
        """)
        params.append(jurisdiction.upper())

    if not force:
        # Skip definitions that already have occurrences linked
        conditions.append("""
            NOT EXISTS (
                SELECT 1 FROM definition_document_occurrences ddo
                WHERE ddo.definition_id = d.id
            )
        """)

    where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""

    query = f"""
        SELECT DISTINCT ON (d.normalized_term)
            d.id,
            d.term,
            d.normalized_term,
            d.document_id,
            d.scope_document_id
        FROM definitions d
        {where_clause}
        ORDER BY d.normalized_term, d.id
    """

    with conn.cursor() as cur:
        cur.execute(query, params if params else None)
        rows = cur.fetchall()

    return [
        {
            'id': row[0],
            'term': row[1],
            'normalized_term': row[2],
            'document_id': row[3],
            'scope_document_id': row[4],
        }
        for row in rows
    ]


def get_all_definition_ids_for_term(conn, normalized_term: str, jurisdiction: Optional[str] = None) -> List[int]:
    """
    Get all definition IDs that share the same normalized term.

    When we find a term in a document, we link ALL definitions with that
    normalized term (not just one) to properly track usage.

    Args:
        conn: Database connection
        normalized_term: The normalized (lowercased, trimmed) term
        jurisdiction: Optional jurisdiction filter (NJ, NY, or NYC) - only return definitions from this jurisdiction
    """
    if jurisdiction:
        # Filter by state via the document's state
        query = """
            SELECT d.id FROM definitions d
            JOIN regulatory_documents r ON d.document_id = r.id
            WHERE d.normalized_term = %s AND r.state = %s
        """
        params = (normalized_term, jurisdiction.upper())
    else:
        query = "SELECT id FROM definitions WHERE normalized_term = %s"
        params = (normalized_term,)

    with conn.cursor() as cur:
        cur.execute(query, params)
        return [row[0] for row in cur.fetchall()]


def build_document_ancestry_map(conn, jurisdiction: Optional[str] = None) -> Dict[int, Set[int]]:
    """
    Build a map of document_id -> set of ancestor document IDs (including self).

    Used for scope-aware definition filtering: a definition applies to a document
    only if the definition's scope_document_id is an ancestor of that document.

    Args:
        conn: Database connection
        jurisdiction: Filter by jurisdiction (NJ, NY, or NYC)

    Returns:
        Dict mapping each document ID to its set of ancestor IDs (including self)
    """
    conditions = ["hierarchy_level = 'section'"]
    params = []

    if jurisdiction:
        conditions.append("state = %s")
        params.append(jurisdiction.upper())

    where_clause = "WHERE " + " AND ".join(conditions)

    # Get all section documents with their parent_id
    query = f"""
        WITH RECURSIVE ancestors AS (
            -- Start with section documents
            SELECT id, parent_id, id as root_id
            FROM regulatory_documents
            {where_clause}

            UNION ALL

            -- Walk up the hierarchy
            SELECT rd.id, rd.parent_id, a.root_id
            FROM regulatory_documents rd
            JOIN ancestors a ON rd.id = a.parent_id
            WHERE rd.parent_id IS NOT NULL
        )
        SELECT root_id, ARRAY_AGG(DISTINCT id) as ancestor_ids
        FROM ancestors
        GROUP BY root_id
    """

    with conn.cursor() as cur:
        cur.execute(query, params if params else None)
        rows = cur.fetchall()

    return {row[0]: set(row[1]) for row in rows}


def build_scope_to_definitions_map(
    conn,
    jurisdiction: Optional[str] = None,
    force: bool = False,
) -> Dict[Optional[int], List[Dict]]:
    """
    Build a map of scope_document_id -> list of definitions.

    Args:
        conn: Database connection
        jurisdiction: Filter by jurisdiction (NJ, NY, or NYC)
        force: If True, include definitions that already have occurrences

    Returns:
        Dict mapping scope_document_id to list of definition dicts
    """
    conditions = []
    params = []

    if jurisdiction:
        conditions.append("""
            EXISTS (
                SELECT 1 FROM regulatory_documents rd
                WHERE rd.id = d.document_id AND rd.state = %s
            )
        """)
        params.append(jurisdiction.upper())

    if not force:
        conditions.append("""
            NOT EXISTS (
                SELECT 1 FROM definition_document_occurrences ddo
                WHERE ddo.definition_id = d.id
            )
        """)

    where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""

    query = f"""
        SELECT
            d.id,
            d.term,
            d.normalized_term,
            d.document_id,
            d.scope_document_id
        FROM definitions d
        {where_clause}
        ORDER BY d.scope_document_id, d.normalized_term
    """

    with conn.cursor() as cur:
        cur.execute(query, params if params else None)
        rows = cur.fetchall()

    # Group by scope_document_id
    scope_map: Dict[Optional[int], List[Dict]] = {}
    for row in rows:
        defn = {
            'id': row[0],
            'term': row[1],
            'normalized_term': row[2],
            'document_id': row[3],
            'scope_document_id': row[4],
        }
        scope_id = row[4]
        if scope_id not in scope_map:
            scope_map[scope_id] = []
        scope_map[scope_id].append(defn)

    return scope_map


def get_applicable_definitions(
    doc_id: int,
    doc_ancestors: Set[int],
    scope_to_defs: Dict[Optional[int], List[Dict]],
) -> List[Dict]:
    """
    Get definitions that apply to a document based on its ancestry.

    A definition applies if its scope_document_id is in the document's ancestor chain.
    Definitions with NULL scope only apply to their own source document.

    Args:
        doc_id: The document ID being scanned
        doc_ancestors: Set of ancestor document IDs (including self)
        scope_to_defs: Map of scope_document_id -> definitions

    Returns:
        List of applicable definitions
    """
    applicable = []

    # Check each scope that overlaps with the document's ancestry
    for scope_id in doc_ancestors:
        if scope_id in scope_to_defs:
            applicable.extend(scope_to_defs[scope_id])

    # Definitions with NULL scope only apply to their own source document
    if None in scope_to_defs:
        for defn in scope_to_defs[None]:
            if defn['document_id'] == doc_id:
                applicable.append(defn)

    return applicable


def get_document_ids_to_scan(
    conn,
    jurisdiction: Optional[str] = None,
    document_ids: Optional[List[int]] = None,
) -> List[int]:
    """
    Get document IDs to scan for term occurrences.

    Only scans section-level documents (where actual regulation text is).
    Returns just IDs to minimize memory - content is fetched in batches.

    Args:
        conn: Database connection
        jurisdiction: Filter by jurisdiction (NJ, NY, or NYC)
        document_ids: Specific document IDs to scan

    Returns:
        List of document IDs
    """
    conditions = ["hierarchy_level = 'section'"]
    params = []

    if document_ids:
        conditions.append("id = ANY(%s)")
        params.append(document_ids)

    if jurisdiction:
        conditions.append("state = %s")
        params.append(jurisdiction.upper())

    where_clause = "WHERE " + " AND ".join(conditions)

    query = f"""
        SELECT id
        FROM regulatory_documents
        {where_clause}
        ORDER BY id
    """

    with conn.cursor() as cur:
        cur.execute(query, params if params else None)
        rows = cur.fetchall()

    return [row[0] for row in rows]


def get_document_batch(conn, doc_ids: List[int]) -> List[Dict]:
    """
    Fetch a batch of documents by their IDs.

    Args:
        conn: Database connection
        doc_ids: List of document IDs to fetch

    Returns:
        List of dicts with id and content
    """
    if not doc_ids:
        return []

    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, content FROM regulatory_documents WHERE id = ANY(%s)",
            (doc_ids,)
        )
        rows = cur.fetchall()

    return [{'id': row[0], 'content': row[1]} for row in rows]


def get_processed_document_ids(conn, jurisdiction: Optional[str] = None) -> Set[int]:
    """
    Get document IDs that already have definition occurrences linked.

    Used for incremental processing - skip documents already processed.

    Args:
        conn: Database connection
        jurisdiction: Filter by jurisdiction (optional)

    Returns:
        Set of document IDs that have been processed
    """
    query = """
        SELECT DISTINCT ddo.document_id
        FROM definition_document_occurrences ddo
    """

    if jurisdiction:
        query += """
            JOIN regulatory_documents rd ON ddo.document_id = rd.id
            WHERE rd.state = %s
        """

    with conn.cursor() as cur:
        cur.execute(query, (jurisdiction.upper(),) if jurisdiction else None)
        return {row[0] for row in cur.fetchall()}


def insert_occurrences(conn, occurrences: List[Tuple[int, int]]) -> int:
    """
    Batch insert definition-document occurrences.

    Uses ON CONFLICT DO NOTHING to handle duplicates gracefully.

    Args:
        conn: Database connection
        occurrences: List of (definition_id, document_id) tuples

    Returns:
        Number of rows inserted
    """
    if not occurrences:
        return 0

    with conn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO definition_document_occurrences (definition_id, document_id)
            VALUES (%s, %s)
            ON CONFLICT (definition_id, document_id) DO NOTHING
            """,
            occurrences
        )
        conn.commit()

    return len(occurrences)


def clear_occurrences_for_definitions(conn, definition_ids: List[int]) -> int:
    """
    Clear existing occurrences for specific definitions (for reprocessing).

    Args:
        conn: Database connection
        definition_ids: List of definition IDs to clear

    Returns:
        Number of rows deleted
    """
    if not definition_ids:
        return 0

    with conn.cursor() as cur:
        cur.execute(
            "DELETE FROM definition_document_occurrences WHERE definition_id = ANY(%s)",
            (definition_ids,)
        )
        deleted = cur.rowcount
        conn.commit()

    return deleted


# ============================================================================
# Main Processing Functions
# ============================================================================

def link_definitions_to_documents(
    jurisdiction: Optional[str] = None,
    definition_ids: Optional[List[int]] = None,
    force: bool = False,
    batch_size: int = 1000,
    doc_batch_size: int = 500,
) -> int:
    """
    Main function to link definitions to documents where terms appear.

    Uses SCOPE-AWARE filtering: only checks definitions that are in scope
    for each document (based on hierarchy ancestry). This dramatically reduces
    the search space compared to checking all definitions against all documents.

    Uses batched document processing with fresh connections to avoid
    connection timeouts during long-running operations.

    Args:
        jurisdiction: Filter by jurisdiction (NY, NJ, or NYC)
        definition_ids: Specific definition IDs to process
        force: If True, reprocess even if already linked
        batch_size: Number of occurrences to insert at a time
        doc_batch_size: Number of documents to process per batch (default 500)

    Returns:
        Total number of links created
    """
    conn = get_db_connection()
    if not conn:
        print("ERROR: Could not connect to database")
        return 0

    try:
        # Step 1: Build document ancestry map
        print("Building document ancestry map...")
        doc_ancestry = build_document_ancestry_map(conn, jurisdiction)
        print(f"  Built ancestry for {len(doc_ancestry)} documents")

        # Step 2: Build scope -> definitions map
        print("Building scope-to-definitions map...")
        scope_to_defs = build_scope_to_definitions_map(conn, jurisdiction, force)
        total_defs = sum(len(defs) for defs in scope_to_defs.values())
        print(f"  Found {total_defs} definitions across {len(scope_to_defs)} scopes")

        if not scope_to_defs:
            print("No definitions to process.")
            return 0

        # Step 3: Get document IDs to scan
        print("Fetching document IDs to scan...")
        all_doc_ids = get_document_ids_to_scan(conn, jurisdiction)
        print(f"Found {len(all_doc_ids)} documents to scan")

        if not all_doc_ids:
            print("No documents to scan.")
            return 0

        # Step 3b: Skip already-processed documents (incremental mode)
        if not force:
            print("Checking for already-processed documents...")
            processed_ids = get_processed_document_ids(conn, jurisdiction)
            if processed_ids:
                original_count = len(all_doc_ids)
                all_doc_ids = [d for d in all_doc_ids if d not in processed_ids]
                skipped = original_count - len(all_doc_ids)
                if skipped > 0:
                    print(f"  Skipping {skipped} already-processed documents")
                    print(f"  {len(all_doc_ids)} documents remaining to process")

        if not all_doc_ids:
            print("All documents already processed.")
            return 0

        # Step 4: Pre-compile regex patterns for all terms
        print("Pre-compiling regex patterns...")
        pattern_cache: Dict[str, re.Pattern] = {}
        for defs in scope_to_defs.values():
            for defn in defs:
                term = defn['term']
                if term not in pattern_cache:
                    pattern_cache[term] = build_word_boundary_pattern(term)
        print(f"  Compiled {len(pattern_cache)} patterns")

        # Step 5: Build term -> definition_ids mapping for all terms
        print("Building term -> definition IDs mapping...")
        term_to_def_ids: Dict[str, List[int]] = {}
        for defs in scope_to_defs.values():
            for defn in defs:
                normalized = defn['normalized_term']
                if normalized not in term_to_def_ids:
                    # Pass jurisdiction to avoid cross-jurisdiction linking
                    term_to_def_ids[normalized] = get_all_definition_ids_for_term(conn, normalized, jurisdiction)
        print(f"  Mapped {len(term_to_def_ids)} unique terms")

    finally:
        conn.close()

    # Step 6: Process documents in batches with scope-aware filtering
    print(f"\nScanning {len(all_doc_ids)} documents with scope-aware filtering...")
    print(f"  Processing in batches of {doc_batch_size} documents")
    start_time = time.time()

    total_docs_processed = 0
    docs_with_matches = 0
    total_links_created = 0
    total_comparisons = 0

    # Process documents in batches
    for batch_start in range(0, len(all_doc_ids), doc_batch_size):
        batch_doc_ids = all_doc_ids[batch_start:batch_start + doc_batch_size]

        conn = get_db_connection()
        if not conn:
            print(f"ERROR: Lost database connection at batch {batch_start}")
            break

        try:
            documents = get_document_batch(conn, batch_doc_ids)
            all_occurrences: List[Tuple[int, int]] = []

            for doc in documents:
                doc_id = doc['id']
                content = doc['content'] or ''

                # Get only definitions that are in scope for this document
                ancestors = doc_ancestry.get(doc_id, {doc_id})
                applicable_defs = get_applicable_definitions(doc_id, ancestors, scope_to_defs)

                doc_matches = 0

                for defn in applicable_defs:
                    term = defn['term']
                    total_comparisons += 1

                    if term_appears_in_content(term, content, pattern_cache):
                        # Only link to THIS definition (already scope-filtered)
                        # Don't link to all definitions with same term name
                        all_occurrences.append((defn['id'], doc_id))
                        doc_matches += 1

                if doc_matches > 0:
                    docs_with_matches += 1

                total_docs_processed += 1

            if all_occurrences:
                insert_occurrences(conn, all_occurrences)
                total_links_created += len(all_occurrences)

            elapsed = time.time() - start_time
            if total_docs_processed > 0:
                rate = total_docs_processed / elapsed
                remaining = (len(all_doc_ids) - total_docs_processed) / rate if rate > 0 else 0
                avg_defs = total_comparisons / total_docs_processed
                print(f"  Scanned {total_docs_processed}/{len(all_doc_ids)} docs "
                      f"(avg {avg_defs:.0f} defs/doc, {docs_with_matches} matched, "
                      f"{total_links_created} links, ~{format_time(remaining)} left)")
                sys.stdout.flush()

        except Exception as e:
            print(f"ERROR processing batch at {batch_start}: {e}")
            continue

        finally:
            conn.close()

    elapsed = time.time() - start_time
    print(f"\nCompleted in {format_time(elapsed)}")
    print(f"  Documents scanned: {total_docs_processed}")
    print(f"  Documents with matches: {docs_with_matches}")
    print(f"  Links created this run: {total_links_created}")

    # Get final total count
    conn = get_db_connection()
    if conn:
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) FROM definition_document_occurrences")
                total = cur.fetchone()[0]
            print(f"  Total links in database: {total}")
            return total
        finally:
            conn.close()

    return total_links_created


def show_status():
    """Show statistics about definition-document linking."""
    conn = get_db_connection()
    if not conn:
        print("ERROR: Could not connect to database")
        return

    try:
        with conn.cursor() as cur:
            # Total occurrences
            cur.execute("SELECT COUNT(*) FROM definition_document_occurrences")
            total_occurrences = cur.fetchone()[0]

            # Definitions with occurrences
            cur.execute("""
                SELECT COUNT(DISTINCT definition_id)
                FROM definition_document_occurrences
            """)
            defs_with_occurrences = cur.fetchone()[0]

            # Total definitions
            cur.execute("SELECT COUNT(*) FROM definitions")
            total_definitions = cur.fetchone()[0]

            # Documents with occurrences
            cur.execute("""
                SELECT COUNT(DISTINCT document_id)
                FROM definition_document_occurrences
            """)
            docs_with_occurrences = cur.fetchone()[0]

            # Total section documents
            cur.execute("""
                SELECT COUNT(*) FROM regulatory_documents
                WHERE hierarchy_level = 'section'
            """)
            total_sections = cur.fetchone()[0]

            # Top 10 most common terms
            cur.execute("""
                SELECT d.term, COUNT(ddo.document_id) as doc_count
                FROM definitions d
                JOIN definition_document_occurrences ddo ON d.id = ddo.definition_id
                GROUP BY d.id, d.term
                ORDER BY doc_count DESC
                LIMIT 10
            """)
            top_terms = cur.fetchall()

        print("\n=== Definition-Document Linking Statistics ===\n")
        print(f"Total term-document links: {total_occurrences:,}")
        print(f"Definitions with occurrences: {defs_with_occurrences:,} / {total_definitions:,} "
              f"({100*defs_with_occurrences/total_definitions:.1f}%)" if total_definitions > 0 else "")
        print(f"Documents with occurrences: {docs_with_occurrences:,} / {total_sections:,} "
              f"({100*docs_with_occurrences/total_sections:.1f}%)" if total_sections > 0 else "")

        if top_terms:
            print("\nTop 10 most common terms:")
            for term, count in top_terms:
                print(f"  {term}: {count:,} documents")

    finally:
        conn.close()


def clean_stale_links():
    """Remove stale links for deleted definitions or documents."""
    conn = get_db_connection()
    if not conn:
        print("ERROR: Could not connect to database")
        return

    try:
        with conn.cursor() as cur:
            # Count before
            cur.execute("SELECT COUNT(*) FROM definition_document_occurrences")
            before = cur.fetchone()[0]

            # Delete orphaned links (CASCADE should handle this, but just in case)
            cur.execute("""
                DELETE FROM definition_document_occurrences ddo
                WHERE NOT EXISTS (
                    SELECT 1 FROM definitions d WHERE d.id = ddo.definition_id
                )
                OR NOT EXISTS (
                    SELECT 1 FROM regulatory_documents rd WHERE rd.id = ddo.document_id
                )
            """)
            deleted = cur.rowcount
            conn.commit()

            print(f"Removed {deleted} stale links")
            print(f"Links remaining: {before - deleted:,}")

    finally:
        conn.close()


# ============================================================================
# Exported Function for batch_definitions.py Integration
# ============================================================================

def link_new_definitions(
    doc_ids: Optional[List[int]] = None,
    jurisdiction: Optional[str] = None,
) -> int:
    """
    Link newly extracted definitions to documents.

    Called from batch_definitions.py after processing batch results.

    Args:
        doc_ids: Document IDs that were just processed (to scope the linking)
        jurisdiction: Jurisdiction filter (NY, NJ, or NYC)

    Returns:
        Number of links created
    """
    # For now, just run the full linking for the jurisdiction
    # Future optimization: only process definitions from the given doc_ids
    return link_definitions_to_documents(jurisdiction=jurisdiction, force=False)


# ============================================================================
# CLI Entry Point
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description='Link definitions to documents where terms appear',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )

    subparsers = parser.add_subparsers(dest='command', help='Command to run')

    # Run command
    run_parser = subparsers.add_parser('run', help='Process definitions and link to documents')
    run_parser.add_argument('--state', choices=['NY', 'NJ', 'NYC'], help='Filter by state')
    run_parser.add_argument('--definition-ids', help='Comma-separated definition IDs to process')
    run_parser.add_argument('--force', action='store_true', help='Reprocess even if already linked')
    run_parser.add_argument('--batch-size', type=int, default=1000, help='Batch size for inserts')
    run_parser.add_argument('--doc-batch-size', type=int, default=500,
                            help='Documents per batch (default 500, uses fresh DB connection per batch)')

    # Status command
    subparsers.add_parser('status', help='Show linking statistics')

    # Clean command
    subparsers.add_parser('clean', help='Remove stale links')

    args = parser.parse_args()

    if args.command == 'run':
        definition_ids = None
        if args.definition_ids:
            definition_ids = [int(x.strip()) for x in args.definition_ids.split(',')]

        link_definitions_to_documents(
            jurisdiction=args.state,
            definition_ids=definition_ids,
            force=args.force,
            batch_size=args.batch_size,
            doc_batch_size=args.doc_batch_size,
        )

    elif args.command == 'status':
        show_status()

    elif args.command == 'clean':
        clean_stale_links()

    else:
        parser.print_help()


if __name__ == '__main__':
    main()
