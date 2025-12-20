#!/usr/bin/env python3
"""
Sample regulations, extract definitions with LLM, store in Neon database.

Workflow:
1. Sample n regulations from housing/child care/permitting topics
2. Run LLM extraction on each (with scope, source location, and confidence)
3. Store results in Neon PostgreSQL database
4. Generate local viewer HTML
"""

import json
import re
import argparse
import random
import sys
from pathlib import Path
from typing import Dict, List, Optional
from pydantic import BaseModel, Field
from dotenv import load_dotenv

# Add backend directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))
from config import PROJECT_ROOT, INDIVIDUAL_REGULATIONS_DIR, OUTPUTS_DIR
from shared_utils import get_db_connection, get_openai_client, call_llm_parse

load_dotenv(PROJECT_ROOT / '.env')


class Definition(BaseModel):
    """A single term definition extracted from regulation text."""
    term: str = Field(description="The term being defined")
    definition: str = Field(description="The definition text")
    scope: Optional[str] = Field(default=None, description="Scope like 'in this section', 'in this part'")
    source_location: Optional[str] = Field(default=None, description="Where it appears, e.g. 'section 1.1'")


class DefinitionsResponse(BaseModel):
    """Response containing all extracted definitions."""
    definitions: List[Definition] = Field(default_factory=list)

REG_DIR = str(INDIVIDUAL_REGULATIONS_DIR)
MODEL_VERSION = "gpt-5-nano"


def get_processed_source_indices() -> set:
    """Get set of source_indices that have already been processed for definitions."""
    conn = get_db_connection()
    if not conn:
        print("Warning: Could not connect to DB, will process all regulations")
        return set()

    try:
        result = conn.execute("SELECT source_index FROM definition_extraction_log")
        processed = {row[0] for row in result.fetchall()}
        conn.close()
        return processed
    except Exception as e:
        print(f"Warning: Could not fetch processed indices: {e}")
        if conn:
            conn.close()
        return set()


def log_extraction(source_index: int, definitions_found: int):
    """Log that a regulation has been processed for definitions."""
    conn = get_db_connection()
    if not conn:
        return

    try:
        conn.execute("""
            INSERT INTO definition_extraction_log (source_index, model_version, definitions_found)
            VALUES (%s, %s, %s)
            ON CONFLICT (source_index) DO UPDATE SET
                processed_at = CURRENT_TIMESTAMP,
                model_version = EXCLUDED.model_version,
                definitions_found = EXCLUDED.definitions_found
        """, (source_index, MODEL_VERSION, definitions_found))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Warning: Could not log extraction: {e}")
        if conn:
            conn.close()


TOPIC_PATTERNS = {
    'housing': ['housing', 'dwelling', 'apartment', 'residential', 'tenant', 'landlord'],
    'child_care': ['child care', 'childcare', 'daycare', 'preschool'],
    'permitting': ['permit', 'license', 'application', 'approval', 'authorization']
}

def has_definition_content(content: str, title: str) -> bool:
    """Check if regulation likely contains definitions"""
    text = (content + ' ' + title).lower()
    patterns = [
        r'\bdefinition\b',  # "Definition" section or word
        r'\bmeans\b',        # "means"
        r'shall mean',       # "shall mean"
        r'for purposes of',  # "for purposes of"
    ]
    return any(re.search(p, text) for p in patterns)


def check_topic_match(content: str, title: str) -> List[str]:
    """Check which topics a regulation matches"""
    combined_text = (content + ' ' + title).lower()
    matched_topics = []
    for topic, keywords in TOPIC_PATTERNS.items():
        for keyword in keywords:
            if keyword.lower() in combined_text:
                matched_topics.append(topic)
                break
    return list(set(matched_topics))


def levenshtein_distance(s1: str, s2: str) -> int:
    """Calculate edit distance between two strings"""
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)

    if len(s2) == 0:
        return len(s1)

    previous_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row

    return previous_row[-1]


