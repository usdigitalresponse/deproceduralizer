"""Detect supersedure relationships between guidance documents.

Three strategies:
  A. Revision chains (R1/R2/R3 suffix in canonical_ref)
  B. Content regex (ported from nys-documents/src/enrichers/supersession.ts)
  C. Title keywords ("revised", "amended", "cancels", etc.)

After detection, resolves bidirectional links and updates status.
"""

import re
from collections import Counter, defaultdict

from lib.db import get_db_connection
from scripts.guidance_pipeline.canonical_ref_cleaner import (
    AGENCY_REF_PATTERN,
    LEGACY_REF_PATTERN,
)


# --- Ref-finding helpers (ported from supersession.ts findRefs) ---

def find_refs_in_text(text: str) -> list[str]:
    """Extract all guidance doc references from a text block."""
    refs: set[str] = set()
    for pattern in [AGENCY_REF_PATTERN, LEGACY_REF_PATTERN]:
        for m in pattern.finditer(text):
            ref = re.sub(r"\s+", "-", m.group(1).strip()).upper()
            refs.add(ref)
    return sorted(refs)


# --- Content regex patterns (ported from supersession.ts extractSupersession) ---

# OCFS-style filing reference block: "Previous ADMs/INFs Cancelled" or "Releases Cancelled"
CANCEL_BLOCK_PATTERN = re.compile(
    r"(?:Previous\s+ADMs?/INFs?\s+)?(?:Releases?\s+)?Cancell?ed\s*"
    r"([\s\S]{0,500}?)"
    r"(?:NYS\s+Regs|Soc\.\s*Serv|Legal\s+Ref|Manual\s+Ref|Misc\s*Ref|Regulatory\s+Ref|Filing\s+Ref|^\s*$)",
    re.IGNORECASE | re.MULTILINE,
)

# "This [type] replaces/supersedes/cancels [ref]"
INLINE_REPLACES_PATTERN = re.compile(
    r"this\s+(?:ADM|LCM|INF|directive|memorandum|guidance|letter|circular|document)"
    r"\s+(?:replaces|supersedes|cancels|rescinds)\s+"
    r"([\s\S]{0,300}?)(?:\.|$)",
    re.IGNORECASE,
)

# "Supersedes:" / "Replaces:" header fields
HEADER_FIELD_PATTERN = re.compile(
    r"(?:Supersedes|Replaces|Cancels|Rescinds)\s*:\s*([\s\S]{0,300}?)(?:\n\n|\n[A-Z]|\Z)",
    re.IGNORECASE,
)

# Revision language: "revised and reissued of" / "reissue of" / "revision of"
REVISION_PATTERN = re.compile(
    r"(?:revised\s+(?:and\s+)?reissu(?:ed|ance)\s+of|reissue\s+of|revision\s+of)"
    r"\s+([\s\S]{0,300})",
    re.IGNORECASE,
)

# DOCCS-specific: "This directive supersedes Directive #NNNN"
DOCCS_SUPERSEDES_PATTERN = re.compile(
    r"(?:this\s+directive\s+)?supersedes\s+Directive\s*#?\s*(\d{4}[A-Z]?)",
    re.IGNORECASE,
)

# Transmittal with revision suffix
TRANSMITTAL_REVISION_PATTERN = re.compile(
    r"Transmittal:\s*(\S+-R\d)",
    re.IGNORECASE,
)


class SupersedureResult:
    """A detected supersedure relationship."""

    def __init__(
        self,
        source_id: int,
        source_ref: str | None,
        target_ref: str,
        target_id: int | None,
        relationship: str,  # 'supersedes', 'revision_of'
        method: str,  # 'revision_chain', 'content_regex', 'title_keyword'
        confidence: str,  # 'high', 'medium', 'low'
    ):
        self.source_id = source_id
        self.source_ref = source_ref
        self.target_ref = target_ref
        self.target_id = target_id
        self.relationship = relationship
        self.method = method
        self.confidence = confidence

    def __repr__(self):
        return (
            f"SupersedureResult({self.source_ref} {self.relationship} {self.target_ref}, "
            f"method={self.method}, confidence={self.confidence})"
        )


def _build_ref_index(conn) -> dict[str, list[dict]]:
    """Build a canonical_ref -> [doc_rows] index from the DB."""
    cur = conn.cursor()
    cur.execute("""
        SELECT id, canonical_ref, title, agency, doc_type, status
        FROM guidance_documents
        WHERE canonical_ref IS NOT NULL
        ORDER BY id
    """)
    rows = cur.fetchall()
    cur.close()

    index: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        ref = r[1].upper()
        index[ref].append({
            "id": r[0], "canonical_ref": r[1], "title": r[2],
            "agency": r[3], "doc_type": r[4], "status": r[5],
        })
    return index


