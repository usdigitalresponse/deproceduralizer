#!/usr/bin/env python3
"""
New York Statutes (NYCLS) - Fetch from OpenLegislation API, Migrate to DB

Pipeline:
1. Fetch law list from NY Senate OpenLegislation API (or use CLI-provided law IDs)
2. For each law: fetch tree structure, walk tree to get all nodes
3. For each SECTION node: fetch full text (with caching)
4. Save to JSON files (complete + individual)
5. Migrate sections to statutes table (upsert ON CONFLICT)
6. Create hierarchy container rows (laws, articles)
7. Populate parent_id using tree walk parent mapping

Citation formats:
  - Sections:  "EXC 296"       (lawId + space + docLevelId)
  - Articles:  "EXC:A15"       (lawId + colon + locationId)
  - Laws:      "law:EXC"       (prefix + lawId)

Usage:
    python ny_statutes.py                      # All consolidated laws
    python ny_statutes.py EXC SOS PBH EDN      # Specific laws (test with child care subset)
    python ny_statutes.py --fetch-only         # Only cache API data
    python ny_statutes.py --skip-fetch         # Use cached JSON
    python ny_statutes.py --skip-db            # Skip database operations
    python ny_statutes.py --hierarchy-only     # Only update hierarchy + parent_id
    python ny_statutes.py --fresh              # Clear cache and re-fetch
    python ny_statutes.py --delay 0.5          # Custom API delay
"""

import json
import os
import sys
import shutil
import time
import argparse
from pathlib import Path
from typing import Optional, Dict, List, Tuple

# Ensure backend/ is on sys.path so `config` and `lib` are importable
# when running as `python backend/scripts/ny_statutes.py` from project root
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import requests

from config import (
    PROJECT_ROOT,
    NY_STATUTES_OUTPUT_DIR,
    NY_STATUTES_TREES_DIR,
    NY_STATUTES_SECTIONS_DIR,
    NY_STATUTES_INDIVIDUAL_DIR,
    NY_STATUTES_COMPLETE_FILE,
    ensure_data_dirs,
)
import psycopg
from lib.db import get_db_connection
from lib.stats import format_time
from dotenv import load_dotenv

load_dotenv(PROJECT_ROOT / '.env')

# OpenLegislation API base URL
API_BASE = "https://legislation.nysenate.gov/api/3"


# =============================================================================
# API CLIENT
# =============================================================================

class NYOpenLegClient:
    """Client for the NY Senate OpenLegislation API with caching and rate limiting."""

    def __init__(self, api_key: str, delay: float = 0.2):
        self.api_key = api_key
        self.delay = delay
        self.session = requests.Session()
        self._last_request_time = 0.0

    def _rate_limit(self):
        """Enforce minimum delay between API calls."""
        elapsed = time.time() - self._last_request_time
        if elapsed < self.delay:
            time.sleep(self.delay - elapsed)
        self._last_request_time = time.time()

    def _get(self, url: str, params: Optional[Dict] = None, max_retries: int = 3) -> Optional[Dict]:
        """Make a GET request with rate limiting and retry on errors."""
        if params is None:
            params = {}
        params['key'] = self.api_key

        for attempt in range(max_retries):
            self._rate_limit()
            try:
                resp = self.session.get(url, params=params, timeout=30)
                if resp.status_code == 200:
                    return resp.json()
                elif resp.status_code == 404:
                    return None
                elif resp.status_code == 429 or resp.status_code >= 500:
                    wait = (2 ** attempt) * 2
                    print(f"    HTTP {resp.status_code}, retrying in {wait}s (attempt {attempt + 1}/{max_retries})")
                    time.sleep(wait)
                else:
                    print(f"    HTTP {resp.status_code} for {url}")
                    return None
            except requests.RequestException as e:
                wait = (2 ** attempt) * 2
                print(f"    Request error: {e}, retrying in {wait}s (attempt {attempt + 1}/{max_retries})")
                time.sleep(wait)

        print(f"    WARNING: Failed after {max_retries} retries: {url}")
        print(f"    This may indicate a transient API issue — data for this endpoint will be skipped.")
        return None

    def get_law_list(self) -> List[Dict]:
        """Fetch the list of all laws."""
        all_items = []
        offset = 1
        limit = 1000

        while True:
            data = self._get(f"{API_BASE}/laws", params={'limit': limit, 'offset': offset})
            if not data or not data.get('success'):
                break

            items = data.get('result', {}).get('items', [])
            if not items:
                break

            all_items.extend(items)
            total = data.get('total', 0)
            if offset + limit > total:
                break
            offset += limit

        return all_items

    def get_law_tree(self, law_id: str, cache_dir: Path = None) -> Optional[Dict]:
        """Fetch the tree structure for a law, with file caching."""
        cache_dir = cache_dir or NY_STATUTES_TREES_DIR
        cache_file = cache_dir / f"{law_id}.json"

        if cache_file.exists():
            with open(cache_file, 'r') as f:
                return json.load(f)

        data = self._get(f"{API_BASE}/laws/{law_id}")
        if not data or not data.get('success'):
            return None

        result = data.get('result', {})

        cache_dir.mkdir(parents=True, exist_ok=True)
        with open(cache_file, 'w') as f:
            json.dump(result, f, indent=2)

        return result

    def get_section_text(self, law_id: str, location_id: str, cache_dir: Path = None) -> Optional[Dict]:
        """Fetch full text for a specific section, with file caching."""
        cache_dir = cache_dir or NY_STATUTES_SECTIONS_DIR
        safe_loc = location_id.replace('/', '_').replace('*', '_')
        cache_file = cache_dir / f"{law_id}_{safe_loc}.json"

        if cache_file.exists():
            with open(cache_file, 'r') as f:
                return json.load(f)

        # Trailing slash required per API docs
        url = f"{API_BASE}/laws/{law_id}/{location_id}/"
        data = self._get(url)
        if not data or not data.get('success'):
            return None

        result = data.get('result', {})

        cache_dir.mkdir(parents=True, exist_ok=True)
        with open(cache_file, 'w') as f:
            json.dump(result, f, indent=2)

        return result