def calculate_definition_overlap(definition: str, content: str) -> float:
    """
    Calculate definition overlap using optimized string matching.
    Returns 0.0-1.0 where 1.0 = exact match.

    Uses exact substring match first (fast), then falls back to
    difflib.SequenceMatcher for fuzzy matching if no exact match found.
    """
    from difflib import SequenceMatcher

    definition_lower = definition.lower()
    content_lower = content.lower()

    # Fast path: check for exact substring match
    if definition_lower in content_lower:
        return 1.0

    # Fallback: use optimized SequenceMatcher for fuzzy matching
    # This is much faster than character-by-character Levenshtein on large texts
    matcher = SequenceMatcher(None, definition_lower, content_lower)
    return matcher.ratio()


def get_regulations_for_extraction(num_to_process: int, skip_processed: bool = True) -> List[Dict]:
    """Get regulations for definition extraction, prioritizing target topics.

    Args:
        num_to_process: Number of regulations to return (guaranteed LLM calls)
        skip_processed: If True, exclude regulations already in definition_extraction_log

    Returns:
        List of regulations, prioritizing housing/child_care/permitting, then expanding to all.
    """
    print(f"[1/3] Finding {num_to_process} regulations for definition extraction...")

    # Get already-processed source_indices
    processed_indices = set()
    if skip_processed:
        processed_indices = get_processed_source_indices()
        if processed_indices:
            print(f"      Excluding {len(processed_indices)} already-processed regulations")

    all_files = list(Path(REG_DIR).glob('*.json'))

    priority_regs = []  # Match priority topics
    other_regs = []     # Have definition content but not priority topics

    for filepath in all_files:
        try:
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                data = json.load(f)

            source_index = data.get('source_index')

            # Skip if already processed
            if skip_processed and source_index in processed_indices:
                continue

            content = data.get('content', '')
            title = data.get('title', '')

            # Must have definition content
            if not has_definition_content(content, title):
                continue

            reg_data = {
                'filename': filepath.name,
                'filepath': str(filepath),
                'title': title,
                'url': data.get('url', ''),
                'content': content,
                'source_index': source_index,
                'nycrr_title': data.get('nycrr_title'),
                'nycrr_part': data.get('nycrr_part'),
                'nycrr_subpart': data.get('nycrr_subpart'),
                'nycrr_section': data.get('nycrr_section'),
            }

            # Check if matches priority topics
            topics = check_topic_match(content, title)
            if topics:
                reg_data['topics'] = topics
                priority_regs.append(reg_data)
            else:
                reg_data['topics'] = ['other']
                other_regs.append(reg_data)

        except Exception:
            pass

    print(f"      Found {len(priority_regs)} priority topic regulations (housing/child_care/permitting)")
    print(f"      Found {len(other_regs)} other regulations with definition content")

    # Build final list: priority first, then others
    result = []

    # Take from priority first
    if len(priority_regs) >= num_to_process:
        result = random.sample(priority_regs, num_to_process)
        print(f"      ✓ Selected {num_to_process} from priority topics")
    else:
        # Take all priority, then fill from others
        result = priority_regs.copy()
        remaining = num_to_process - len(result)
        if remaining > 0 and other_regs:
            extras = random.sample(other_regs, min(remaining, len(other_regs)))
            result.extend(extras)
            print(f"      ✓ Selected {len(priority_regs)} priority + {len(extras)} other = {len(result)} total")

    if len(result) < num_to_process:
        print(f"      ⚠ Only {len(result)} unprocessed regulations available")

    print()
    return result

def extract_with_llm(content: str, title: str, client=None, max_retries: int = 3) -> List[Dict]:
    """Extract definitions using LLM with Pydantic structured output.

    Args:
        content: Regulation content text
        title: Regulation title
        client: OpenAI client (optional, will create one if not provided)
        max_retries: Number of retries on failed responses

    Returns:
        List of definition dicts with term, definition, scope, source_location
    """
    if client is None:
        client = get_openai_client()

    prompt = f"""Extract all term definitions from this regulation section.

TITLE: {title}
CONTENT (first 3000 chars):
{content[:3000]}

For each definition found, extract:
- The term being defined (required)
- The definition text (required)
- The scope (e.g., "in this section", "in this part", "throughout this title")
- The source location where it appears (e.g., "definitions section", "section 1.1")

Only extract actual term definitions, not general descriptions."""

    parsed = call_llm_parse(
        client=client,
        prompt=prompt,
        response_format=DefinitionsResponse,
        model=MODEL_VERSION,
        max_retries=max_retries
    )

    if parsed is None:
        return []

    # Convert Pydantic models to dicts
    return [d.model_dump() for d in parsed.definitions]

