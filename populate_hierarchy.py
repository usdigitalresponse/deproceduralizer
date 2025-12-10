#!/usr/bin/env python3
"""
Enrich regulation JSON files with parent/child hierarchy information.

This script:
1. Reads all regulation JSON files from individual_regulations/
2. Parses URLs to extract hierarchy information (title, part, section)
3. Adds hierarchy fields to each JSON file
4. Links children to parents via parent_source_index

Usage:
    python populate_hierarchy.py           # Run the enrichment
    python populate_hierarchy.py --dry-run # Preview without saving changes
"""

import json
import re
import os
import glob
import argparse
from collections import defaultdict
from typing import Optional, Dict


# =============================================================================
# URL PARSING FUNCTIONS
# =============================================================================

def parse_citation_url(url: str) -> Optional[Dict]:
    """
    Parse citation-style URLs like '18-NYCRR-433.8' into components.

    These URLs directly encode the NYCRR citation:
      - {title}-NYCRR-{part}.{section}
      - {title}-NYCRR-{part}-{subpart}.{section}

    Returns:
        Dictionary with title, part, section, subpart keys, or None if not parseable
    """
    if '/new-york/' not in url:
        return None

    path = url.split('/new-york/')[1]

    # Match pattern: {title}-NYCRR-{rest}
    match = re.match(r'^(\d+)-NYCRR-(.+)$', path)
    if not match:
        return None

    title_num = int(match.group(1))
    rest = match.group(2)

    # Skip appendices and special formats (they have complex paths)
    if 'app' in rest.lower() or 'ch-' in rest:
        return None

    result = {
        'nycrr_title': title_num,
        'nycrr_part': None,
        'nycrr_section': None,
        'hierarchy_level': 'section'
    }

    # Pattern 1: part.section (e.g., 433.8)
    simple_match = re.match(r'^(\d+)\.(\d+)$', rest)
    if simple_match:
        result['nycrr_part'] = simple_match.group(1)
        result['nycrr_section'] = simple_match.group(2)
        return result

    # Pattern 2: part-subpart.section (e.g., 5-1.2, 151-7.0)
    subpart_match = re.match(r'^(\d+)-(\d+)\.(\d+)$', rest)
    if subpart_match:
        result['nycrr_part'] = subpart_match.group(1)
        result['nycrr_section'] = subpart_match.group(3)
        return result

    # Pattern 3: part.section.subsection (e.g., 1200.1.15)
    subsection_match = re.match(r'^(\d+)\.(\d+)\.(\d+)$', rest)
    if subsection_match:
        result['nycrr_part'] = subsection_match.group(1)
        result['nycrr_section'] = f"{subsection_match.group(2)}.{subsection_match.group(3)}"
        return result

    return None


def parse_hierarchy_url(url: str) -> Optional[Dict]:
    """
    Parse hierarchy-style URLs like 'title-22/subtitle-A/chapter-II/part-221'.

    These URLs encode the full path through the regulatory hierarchy.

    Returns:
        Dictionary with hierarchy components, or None if not parseable
    """
    if '/new-york/' not in url:
        return None

    path = url.split('/new-york/')[1]

    # Must start with title- for hierarchy URLs
    if not path.startswith('title-'):
        return None

    result = {
        'hierarchy_path': path,
        'nycrr_title': None,
        'nycrr_part': None,
        'hierarchy_level': None
    }

    components = path.split('/')

    for comp in components:
        if comp.startswith('title-'):
            try:
                result['nycrr_title'] = int(comp.replace('title-', ''))
            except ValueError:
                result['nycrr_title'] = None
        elif comp.startswith('part-'):
            result['nycrr_part'] = comp.replace('part-', '')

    # Determine hierarchy level from last path component
    last = components[-1]
    level_prefixes = ['subpart-', 'part-', 'article-', 'subchapter-', 'chapter-', 'subtitle-', 'title-']
    for prefix in level_prefixes:
        if last.startswith(prefix):
            result['hierarchy_level'] = prefix.rstrip('-')
            break
    else:
        result['hierarchy_level'] = 'section'

    return result


def get_parent_hierarchy_path(hierarchy_path: str) -> Optional[str]:
    """Get the parent's hierarchy path by removing the last component."""
    if not hierarchy_path:
        return None
    parts = hierarchy_path.rstrip('/').rsplit('/', 1)
    return parts[0] if len(parts) > 1 else None


# =============================================================================
# MAIN PROCESSING
# =============================================================================