def _resolve_ref(ref: str, ref_index: dict[str, list[dict]]) -> int | None:
    """Try to resolve a reference string to a DB document id."""
    ref_upper = ref.upper()
    matches = ref_index.get(ref_upper)
    if matches:
        return matches[0]["id"]

    # Try normalizing: strip spaces, add/remove hyphens
    normalized = re.sub(r"\s+", "-", ref_upper)
    matches = ref_index.get(normalized)
    if matches:
        return matches[0]["id"]

    return None


# --- Strategy A: Revision Chains ---

def detect_revision_chains(conn, ref_index: dict[str, list[dict]]) -> list[SupersedureResult]:
    """Find docs with -R1, -R2, etc. suffixes and link to base refs."""
    cur = conn.cursor()
    cur.execute("""
        SELECT id, canonical_ref, title, agency
        FROM guidance_documents
        WHERE canonical_ref ~ '-R\\d+$'
        ORDER BY canonical_ref
    """)
    revision_docs = cur.fetchall()
    cur.close()

    results = []
    for r in revision_docs:
        doc_id, ref, title, agency = r
        # Extract base ref: strip -R1, -R2, etc.
        base_ref = re.sub(r"-R\d+$", "", ref, flags=re.IGNORECASE).upper()
        target_id = _resolve_ref(base_ref, ref_index)

        results.append(SupersedureResult(
            source_id=doc_id,
            source_ref=ref,
            target_ref=base_ref,
            target_id=target_id,
            relationship="revision_of",
            method="revision_chain",
            confidence="high",
        ))
        # The revision also supersedes the base
        results.append(SupersedureResult(
            source_id=doc_id,
            source_ref=ref,
            target_ref=base_ref,
            target_id=target_id,
            relationship="supersedes",
            method="revision_chain",
            confidence="high",
        ))

    return results


# --- Strategy B: Content Regex ---

def detect_content_supersedure(conn, ref_index: dict[str, list[dict]]) -> list[SupersedureResult]:
    """Scan document content for supersedure language."""
    cur = conn.cursor()
    # Only scan docs with content, limit to first 3000 chars for performance
    cur.execute("""
        SELECT id, canonical_ref, title, agency, LEFT(content, 3000) as content_start
        FROM guidance_documents
        WHERE content IS NOT NULL AND LENGTH(content) > 50
        ORDER BY id
    """)
    docs = cur.fetchall()
    cur.close()

    results = []
    for doc_id, doc_ref, title, agency, content in docs:
        # Cancel block
        m = CANCEL_BLOCK_PATTERN.search(content)
        if m:
            refs = find_refs_in_text(m.group(1))
            # Filter out self-references
            refs = [r for r in refs if r.upper() != (doc_ref or "").upper()]
            for ref in refs:
                target_id = _resolve_ref(ref, ref_index)
                results.append(SupersedureResult(
                    source_id=doc_id, source_ref=doc_ref,
                    target_ref=ref, target_id=target_id,
                    relationship="supersedes",
                    method="content_regex", confidence="high",
                ))

        # Inline replaces
        m = INLINE_REPLACES_PATTERN.search(content)
        if m:
            refs = find_refs_in_text(m.group(1))
            refs = [r for r in refs if r.upper() != (doc_ref or "").upper()]
            for ref in refs:
                target_id = _resolve_ref(ref, ref_index)
                results.append(SupersedureResult(
                    source_id=doc_id, source_ref=doc_ref,
                    target_ref=ref, target_id=target_id,
                    relationship="supersedes",
                    method="content_regex", confidence="high",
                ))

        # Header field: "Supersedes: ..."
        m = HEADER_FIELD_PATTERN.search(content)
        if m:
            refs = find_refs_in_text(m.group(1))
            refs = [r for r in refs if r.upper() != (doc_ref or "").upper()]
            for ref in refs:
                target_id = _resolve_ref(ref, ref_index)
                results.append(SupersedureResult(
                    source_id=doc_id, source_ref=doc_ref,
                    target_ref=ref, target_id=target_id,
                    relationship="supersedes",
                    method="content_regex", confidence="high",
                ))

        # Revision language
        m = REVISION_PATTERN.search(content)
        if m:
            refs = find_refs_in_text(m.group(1))
            refs = [r for r in refs if r.upper() != (doc_ref or "").upper()]
            for ref in refs[:1]:  # Take first match only for revision_of
                target_id = _resolve_ref(ref, ref_index)
                results.append(SupersedureResult(
                    source_id=doc_id, source_ref=doc_ref,
                    target_ref=ref, target_id=target_id,
                    relationship="revision_of",
                    method="content_regex", confidence="high",
                ))

        # DOCCS directive supersession
        m = DOCCS_SUPERSEDES_PATTERN.search(content)
        if m:
            directive_num = m.group(1)
            target_ref = f"DIRECTIVE-#{directive_num}"
            # Try to resolve with various formats
            target_id = _resolve_ref(target_ref, ref_index)
            if not target_id:
                target_id = _resolve_ref(f"DIRECTIVE-{directive_num}", ref_index)
            results.append(SupersedureResult(
                source_id=doc_id, source_ref=doc_ref,
                target_ref=target_ref, target_id=target_id,
                relationship="supersedes",
                method="content_regex", confidence="medium",
            ))

        # Transmittal revision
        m = TRANSMITTAL_REVISION_PATTERN.search(content)
        if m:
            full_ref = m.group(1).upper()
            base_ref = re.sub(r"-R\d$", "", full_ref)
            if base_ref != full_ref:
                target_id = _resolve_ref(base_ref, ref_index)
                results.append(SupersedureResult(
                    source_id=doc_id, source_ref=doc_ref,
                    target_ref=base_ref, target_id=target_id,
                    relationship="revision_of",
                    method="content_regex", confidence="high",
                ))

    return results