def store_to_database(regulations: List[Dict]):
    """Store definitions in Neon database using shared_utils connection"""
    print(f"[2/3] Storing results in Neon database...")
    print(f"      Input: {len(regulations)} regulations to process")

    # Count definitions before storing
    total_input_defs = sum(len(r.get('llm_definitions', [])) for r in regulations)
    print(f"      Input: {total_input_defs} total definitions to store")

    conn = get_db_connection()
    if not conn:
        print("      ERROR: Could not connect to database")
        return

    try:
        print("      ✓ Connected to database")

        # Check definitions count before
        before_count = conn.execute("SELECT COUNT(*) FROM definitions").fetchone()[0]
        print(f"      Definitions in DB before: {before_count}")

        # Insert data
        total_defs = 0
        docs_processed = 0
        for reg in regulations:
            # Skip regulations with no definitions
            definitions_list = reg.get('llm_definitions', [])
            if not definitions_list:
                continue

            try:
                source_idx = reg.get('source_index', 0)
                # Insert/get regulatory_document
                doc_id = conn.execute("""
                    INSERT INTO regulatory_documents
                    (source_index, type, state, title, url, url_type, content,
                     nycrr_title, nycrr_part, nycrr_subpart, nycrr_section)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (state, source_index, type) DO UPDATE SET
                        title = EXCLUDED.title,
                        url = EXCLUDED.url,
                        content = EXCLUDED.content
                    RETURNING id
                """, (
                    source_idx,
                    "regulation",
                    "NY",
                    reg['title'],
                    reg['url'],
                    "regulation",
                    reg['content'],
                    reg.get('nycrr_title'),
                    reg.get('nycrr_part'),
                    reg.get('nycrr_subpart'),
                    reg.get('nycrr_section')
                )).fetchone()[0]
                docs_processed += 1

                # Delete previous definitions for this document
                conn.execute("DELETE FROM definitions WHERE document_id = %s", (doc_id,))

                # Insert definitions
                defs_for_this_doc = 0
                reg_url = reg.get('url', '')
                for defn in definitions_list:
                    # Calculate definition overlap
                    definition_text = defn.get('definition', '')
                    overlap = calculate_definition_overlap(definition_text, reg['content'])

                    conn.execute("""
                        INSERT INTO definitions
                        (document_id, url, term, definition, scope, source_location, definition_overlap, model_version)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    """, (
                        doc_id,
                        reg_url,
                        defn.get('term'),
                        definition_text,
                        defn.get('scope'),
                        defn.get('source_location'),
                        overlap,
                        MODEL_VERSION
                    ))
                    total_defs += 1
                    defs_for_this_doc += 1

                print(f"        Doc {doc_id} (source_idx={source_idx}): {defs_for_this_doc} definitions inserted")

            except Exception as doc_err:
                print(f"      ERROR processing reg {reg.get('title', 'unknown')[:40]}: {doc_err}")
                import traceback
                traceback.print_exc()

        print(f"      Committing transaction...")
        conn.commit()

        # Check definitions count after
        after_count = conn.execute("SELECT COUNT(*) FROM definitions").fetchone()[0]
        print(f"      Definitions in DB after: {after_count} (added {after_count - before_count})")

        conn.close()

        print(f"      ✓ Stored {docs_processed} regulations with {total_defs} definitions")
        print()

    except Exception as e:
        print(f"      ERROR: {e}")
        import traceback
        traceback.print_exc()