# =============================================================================
# TREE WALKING
# =============================================================================

def walk_law_tree(node: Dict, parent_location_id: Optional[str] = None) -> List[Dict]:
    """
    Recursively flatten a law tree into a list of nodes.

    Each returned node includes:
      - All original fields (lawId, locationId, title, docType, docLevelId, etc.)
      - parent_location_id: the locationId of the parent node (None for root)

    Args:
        node: A tree node from the API response
        parent_location_id: The parent's locationId

    Returns:
        Flat list of all nodes in the tree
    """
    results = []

    entry = {
        'lawId': node.get('lawId', ''),
        'locationId': node.get('locationId', ''),
        'title': node.get('title', ''),
        'docType': node.get('docType', ''),
        'docLevelId': node.get('docLevelId', ''),
        'activeDate': node.get('activeDate', ''),
        'sequenceNo': node.get('sequenceNo', 0),
        'repealed': node.get('repealed', False),
        'repealedDate': node.get('repealedDate'),
        'text': node.get('text'),
        'parent_location_id': parent_location_id,
    }
    results.append(entry)

    children = node.get('documents', {})
    if isinstance(children, dict):
        items = children.get('items', [])
    elif isinstance(children, list):
        items = children
    else:
        items = []

    for child in items:
        results.extend(walk_law_tree(child, parent_location_id=node.get('locationId', '')))

    return results


def build_citation(law_id: str, location_id: str, doc_type: str) -> str:
    """
    Build a citation string for a node.

    Citation formats:
      - SECTION:  "EXC 296"      (lawId + space + locationId)
      - Non-section containers: "EXC:A15" (lawId + colon + locationId)
      - Law root (CHAPTER): "law:EXC"
    """
    # Root CHAPTER nodes have locationIds like "-CH55" — treat as law container
    if not location_id or location_id == law_id or doc_type == 'CHAPTER':
        return f"law:{law_id}"

    if doc_type == 'SECTION':
        return f"{law_id} {location_id}"

    return f"{law_id}:{location_id}"


def doc_type_to_hierarchy_level(doc_type: str) -> str:
    """Map API docType to our hierarchy_level values."""
    mapping = {
        'CHAPTER': 'law',
        'ARTICLE': 'article',
        'TITLE': 'title',
        'PART': 'part',
        'SUB_ARTICLE': 'sub_article',
        'SECTION': 'section',
    }
    return mapping.get(doc_type, doc_type.lower() if doc_type else 'unknown')