def enrich_json_files(json_dir: str, dry_run: bool = False):
    """
    Enrich JSON files with hierarchy information.

    Steps:
    1. Read all JSON files
    2. Parse each URL to extract hierarchy info
    3. Build parent lookup tables
    4. Add hierarchy fields and parent_source_index to each file
    5. Save enriched JSON files
    """
    print(f"Enriching JSON files in {json_dir}/...")
    if dry_run:
        print("[DRY RUN - no files will be modified]\n")

    # Step 1: Read all JSON files
    files = sorted(glob.glob(os.path.join(json_dir, '*.json')))
    print(f"Found {len(files)} JSON files\n")

    # Step 2: Parse all files and build lookup tables
    print("Parsing URLs and building parent lookups...")

    documents = []  # List of (filepath, data, parsed_info)

    # Lookup tables for parent matching
    # For hierarchy URLs: path -> source_index
    hierarchy_path_to_source_index = {}
    # For citation URLs: (title, part) -> source_index (Part containers only)
    part_container_lookup = {}

    for filepath in files:
        try:
            with open(filepath) as f:
                data = json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            print(f"  Warning: Could not read {filepath}: {e}")
            continue

        url = data.get('url', '')
        source_index = data.get('source_index')

        # Try citation URL format first
        parsed = parse_citation_url(url)
        if parsed:
            parsed['url_format'] = 'citation'
            documents.append((filepath, data, parsed))
            continue

        # Try hierarchy URL format
        parsed = parse_hierarchy_url(url)
        if parsed:
            parsed['url_format'] = 'hierarchy'
            documents.append((filepath, data, parsed))

            # Record for parent lookup
            hierarchy_path = parsed.get('hierarchy_path')
            if hierarchy_path and source_index is not None:
                hierarchy_path_to_source_index[hierarchy_path] = source_index

            # If this is a Part container, add to part lookup
            if parsed.get('hierarchy_level') == 'part' and parsed.get('nycrr_part'):
                nycrr_title = parsed.get('nycrr_title')
                if nycrr_title is not None and source_index is not None:
                    key = (nycrr_title, parsed['nycrr_part'])
                    part_container_lookup[key] = source_index
            continue

        # URL didn't match either pattern
        documents.append((filepath, data, None))

    print(f"Parsed {len(documents)} documents")
    print(f"Found {len(part_container_lookup)} Part containers")
    print(f"Found {len(hierarchy_path_to_source_index)} hierarchy paths\n")

    # Step 3: Enrich each document
    print("Enriching documents with hierarchy info...")

    enriched_count = 0
    parent_linked_count = 0
    parent_not_found = 0

    for filepath, data, parsed in documents:
        if parsed is None:
            # Couldn't parse URL - just add empty hierarchy fields
            data['hierarchy_level'] = None
            data['hierarchy_path'] = None
            data['nycrr_title'] = None
            data['nycrr_part'] = None
            data['nycrr_section'] = None
            data['parent_source_index'] = None
        else:
            # Add parsed hierarchy fields
            data['hierarchy_level'] = parsed.get('hierarchy_level')
            data['hierarchy_path'] = parsed.get('hierarchy_path')
            data['nycrr_title'] = parsed.get('nycrr_title')
            data['nycrr_part'] = parsed.get('nycrr_part')
            data['nycrr_section'] = parsed.get('nycrr_section')

            # Find parent
            parent_source_index = None

            if parsed['url_format'] == 'citation':
                # For citation URLs, parent is the Part container
                nycrr_title = parsed.get('nycrr_title')
                nycrr_part = parsed.get('nycrr_part')
                if nycrr_title is not None and nycrr_part:
                    key = (nycrr_title, nycrr_part)
                    parent_source_index = part_container_lookup.get(key)

            else:  # hierarchy URL
                # Parent is found by removing last path component
                hierarchy_path = parsed.get('hierarchy_path')
                parent_path = get_parent_hierarchy_path(hierarchy_path)
                if parent_path:
                    parent_source_index = hierarchy_path_to_source_index.get(parent_path)

            data['parent_source_index'] = parent_source_index

            if parent_source_index is not None:
                parent_linked_count += 1
            elif parsed.get('hierarchy_level') != 'title':
                parent_not_found += 1

        enriched_count += 1

        # Save the enriched file
        if not dry_run:
            with open(filepath, 'w') as f:
                json.dump(data, f, indent=2)

        if enriched_count % 5000 == 0:
            print(f"  Processed {enriched_count} files...")

    # Final stats
    print(f"\nResults:")
    print(f"  Total files enriched: {enriched_count}")
    print(f"  Documents linked to parent: {parent_linked_count}")
    print(f"  Documents without parent found: {parent_not_found}")
    print(f"  (Top-level titles have no parent - this is expected)")

    if dry_run:
        print("\n[DRY RUN - no files were modified]")
    else:
        print("\nFiles have been updated with hierarchy information.")

    # Show sample of enriched data
    print("\nSample enriched document:")
    for filepath, data, parsed in documents[:1]:
        if parsed:
            print(f"  File: {os.path.basename(filepath)}")
            print(f"  hierarchy_level: {data.get('hierarchy_level')}")
            print(f"  nycrr_title: {data.get('nycrr_title')}")
            print(f"  nycrr_part: {data.get('nycrr_part')}")
            print(f"  nycrr_section: {data.get('nycrr_section')}")
            print(f"  parent_source_index: {data.get('parent_source_index')}")


def main():
    parser = argparse.ArgumentParser(
        description='Enrich regulation JSON files with hierarchy information'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Preview changes without modifying files'
    )
    parser.add_argument(
        '--json-dir',
        default='individual_regulations',
        help='Directory containing regulation JSON files (default: individual_regulations)'
    )

    args = parser.parse_args()

    enrich_json_files(args.json_dir, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