# --- Strategy C: Title Keywords ---

def detect_title_supersedure(conn, ref_index: dict[str, list[dict]]) -> list[SupersedureResult]:
    """Detect supersedure from title patterns like 'Revised', 'Amended', 'Cancels'."""
    cur = conn.cursor()
    cur.execute("""
        SELECT id, canonical_ref, title, agency
        FROM guidance_documents
        WHERE title ~* '(revis|amend|cancel|replac|supersed|rescind)'
          AND canonical_ref IS NOT NULL
        ORDER BY id
    """)
    docs = cur.fetchall()
    cur.close()

    results = []
    for doc_id, doc_ref, title, agency in docs:
        refs = find_refs_in_text(title)
        refs = [r for r in refs if r.upper() != (doc_ref or "").upper()]
        for ref in refs:
            target_id = _resolve_ref(ref, ref_index)
            results.append(SupersedureResult(
                source_id=doc_id, source_ref=doc_ref,
                target_ref=ref, target_id=target_id,
                relationship="supersedes",
                method="title_keyword", confidence="low",
            ))

    return results


# --- Strategy D: Self-declared obsolete/superseded ---

# Patterns where a document declares ITSELF obsolete
SELF_OBSOLETE_PATTERN = re.compile(
    r"this\s+(?:TSB-M|ADM|LCM|INF|GIS|directive|memorandum|document|form|letter|circular)"
    r"\s+(?:is|has been|was)\s+"
    r"(?:obsolete|superseded|replaced|canceled|cancelled|rescinded|no longer in effect)",
    re.IGNORECASE,
)
NO_LONGER_PATTERN = re.compile(
    r"(?:this|the above).{0,30}(?:is|has been|was)\s+"
    r"(?:no longer in effect|no longer valid|void|withdrawn)",
    re.IGNORECASE,
)


def detect_self_declared_obsolete(conn) -> list[int]:
    """Find docs that declare themselves obsolete/superseded in their content.

    Returns list of document IDs that should be marked superseded.
    """
    cur = conn.cursor()
    cur.execute("""
        SELECT id, LEFT(content, 3000) as content_start
        FROM guidance_documents
        WHERE status = 'active'
          AND content IS NOT NULL AND LENGTH(content) > 50
        ORDER BY id
    """)
    docs = cur.fetchall()
    cur.close()

    obsolete_ids = []
    for doc_id, content in docs:
        if SELF_OBSOLETE_PATTERN.search(content) or NO_LONGER_PATTERN.search(content):
            obsolete_ids.append(doc_id)

    return obsolete_ids


def _apply_self_declared_obsolete(obsolete_ids: list[int], conn, dry_run: bool) -> int:
    """Mark self-declared obsolete docs as superseded."""
    if not obsolete_ids:
        return 0
    cur = conn.cursor()
    if not dry_run:
        # Use ANY to batch update
        cur.execute(
            "UPDATE guidance_documents SET status = 'superseded' WHERE id = ANY(%s) AND status = 'active'",
            (obsolete_ids,),
        )
        conn.commit()
    cur.close()
    return len(obsolete_ids)