def build_hierarchy_path(law_id: str, law_name: str, doc_type: str, location_id: str, title: str) -> str:
    """Build a human-readable hierarchy path."""
    parts = [f"{law_name} ({law_id})"]

    if doc_type == 'SECTION':
        parts.append(f"Section {location_id}")
        if title:
            parts[-1] += f" - {title}"
    elif doc_type != 'CHAPTER' and location_id:
        parts.append(f"{doc_type.replace('_', ' ').title()} {location_id}")
        if title:
            parts[-1] += f" - {title}"

    return ' > '.join(parts)


# =============================================================================
# RECORD BUILDING
# =============================================================================

def build_statute_record(node: Dict, law_name: str, text: Optional[str] = None) -> Dict:
    """Convert a tree node + fetched text into a DB-ready statute record."""
    law_id = node['lawId']
    location_id = node['locationId']
    doc_type = node['docType']
    node_title = node.get('title', '')

    citation = build_citation(law_id, location_id, doc_type)
    hierarchy_level = doc_type_to_hierarchy_level(doc_type)
    content = text or node.get('text') or ''

    # Build display title
    if doc_type == 'SECTION':
        display_title = f"NYCLS {law_id} {location_id}"
        if node_title:
            display_title += f" - {node_title}"
    elif doc_type == 'CHAPTER' or not location_id or location_id == law_id:
        display_title = f"{law_name} ({law_id})"
    else:
        display_title = f"NYCLS {law_id} {doc_type.replace('_', ' ').title()} {location_id}"
        if node_title:
            display_title += f" - {node_title}"

    # Determine article info (for ARTICLE and SECTION nodes)
    nycls_article = None
    nycls_article_name = None
    if doc_type == 'ARTICLE':
        nycls_article = location_id
        nycls_article_name = node_title
    # For sections, article is determined later via parent mapping

    return {
        'citation': citation,
        'state': 'NY',
        'title': display_title,
        'content': content,
        'nycls_law_id': law_id,
        'nycls_law_name': law_name,
        'nycls_article': nycls_article,
        'nycls_article_name': nycls_article_name,
        'nycls_section': location_id if doc_type == 'SECTION' else None,
        'nycls_section_name': node_title if doc_type == 'SECTION' else None,
        'hierarchy_level': hierarchy_level,
        'hierarchy_path': build_hierarchy_path(law_id, law_name, doc_type, location_id, node_title),
        'source_index': node.get('sequenceNo', 0),
        # Metadata for parent resolution
        '_parent_location_id': node.get('parent_location_id'),
        '_location_id': location_id,
        '_doc_type': doc_type,
        '_law_id': law_id,
    }


# =============================================================================
# FETCH PIPELINE
# =============================================================================

def fetch_law_statutes(client: NYOpenLegClient, law_id: str, law_name: str) -> List[Dict]:
    """
    Fetch all sections for a single law.

    1. Get tree structure
    2. Walk tree to find all SECTION nodes
    3. Fetch text for each section (with caching)
    4. Build statute records
    """
    print(f"\n  Fetching tree for {law_id} ({law_name})...")
    tree = client.get_law_tree(law_id)
    if not tree:
        print(f"    Could not fetch tree for {law_id}")
        return []

    # The root of the tree is in the 'documents' key
    root = tree.get('documents', tree)
    nodes = walk_law_tree(root)

    sections = [n for n in nodes if n['docType'] == 'SECTION']
    containers = [n for n in nodes if n['docType'] != 'SECTION']

    print(f"    Found {len(sections)} sections, {len(containers)} containers")

    records = []
    start_time = time.time()

    # Build container records (no text fetch needed)
    for node in containers:
        record = build_statute_record(node, law_name)
        records.append(record)

    # Fetch section text and build records
    for i, node in enumerate(sections):
        location_id = node['locationId']

        # Skip repealed sections
        if node.get('repealed'):
            continue

        # Fetch full text
        section_data = client.get_section_text(law_id, location_id)
        text = section_data.get('text', '') if section_data else ''

        record = build_statute_record(node, law_name, text=text)

        # Try to determine article from parent chain in the tree
        parent_loc = node.get('parent_location_id')
        for container in containers:
            if container['locationId'] == parent_loc and container['docType'] == 'ARTICLE':
                record['nycls_article'] = container['locationId']
                record['nycls_article_name'] = container.get('title', '')
                break

        records.append(record)

        if (i + 1) % 50 == 0 or (i + 1) == len(sections):
            elapsed = time.time() - start_time
            rate = (i + 1) / elapsed if elapsed > 0 else 0
            remaining = (len(sections) - i - 1) / rate if rate > 0 else 0
            print(f"    Fetched {i + 1}/{len(sections)} sections "
                  f"({format_time(elapsed)}, ETA: {format_time(remaining)})")

    return records


