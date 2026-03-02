"""Resolve NYCRR citations from guidance documents to regulatory_documents."""

import re
import time

from lib.db import get_db_connection


def parse_nycrr_citation(citation: str) -> tuple[str | None, str | None, str | None]:
    """Parse an NYCRR citation into (title, part, section).

    Examples:
        '18 NYCRR 415.2' -> ('18', '415', '415.2')
        '18 NYCRR § 385.3' -> ('18', '385', '385.3')
        '18 NYCRR Part 413' -> ('18', '413', None)
        '9 NYCRR 180-7.5(c)' -> ('9', '180-7', '180-7.5')
        '18 NYCRR 360' -> ('18', '360', None)  # part-only, no dot
        '18 NYCRR §360' -> ('18', '360', None)  # part-only with §
    """
    m = re.match(
        r"(\d+)\s+NYCRR\s*(?:§\s*|Part\s+|Section\s+)?(\d+[\w\-]*(?:\.\d+)?)",
        citation,
        re.IGNORECASE,
    )
    if not m:
        return None, None, None

    title = m.group(1)
    section_str = m.group(2)

    part_match = re.match(r"(\d+[\w\-]*?)(?:\.\d+)?$", section_str)
    part = part_match.group(1) if part_match else section_str

    # Treat as part-only if: explicit "Part" keyword, OR no dot in section
    # (e.g., "18 NYCRR 360" or "18 NYCRR §360" are part-level refs)
    if "." not in section_str:
        return title, part, None

    return title, part, section_str