# --- Bidirectional link resolution ---

def resolve_bidirectional_links(
    results: list[SupersedureResult], conn, dry_run: bool = True
) -> dict:
    """Apply detected supersedure relationships to the DB.

    For each relationship:
    - 'supersedes': set source.supersedes, target.superseded_by, target.status='superseded'
    - 'revision_of': set source.revision_of
    """
    # Group by source doc
    by_source: dict[int, dict] = defaultdict(lambda: {"supersedes": set(), "revision_of": None})
    # Track superseded_by for targets
    superseded_by_map: dict[int, str] = {}  # target_id -> source_ref

    for r in results:
        if r.relationship == "supersedes":
            by_source[r.source_id]["supersedes"].add(r.target_ref)
            if r.target_id:
                # Use canonical_ref if available; fall back to synthetic ref from source_id
                ref_label = r.source_ref or f"gd:{r.source_id}"
                if not r.source_ref:
                    print(f"  Warning: source doc id={r.source_id} has no canonical_ref, "
                          f"using '{ref_label}' for superseded_by")
                # Latest superseder wins
                superseded_by_map[r.target_id] = ref_label
        elif r.relationship == "revision_of":
            if by_source[r.source_id]["revision_of"] is None:
                by_source[r.source_id]["revision_of"] = r.target_ref

    updates_supersedes = 0
    updates_revision_of = 0
    updates_superseded_by = 0
    updates_status = 0

    cur = conn.cursor()

    # Update source docs: supersedes and revision_of
    for source_id, data in by_source.items():
        if data["supersedes"]:
            refs_list = sorted(data["supersedes"])
            if not dry_run:
                cur.execute(
                    "UPDATE guidance_documents SET supersedes = %s WHERE id = %s",
                    (refs_list, source_id),
                )
            updates_supersedes += 1

        if data["revision_of"]:
            if not dry_run:
                cur.execute(
                    "UPDATE guidance_documents SET revision_of = %s WHERE id = %s",
                    (data["revision_of"], source_id),
                )
            updates_revision_of += 1

    # Update target docs: superseded_by and status
    for target_id, source_ref in superseded_by_map.items():
        if not dry_run:
            cur.execute(
                "UPDATE guidance_documents SET superseded_by = %s, status = 'superseded' WHERE id = %s",
                (source_ref, target_id),
            )
        updates_superseded_by += 1
        updates_status += 1

    if not dry_run:
        conn.commit()
    cur.close()

    return {
        "supersedes_updated": updates_supersedes,
        "revision_of_updated": updates_revision_of,
        "superseded_by_updated": updates_superseded_by,
        "status_set_superseded": updates_status,
    }


# --- Main entry points ---

def detect_supersedure(dry_run: bool = True) -> dict:
    """Run all supersedure detection strategies and apply results."""
    conn = get_db_connection()
    if not conn:
        raise ConnectionError("Could not connect to database")

    print("Building canonical_ref index...")
    ref_index = _build_ref_index(conn)
    print(f"  {len(ref_index)} unique canonical_refs indexed")

    print("\nStrategy A: Revision chains (-R1/-R2 suffix)...")
    chain_results = detect_revision_chains(conn, ref_index)
    print(f"  Found {len(chain_results)} relationships")

    print("\nStrategy B: Content regex patterns...")
    content_results = detect_content_supersedure(conn, ref_index)
    print(f"  Found {len(content_results)} relationships")

    print("\nStrategy C: Title keywords...")
    title_results = detect_title_supersedure(conn, ref_index)
    print(f"  Found {len(title_results)} relationships")

    print("\nStrategy D: Self-declared obsolete/superseded...")
    self_obsolete_ids = detect_self_declared_obsolete(conn)
    print(f"  Found {len(self_obsolete_ids)} docs declaring themselves obsolete")

    # Merge, deduplicating by (source_id, target_ref, relationship)
    all_results = chain_results + content_results + title_results
    seen: set[tuple] = set()
    deduped: list[SupersedureResult] = []
    for r in all_results:
        key = (r.source_id, r.target_ref, r.relationship)
        if key not in seen:
            seen.add(key)
            deduped.append(r)

    print(f"\nTotal unique relationships: {len(deduped)}")

    # Stats
    resolved = sum(1 for r in deduped if r.target_id is not None)
    unresolved = len(deduped) - resolved
    print(f"  Resolved to DB doc: {resolved}")
    print(f"  Unresolved (ref not in DB): {unresolved}")

    by_method = Counter(r.method for r in deduped)
    print(f"  By method: {dict(by_method)}")

    by_relationship = Counter(r.relationship for r in deduped)
    print(f"  By relationship: {dict(by_relationship)}")

    # Apply bidirectional links
    print(f"\n{'[DRY RUN] ' if dry_run else ''}Resolving bidirectional links...")
    link_stats = resolve_bidirectional_links(deduped, conn, dry_run=dry_run)

    # Apply self-declared obsolete status
    print(f"{'[DRY RUN] ' if dry_run else ''}Marking self-declared obsolete docs...")
    self_obsolete_count = _apply_self_declared_obsolete(self_obsolete_ids, conn, dry_run=dry_run)
    link_stats["self_declared_obsolete"] = self_obsolete_count

    mode = "DRY RUN" if dry_run else "EXECUTED"
    print(f"\n[{mode}] Link resolution + status updates:")
    for key, val in link_stats.items():
        print(f"  {key}: {val}")

    conn.close()
    return {
        "total_detected": len(deduped),
        "resolved": resolved,
        "unresolved": unresolved,
        "by_method": dict(by_method),
        "by_relationship": dict(by_relationship),
        "link_stats": link_stats,
    }