def fetch_all_laws(client: NYOpenLegClient, law_ids: Optional[List[str]] = None) -> List[Dict]:
    """
    Fetch statutes for specified laws (or all consolidated laws).

    Args:
        client: API client
        law_ids: Specific law IDs to fetch. If None, fetches all consolidated laws.

    Returns:
        List of all statute records
    """
    if law_ids:
        # User specified law IDs — use them directly
        laws = [{'lawId': lid.upper(), 'name': lid.upper(), 'lawType': 'CONSOLIDATED'} for lid in law_ids]
        # Try to get real names from the law list
        print("Fetching law list for names...")
        all_laws = client.get_law_list()
        law_name_map = {law['lawId']: law['name'] for law in all_laws}
        for law in laws:
            law['name'] = law_name_map.get(law['lawId'], law['lawId'])
    else:
        print("Fetching complete law list...")
        all_laws = client.get_law_list()
        laws = [law for law in all_laws if law.get('lawType') == 'CONSOLIDATED']
        print(f"Found {len(all_laws)} total laws, {len(laws)} consolidated")

    all_records = []
    failed_laws = []
    total_start = time.time()

    for i, law in enumerate(laws):
        law_id = law['lawId']
        law_name = law['name']
        print(f"\n{'='*60}")
        print(f"Law {i + 1}/{len(laws)}: {law_id} - {law_name}")
        print(f"{'='*60}")

        records = fetch_law_statutes(client, law_id, law_name)
        if not records:
            failed_laws.append(f"{law_id} ({law_name})")
        all_records.extend(records)

        elapsed = time.time() - total_start
        print(f"  Running total: {len(all_records)} records ({format_time(elapsed)})")

    if failed_laws:
        print(f"\nWARNING: {len(failed_laws)} law(s) returned no records (possible API errors):")
        for law in failed_laws:
            print(f"  - {law}")
        print("Re-run with these law IDs to retry.")

    return all_records


# =============================================================================
# SAVE TO JSON
# =============================================================================

def save_statutes(records: List[Dict]):
    """Save statute records to JSON files."""
    ensure_data_dirs()

    # Keep _parent_location_id, _location_id, _doc_type, _law_id for hierarchy resolution
    # but strip any other internal fields
    keep_internal = {'_parent_location_id', '_location_id', '_doc_type', '_law_id'}
    clean_records = []
    for rec in records:
        clean = {k: v for k, v in rec.items() if not k.startswith('_') or k in keep_internal}
        clean_records.append(clean)

    # Save complete file
    with open(NY_STATUTES_COMPLETE_FILE, 'w', encoding='utf-8') as f:
        json.dump(clean_records, f, indent=2, ensure_ascii=False)
    print(f"\nSaved {len(clean_records):,} records to {NY_STATUTES_COMPLETE_FILE}")

    # Save individual files
    NY_STATUTES_INDIVIDUAL_DIR.mkdir(parents=True, exist_ok=True)
    for i, rec in enumerate(clean_records):
        citation = rec['citation'].replace(':', '_').replace(' ', '_').replace('/', '_')
        filename = f"{i:06d}_{citation}.json"
        with open(NY_STATUTES_INDIVIDUAL_DIR / filename, 'w', encoding='utf-8') as f:
            json.dump(rec, f, indent=2, ensure_ascii=False)
    print(f"Saved {len(clean_records):,} individual files to {NY_STATUTES_INDIVIDUAL_DIR}")


# =============================================================================
# DATABASE MIGRATION
# =============================================================================