def generate_viewer(regulations: List[Dict]):
    """Generate HTML viewer for local browsing"""
    print(f"[3/3] Generating local viewer...")

    html = """<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>LLM Extracted Definitions</title>
    <style>
        body { font-family: Arial; margin: 20px; background: #f5f5f5; }
        .header { background: white; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .reg-item { background: white; padding: 20px; margin-bottom: 15px; border-radius: 5px; }
        .reg-title { font-size: 1.1em; font-weight: bold; color: #2c3e50; margin-bottom: 10px; }
        .reg-meta { font-size: 0.9em; color: #666; margin-bottom: 15px; }
        .topics { display: inline-block; }
        .badge { display: inline-block; background: #3498db; color: white; padding: 3px 8px; margin: 3px; border-radius: 3px; font-size: 0.8em; }
        .definitions { margin-top: 15px; }
        .def-item { background: #f9f9f9; padding: 10px; margin: 8px 0; border-left: 3px solid #3498db; }
        .def-term { font-weight: bold; color: #2c3e50; }
        .def-text { color: #555; margin-top: 5px; font-size: 0.9em; }
        .def-scope { font-size: 0.85em; color: #888; margin-top: 5px; font-style: italic; }
        .def-source { font-size: 0.85em; color: #666; margin-top: 3px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>LLM Extracted Definitions</h1>
        <p>Extracted from housing, child care, and permitting regulations</p>
    </div>
"""

    for reg in regulations:
        defs = reg.get('llm_definitions', [])
        if not defs:
            continue

        topics_html = ''.join(f'<span class="badge">{t.replace("_", " ")}</span>' for t in reg['topics'])

        html += f"""
    <div class="reg-item">
        <div class="reg-title">{reg['title']}</div>
        <div class="reg-meta">
            <strong>File:</strong> {reg['filename']}<br>
            <strong>URL:</strong> <a href="{reg['url']}" target="_blank">{reg['url']}</a><br>
            <div class="topics">{topics_html}</div>
        </div>
        <div class="definitions">
            <strong>{len(defs)} definitions extracted:</strong>
"""

        for defn in defs:
            term = defn.get('term', 'Unknown')
            definition = defn.get('definition', '')
            scope = defn.get('scope')
            source = defn.get('source_location')

            scope_text = f"<div class='def-scope'>Scope: {scope}</div>" if scope else ""
            source_text = f"<div class='def-source'>Source: {source}</div>" if source else ""

            html += f"""
            <div class="def-item">
                <div class="def-term">{term}</div>
                <div class="def-text">{definition[:200]}{'...' if len(definition) > 200 else ''}</div>
                {scope_text}
                {source_text}
            </div>
"""

        html += """
        </div>
    </div>
"""

    html += """
</body>
</html>
"""

    OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
    output_file = OUTPUTS_DIR / "viewer_extracted_definitions.html"
    with open(output_file, 'w') as f:
        f.write(html)

    print(f"      ✓ Viewer generated: {output_file}")
    print()

def main():
    parser = argparse.ArgumentParser(description='Extract definitions with LLM and store to database')
    parser.add_argument('-n', '--num', type=int, default=20, help='Number of regulations to sample')
    parser.add_argument('--seed', type=int, default=42, help='Random seed for reproducible sampling (default: 42)')
    parser.add_argument('--reprocess', action='store_true', help='Re-process even if already done')

    args = parser.parse_args()

    # Set random seed for reproducibility
    random.seed(args.seed)

    print("=" * 80)
    print("LLM EXTRACTION → NEON DATABASE")
    print("=" * 80)
    print()

    # Step 1: Get regulations (skip already-processed unless --reprocess)
    skip_processed = not args.reprocess
    regulations = get_regulations_for_extraction(args.num, skip_processed=skip_processed)

    if not regulations:
        print("No regulations found!")
        return

    # Step 2: Extract with LLM
    print(f"Extracting definitions with LLM ({args.num} regulations)...")
    print()

    # Create client once for efficiency
    client = get_openai_client()

    for i, reg in enumerate(regulations, 1):
        print(f"  [{i}/{len(regulations)}] {reg['filename'][:40]}...")
        reg['llm_definitions'] = extract_with_llm(reg['content'], reg['title'], client=client)
        num_defs = len(reg['llm_definitions'])
        print(f"      → {num_defs} definitions found")

        # Log that we processed this regulation
        if reg.get('source_index') is not None:
            log_extraction(reg['source_index'], num_defs)

    print()

    # Step 3: Store to database
    store_to_database(regulations)

    # Step 4: Generate viewer
    generate_viewer(regulations)

    # Summary
    total_defs = sum(len(r.get('llm_definitions', [])) for r in regulations)
    print("=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Regulations processed: {len(regulations)}")
    print(f"Total definitions: {total_defs}")
    print()
    print(f"✓ Results stored in Neon database")
    print(f"✓ Local viewer: {OUTPUTS_DIR / 'viewer_extracted_definitions.html'}")
    print()

if __name__ == '__main__':
    main()
