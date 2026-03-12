"""Import guidance documents into the guidance_documents table."""

import re
import time
from collections import Counter

from lib.db import get_db_connection
from scripts.guidance_pipeline.catalog import (
    extract_canonical_ref,
    extract_year,
    load_text,
)

# Doc types that are actually codified law/regulations, not guidance
_REGULATION_DOC_TYPES = {"Code", "Statute"}

# Title patterns that indicate NYCRR regulation text, not guidance
_REGULATION_TITLE_RE = re.compile(
    r"^(?:CHAPTER [IVX]+|PART \d+|SUBPART \d+)\b.*(?:FINANCING|ACCOUNTING|DEALERS|RULE)\b",
    re.IGNORECASE,
)


def _is_regulation(doc: dict) -> bool:
    """Return True if the document is actually a regulation, not guidance."""
    doc_type = doc.get("doc_type", "")
    if doc_type in _REGULATION_DOC_TYPES:
        return True
    title = doc.get("title", "")
    if _REGULATION_TITLE_RE.search(title):
        return True
    return False


def preview_import(docs: list[dict]) -> None:
    """Show dry-run summary of what would be imported."""
    print(f"\n[DRY RUN] Would import {len(docs)} documents")

    by_project = Counter(d.get("source_project") for d in docs)
    print("\nBy source project:")
    for proj, count in sorted(by_project.items()):
        print(f"  {proj}: {count}")

    by_agency = Counter(d.get("agency") for d in docs)
    print("\nBy agency:")
    for agency, count in sorted(by_agency.items(), key=lambda x: -x[1]):
        print(f"  {agency}: {count}")

    by_type = Counter(d.get("doc_type") for d in docs)
    print("\nBy doc_type:")
    for dt, count in sorted(by_type.items(), key=lambda x: -x[1]):
        print(f"  {dt}: {count}")


def import_documents(source_dir: str, docs: list[dict]) -> dict[str, int]:
    """Import guidance documents into guidance_documents table.

    Uses ON CONFLICT(catalog_id) for idempotent re-runs.
    Returns dict of catalog_id -> DB id mappings.
    """
    conn = get_db_connection()
    if not conn:
        raise ConnectionError("Could not connect to database")

    try:
        return _do_import(conn, source_dir, docs)
    finally:
        conn.close()