def migrate_ny_statutes_to_db(records: Optional[List[Dict]] = None) -> int:
    """
    Migrate NY statutes from records (or JSON file) to statutes table.

    Uses upsert (ON CONFLICT jurisdiction+citation) to allow re-runs.
    """
    if records is None:
        if not NY_STATUTES_COMPLETE_FILE.exists():
            print(f"Error: Statutes file not found: {NY_STATUTES_COMPLETE_FILE}")
            return 0

        print(f"Loading statutes from {NY_STATUTES_COMPLETE_FILE}...")
        with open(NY_STATUTES_COMPLETE_FILE) as f:
            records = json.load(f)

    print(f"Migrating {len(records):,} NY statutes to database...")

    conn = get_db_connection()
    if not conn:
        print("ERROR: Could not connect to database")
        return 0

    insert_sql = """
        INSERT INTO statutes
        (citation, jurisdiction, title, content,
         nycls_law_id, nycls_law_name, nycls_article, nycls_article_name,
         nycls_section, nycls_section_name,
         hierarchy_level, hierarchy_path, source_index)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (jurisdiction, citation) DO UPDATE SET
            title = EXCLUDED.title,
            content = EXCLUDED.content,
            nycls_law_id = EXCLUDED.nycls_law_id,
            nycls_law_name = EXCLUDED.nycls_law_name,
            nycls_article = EXCLUDED.nycls_article,
            nycls_article_name = EXCLUDED.nycls_article_name,
            nycls_section = EXCLUDED.nycls_section,
            nycls_section_name = EXCLUDED.nycls_section_name,
            hierarchy_level = EXCLUDED.hierarchy_level,
            hierarchy_path = EXCLUDED.hierarchy_path,
            source_index = EXCLUDED.source_index
    """

    total = 0
    errors = 0
    start_time = time.time()

    # Build all rows up front, skipping records without citations
    all_rows = []
    for rec in records:
        citation = rec.get('citation', '')
        if not citation:
            continue
        all_rows.append((
            citation,
            'NY',
            rec.get('title', ''),
            rec.get('content', ''),
            rec.get('nycls_law_id'),
            rec.get('nycls_law_name'),
            rec.get('nycls_article'),
            rec.get('nycls_article_name'),
            rec.get('nycls_section'),
            rec.get('nycls_section_name'),
            rec.get('hierarchy_level', 'section'),
            rec.get('hierarchy_path', ''),
            rec.get('source_index'),
        ))

    BATCH = 1000
    try:
        with conn.cursor() as cur:
            for i in range(0, len(all_rows), BATCH):
                batch = all_rows[i:i + BATCH]
                try:
                    cur.executemany(insert_sql, batch)
                    conn.commit()
                    total += len(batch)
                except Exception:
                    conn.rollback()
                    # Fall back to row-by-row to identify bad rows
                    for row in batch:
                        try:
                            cur.execute(insert_sql, row)
                            conn.commit()
                            total += 1
                        except Exception as row_err:
                            conn.rollback()
                            errors += 1
                            print(f"  ERROR inserting {row[0]}: {row_err}")

                elapsed = time.time() - start_time
                done = total + errors
                if done % 1000 == 0 or done == len(all_rows):
                    print(f"  Migrated {total:,} / {len(all_rows):,} ({format_time(elapsed)})")

    finally:
        conn.close()

    if errors:
        print(f"WARNING: {errors:,} rows failed to insert")

    elapsed = time.time() - start_time
    print(f"Migrated {total:,} statutes in {format_time(elapsed)}")
    return total


# =============================================================================
# HIERARCHY / PARENT ID
# =============================================================================

