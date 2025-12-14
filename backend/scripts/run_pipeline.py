#!/usr/bin/env python3
"""
Combined pipeline: Extract definitions AND run red flag analysis.

Imports functions from existing scripts to avoid duplication.
"""

import sys
import argparse
import asyncio
from pathlib import Path
from datetime import datetime

# Add paths for imports
sys.path.insert(0, str(Path(__file__).parent.parent))
sys.path.insert(0, str(Path(__file__).parent.parent.parent / 'experiments'))

from config import PROJECT_ROOT, INDIVIDUAL_REGULATIONS_DIR
from dotenv import load_dotenv
load_dotenv(PROJECT_ROOT / '.env')

# Import from existing scripts
from llm_extract_to_db import (
    get_topic_regulations,
    extract_with_llm,
    store_to_database,
    calculate_definition_overlap
)

from analyze_red_flags import (
    get_db_connection,
    create_analysis_prompt,
    RegulationData,
    RegulationAnalysis,
    validate_analysis_categories,
    save_analysis_to_database,
    CATEGORY_KEYWORDS
)

import json
import os
from openai import AsyncOpenAI


def get_relevant_definitions(conn, nycrr_title: int, nycrr_part: str, content: str) -> list:
    """Fetch definitions from same NYCRR part that match terms in the content."""
    if not conn or not nycrr_title or not nycrr_part:
        return []

    try:
        with conn.cursor() as cur:
            # Get all definitions from the same NYCRR title+part
            cur.execute("""
                SELECT d.term, d.definition, d.scope
                FROM definitions d
                JOIN regulatory_documents rd ON d.document_id = rd.id
                WHERE rd.nycrr_title = %s AND rd.nycrr_part = %s
            """, (nycrr_title, nycrr_part))

            rows = cur.fetchall()
            if not rows:
                return []

            # Filter to definitions where the term appears in the content
            content_lower = content.lower()
            matching_defs = []

            for term, definition, scope in rows:
                if term and term.lower() in content_lower:
                    matching_defs.append({
                        'term': term,
                        'definition': definition,
                        'scope': scope
                    })

            return matching_defs
    except Exception as e:
        print(f"Warning: Error fetching definitions: {e}")
        return []


async def analyze_single_regulation(regulation: RegulationData, client: AsyncOpenAI,
                                   db_conn, verbose: bool = True) -> RegulationAnalysis:
    """Analyze a single regulation, printing definitions being used."""

    # Fetch relevant definitions
    definitions = get_relevant_definitions(
        db_conn,
        regulation.nycrr_title,
        regulation.nycrr_part,
        regulation.content
    )

    if definitions and verbose:
        print(f"\n    📖 Definitions for {regulation.nycrr_title}-{regulation.nycrr_part}:")
        for defn in definitions:
            term = defn.get('term', '?')
            definition = defn.get('definition', '')[:80]
            scope = defn.get('scope', '')
            print(f"       • {term} ({scope}): {definition}...")

    # Create prompt with definitions
    prompt = create_analysis_prompt(
        section_text=regulation.content,
        citation=regulation.url,
        heading=regulation.title
    )

    try:
        response = await client.beta.chat.completions.parse(
            model="gpt-5-nano",
            messages=[{"role": "system", "content": prompt}],
            response_format=RegulationAnalysis
        )
        return response.choices[0].message.parsed
    except Exception as e:
        print(f"    ❌ Analysis error: {e}")
        return RegulationAnalysis(
            has_implementation_issues=False,
            red_flags=[],
            overall_complexity=None,
            summary=None,
            requires_technical_review=False,
            has_reporting_requirement=False
        )


def score_regulations_by_definition_matches(directory: str, db_conn) -> dict:
    """Score regulations based on matching definition terms in database.

    Returns dict mapping file path to score (0-1 scale).
    """
    scores = {}

    # Get all definition terms from database
    try:
        with db_conn.cursor() as cur:
            cur.execute("SELECT DISTINCT LOWER(term) FROM definitions")
            definition_terms = {row[0] for row in cur.fetchall()}
    except Exception:
        return scores

    if not definition_terms:
        return scores

    # Score each regulation file
    for filepath in Path(directory).glob("*.json"):
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
                content = (data.get('content', '') + ' ' + data.get('title', '')).lower()

                # Count matching terms
                matches = sum(1 for term in definition_terms if term in content)
                # Normalize: 0 to 1 scale
                score = min(1.0, matches / len(definition_terms)) if definition_terms else 0.0
                scores[str(filepath)] = score
        except Exception:
            pass

    return scores


