#!/usr/bin/env python3
"""
Targeted Analysis Script - Run red_flags and definitions on specific regulation sections.

This script allows filtering regulations by title, chapter, subchapter, part, etc.
and runs the red_flags and/or definitions extraction on the filtered set.

Examples:
    # NY Title 18, Chapter II, Subchapter C (Social Services - Family and Children's Services)
    python backend/scripts/targeted_analysis.py --state NY --title 18 --chapter II --subchapter C --red-flags

    # NY Title 19, Chapter XXXII, Part 1202 (Code Enforcement)
    python backend/scripts/targeted_analysis.py --state NY --title 19 --chapter XXXII --part 1202 --red-flags

    # NJ Title 3A (Children and Families)
    python backend/scripts/targeted_analysis.py --state NJ --title 3A --red-flags --definitions

    # NJ Title 5, Chapter 23 (Community Affairs)
    python backend/scripts/targeted_analysis.py --state NJ --title 5 --chapter 23 --red-flags --definitions
"""

import json
import argparse
import sys
import random
import asyncio
import subprocess
import os
from pathlib import Path
from typing import List, Dict, Optional
from datetime import datetime
from tqdm import tqdm

# Add backend directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))
from config import (
    INDIVIDUAL_REGULATIONS_DIR,
    NJ_INDIVIDUAL_REGULATIONS_DIR,
    OUTPUTS_DIR,
    WEB_PUBLIC_DIR
)
from shared_utils import get_db_connection, get_async_openai_client, get_openai_client

# Import functions from red_flags and extract_definitions
from red_flags import (
    RegulationData,
    RegulationAnalysis,
    analyze_regulation,
    analyze_regulations_batch,
    save_analysis_to_database,
    MODEL_VERSION
)
from extract_definitions import (
    extract_with_llm,
    extract_with_llm_async,
    store_to_database as store_definitions_to_database,
    generate_viewer,
    log_extraction,
    has_definition_content
)


# Predefined batch targets
BATCH_TARGETS = [
    # NY Title 18, Chapter II, Subchapter C (Family and Children's Services)
    {'state': 'NY', 'title': '18', 'chapter': 'II', 'subchapter': 'C',
     'red_flags': True, 'definitions': False,
     'description': 'NY Title 18 Ch II Subch C (Family & Children Services)'},

    # NY Title 19, Chapter XXXII, Part 1202 (Code Enforcement)
    {'state': 'NY', 'title': '19', 'chapter': 'XXXII', 'part': '1202',
     'red_flags': True, 'definitions': False,
     'description': 'NY Title 19 Ch XXXII Part 1202 (Code Enforcement)'},

    # NJ Title 3A (Children and Families) - red flags + definitions
    {'state': 'NJ', 'title': '3A',
     'red_flags': True, 'definitions': True,
     'description': 'NJ Title 3A (Children and Families)'},

    # NJ Title 5, Chapter 23 (Community Affairs) - red flags + definitions
    {'state': 'NJ', 'title': '5', 'chapter': '23',
     'red_flags': True, 'definitions': True,
     'description': 'NJ Title 5 Ch 23 (Community Affairs)'},

    # NJ Title 5, Chapter 70 (Community Affairs) - red flags + definitions
    {'state': 'NJ', 'title': '5', 'chapter': '70',
     'red_flags': True, 'definitions': True,
     'description': 'NJ Title 5 Ch 70 (Community Affairs)'},
]


def get_regulations_dir(state: str) -> Path:
    """Get the regulations directory for a state."""
    if state.upper() == 'NJ':
        return NJ_INDIVIDUAL_REGULATIONS_DIR
    return INDIVIDUAL_REGULATIONS_DIR


def get_already_analyzed_source_indices(state: str) -> set:
    """Get source_indices that already have red flag analyses in the database."""
    conn = get_db_connection()
    if not conn:
        print("Warning: Could not connect to DB, will process all regulations")
        return set()

    try:
        result = conn.execute("""
            SELECT DISTINCT rd.source_index
            FROM regulatory_documents rd
            JOIN analyses a ON rd.id = a.document_id
            WHERE rd.state = %s AND a.is_current = TRUE
        """, (state.upper(),))
        analyzed = {row[0] for row in result.fetchall()}
        conn.close()
        return analyzed
    except Exception as e:
        print(f"Warning: Could not fetch analyzed indices: {e}")
        if conn:
            conn.close()
        return set()