def populate_ny_parent_ids(records: Optional[List[Dict]] = None) -> int:
    """
    Populate parent_id for NY statutes using the parent mapping from tree walks.

    If records with _parent_location_id are provided, uses those mappings.
    Otherwise, falls back to SQL-based heuristics.

    Returns count of rows updated.
    """
    print("\nPopulating parent_id for NY statutes...")

    conn = get_db_connection()
    if not conn:
        print("ERROR: Could not connect to database")
        return 0

    try:
        total_updated = 0

        if records:
            # Index records by (law_id, location_id) for O(1) parent lookup
            rec_index: Dict[tuple, Dict] = {}
            for rec in records:
                law_id = rec.get('_law_id', '')
                loc_id = rec.get('_location_id', '')
                if law_id and loc_id:
                    rec_index[(law_id, loc_id)] = rec

            # Build parent mapping: child_citation -> parent_citation
            parent_map: Dict[str, str] = {}
            for rec in records:
                law_id = rec.get('_law_id', '')
                loc_id = rec.get('_location_id', '')
                doc_type = rec.get('_doc_type', '')
                parent_loc = rec.get('_parent_location_id')
                if not parent_loc or not law_id:
                    continue

                child_citation = build_citation(law_id, loc_id, doc_type)

                # O(1) lookup for parent record
                parent_rec = rec_index.get((law_id, parent_loc))
                if parent_rec:
                    parent_citation = build_citation(law_id, parent_loc, parent_rec.get('_doc_type', ''))
                else:
                    # Fallback: guess law container
                    parent_citation = f"law:{law_id}" if not parent_loc or parent_loc == law_id else f"{law_id}:{parent_loc}"

                parent_map[child_citation] = parent_citation

            print(f"  Built {len(parent_map):,} parent relationships from tree data")
            print(f"  Uploading to temp table and batch-updating...")

            # Use a temp table + single UPDATE for all mappings at once
            conn.execute("CREATE TEMP TABLE _parent_map (child_citation TEXT, parent_citation TEXT)")

            # Insert in batches of 1000 using executemany
            items = list(parent_map.items())
            BATCH = 1000
            with conn.cursor() as cur:
                for i in range(0, len(items), BATCH):
                    batch = items[i:i + BATCH]
                    cur.executemany(
                        "INSERT INTO _parent_map (child_citation, parent_citation) VALUES (%s, %s)",
                        batch,
                    )
                    done = min(i + BATCH, len(items))
                    if done % 5000 == 0 or done == len(items):
                        print(f"    Uploaded {done:,} / {len(items):,} mappings")

            conn.commit()

            # Single UPDATE joining temp table to statutes
            print(f"  Running batch UPDATE...")
            result = conn.execute("""
                UPDATE statutes s
                SET parent_id = p.id
                FROM _parent_map m
                JOIN statutes p ON p.jurisdiction = 'NY' AND p.citation = m.parent_citation
                WHERE s.jurisdiction = 'NY' AND s.citation = m.child_citation
                  AND (s.parent_id IS NULL OR s.parent_id != p.id)
            """)
            total_updated = result.rowcount
            conn.commit()

            conn.execute("DROP TABLE IF EXISTS _parent_map")
            conn.commit()

            print(f"  Updated {total_updated:,} parent relationships")

        else:
            # Fallback: SQL-based parent resolution for sections -> law container
            print("  No tree data available, using SQL-based parent resolution...")

            # Sections -> parent law container
            result = conn.execute("""
                UPDATE statutes s
                SET parent_id = p.id
                FROM statutes p
                WHERE s.jurisdiction = 'NY'
                  AND s.hierarchy_level = 'section'
                  AND p.jurisdiction = 'NY'
                  AND p.hierarchy_level = 'law'
                  AND p.citation = CONCAT('law:', s.nycls_law_id)
                  AND (s.parent_id IS NULL OR s.parent_id != p.id)
            """)
            sections_updated = result.rowcount
            conn.commit()
            print(f"    Updated {sections_updated:,} sections -> law")
            total_updated += sections_updated

        print(f"  Total: {total_updated:,} parent relationships set")
        return total_updated

    except psycopg.Error as e:
        print(f"ERROR populating parent_ids: {e}")
        import traceback
        traceback.print_exc()
        return -1
    finally:
        conn.close()


# =============================================================================
# MAIN PIPELINE
# =============================================================================