def supersedure_report() -> None:
    """Print a summary report of all supersedure relationships in the DB."""
    conn = get_db_connection()
    if not conn:
        raise ConnectionError("Could not connect to database")

    cur = conn.cursor()

    # Overall status
    cur.execute("""
        SELECT status, COUNT(*)
        FROM guidance_documents
        GROUP BY status
        ORDER BY COUNT(*) DESC
    """)
    print("=== Document Status ===")
    for status, count in cur.fetchall():
        print(f"  {status or 'NULL'}: {count}")

    # Supersedes relationships
    cur.execute("""
        SELECT COUNT(*)
        FROM guidance_documents
        WHERE supersedes IS NOT NULL AND array_length(supersedes, 1) > 0
    """)
    supersedes_count = cur.fetchone()[0]
    print(f"\n=== Supersedure Summary ===")
    print(f"  Docs with supersedes: {supersedes_count}")

    cur.execute("""
        SELECT COUNT(*)
        FROM guidance_documents
        WHERE superseded_by IS NOT NULL
    """)
    superseded_by_count = cur.fetchone()[0]
    print(f"  Docs with superseded_by: {superseded_by_count}")

    cur.execute("""
        SELECT COUNT(*)
        FROM guidance_documents
        WHERE revision_of IS NOT NULL
    """)
    revision_of_count = cur.fetchone()[0]
    print(f"  Docs with revision_of: {revision_of_count}")

    # By agency
    cur.execute("""
        SELECT agency, COUNT(*)
        FROM guidance_documents
        WHERE status = 'superseded'
        GROUP BY agency
        ORDER BY COUNT(*) DESC
        LIMIT 15
    """)
    rows = cur.fetchall()
    if rows:
        print(f"\n=== Superseded Docs by Agency ===")
        for agency, count in rows:
            print(f"  {agency}: {count}")

    # By doc_type
    cur.execute("""
        SELECT doc_type, COUNT(*)
        FROM guidance_documents
        WHERE status = 'superseded'
        GROUP BY doc_type
        ORDER BY COUNT(*) DESC
        LIMIT 15
    """)
    rows = cur.fetchall()
    if rows:
        print(f"\n=== Superseded Docs by Type ===")
        for doc_type, count in rows:
            print(f"  {doc_type or 'NULL'}: {count}")

    # Sample revision chains
    cur.execute("""
        SELECT g1.canonical_ref AS revision, g1.revision_of AS original,
               g2.canonical_ref AS original_ref, g2.status AS original_status
        FROM guidance_documents g1
        LEFT JOIN guidance_documents g2 ON g2.canonical_ref = g1.revision_of
        WHERE g1.revision_of IS NOT NULL
        ORDER BY g1.canonical_ref
        LIMIT 20
    """)
    rows = cur.fetchall()
    if rows:
        print(f"\n=== Sample Revision Chains (up to 20) ===")
        for revision, original, original_ref, original_status in rows:
            resolved = "resolved" if original_ref else "NOT IN DB"
            print(f"  {revision} -> revision_of -> {original} ({resolved}, status={original_status})")

    cur.close()
    conn.close()