def get_already_extracted_source_indices() -> set:
    """Get source_indices that already have definitions extracted."""
    conn = get_db_connection()
    if not conn:
        print("Warning: Could not connect to DB, will process all regulations")
        return set()

    try:
        result = conn.execute("SELECT source_index FROM definition_extraction_log")
        extracted = {row[0] for row in result.fetchall()}
        conn.close()
        return extracted
    except Exception as e:
        print(f"Warning: Could not fetch extracted indices: {e}")
        if conn:
            conn.close()
        return set()


def load_filtered_regulations(
    state: str,
    title: Optional[str] = None,
    chapter: Optional[str] = None,
    subchapter: Optional[str] = None,
    part: Optional[str] = None,
    article: Optional[str] = None,
    sample_size: Optional[int] = None,
    seed: int = 42,
    skip_source_indices: Optional[set] = None
) -> List[Dict]:
    """
    Load regulations filtered by hierarchy components.

    Args:
        state: 'NY' or 'NJ'
        title: Title number (e.g., '18', '3A')
        chapter: Chapter (e.g., 'II', 'XXXII', '23')
        subchapter: Subchapter (e.g., 'C')
        part: Part number (e.g., '1202')
        article: Article number
        sample_size: Max number of regulations to return (None = all)
        seed: Random seed for sampling
        skip_source_indices: Set of source_indices to skip (already processed)

    Returns:
        List of regulation dicts
    """
    random.seed(seed)
    reg_dir = get_regulations_dir(state)
    all_files = list(reg_dir.glob('*.json'))

    print(f"Scanning {len(all_files)} files in {reg_dir}...")
    if skip_source_indices:
        print(f"Skipping {len(skip_source_indices)} already-processed regulations")

    matched = []
    skipped_count = 0
    state_upper = state.upper()

    for filepath in tqdm(all_files, desc="Scanning files", unit="file"):
        try:
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                data = json.load(f)

            # Skip already-processed source indices
            source_index = data.get('source_index')
            if skip_source_indices and source_index in skip_source_indices:
                skipped_count += 1
                continue

            # State-specific field prefixes
            if state_upper == 'NJ':
                prefix = 'njac_'
            else:
                prefix = 'nycrr_'

            # Check filters
            if title is not None:
                reg_title = data.get(f'{prefix}title')
                # Handle string/int comparison
                if str(reg_title) != str(title):
                    continue

            if chapter is not None:
                reg_chapter = data.get(f'{prefix}chapter')
                if str(reg_chapter) != str(chapter):
                    continue

            if subchapter is not None:
                reg_subchapter = data.get(f'{prefix}subchapter')
                if str(reg_subchapter) != str(subchapter):
                    continue

            if part is not None:
                reg_part = data.get(f'{prefix}part')
                if str(reg_part) != str(part):
                    continue

            if article is not None:
                reg_article = data.get(f'{prefix}article')
                if str(reg_article) != str(article):
                    continue

            # Add filepath for reference
            data['_filepath'] = str(filepath)
            matched.append(data)

        except Exception as e:
            continue

    print(f"Found {len(matched)} matching regulations")
    if skipped_count > 0:
        print(f"Skipped {skipped_count} already-processed regulations")

    # Sample if requested
    if sample_size and len(matched) > sample_size:
        matched = random.sample(matched, sample_size)
        print(f"Sampled down to {sample_size} regulations")

    return matched


def convert_to_regulation_data(reg_dict: Dict, state: str) -> RegulationData:
    """Convert a regulation dict to RegulationData for red_flags analysis."""
    prefix = 'njac_' if state.upper() == 'NJ' else 'nycrr_'

    # Handle title field - nycrr_title expects int, but NJ titles can be strings like "3A"
    raw_title = reg_dict.get(f'{prefix}title')
    parsed_title = None
    if raw_title is not None:
        try:
            parsed_title = int(raw_title)
        except (ValueError, TypeError):
            # NJ titles like "3A" can't be parsed as int, leave as None
            pass

    return RegulationData(
        url=reg_dict.get('url', ''),
        title=reg_dict.get('title', ''),
        content=reg_dict.get('content', ''),
        url_type=reg_dict.get('url_type', 'regulation'),
        source_index=reg_dict.get('source_index', 0),
        hierarchy_level=reg_dict.get('hierarchy_level'),
        hierarchy_path=reg_dict.get('hierarchy_path'),
        nycrr_title=parsed_title,
        nycrr_part=reg_dict.get(f'{prefix}part'),
        nycrr_subpart=reg_dict.get(f'{prefix}subpart'),
        nycrr_section=reg_dict.get(f'{prefix}section'),
        parent_source_index=reg_dict.get('parent_source_index'),
        matched_categories=[],
        primary_category=None
    )