def _do_import(conn, source_dir: str, docs: list[dict]) -> dict[str, int]:
    """Internal import logic with connection managed by caller."""
    upsert_sql = """
        INSERT INTO guidance_documents
        (catalog_id, canonical_ref, title, agency, agency_division, doc_type, domain,
         date_published, date_effective, date_revised, date_expires, year,
         content, url, file_format,
         status, supersedes, superseded_by, revision_of,
         sender_name, sender_title, distribution_to, programs,
         cites_regulations, cites_federal, cites_documents,
         source_project, text_path, jurisdiction)
        VALUES (
            %(catalog_id)s, %(canonical_ref)s, %(title)s, %(agency)s, %(agency_division)s,
            %(doc_type)s, %(domain)s,
            %(date_published)s, %(date_effective)s, %(date_revised)s, %(date_expires)s, %(year)s,
            %(content)s, %(url)s, %(file_format)s,
            %(status)s, %(supersedes)s, %(superseded_by)s, %(revision_of)s,
            %(sender_name)s, %(sender_title)s, %(distribution_to)s, %(programs)s,
            %(cites_regulations)s, %(cites_federal)s, %(cites_documents)s,
            %(source_project)s, %(text_path)s, %(jurisdiction)s
        )
        ON CONFLICT (catalog_id) WHERE catalog_id IS NOT NULL DO UPDATE SET
            canonical_ref = EXCLUDED.canonical_ref,
            title = EXCLUDED.title,
            agency = EXCLUDED.agency,
            agency_division = EXCLUDED.agency_division,
            doc_type = EXCLUDED.doc_type,
            domain = EXCLUDED.domain,
            date_published = EXCLUDED.date_published,
            date_effective = EXCLUDED.date_effective,
            date_revised = EXCLUDED.date_revised,
            date_expires = EXCLUDED.date_expires,
            year = EXCLUDED.year,
            content = EXCLUDED.content,
            url = EXCLUDED.url,
            file_format = EXCLUDED.file_format,
            status = EXCLUDED.status,
            supersedes = EXCLUDED.supersedes,
            superseded_by = EXCLUDED.superseded_by,
            revision_of = EXCLUDED.revision_of,
            sender_name = EXCLUDED.sender_name,
            sender_title = EXCLUDED.sender_title,
            distribution_to = EXCLUDED.distribution_to,
            programs = EXCLUDED.programs,
            cites_regulations = EXCLUDED.cites_regulations,
            cites_federal = EXCLUDED.cites_federal,
            cites_documents = EXCLUDED.cites_documents,
            source_project = EXCLUDED.source_project,
            text_path = EXCLUDED.text_path,
            jurisdiction = EXCLUDED.jurisdiction
        RETURNING id
    """

    total = 0
    skipped = 0
    errors = 0
    id_map: dict[str, int] = {}
    start_time = time.time()

    cur = conn.cursor()

    for i, doc in enumerate(docs):
        # Skip documents that are actually regulations, not guidance
        if _is_regulation(doc):
            skipped += 1
            continue

        content = load_text(source_dir, doc.get("text_path", ""))
        if not content or not content.strip():
            skipped += 1
            continue

        row = _build_row(doc, content)

        try:
            cur.execute(upsert_sql, row)
            result = cur.fetchone()
            if result:
                id_map[doc["id"]] = result[0]
            total += 1

            if total % 50 == 0:
                conn.commit()

            if total % 200 == 0:
                elapsed = time.time() - start_time
                rate = total / elapsed if elapsed > 0 else 0
                remaining = (len(docs) - i) / rate if rate > 0 else 0
                print(
                    f"  Imported {total}/{len(docs)} docs "
                    f"({skipped} skipped, {errors} errors), "
                    f"ETA: {remaining:.0f}s"
                )

        except Exception as e:
            errors += 1
            if errors <= 5:
                print(f"  Error importing doc {doc.get('id', '?')}: {e}")
            if errors == 5:
                print("  (suppressing further error messages)")
            conn.rollback()
            cur = conn.cursor()

    conn.commit()
    cur.close()

    print(f"\nImport complete: {total} imported, {skipped} skipped (no content), {errors} errors")
    return id_map


def _infer_jurisdiction(agency: str) -> str:
    """Infer jurisdiction from agency name.

    NYC agencies (NYC_DOHMH, NYC_DOE, etc.) → 'NYC'
    Everything else → 'NY' (state-level agencies)
    """
    if agency and agency.upper().startswith("NYC"):
        return "NYC"
    return "NY"


def _build_row(doc: dict, content: str) -> dict:
    """Build a parameter dict for the upsert query."""
    canonical_ref = extract_canonical_ref(doc)
    year = extract_year(doc)

    # Parse date fields — handle both string and None
    def parse_date(val):
        if not val:
            return None
        s = str(val).strip()
        if not s or s == "None":
            return None
        return s[:10]  # Take YYYY-MM-DD portion

    agency = doc.get("agency", "UNKNOWN")

    return {
        "catalog_id": doc.get("id"),
        "canonical_ref": canonical_ref,
        "title": (doc.get("title", "") or "").strip() or f"Guidance Document {doc.get('id', '?')}",
        "agency": agency,
        "agency_division": doc.get("agency_division"),
        "doc_type": doc.get("doc_type"),
        "domain": doc.get("domain"),
        "date_published": parse_date(doc.get("date_published")),
        "date_effective": parse_date(doc.get("date_effective")),
        "date_revised": parse_date(doc.get("date_revised")),
        "date_expires": parse_date(doc.get("date_expires")),
        "year": year,
        "content": content,
        "url": doc.get("url", "").strip() or None,
        "file_format": doc.get("file_format"),
        "status": doc.get("status", "active"),
        "supersedes": doc.get("supersedes") or None,
        "superseded_by": doc.get("superseded_by"),
        "revision_of": doc.get("revision_of"),
        "sender_name": doc.get("sender_name"),
        "sender_title": doc.get("sender_title"),
        "distribution_to": doc.get("distribution_to") or None,
        "programs": doc.get("programs") or None,
        "cites_regulations": doc.get("cites_regulations") or None,
        "cites_federal": doc.get("cites_federal") or None,
        "cites_documents": doc.get("cites_documents") or None,
        "source_project": doc.get("source_project"),
        "text_path": doc.get("text_path"),
        "jurisdiction": _infer_jurisdiction(agency),
    }