async def run_pipeline(sample_size: int = 20, skip_extraction: bool = False, seed: int = 42):
    """Run the full pipeline: extract definitions, then analyze for red flags."""

    # Set random seed for reproducibility
    random.seed(seed)

    print("=" * 70)
    print("COMBINED PIPELINE: DEFINITIONS → RED FLAG ANALYSIS")
    print("=" * 70)
    print()

    db_conn = get_db_connection()
    if not db_conn:
        print("❌ Could not connect to database")
        return

    # Step 1: Extract definitions (unless skipped)
    if not skip_extraction:
        print("STEP 1: EXTRACTING DEFINITIONS")
        print("-" * 40)

        regulations_for_defs = get_topic_regulations(sample_size)

        if regulations_for_defs:
            print(f"Extracting definitions from {len(regulations_for_defs)} regulations...")

            for i, reg in enumerate(regulations_for_defs, 1):
                print(f"  [{i}/{len(regulations_for_defs)}] {reg['filename'][:40]}...")
                defs = extract_with_llm(reg['content'], reg['title'])
                reg['llm_definitions'] = defs
                print(f"      → {len(defs)} definitions")

            store_to_database(regulations_for_defs)
        print()
    else:
        print("STEP 1: SKIPPED (using existing definitions)")
        print()

    # Step 2: Run red flag analysis
    print("STEP 2: RED FLAG ANALYSIS WITH DEFINITIONS")
    print("-" * 40)

    # Score regulations by definition matches for prioritization
    definition_scores = score_regulations_by_definition_matches(
        str(INDIVIDUAL_REGULATIONS_DIR),
        db_conn
    )

    # Load regulations for analysis (reuse same ones or load fresh)
    from analyze_red_flags import load_regulations_multi_category, build_category_index, deduplicate_and_assign

    # Custom sampling that prioritizes definitions
    file_category_map = build_category_index(str(INDIVIDUAL_REGULATIONS_DIR), CATEGORY_KEYWORDS)
    if file_category_map:
        file_assignments = deduplicate_and_assign(file_category_map, CATEGORY_KEYWORDS)

        # Build scoring for files and prioritize in sampling
        selected_regulations = []
        num_categories = len([c for c in CATEGORY_KEYWORDS.keys() if any(v == c for v in file_assignments.values())])
        base_quota = sample_size // num_categories

        for category in CATEGORY_KEYWORDS.keys():
            category_files = [f for f, c in file_assignments.items() if c == category]
            if not category_files:
                continue

            # Sort by definition score (highest first)
            sorted_files = sorted(category_files, key=lambda f: (-definition_scores.get(str(f), 0.0), str(f)))

            # Take top files up to quota
            quota = base_quota + (1 if category == sorted(CATEGORY_KEYWORDS.keys())[0] else 0)
            selected_files = sorted_files[:min(quota, len(sorted_files))]

            for file_path in selected_files:
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        regulation_data = RegulationData(
                            **data,
                            matched_categories=list(file_category_map[file_path]),
                            primary_category=category
                        )
                        selected_regulations.append(regulation_data)
                except Exception:
                    pass

        regulations = selected_regulations
    else:
        regulations = load_regulations_multi_category(
            str(INDIVIDUAL_REGULATIONS_DIR),
            CATEGORY_KEYWORDS,
            sample_size,
            selected_categories=None
        )

    if not regulations:
        print("No regulations found for analysis!")
        return

    print(f"Analyzing {len(regulations)} regulations for red flags...")
    print()

    client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    output_file = f"red_flag_analysis_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    results = []

    for i, reg in enumerate(regulations, 1):
        print(f"[{i}/{len(regulations)}] {reg.title[:50]}...")

        analysis = await analyze_single_regulation(reg, client, db_conn, verbose=True)

        # Validate and report
        is_valid, invalid_cats = validate_analysis_categories(analysis)

        if analysis.red_flags:
            flags_summary = ', '.join([f"{f.category.value}:{f.severity}" for f in analysis.red_flags])
            print(f"    🚩 {len(analysis.red_flags)} flags: {flags_summary}")
        else:
            print(f"    ✓ No red flags")

        # Build result dict
        result = {
            'source_index': reg.source_index,
            'title': reg.title,
            'url': reg.url,
            'nycrr_title': reg.nycrr_title,
            'nycrr_part': reg.nycrr_part,
            'has_implementation_issues': analysis.has_implementation_issues,
            'overall_complexity': analysis.overall_complexity,
            'summary': analysis.summary,
            'num_flags': len(analysis.red_flags),
            'red_flags': [
                {
                    'category': f.category.value,
                    'explanation': f.explanation,
                    'severity': f.severity,
                    'complexity': f.complexity
                }
                for f in analysis.red_flags
            ]
        }
        results.append(result)

        # Save to database
        save_analysis_to_database(db_conn, reg, analysis)

        # Periodic save
        if i % 5 == 0:
            with open(output_file, 'w') as f:
                json.dump(results, f, indent=2)
            print(f"    💾 Saved progress to {output_file}")

        print()

    # Final save
    with open(output_file, 'w') as f:
        json.dump(results, f, indent=2)

    db_conn.close()

    # Summary
    print("=" * 70)
    print("PIPELINE COMPLETE")
    print("=" * 70)
    print(f"Regulations analyzed: {len(results)}")
    print(f"With red flags: {sum(1 for r in results if r['num_flags'] > 0)}")
    print(f"Output: {output_file}")


def main():
    parser = argparse.ArgumentParser(description='Run combined definition extraction + red flag analysis')
    parser.add_argument('-n', '--sample-size', type=int, default=20,
                        help='Number of regulations to process (default: 20)')
    parser.add_argument('--skip-extraction', action='store_true',
                        help='Skip definition extraction, use existing definitions')
    parser.add_argument('--seed', type=int, default=42,
                        help='Random seed for reproducible sampling (default: 42)')

    args = parser.parse_args()

    asyncio.run(run_pipeline(
        sample_size=args.sample_size,
        skip_extraction=args.skip_extraction,
        seed=args.seed
    ))


if __name__ == '__main__':
    main()