async def run_red_flags_analysis(
    regulations: List[Dict],
    state: str,
    batch_size: int = 50,
    no_database: bool = False,
    delay: float = 0
) -> List[Dict]:
    """Run red flags analysis on filtered regulations with tqdm progress."""
    from red_flags import analyze_regulation, save_analysis_to_database, validate_analysis_categories

    print(f"\n{'='*60}")
    print(f"RED FLAGS ANALYSIS ({len(regulations)} regulations, concurrency={batch_size})")
    print(f"{'='*60}")

    # Convert to RegulationData
    reg_data_list = [convert_to_regulation_data(r, state) for r in regulations]

    # Setup output file
    OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    output_file = str(OUTPUTS_DIR / f"red_flag_targeted_{state}_{timestamp}.json")

    # Get clients
    client = get_async_openai_client()
    db_conn = None if no_database else get_db_connection()

    results = []
    results_lock = asyncio.Lock()
    db_write_success = 0
    db_write_failed = 0

    # Use semaphore for controlled concurrency
    semaphore = asyncio.Semaphore(batch_size)
    pbar = tqdm(total=len(reg_data_list), desc="Analyzing red flags", unit="reg")

    async def process_one(regulation, retry_count=0):
        nonlocal db_write_success, db_write_failed
        async with semaphore:
            try:
                # Add delay between requests if specified
                if delay > 0:
                    await asyncio.sleep(delay)
                analysis = await analyze_regulation(regulation, client)
                validate_analysis_categories(analysis)

                red_flags_list = [{
                    'category': flag.category.value,
                    'explanation': flag.explanation,
                    'severity': flag.severity,
                    'complexity': flag.complexity,
                    'matched_phrases': flag.matched_phrases,
                    'implementation_approach': flag.implementation_approach,
                    'effort_estimate': flag.effort_estimate,
                    'text_examples': flag.text_examples
                } for flag in analysis.red_flags] if analysis.red_flags else []

                row = {
                    'source_index': regulation.source_index,
                    'title': regulation.title,
                    'url': regulation.url,
                    'content': regulation.content,
                    'red_flags': red_flags_list,
                    'has_implementation_issues': analysis.has_implementation_issues,
                    'overall_complexity': analysis.overall_complexity,
                    'summary': analysis.summary,
                    'max_severity': max([f.severity for f in analysis.red_flags], default=0),
                    'num_flags': len(analysis.red_flags)
                }

                async with results_lock:
                    results.append(row)

                    # Save to database
                    if db_conn:
                        analysis_id = save_analysis_to_database(db_conn, regulation, analysis, state=state)
                        if analysis_id:
                            db_write_success += 1
                        else:
                            db_write_failed += 1

                    # Save progress every 10 results
                    if len(results) % 10 == 0:
                        with open(output_file, 'w', encoding='utf-8') as f:
                            json.dump(results, f, indent=2, ensure_ascii=False)

                pbar.update(1)
            except Exception as e:
                error_str = str(e).lower()
                # Retry on rate limit errors
                if ('rate' in error_str or 'limit' in error_str or '429' in error_str) and retry_count < 3:
                    wait_time = (2 ** retry_count) * 5  # 5, 10, 20 seconds
                    tqdm.write(f"⚠️ Rate limit hit, waiting {wait_time}s before retry...")
                    await asyncio.sleep(wait_time)
                    await process_one(regulation, retry_count + 1)
                    return
                tqdm.write(f"⚠️ Error processing {regulation.source_index}: {e}")
                pbar.update(1)

    try:
        # Launch all tasks with semaphore controlling concurrency
        tasks = [process_one(reg) for reg in reg_data_list]
        await asyncio.gather(*tasks)

        pbar.close()

        # Final save
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, ensure_ascii=False)

        # DB status
        if db_conn:
            if db_write_failed > 0:
                print(f"⚠️  DB: {db_write_success} written, {db_write_failed} failed")
            else:
                print(f"✓ DB: All {db_write_success} analyses written")

        # Copy to web app
        web_data_path = WEB_PUBLIC_DIR / "data.json"
        web_data_path.parent.mkdir(parents=True, exist_ok=True)
        import shutil
        shutil.copy(output_file, web_data_path)
        print(f"📦 Copied to {web_data_path}")

        # Summary
        num_with_flags = sum(1 for r in results if r.get('num_flags', 0) > 0)
        print(f"\n=== Red Flags Summary ===")
        print(f"Total analyzed: {len(results)}")
        print(f"With red flags: {num_with_flags}")
        print(f"Output: {output_file}")

        # Refresh hierarchy stats if we wrote to DB
        if db_conn:
            try:
                from refresh_hierarchy_stats import refresh_analysis_stats
                print("\nRefreshing analysis stats...")
                refresh_analysis_stats(db_conn, state.upper())
            except Exception as e:
                print(f"⚠️ Failed to refresh stats: {e}")

        return results

    finally:
        if db_conn:
            try:
                db_conn.close()
            except:
                pass