def run_pipeline(
    law_ids: Optional[List[str]] = None,
    fetch_only: bool = False,
    skip_fetch: bool = False,
    skip_db: bool = False,
    hierarchy_only: bool = False,
    fresh: bool = False,
    delay: float = 0.2,
):
    """Run the NY statutes pipeline."""
    print("=" * 60)
    print("NY STATUTES PIPELINE (OpenLegislation API)")
    print("Fetch -> JSON -> Database -> Hierarchy")
    print("=" * 60)
    print()

    start_time = time.time()
    ensure_data_dirs()

    api_key = os.getenv('NY_OPEN_LEG_API_KEY')
    if not api_key and not skip_fetch:
        print("ERROR: NY_OPEN_LEG_API_KEY not set in .env")
        print("Get a free API key at https://legislation.nysenate.gov/")
        return False

    # Hierarchy-only mode
    if hierarchy_only:
        print("[SKIPPED] Fetch & migrate steps (--hierarchy-only)")
        print()

        print("STEP: POPULATING PARENT IDS")
        print("-" * 40)

        # Try loading records with parent info from complete file
        records = None
        if NY_STATUTES_COMPLETE_FILE.exists():
            with open(NY_STATUTES_COMPLETE_FILE) as f:
                records = json.load(f)

        populate_ny_parent_ids(records)

        elapsed = time.time() - start_time
        print(f"\nHierarchy update complete in {format_time(elapsed)}")
        return True

    # Fresh mode — clear caches
    if fresh:
        print("Clearing caches (--fresh)...")
        for d in [NY_STATUTES_TREES_DIR, NY_STATUTES_SECTIONS_DIR, NY_STATUTES_INDIVIDUAL_DIR]:
            if d.exists():
                shutil.rmtree(d)
                d.mkdir(parents=True, exist_ok=True)
        if NY_STATUTES_COMPLETE_FILE.exists():
            NY_STATUTES_COMPLETE_FILE.unlink()
        print()

    # Step 1: Fetch from API
    records = None
    if not skip_fetch:
        print("STEP 1: FETCHING FROM OPENLEGISLATION API")
        print("-" * 40)

        client = NYOpenLegClient(api_key=api_key, delay=delay)
        records = fetch_all_laws(client, law_ids=law_ids)

        if not records:
            print("ERROR: No statutes fetched!")
            return False

        print(f"\nFetched {len(records):,} total records")

        # Save to JSON
        print("\nSTEP 2: SAVING TO JSON")
        print("-" * 40)
        save_statutes(records)
        print()
    else:
        print("[SKIPPED] Steps 1-2: Fetch & save (--skip-fetch)")
        print()

    if fetch_only:
        elapsed = time.time() - start_time
        print(f"\nFetch complete in {format_time(elapsed)}")
        return True

    if skip_db:
        elapsed = time.time() - start_time
        print(f"\nPipeline complete (DB skipped) in {format_time(elapsed)}")
        return True

    # Step 3: Migrate to database
    print("STEP 3: MIGRATING TO DATABASE")
    print("-" * 40)
    migrated = migrate_ny_statutes_to_db(records)
    if migrated == 0:
        print("WARNING: No statutes migrated")
    print()

    # Step 4: Populate parent_id
    print("STEP 4: POPULATING PARENT IDS")
    print("-" * 40)
    parent_updates = populate_ny_parent_ids(records)
    print()

    elapsed = time.time() - start_time
    print("=" * 60)
    print("PIPELINE COMPLETE")
    print("=" * 60)
    print(f"Records migrated: {migrated:,}")
    print(f"Parent relationships set: {parent_updates:,}")
    print(f"Total time: {format_time(elapsed)}")

    return True


def main():
    parser = argparse.ArgumentParser(
        description='NY Statutes - Fetch from OpenLegislation API and migrate to DB'
    )
    parser.add_argument('law_ids', nargs='*',
                        help='Specific law IDs to fetch (e.g., EXC SOS PBH EDN). Omit for all consolidated laws.')
    parser.add_argument('--fetch-only', action='store_true',
                        help='Only fetch and cache API data, skip database operations')
    parser.add_argument('--skip-fetch', action='store_true',
                        help='Skip API fetch, use existing cached JSON')
    parser.add_argument('--skip-db', action='store_true',
                        help='Skip database operations')
    parser.add_argument('--hierarchy-only', action='store_true',
                        help='Only update parent_id relationships')
    parser.add_argument('--fresh', action='store_true',
                        help='Clear all caches and re-fetch from API')
    parser.add_argument('--delay', type=float, default=0.2,
                        help='Delay between API calls in seconds (default: 0.2)')

    args = parser.parse_args()

    run_pipeline(
        law_ids=args.law_ids if args.law_ids else None,
        fetch_only=args.fetch_only,
        skip_fetch=args.skip_fetch,
        skip_db=args.skip_db,
        hierarchy_only=args.hierarchy_only,
        fresh=args.fresh,
        delay=args.delay,
    )


if __name__ == "__main__":
    main()