def resolve_citations(
    docs: list[dict],
    dry_run: bool = False,
) -> None:
    """Resolve NYCRR citations from guidance docs to regulation IDs.

    Creates cross_references rows with source_guidance_id pointing to
    target_document_id in regulatory_documents.
    """
    docs_with_cites = [d for d in docs if d.get("cites_regulations")]
    if not docs_with_cites:
        print("No documents with NYCRR citations found.")
        return

    print(f"\nResolving citations for {len(docs_with_cites)} documents...")

    all_citations = set()
    for doc in docs_with_cites:
        for cite in doc.get("cites_regulations", []):
            if "NYCRR" in cite.upper():
                all_citations.add(cite)

    print(f"  Found {len(all_citations)} unique NYCRR citations")

    if dry_run:
        parsed_ok = 0
        for cite in sorted(all_citations)[:10]:
            title, part, section = parse_nycrr_citation(cite)
            status = "OK" if title else "FAIL"
            if title:
                parsed_ok += 1
            print(f"  [{status}] {cite} -> title={title}, part={part}, section={section}")
        total_parsed = sum(1 for c in all_citations if parse_nycrr_citation(c)[0])
        print(f"  Parseable: {total_parsed}/{len(all_citations)}")
        return

    conn = get_db_connection()
    if not conn:
        raise ConnectionError("Could not connect to database")

    try:
        cur = conn.cursor()

        # Get DB IDs for our guidance docs (by catalog_id)
        catalog_ids = [d["id"] for d in docs_with_cites]
        cur.execute(
            "SELECT catalog_id, id FROM guidance_documents WHERE catalog_id = ANY(%s)",
            (catalog_ids,),
        )
        guidance_id_map = {row[0]: row[1] for row in cur.fetchall()}
        print(f"  Found {len(guidance_id_map)} guidance docs in DB")

        if not guidance_id_map:
            print("  No guidance docs found in DB. Run import first.")
            return

        # Build regulation lookup
        section_lookup, part_lookup = _build_regulation_lookups(cur)
        print(f"  Loaded {len(section_lookup)} section entries, {len(part_lookup)} part entries")

        total_refs = 0
        resolved_refs = 0
        unresolved_refs = 0
        docs_processed = 0
        start_time = time.time()

        for doc in docs_with_cites:
            source_db_id = guidance_id_map.get(doc["id"])
            if not source_db_id:
                continue

            nycrr_cites = [c for c in doc.get("cites_regulations", []) if "NYCRR" in c.upper()]
            if not nycrr_cites:
                continue

            # Delete existing cross_references for this source (idempotent re-run)
            cur.execute(
                "DELETE FROM cross_references WHERE source_guidance_id = %s",
                (source_db_id,),
            )

            for cite in nycrr_cites:
                title, part, section = parse_nycrr_citation(cite)
                if not title:
                    continue

                total_refs += 1
                target_id = _resolve_single_citation(
                    title, part, section, section_lookup, part_lookup
                )

                is_resolved = target_id is not None
                if is_resolved:
                    resolved_refs += 1
                else:
                    unresolved_refs += 1

                normalized = f"{title} NYCRR {section or f'Part {part}'}" if title else cite

                cur.execute(
                    """
                    INSERT INTO cross_references
                    (source_guidance_id, ref_type, raw_text, normalized_citation,
                     target_document_id, is_resolved, state,
                     source_jurisdiction, target_jurisdiction)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        source_db_id,
                        "nycrr",
                        cite,
                        normalized,
                        target_id,
                        is_resolved,
                        "NY",
                        "NY",
                        "NY" if target_id else None,
                    ),
                )

            docs_processed += 1
            if docs_processed % 50 == 0:
                conn.commit()
                elapsed = time.time() - start_time
                rate = docs_processed / elapsed if elapsed > 0 else 0
                remaining = (len(docs_with_cites) - docs_processed) / rate if rate > 0 else 0
                print(
                    f"  Processed {docs_processed}/{len(docs_with_cites)} docs, "
                    f"{resolved_refs} resolved, {unresolved_refs} unresolved, "
                    f"ETA: {remaining:.0f}s"
                )

        conn.commit()
        cur.close()

        print(
            f"\nCitation resolution complete: {docs_processed} docs, "
            f"{total_refs} refs ({resolved_refs} resolved, {unresolved_refs} unresolved)"
        )
    finally:
        conn.close()


def _build_regulation_lookups(cur) -> tuple[dict[tuple, int], dict[tuple, list[int]]]:
    """Build section and part lookup dicts from regulatory_documents."""
    # Load section-level rows (populates both lookups)
    cur.execute(
        """
        SELECT id, nycrr_title, nycrr_part, nycrr_section
        FROM regulatory_documents
        WHERE state = 'NY' AND type = 'regulation'
          AND nycrr_section IS NOT NULL
        """
    )
    section_lookup: dict[tuple, int] = {}
    part_lookup: dict[tuple, list[int]] = {}
    for row in cur.fetchall():
        db_id, title, part, section = row
        if title and section:
            section_lookup[(str(title), section)] = db_id
        if title and part:
            key = (str(title), str(part))
            part_lookup.setdefault(key, []).append(db_id)

    # Load part-only rows (no sections) so part-level citations can resolve
    cur.execute(
        """
        SELECT id, nycrr_title, nycrr_part
        FROM regulatory_documents
        WHERE state = 'NY' AND type = 'regulation'
          AND nycrr_part IS NOT NULL
          AND nycrr_section IS NULL
        """
    )
    for row in cur.fetchall():
        db_id, title, part = row
        if title and part:
            key = (str(title), str(part))
            part_lookup.setdefault(key, []).append(db_id)

    return section_lookup, part_lookup


def _resolve_single_citation(
    title: str,
    part: str | None,
    section: str | None,
    section_lookup: dict[tuple, int],
    part_lookup: dict[tuple, list[int]],
) -> int | None:
    """Resolve a parsed NYCRR citation to a regulatory_documents ID."""
    target_id = None
    if section:
        target_id = section_lookup.get((title, section))
    if not target_id and part:
        part_matches = part_lookup.get((title, str(part)), [])
        if part_matches:
            target_id = part_matches[0]
    return target_id


def re_resolve_all(dry_run: bool = False) -> None:
    """Re-resolve all guidance→regulation citations from the database.

    Reads guidance documents and their cites_regulations directly from the DB,
    rebuilds all cross_references for guidance sources. Does not require the
    nys-documents catalog.
    """
    conn = get_db_connection()
    if not conn:
        raise ConnectionError("Could not connect to database")

    try:
        cur = conn.cursor()

        # Fetch all guidance docs with NYCRR citations
        cur.execute(
            """
            SELECT id, catalog_id, canonical_ref, agency, cites_regulations
            FROM guidance_documents
            WHERE cites_regulations IS NOT NULL
              AND array_length(cites_regulations, 1) > 0
            """
        )
        all_docs = []
        for row in cur.fetchall():
            gd_id, catalog_id, canonical_ref, agency, cites_regs = row
            # cites_regulations is jsonb, psycopg2 returns it as a Python list
            nycrr_cites = [c for c in (cites_regs or []) if "NYCRR" in c.upper()]
            if nycrr_cites:
                all_docs.append({
                    "db_id": gd_id,
                    "canonical_ref": canonical_ref or catalog_id or str(gd_id),
                    "agency": agency,
                    "nycrr_cites": nycrr_cites,
                })

        print(f"\nRe-resolving citations for {len(all_docs)} guidance documents...")

        # Collect unique citations
        all_citations = set()
        for doc in all_docs:
            all_citations.update(doc["nycrr_cites"])
        print(f"  {len(all_citations)} unique NYCRR citations")

        if dry_run:
            parsed_ok = 0
            for cite in sorted(all_citations)[:20]:
                title, part, section = parse_nycrr_citation(cite)
                status = "OK" if title else "FAIL"
                if title:
                    parsed_ok += 1
                print(f"  [{status}] {cite} -> title={title}, part={part}, section={section}")
            total_parsed = sum(1 for c in all_citations if parse_nycrr_citation(c)[0])
            print(f"  Parseable: {total_parsed}/{len(all_citations)}")
            cur.close()
            return

        # Build regulation lookups
        section_lookup, part_lookup = _build_regulation_lookups(cur)
        print(f"  Loaded {len(section_lookup)} section entries, {len(part_lookup)} part entries")

        total_refs = 0
        resolved_refs = 0
        unresolved_refs = 0
        docs_processed = 0
        start_time = time.time()

        for doc in all_docs:
            source_db_id = doc["db_id"]

            # Delete existing cross_references for this source (idempotent)
            cur.execute(
                "DELETE FROM cross_references WHERE source_guidance_id = %s",
                (source_db_id,),
            )

            for cite in doc["nycrr_cites"]:
                title, part, section = parse_nycrr_citation(cite)
                if not title:
                    continue

                total_refs += 1
                target_id = _resolve_single_citation(
                    title, part, section, section_lookup, part_lookup
                )

                is_resolved = target_id is not None
                if is_resolved:
                    resolved_refs += 1
                else:
                    unresolved_refs += 1

                normalized = f"{title} NYCRR {section or f'Part {part}'}" if title else cite

                cur.execute(
                    """
                    INSERT INTO cross_references
                    (source_guidance_id, ref_type, raw_text, normalized_citation,
                     target_document_id, is_resolved, state,
                     source_jurisdiction, target_jurisdiction)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        source_db_id,
                        "nycrr",
                        cite,
                        normalized,
                        target_id,
                        is_resolved,
                        "NY",
                        "NY",
                        "NY" if target_id else None,
                    ),
                )

            docs_processed += 1
            if docs_processed % 100 == 0:
                conn.commit()
                elapsed = time.time() - start_time
                rate = docs_processed / elapsed if elapsed > 0 else 0
                remaining = (len(all_docs) - docs_processed) / rate if rate > 0 else 0
                print(
                    f"  Processed {docs_processed}/{len(all_docs)} docs, "
                    f"{resolved_refs} resolved, {unresolved_refs} unresolved, "
                    f"ETA: {remaining:.0f}s"
                )

        conn.commit()
        cur.close()

        print(
            f"\nRe-resolution complete: {docs_processed} docs, "
            f"{total_refs} refs ({resolved_refs} resolved, {unresolved_refs} unresolved)"
        )
    finally:
        conn.close()