async def run_definitions_extraction(
    regulations: List[Dict],
    state: str,
    no_database: bool = False,
    batch_size: int = 20,
    delay: float = 0
) -> List[Dict]:
    """Run definitions extraction on filtered regulations (parallelized)."""

    print(f"\n{'='*60}")
    print(f"DEFINITIONS EXTRACTION ({len(regulations)} regulations, concurrency={batch_size})")
    print(f"{'='*60}")

    # Setup output file for local backup
    OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    output_file = OUTPUTS_DIR / f"definitions_targeted_{state}_{timestamp}.json"

    # Filter to regulations likely containing definitions
    regs_with_defs = []
    for reg in regulations:
        content = reg.get('content', '')
        title = reg.get('title', '')
        if has_definition_content(content, title):
            regs_with_defs.append(reg)

    print(f"Found {len(regs_with_defs)}/{len(regulations)} regulations with definition content")

    if not regs_with_defs:
        print("No regulations with definition content found!")
        return []

    # Create async client
    client = get_async_openai_client()

    # Use semaphore for controlled concurrency
    semaphore = asyncio.Semaphore(batch_size)
    pbar = tqdm(total=len(regs_with_defs), desc="Extracting definitions", unit="reg")
    results_lock = asyncio.Lock()
    processed_count = 0

    async def process_one(reg, retry_count=0):
        nonlocal processed_count
        async with semaphore:
            try:
                if delay > 0:
                    await asyncio.sleep(delay)

                definitions = await extract_with_llm_async(
                    reg.get('content', ''),
                    reg.get('title', ''),
                    client=client
                )
                reg['llm_definitions'] = definitions

                async with results_lock:
                    processed_count += 1
                    # Log extraction
                    source_index = reg.get('source_index')
                    if source_index is not None:
                        log_extraction(source_index, len(definitions))

                    # Save progress every 10 extractions
                    if processed_count % 10 == 0:
                        _save_definitions_json(regs_with_defs, output_file)

                tqdm.write(f"  {reg.get('title', 'Unknown')[:50]}... → {len(definitions)} definitions")
                pbar.update(1)

            except Exception as e:
                error_str = str(e).lower()
                if ('rate' in error_str or 'limit' in error_str or '429' in error_str) and retry_count < 3:
                    wait_time = (2 ** retry_count) * 5
                    tqdm.write(f"⚠️ Rate limit hit, waiting {wait_time}s before retry...")
                    await asyncio.sleep(wait_time)
                    await process_one(reg, retry_count + 1)
                    return
                tqdm.write(f"⚠️ Error processing {reg.get('source_index')}: {e}")
                pbar.update(1)

    # Launch all tasks with semaphore controlling concurrency
    tasks = [process_one(reg) for reg in regs_with_defs]
    await asyncio.gather(*tasks)
    pbar.close()

    # Final save to JSON
    _save_definitions_json(regs_with_defs, output_file)
    print(f"📦 Saved to {output_file}")

    # Store to database
    if not no_database:
        store_definitions_to_database(regs_with_defs, state=state)

    # Generate viewer
    generate_viewer(regs_with_defs)

    # Summary
    total_defs = sum(len(r.get('llm_definitions', [])) for r in regs_with_defs)
    print(f"\n=== Definitions Summary ===")
    print(f"Regulations processed: {len(regs_with_defs)}")
    print(f"Total definitions: {total_defs}")
    print(f"Output: {output_file}")

    return regs_with_defs


def _save_definitions_json(regs_with_defs: List[Dict], output_file: Path):
    """Save definitions to JSON file."""
    # Create serializable output
    output_data = []
    for reg in regs_with_defs:
        if 'llm_definitions' not in reg:
            continue
        output_data.append({
            'source_index': reg.get('source_index'),
            'title': reg.get('title'),
            'url': reg.get('url'),
            'definitions': reg.get('llm_definitions', [])
        })

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)


def parse_arguments():
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description='Run targeted red_flags and/or definitions analysis',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # NY Title 18, Chapter II, Subchapter C (Family and Children's Services)
  python backend/scripts/targeted_analysis.py --state NY --title 18 --chapter II --subchapter C --red-flags

  # NY Title 19, Chapter XXXII, Part 1202 (Code Enforcement)
  python backend/scripts/targeted_analysis.py --state NY --title 19 --chapter XXXII --part 1202 --red-flags

  # NJ Title 3A (Children and Families) - both analyses
  python backend/scripts/targeted_analysis.py --state NJ --title 3A --red-flags --definitions

  # NJ Title 5, Chapters 23 and 70
  python backend/scripts/targeted_analysis.py --state NJ --title 5 --chapter 23 --red-flags --definitions
  python backend/scripts/targeted_analysis.py --state NJ --title 5 --chapter 70 --red-flags --definitions
        """
    )

    # Batch mode - run all predefined targets
    parser.add_argument('--batch', action='store_true',
                        help='Run all predefined target analyses (NY Title 18/19, NJ Title 3A/5)')

    # Filter arguments (for single target mode)
    parser.add_argument('--state', type=str, choices=['NY', 'NJ'],
                        help='State to analyze (NY or NJ)')
    parser.add_argument('--title', type=str, help='Title number (e.g., 18, 3A)')
    parser.add_argument('--chapter', type=str, help='Chapter (e.g., II, XXXII, 23)')
    parser.add_argument('--subchapter', type=str, help='Subchapter (e.g., C)')
    parser.add_argument('--part', type=str, help='Part number (e.g., 1202)')
    parser.add_argument('--article', type=str, help='Article number')

    # Analysis type arguments
    parser.add_argument('--red-flags', action='store_true',
                        help='Run red flags analysis')
    parser.add_argument('--definitions', action='store_true',
                        help='Run definitions extraction')

    # Options
    parser.add_argument('--sample-size', '-n', type=int, default=None,
                        help='Max number of regulations to analyze (default: all)')
    parser.add_argument('--batch-size', type=int, default=50,
                        help='Batch size for parallel API calls (default: 50)')
    parser.add_argument('--delay', type=float, default=0,
                        help='Delay in seconds between API calls to avoid rate limits (default: 0)')
    parser.add_argument('--seed', type=int, default=42,
                        help='Random seed for sampling (default: 42)')
    parser.add_argument('--no-database', action='store_true',
                        help='Skip database writes')
    parser.add_argument('--list-only', action='store_true',
                        help='Only list matching regulations, do not analyze')
    parser.add_argument('--reprocess', action='store_true',
                        help='Re-process regulations even if already analyzed')

    return parser.parse_args()


async def run_single_target(
    state: str,
    title: Optional[str] = None,
    chapter: Optional[str] = None,
    subchapter: Optional[str] = None,
    part: Optional[str] = None,
    article: Optional[str] = None,
    run_red_flags: bool = False,
    run_definitions: bool = False,
    sample_size: Optional[int] = None,
    batch_size: int = 10,
    seed: int = 42,
    no_database: bool = False,
    reprocess: bool = False,
    description: str = "",
    delay: float = 0
):
    """Run analysis on a single target configuration."""

    print("="*60)
    print(f"TARGET: {description or 'Custom'}")
    print("="*60)
    print(f"State: {state}")
    print(f"Filters: title={title}, chapter={chapter}, subchapter={subchapter}, part={part}")
    print(f"Analyses: red_flags={run_red_flags}, definitions={run_definitions}")
    print()

    # Build skip set
    skip_indices = set()
    if not reprocess:
        if run_red_flags:
            analyzed = get_already_analyzed_source_indices(state)
            print(f"Found {len(analyzed)} regulations with existing red flag analyses")
            skip_indices.update(analyzed)
        if run_definitions:
            extracted = get_already_extracted_source_indices()
            print(f"Found {len(extracted)} regulations with existing definitions")
            skip_indices.update(extracted)
        if skip_indices:
            print()

    # Load filtered regulations
    regulations = load_filtered_regulations(
        state=state,
        title=title,
        chapter=chapter,
        subchapter=subchapter,
        part=part,
        article=article,
        sample_size=sample_size,
        seed=seed,
        skip_source_indices=skip_indices if skip_indices else None
    )

    if not regulations:
        print("No matching regulations found (or all already processed)!")
        print()
        return

    # Run analyses
    if run_red_flags:
        await run_red_flags_analysis(
            regulations,
            state,
            batch_size=batch_size,
            no_database=no_database,
            delay=delay
        )

    if run_definitions:
        await run_definitions_extraction(
            regulations,
            state,
            no_database=no_database,
            batch_size=batch_size,
            delay=delay
        )

    print()


async def main():
    """Main execution function."""
    args = parse_arguments()

    # Batch mode - run all predefined targets
    if args.batch:
        print("="*60)
        print("BATCH MODE - Running all predefined targets")
        print("="*60)
        print(f"\nCounting regulations for {len(BATCH_TARGETS)} targets...")

        # First pass: count all regulations to process
        target_counts = []
        total_regs = 0
        total_skipped = 0

        for target in tqdm(BATCH_TARGETS, desc="Scanning targets", unit="target"):
            state = target['state']

            # Get skip indices for this target
            skip_indices = set()
            if not args.reprocess:
                if target.get('red_flags'):
                    skip_indices.update(get_already_analyzed_source_indices(state))
                if target.get('definitions'):
                    skip_indices.update(get_already_extracted_source_indices())

            # Count matching regulations
            regs = load_filtered_regulations(
                state=state,
                title=target.get('title'),
                chapter=target.get('chapter'),
                subchapter=target.get('subchapter'),
                part=target.get('part'),
                article=target.get('article'),
                sample_size=args.sample_size,
                seed=args.seed,
                skip_source_indices=skip_indices if skip_indices else None
            )

            target_counts.append({
                'target': target,
                'count': len(regs),
                'regulations': regs,
                'skip_indices': skip_indices
            })
            total_regs += len(regs)

        # Summary
        print(f"\n{'='*60}")
        print("BATCH SUMMARY")
        print(f"{'='*60}")
        for i, tc in enumerate(target_counts, 1):
            status = "✓" if tc['count'] > 0 else "⊘"
            print(f"  {status} {i}. {tc['target']['description']}: {tc['count']} regulations")
        print(f"\n  TOTAL: {total_regs} regulations to process")
        if total_regs == 0:
            print("\nNothing to process! All regulations already analyzed.")
            return
        print()

        # Process with overall progress bar
        processed_regs = 0
        overall_pbar = tqdm(total=total_regs, desc="Overall progress", unit="reg", position=0)

        for i, tc in enumerate(target_counts, 1):
            target = tc['target']
            state = target['state']

            print(f"\n{'#'*60}")
            print(f"# TARGET {i}/{len(BATCH_TARGETS)}: {target['description']}")
            print(f"{'#'*60}\n")

            # Run red flags with red_flags-specific skip indices
            if target.get('red_flags'):
                rf_skip = get_already_analyzed_source_indices(state) if not args.reprocess else set()
                rf_regs = load_filtered_regulations(
                    state=state,
                    title=target.get('title'),
                    chapter=target.get('chapter'),
                    subchapter=target.get('subchapter'),
                    part=target.get('part'),
                    article=target.get('article'),
                    sample_size=args.sample_size,
                    seed=args.seed,
                    skip_source_indices=rf_skip if rf_skip else None
                )
                if rf_regs:
                    await run_red_flags_analysis(
                        rf_regs,
                        state,
                        batch_size=args.batch_size,
                        no_database=args.no_database,
                        delay=args.delay
                    )
                    overall_pbar.update(len(rf_regs))
                else:
                    print("  Red flags: All regulations already analyzed ✓")

            # Run definitions with definitions-specific skip indices
            if target.get('definitions'):
                def_skip = get_already_extracted_source_indices() if not args.reprocess else set()
                def_regs = load_filtered_regulations(
                    state=state,
                    title=target.get('title'),
                    chapter=target.get('chapter'),
                    subchapter=target.get('subchapter'),
                    part=target.get('part'),
                    article=target.get('article'),
                    sample_size=args.sample_size,
                    seed=args.seed,
                    skip_source_indices=def_skip if def_skip else None
                )
                if def_regs:
                    await run_definitions_extraction(
                        def_regs,
                        state,
                        no_database=args.no_database,
                        batch_size=args.batch_size,
                        delay=args.delay
                    )
                else:
                    print("  Definitions: All regulations already extracted ✓")

        overall_pbar.close()

        print("\n" + "="*60)
        print(f"ALL BATCH TARGETS COMPLETE - {processed_regs} regulations processed")
        print("="*60)
        return

    # Single target mode - validate arguments
    if not args.state:
        print("Error: Must specify --state or use --batch mode")
        sys.exit(1)

    # Must specify at least one analysis type
    if not args.red_flags and not args.definitions and not args.list_only:
        print("Error: Must specify --red-flags and/or --definitions (or --list-only)")
        sys.exit(1)

    # Must specify at least one filter
    if not any([args.title, args.chapter, args.subchapter, args.part, args.article]):
        print("Error: Must specify at least one filter (--title, --chapter, etc.)")
        sys.exit(1)

    print("="*60)
    print("TARGETED REGULATION ANALYSIS")
    print("="*60)
    print(f"State: {args.state}")
    print(f"Filters: title={args.title}, chapter={args.chapter}, "
          f"subchapter={args.subchapter}, part={args.part}, article={args.article}")
    print(f"Analyses: red_flags={args.red_flags}, definitions={args.definitions}")
    print(f"Reprocess: {args.reprocess}")
    print()

    # Build skip set based on what's already been processed
    skip_indices = set()
    if not args.reprocess and not args.list_only:
        if args.red_flags:
            analyzed = get_already_analyzed_source_indices(args.state)
            print(f"Found {len(analyzed)} regulations with existing red flag analyses")
            skip_indices.update(analyzed)
        if args.definitions:
            extracted = get_already_extracted_source_indices()
            print(f"Found {len(extracted)} regulations with existing definitions")
            skip_indices.update(extracted)
        print()

    # Load filtered regulations
    regulations = load_filtered_regulations(
        state=args.state,
        title=args.title,
        chapter=args.chapter,
        subchapter=args.subchapter,
        part=args.part,
        article=args.article,
        sample_size=args.sample_size,
        seed=args.seed,
        skip_source_indices=skip_indices if skip_indices else None
    )

    if not regulations:
        print("No matching regulations found!")
        sys.exit(1)

    # List only mode
    if args.list_only:
        print(f"\n=== Matching Regulations ({len(regulations)}) ===")
        for reg in regulations[:50]:  # Limit to 50 for readability
            print(f"  {reg.get('title', 'Unknown')[:80]}")
        if len(regulations) > 50:
            print(f"  ... and {len(regulations) - 50} more")
        return

    # Run analyses
    if args.red_flags:
        await run_red_flags_analysis(
            regulations,
            args.state,
            batch_size=args.batch_size,
            no_database=args.no_database,
            delay=args.delay
        )

    if args.definitions:
        await run_definitions_extraction(
            regulations,
            args.state,
            no_database=args.no_database,
            batch_size=args.batch_size,
            delay=args.delay
        )

    print("\n" + "="*60)
    print("ANALYSIS COMPLETE")
    print("="*60)


def run_with_caffeinate():
    """Run the script with caffeinate to prevent system sleep."""
    # Check if we're already running under caffeinate
    if os.environ.get('CAFFEINATED'):
        asyncio.run(main())
        return

    # Re-run this script under caffeinate
    print("☕ Starting with caffeinate to prevent sleep...")
    env = os.environ.copy()
    env['CAFFEINATED'] = '1'

    try:
        result = subprocess.run(
            ['caffeinate', '-dims', sys.executable] + sys.argv,
            env=env
        )
        sys.exit(result.returncode)
    except FileNotFoundError:
        # caffeinate not available (not macOS), run directly
        print("⚠️  caffeinate not found, running without it")
        asyncio.run(main())


if __name__ == "__main__":
    run_with_caffeinate()
