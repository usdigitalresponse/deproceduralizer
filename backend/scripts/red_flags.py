#!/usr/bin/env python3
"""
Red Flag Analysis - Identify implementation complexity in regulations.

Analyzes regulations for 12 categories of "red flags" based on Jennifer Pahlka's
framework from "Recoding America".

Examples:
    # Analyze sample of NY regulations
    python red_flags.py --state NY --sample-size 100

    # Analyze specific NJ title
    python red_flags.py --state NJ --title 3A

    # Analyze NY Title 18, Chapter II, skip already-processed
    python red_flags.py --state NY --title 18 --chapter II --skip-done

    # Dry run to see what would be analyzed
    python red_flags.py --state NJ --title 5 --dry-run
"""

import json
import os
import shutil
import sys
import random
import argparse
from pathlib import Path
from typing import List, Optional, Dict, Set, Tuple
from enum import Enum
from pydantic import BaseModel, Field
from openai import AsyncOpenAI  # Type hint only
from dotenv import load_dotenv
import asyncio
from datetime import datetime
import psycopg
from psycopg import Connection

# Add backend directory to path for config import
sys.path.insert(0, str(Path(__file__).parent.parent))
from config import INDIVIDUAL_REGULATIONS_DIR, WEB_PUBLIC_DIR, PROJECT_ROOT, OUTPUTS_DIR
from shared_utils import (
    get_db_connection,
    get_openai_client,
    get_async_openai_client,
    call_llm_parse_async,
    load_prompt_parts,
    format_batch_request,
    get_filtered_documents,
    get_already_analyzed_ids,
    BatchManager,
    parse_batch_result_tool_use,
)

# Load environment variables from project root
load_dotenv(PROJECT_ROOT / '.env')

# Model version imported from shared_utils for centralized management
from shared_utils import DEFAULT_MODEL as MODEL_VERSION


class ComplexityLevel(str, Enum):
    """Complexity levels for implementation issues"""
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class RedFlagCategory(str, Enum):
    """12 implementation complexity categories based on Jennifer Pahlka's framework.
    MUST use one of these exact values:"""

    COMPLEXITY_POLICY_DEBT = "complexity_policy_debt"
    OPTIONS_BECOME_REQUIREMENTS = "options_become_requirements"
    POLICY_IMPLEMENTATION_SEPARATION = "policy_implementation_separation"
    OVERWROUGHT_LEGALESE = "overwrought_legalese"
    CASCADE_OF_RIGIDITY = "cascade_of_rigidity"
    MANDATED_STEPS_NOT_OUTCOMES = "mandated_steps_not_outcomes"
    ADMINISTRATIVE_BURDENS = "administrative_burdens"
    NO_FEEDBACK_LOOPS = "no_feedback_loops"
    PROCESS_WORSHIP_OVERSIGHT = "process_worship_oversight"
    ZERO_RISK_LANGUAGE = "zero_risk_language"
    FROZEN_TECHNOLOGY = "frozen_technology"
    IMPLEMENTATION_OPPORTUNITY = "implementation_opportunity"

class RedFlagDetail(BaseModel):
    """Details for a specific red flag category"""
    category: RedFlagCategory = Field(
        description="One of: complexity_policy_debt, options_become_requirements, policy_implementation_separation, overwrought_legalese, cascade_of_rigidity, mandated_steps_not_outcomes, administrative_burdens, no_feedback_loops, process_worship_oversight, zero_risk_language, frozen_technology, implementation_opportunity"
    )
    explanation: str
    severity: int  # 1-10 scale for this specific category
    complexity: str  # HIGH, MEDIUM, or LOW
    matched_phrases: List[str] = []  # Exact quotes from the regulation
    implementation_approach: str
    effort_estimate: Optional[str] = None  # Rough estimate of effort/timeline
    text_examples: List[str] = []  # Supporting context


class RegulationAnalysis(BaseModel):
    """Pydantic model for structured regulation analysis output"""

    has_implementation_issues: bool  # True if any categories 1-11 are found
    red_flags: List[RedFlagDetail] = []  # List of red flag details
    overall_complexity: Optional[str] = None  # HIGH, MEDIUM, LOW, or None
    summary: Optional[str] = None  # 2-3 sentence summary of main concerns
    requires_technical_review: bool = False  # True if needs architect/engineer review
    has_reporting_requirement: bool = False  # True if regulation creates reporting requirements

class RegulationData(BaseModel):
    """Model for the input regulation data"""
    url: str
    title: str
    content: str
    url_type: str
    source_index: int
    # Hierarchy fields
    hierarchy_level: Optional[str] = None
    hierarchy_path: Optional[str] = None
    nycrr_title: Optional[int] = None
    nycrr_part: Optional[str] = None
    nycrr_subpart: Optional[str] = None
    nycrr_section: Optional[str] = None
    parent_source_index: Optional[int] = None
    # Category tracking fields
    matched_categories: List[str] = []
    primary_category: Optional[str] = None

# Category keywords for filtering
CATEGORY_KEYWORDS = {
    'housing': ['housing', 'apartment', 'rent', 'tenant', 'landlord', 'lease', 'eviction'],
    'child_care': ['child care', 'childcare', 'daycare', 'day care', 'preschool', 'early childhood'],
    'permitting': ['permit', 'permitting', 'license', 'licensing', 'approval process', 'application', 'approval']
}

def build_category_index(directory: str, categories_config: Dict[str, List[str]]) -> Dict[Path, Set[str]]:
    """Build index mapping each file to its matching categories

    Args:
        directory: Path to directory containing regulation JSON files
        categories_config: Dict mapping category names to keyword lists

    Returns:
        Dict mapping file paths to sets of matching categories
    """
    file_category_map = {}
    regulation_files = list(Path(directory).glob("*.json"))

    print(f"Building category index for {len(regulation_files)} files...")

    for file_path in regulation_files:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                content_lower = (data.get('title', '') + ' ' + data.get('content', '')).lower()

                matched_categories = set()
                for category, keywords in categories_config.items():
                    if any(keyword.lower() in content_lower for keyword in keywords):
                        matched_categories.add(category)

                if matched_categories:
                    file_category_map[file_path] = matched_categories
        except Exception as e:
            continue

    print(f"Index built: {sum(len(cats) for cats in file_category_map.values())} total matches")
    for cat in categories_config.keys():
        count = sum(1 for cats in file_category_map.values() if cat in cats)
        print(f"  {cat}: {count} matches")

    return file_category_map

def deduplicate_and_assign(file_category_map: Dict[Path, Set[str]], categories_config: Dict[str, List[str]]) -> Dict[Path, str]:
    """Assign each file to primary category using 'fewest matches' heuristic

    Args:
        file_category_map: Output from build_category_index
        categories_config: Category configuration dict

    Returns:
        Dict mapping file paths to their primary category
    """
    category_counts = {cat: 0 for cat in categories_config.keys()}
    file_assignments = {}

    # Sort by number of matches (process files with fewer matches first)
    sorted_files = sorted(file_category_map.items(),
                         key=lambda x: len(x[1]))

    for file_path, matched_categories in sorted_files:
        # Assign to category with fewest current assignments
        primary_category = min(matched_categories,
                              key=lambda c: category_counts[c])
        file_assignments[file_path] = primary_category
        category_counts[primary_category] += 1

    print(f"\nAssignments by primary category:")
    for cat in categories_config.keys():
        count = sum(1 for c in file_assignments.values() if c == cat)
        print(f"  {cat}: {count}")

    return file_assignments

def stratified_sample(file_assignments: Dict[Path, str],
                     file_category_map: Dict[Path, Set[str]],
                     categories_config: Dict[str, List[str]],
                     total_limit: int) -> List[RegulationData]:
    """Stratified sampling with equal quotas per category

    Args:
        file_assignments: Output from deduplicate_and_assign
        file_category_map: Output from build_category_index
        categories_config: Category configuration dict
        total_limit: Target total sample size

    Returns:
        List of sampled RegulationData objects
    """
    # Initialize quotas
    num_categories = len([c for c in categories_config.keys()
                         if any(v == c for v in file_assignments.values())])

    if num_categories == 0:
        print("No regulations found matching any category!")
        return []

    base_quota = total_limit // num_categories
    remainder = total_limit % num_categories

    category_quotas = {}
    category_files = {cat: [] for cat in categories_config.keys()}

    # Group files by primary category
    for file_path, primary_cat in file_assignments.items():
        category_files[primary_cat].append(file_path)

    # Assign quotas (prioritize categories with remainder)
    active_categories = [c for c in categories_config.keys() if category_files[c]]
    for i, cat in enumerate(sorted(active_categories)):
        quota = base_quota + (1 if i < remainder else 0)
        category_quotas[cat] = quota

    print(f"\nStratified sampling ({total_limit} total):")
    selected_regulations = []

    for category in categories_config.keys():
        files = category_files[category]
        quota = category_quotas[category]

        if not files:
            continue

        # Sample up to quota (or all if fewer available)
        sample_size = min(quota, len(files))
        sampled_files = random.sample(files, sample_size)

        print(f"  {category}: sampling {sample_size}/{len(files)} (quota: {quota})")

        for file_path in sampled_files:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    regulation_data = RegulationData(
                        **data,
                        matched_categories=list(file_category_map[file_path]),
                        primary_category=category
                    )
                    selected_regulations.append(regulation_data)
            except Exception as e:
                print(f"    Error loading {file_path}: {e}")
                continue

    # Handle quota exhaustion - if one category didn't meet quota, try to get more
    total_selected = len(selected_regulations)
    if total_selected < total_limit:
        remaining_quota = total_limit - total_selected
        print(f"\nHandling quota exhaustion: need {remaining_quota} more samples")

        # Get all sampled URLs (not file paths)
        sampled_urls = {reg.url for reg in selected_regulations}

        # Try to sample from under-quota categories
        for category in categories_config.keys():
            if remaining_quota <= 0:
                break

            # Load and check URLs from available files
            available_files = []
            for f in category_files[category]:
                try:
                    with open(f, 'r', encoding='utf-8') as file:
                        data = json.load(file)
                        if data.get('url') not in sampled_urls:
                            available_files.append(f)
                except Exception:
                    continue

            if not available_files:
                continue

            additional = min(remaining_quota, len(available_files))
            extra_files = random.sample(available_files, additional)

            print(f"  {category}: adding {additional} more")

            for file_path in extra_files:
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        regulation_data = RegulationData(
                            **data,
                            matched_categories=list(file_category_map[file_path]),
                            primary_category=category
                        )
                        selected_regulations.append(regulation_data)
                        sampled_urls.add(regulation_data.url)
                        remaining_quota -= 1
                except Exception as e:
                    print(f"    Error loading {file_path}: {e}")
                    continue

    print(f"Total selected: {len(selected_regulations)}/{total_limit}")
    return selected_regulations

def load_regulations_multi_category(directory: str,
                                   categories_config: Dict[str, List[str]],
                                   total_limit: int,
                                   selected_categories: Optional[List[str]] = None) -> List[RegulationData]:
    """Load regulations with balanced multi-category sampling

    Args:
        directory: Path to directory containing regulation JSON files
        categories_config: Dict mapping category names to keyword lists
        total_limit: Target total sample size
        selected_categories: List of categories to include (None = all)

    Returns:
        List of sampled RegulationData objects
    """
    # Filter categories if specified
    if selected_categories and 'all' not in selected_categories:
        active_config = {k: v for k, v in categories_config.items()
                        if k in selected_categories}
    else:
        active_config = categories_config

    # Phase 1: Build index
    file_category_map = build_category_index(directory, active_config)

    if not file_category_map:
        print("No regulations found matching any category!")
        return []

    # Phase 2: Deduplicate and assign primary categories
    file_assignments = deduplicate_and_assign(file_category_map, active_config)

    # Phase 3: Stratified sample
    regulations = stratified_sample(file_assignments, file_category_map,
                                   active_config, total_limit)

    return regulations

def validate_analysis_categories(analysis: RegulationAnalysis) -> tuple[bool, list]:
    """Check if all red flag categories match the valid enum values.

    Returns:
        (True if all valid, list of invalid categories found)
        Prints warnings for invalid categories.
    """
    valid_categories = {cat.value for cat in RedFlagCategory}
    invalid_categories = []

    for flag in analysis.red_flags:
        if flag.category.value not in valid_categories:
            print(f"    ⚠️  INVALID CATEGORY: '{flag.category.value}' (not in enum)")
            invalid_categories.append(flag.category.value)

    return (len(invalid_categories) == 0, invalid_categories)

def create_analysis_prompt(section_text: str = "", citation: str = "", heading: str = "") -> str:
    """
    Build comprehensive Pahlka implementation analysis prompt with pattern library examples.
    Uses centralized prompt from prompts.yaml.

    Combines system + user prompts for non-batch calls.
    """
    parts = load_prompt_parts(
        "red_flags_analysis",
        section_text=section_text,
        citation=citation,
        heading=heading
    )
    # Combine system and user for non-batch calls
    if parts.get('system'):
        return f"{parts['system']}\n\n{parts['user']}"
    return parts['user']

def save_analysis_to_database(conn: Connection,
                             regulation: RegulationData,
                             analysis: RegulationAnalysis,
                             state: str = "NY") -> Optional[int]:
    """Save regulation analysis to database

    Args:
        conn: Database connection
        regulation: Regulation data
        analysis: Analysis results
        state: State code (NY or NJ)

    Returns:
        analysis_id if successful, None otherwise
    """
    try:
        with conn.cursor() as cur:
            # 1. Insert/Update regulatory_documents
            cur.execute("""
                INSERT INTO regulatory_documents
                (source_index, type, state, title, url, url_type, content,
                 hierarchy_level, hierarchy_path, nycrr_title, nycrr_part, nycrr_subpart, nycrr_section)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (state, source_index, type) DO UPDATE SET
                    title = EXCLUDED.title,
                    url = EXCLUDED.url,
                    content = EXCLUDED.content
                RETURNING id
            """, (
                regulation.source_index, "regulation", state.upper(),
                regulation.title, regulation.url, regulation.url_type,
                regulation.content, regulation.hierarchy_level,
                regulation.hierarchy_path, regulation.nycrr_title,
                regulation.nycrr_part, regulation.nycrr_subpart, regulation.nycrr_section
            ))
            doc_id = cur.fetchone()[0]

            # 2. Delete previous analyses (cascades to red_flags)
            cur.execute("""
                DELETE FROM analyses
                WHERE document_id = %s
            """, (doc_id,))

            # 3. Insert new analysis
            cur.execute("""
                INSERT INTO analyses
                (document_id, model_version, has_implementation_issues,
                 overall_complexity, summary, requires_technical_review,
                 has_reporting_requirement, max_severity, num_flags)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (
                doc_id, MODEL_VERSION,
                analysis.has_implementation_issues,
                analysis.overall_complexity, analysis.summary,
                analysis.requires_technical_review,
                analysis.has_reporting_requirement,
                max([f.severity for f in analysis.red_flags], default=0),
                len(analysis.red_flags)
            ))
            analysis_id = cur.fetchone()[0]

            # 4. Insert red flags
            if analysis.red_flags:
                flag_data = [
                    (
                        analysis_id, flag.category.value, flag.explanation,
                        flag.severity, flag.complexity,
                        flag.matched_phrases, flag.implementation_approach,
                        flag.effort_estimate, flag.text_examples
                    )
                    for flag in analysis.red_flags
                ]
                cur.executemany("""
                    INSERT INTO red_flags
                    (analysis_id, category, explanation, severity, complexity,
                     matched_phrases, implementation_approach, effort_estimate,
                     text_examples)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, flag_data)

            conn.commit()
            return analysis_id

    except Exception as e:
        try:
            conn.rollback()
        except:
            pass
        print(f"❌ Error saving to database for {regulation.source_index}: {type(e).__name__}: {e}")
        return None

async def analyze_regulation(regulation_data: RegulationData, client: AsyncOpenAI) -> RegulationAnalysis:
    """Analyze a single regulation for red flags using GPT-5 nano with structured output"""

    prompt = create_analysis_prompt(
        section_text=regulation_data.content,
        citation=regulation_data.url,
        heading=regulation_data.title
    )

    result = await call_llm_parse_async(
        client=client,
        prompt=prompt,
        response_format=RegulationAnalysis,
        model=MODEL_VERSION,
    )

    if result is None:
        print(f"Error analyzing regulation {regulation_data.source_index}")
        return RegulationAnalysis(
            has_implementation_issues=False,
            red_flags=[],
            overall_complexity=None,
            summary=None,
            requires_technical_review=False,
            has_reporting_requirement=False
        )

    return result

async def analyze_regulations_batch(regulations: List[RegulationData],
                                   client: AsyncOpenAI,
                                   output_file: str,
                                   batch_size: int = 10,
                                   db_conn: Optional[Connection] = None) -> List[Dict]:
    """Analyze a batch of regulations in parallel, saving every 5 completed calls

    Args:
        regulations: List of regulations to analyze
        client: AsyncOpenAI client
        output_file: Path to output JSON file
        batch_size: Batch size for parallel processing
        db_conn: Optional database connection for writing results
    """

    results = []
    completed_count = 0
    invalid_categories_found = []
    db_write_success = 0
    db_write_failed = 0

    # Process in batches for controlled parallelism
    for batch_start in range(0, len(regulations), batch_size):
        batch = regulations[batch_start:batch_start + batch_size]
        print(f"Processing batch {batch_start // batch_size + 1} ({len(batch)} regulations)...")

        # Create tasks for parallel execution
        tasks = [analyze_regulation(reg, client) for reg in batch]
        analyses = await asyncio.gather(*tasks)

        # Process results from this batch
        for regulation, analysis in zip(batch, analyses):
            # Track invalid categories
            is_valid, invalid_cats = validate_analysis_categories(analysis)
            if not is_valid:
                invalid_categories_found.extend([(regulation.source_index, cat) for cat in invalid_cats])

            # Keep red_flags as actual array (not JSON string) for JSON output
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
                'url_type': regulation.url_type,
                # Hierarchy fields
                'hierarchy_level': regulation.hierarchy_level,
                'hierarchy_path': regulation.hierarchy_path,
                'nycrr_title': regulation.nycrr_title,
                'nycrr_part': regulation.nycrr_part,
                'nycrr_subpart': regulation.nycrr_subpart,
                'nycrr_section': regulation.nycrr_section,
                'parent_source_index': regulation.parent_source_index,
                # Category tracking
                'matched_categories': regulation.matched_categories,
                'primary_category': regulation.primary_category,
                # Analysis fields
                'red_flags': red_flags_list,
                'has_implementation_issues': analysis.has_implementation_issues,
                'overall_complexity': analysis.overall_complexity,
                'summary': analysis.summary,
                'requires_technical_review': analysis.requires_technical_review,
                'has_reporting_requirement': analysis.has_reporting_requirement,
                'max_severity': max([flag.severity for flag in analysis.red_flags], default=0),
                'num_flags': len(analysis.red_flags)
            }
            results.append(row)
            completed_count += 1

            # Save to database if connection available
            if db_conn:
                analysis_id = save_analysis_to_database(db_conn, regulation, analysis)
                if analysis_id is not None:
                    db_write_success += 1
                else:
                    db_write_failed += 1

            # Format severity summary for console output
            if analysis.red_flags:
                flag_summary = ', '.join([f"{flag.category}:{flag.severity}" for flag in analysis.red_flags])
                categories_str = f" [{', '.join(regulation.matched_categories)}]" if regulation.matched_categories else ""
                print(f"  {regulation.title[:50]}... 🚩 {len(analysis.red_flags)} flags ({flag_summary}){categories_str}")
            else:
                categories_str = f" [{', '.join(regulation.matched_categories)}]" if regulation.matched_categories else ""
                print(f"  {regulation.title[:50]}... No flags{categories_str}")

        # Save to JSON every 5 completed results
        if completed_count % 5 == 0 or batch_start + batch_size >= len(regulations):
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(results, f, indent=2, ensure_ascii=False)
            print(f"  💾 Saved progress ({completed_count} regulations) to {output_file}")

    # Report invalid categories if found
    if invalid_categories_found:
        print(f"\n⚠️  VALIDATION ISSUES DETECTED:")
        print(f"Found {len(invalid_categories_found)} invalid category values:")
        unique_invalid = {}
        for source_idx, cat in invalid_categories_found:
            if cat not in unique_invalid:
                unique_invalid[cat] = []
            unique_invalid[cat].append(source_idx)
        for cat in sorted(unique_invalid.keys()):
            print(f"  - '{cat}': {len(unique_invalid[cat])} occurrence(s)")

    # Report database write status
    if db_conn:
        if db_write_failed > 0:
            print(f"\n⚠️  DATABASE WRITE STATUS:")
            print(f"  ✓ Successfully wrote: {db_write_success} analyses")
            print(f"  ✗ Failed to write: {db_write_failed} analyses")
            print(f"  ⚠️  {db_write_failed} analyses are in JSON but NOT in database!")
            print(f"  💡 You can manually import from {output_file} if needed")
        else:
            print(f"\n✓ Database write status:")
            print(f"  ✓ All {db_write_success} analyses written to database")

    return results

def parse_arguments():
    """Parse command-line arguments"""
    parser = argparse.ArgumentParser(
        description='Analyze regulations for red flags (implementation complexity)'
    )

    # State selection (required for DB mode)
    parser.add_argument(
        '--state',
        type=str,
        choices=['NY', 'NJ'],
        help='State to analyze (uses database)'
    )

    # Hierarchy filters
    parser.add_argument(
        '--title',
        type=str,
        help='Filter by title (e.g., "3A", "18")'
    )

    parser.add_argument(
        '--chapter',
        type=str,
        help='Filter by chapter (e.g., "II", "23")'
    )

    parser.add_argument(
        '--subchapter',
        type=str,
        help='Filter by subchapter (e.g., "C")'
    )

    parser.add_argument(
        '--part',
        type=str,
        help='Filter by part (e.g., "1202")'
    )

    # Processing options
    parser.add_argument(
        '--sample-size', '-n',
        type=int,
        default=None,
        help='Max number of regulations to analyze (default: all matching)'
    )

    parser.add_argument(
        '--skip-done',
        action='store_true',
        help='Skip documents that already have analyses'
    )

    parser.add_argument(
        '--categories',
        nargs='+',
        choices=['housing', 'child_care', 'permitting', 'all'],
        default=['all'],
        help='Categories to include when using JSON files (default: all)'
    )

    parser.add_argument(
        '--no-database',
        action='store_true',
        help='Skip database writes (JSON only)'
    )

    parser.add_argument(
        '--batch-size',
        type=int,
        default=10,
        help='Parallel batch size for API calls (default: 10)'
    )

    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be analyzed without running'
    )

    parser.add_argument(
        '--seed',
        type=int,
        default=42,
        help='Random seed for reproducible sampling (default: 42)'
    )

    # Batch API options
    parser.add_argument(
        '--use-batch-api',
        action='store_true',
        help='Submit to Anthropic Batch API (50%% cheaper, up to 24h processing)'
    )

    parser.add_argument(
        '--process-batch',
        type=str,
        metavar='BATCH_ID',
        help='Process a completed batch (e.g., msgbatch_xxx)'
    )

    return parser.parse_args()


# Batches directory for red flags
BATCHES_DIR = OUTPUTS_DIR / 'batches' / 'red_flags'


def submit_batch_api(regulations: List[RegulationData], state: str, title: str = None) -> str:
    """
    Submit regulations for batch API processing (50% cheaper).

    Args:
        regulations: List of regulations to analyze
        state: State code
        title: Optional title filter (for batch naming)

    Returns:
        Batch API ID
    """
    print(f"\n[1/2] Formatting {len(regulations)} batch requests...")

    # Load system prompt ONCE for caching (same across all requests)
    # This gets cached by Anthropic's batch API
    sample_parts = load_prompt_parts("red_flags_analysis", section_text="", citation="", heading="")
    system_prompt = sample_parts['system']

    # Format requests with shared system prompt
    requests = []
    doc_ids = []
    for reg in regulations:
        # Only the user message varies per document
        parts = load_prompt_parts(
            "red_flags_analysis",
            section_text=reg.content,
            citation=reg.url,
            heading=reg.title
        )
        request = format_batch_request(
            custom_id=f"doc_{reg.source_index}",
            prompt=parts['user'],
            response_format=RegulationAnalysis,
            system=system_prompt,  # Cached across all requests
        )
        requests.append(request)
        doc_ids.append(reg.source_index)

    print(f"      ✓ Formatted {len(requests)} requests")

    # Submit batch
    print(f"\n[2/2] Submitting to Anthropic Batch API...")

    batch_name = f"red_flags_{state}"
    if title:
        batch_name += f"_{title}"

    manager = BatchManager(batches_dir=BATCHES_DIR)
    batch_id = manager.submit_batch(
        requests=requests,
        batch_name=batch_name,
        metadata={
            'state': state,
            'title': title,
            'document_ids': doc_ids,
        }
    )

    print(f"      ✓ Submitted batch: {batch_id}")
    return batch_id


def process_batch_results(batch_id: str, state: str):
    """
    Process results from a completed batch and save to database.

    Args:
        batch_id: Batch API ID to process
        state: State code for database operations
    """
    import time as time_module

    print("=" * 70)
    print("PROCESSING RED FLAGS BATCH")
    print("=" * 70)
    print()

    manager = BatchManager(batches_dir=BATCHES_DIR)

    # Check batch status
    print("[1/3] Checking batch status...")
    try:
        status = manager.get_batch_status(batch_id)
    except Exception as e:
        print(f"      ❌ Could not retrieve batch: {e}")
        return

    if status['status'] != 'ended':
        print(f"      ⚠️  Batch is still processing: {status['status']}")
        print(f"      Progress: {status['succeeded'] + status['errored']}/{status['total']}")
        print("\nWait for batch to complete, then run this command again.")
        return

    print(f"      ✓ Batch completed")
    print(f"      Succeeded: {status['succeeded']}")
    print(f"      Errored: {status['errored']}")
    print()

    # Get batch directory for metadata
    batch_dir = manager.find_batch_dir(batch_id)
    metadata = {}
    if batch_dir:
        info_file = batch_dir / 'batch_info.json'
        if info_file.exists():
            with open(info_file) as f:
                metadata = json.load(f)

    # Retrieve and process results
    print("[2/3] Retrieving and processing results...")

    conn = get_db_connection()
    if not conn:
        print("      ❌ Could not connect to database")
        return

    results_iter = manager.get_batch_results(batch_id)

    total_analyses = 0
    succeeded = 0
    errored = 0
    processed = 0
    total_expected = status['total']
    start_time = time_module.time()

    for result in results_iter:
        custom_id = result.custom_id
        doc_id = int(custom_id.replace('doc_', ''))

        if result.result.type != 'succeeded':
            if batch_dir:
                manager.log_error(batch_dir, custom_id, result.result.type.upper(), str(result.result))
            errored += 1
            processed += 1
            continue

        # Parse the analysis
        try:
            analysis = parse_batch_result_tool_use(result, RegulationAnalysis)

            if not analysis:
                if batch_dir:
                    manager.log_error(batch_dir, custom_id, 'PARSE_ERROR', 'Could not parse tool_use')
                errored += 1
                processed += 1
                continue

            # Get document info for saving
            doc_result = conn.execute(
                "SELECT title, url, content FROM regulatory_documents WHERE id = %s",
                (doc_id,)
            ).fetchone()

            if doc_result:
                reg_data = RegulationData(
                    url=doc_result[1] or '',
                    title=doc_result[0] or '',
                    content=doc_result[2] or '',
                    url_type='regulation',
                    source_index=doc_id,
                )

                analysis_id = save_analysis_to_database(conn, reg_data, analysis, state)
                if analysis_id:
                    total_analyses += 1
                    succeeded += 1
                else:
                    errored += 1
            else:
                errored += 1

        except Exception as e:
            if batch_dir:
                manager.log_error(batch_dir, custom_id, 'ERROR', str(e))
            errored += 1

        processed += 1

        # Progress update
        if processed % 50 == 0 or processed == total_expected:
            from shared_utils import format_time
            elapsed = time_module.time() - start_time
            pct = (processed / total_expected * 100) if total_expected > 0 else 0
            eta = (elapsed / processed * (total_expected - processed)) if processed > 0 else 0
            print(f"      [{processed}/{total_expected}] ({pct:.1f}%) | {total_analyses} saved | ETA: {format_time(eta)}")

    conn.close()

    # Update batch info
    if batch_dir:
        info_file = batch_dir / 'batch_info.json'
        if info_file.exists():
            with open(info_file) as f:
                batch_info = json.load(f)
            batch_info['status'] = 'processed'
            batch_info['processed_at'] = datetime.now().isoformat()
            batch_info['analyses_saved'] = total_analyses
            batch_info['succeeded'] = succeeded
            batch_info['errored'] = errored
            with open(info_file, 'w') as f:
                json.dump(batch_info, f, indent=2)

    # Refresh stats
    print("[3/3] Refreshing hierarchy stats...")
    try:
        conn = get_db_connection()
        if conn:
            from shared_utils import refresh_analysis_stats
            refresh_analysis_stats(conn, state)
            conn.close()
    except Exception as e:
        print(f"      ⚠️  Could not refresh stats: {e}")

    print()
    print("=" * 70)
    print("PROCESSING COMPLETE")
    print("=" * 70)
    print(f"Analyses saved: {total_analyses}")
    print(f"Succeeded: {succeeded}")
    if errored > 0:
        print(f"Errors: {errored}")
        if batch_dir:
            print(f"See: {batch_dir / 'errors.log'}")
    print()


async def main():
    """Main execution function"""

    # Parse arguments
    args = parse_arguments()

    # Handle --process-batch (doesn't need other args)
    if args.process_batch:
        state = args.state or 'NY'
        process_batch_results(args.process_batch, state)
        return

    # Set random seed for reproducibility
    random.seed(args.seed)

    # Initialize async OpenAI client
    client = get_async_openai_client()

    # Determine state for DB operations
    state = getattr(args, 'state', None) or 'NY'

    # Load regulations - from DB if state specified, otherwise from JSON
    if args.state:
        print(f"Loading regulations from database...")
        print(f"  State: {args.state}")
        if args.title:
            print(f"  Title: {args.title}")
        if args.chapter:
            print(f"  Chapter: {args.chapter}")
        if getattr(args, 'subchapter', None):
            print(f"  Subchapter: {args.subchapter}")
        if getattr(args, 'part', None):
            print(f"  Part: {args.part}")

        docs = get_filtered_documents(
            state=args.state,
            title=args.title,
            chapter=args.chapter,
            subchapter=getattr(args, 'subchapter', None),
            part=getattr(args, 'part', None),
            hierarchy_level='section',
            limit=args.sample_size,
        )

        if not docs:
            print("No documents found matching criteria!")
            return

        print(f"  Found {len(docs)} documents")

        # Skip already-processed if requested
        if getattr(args, 'skip_done', False):
            already_done = get_already_analyzed_ids(args.state)
            before_count = len(docs)
            docs = [d for d in docs if d['id'] not in already_done]
            skipped = before_count - len(docs)
            if skipped > 0:
                print(f"  Skipped {skipped} already-analyzed documents")
            print(f"  {len(docs)} documents to analyze")

        if not docs:
            print("All matching documents already analyzed!")
            return

        # Dry run
        if getattr(args, 'dry_run', False):
            print("\nDRY RUN - Would analyze these documents:")
            for i, doc in enumerate(docs[:10], 1):
                print(f"  {i}. [{doc['id']}] {doc['title'][:60]}")
            if len(docs) > 10:
                print(f"  ... and {len(docs) - 10} more")
            return

        # Convert to RegulationData
        prefix = 'njac' if args.state == 'NJ' else 'nycrr'
        regulations = []
        for doc in docs:
            regulations.append(RegulationData(
                url=doc.get('url', ''),
                title=doc.get('title', ''),
                content=doc.get('content', ''),
                url_type='regulation',
                source_index=doc.get('id', 0),  # Use DB id as source_index
                hierarchy_level=doc.get('hierarchy_level'),
                hierarchy_path=doc.get('hierarchy_path'),
                nycrr_title=doc.get(f'{prefix}_title'),
                nycrr_part=doc.get(f'{prefix}_part'),
                nycrr_subpart=doc.get(f'{prefix}_subpart'),
                nycrr_section=doc.get(f'{prefix}_section'),
            ))
    else:
        # Legacy JSON file mode
        print(f"Loading regulations from JSON files...")
        sample_size = args.sample_size or 100
        print(f"  Target: {sample_size} total")
        print(f"  Categories: {', '.join(args.categories) if 'all' not in args.categories else 'all'}")

        regulations = load_regulations_multi_category(
            str(INDIVIDUAL_REGULATIONS_DIR),
            CATEGORY_KEYWORDS,
            sample_size,
            selected_categories=args.categories if 'all' not in args.categories else None
        )

    print(f"Loaded {len(regulations)} regulations")

    if not regulations:
        print("No regulations found!")
        return

    # Print category distribution
    category_dist = {}
    for reg in regulations:
        cat = reg.primary_category or "unknown"
        category_dist[cat] = category_dist.get(cat, 0) + 1

    print(f"\nSampling distribution:")
    for cat, count in sorted(category_dist.items()):
        print(f"  {cat}: {count}")

    # Handle batch API mode
    if getattr(args, 'use_batch_api', False):
        print()
        print("=" * 70)
        print("BATCH API SUBMISSION")
        print("=" * 70)

        batch_id = submit_batch_api(
            regulations,
            state=state,
            title=args.title if hasattr(args, 'title') else None
        )

        print()
        print("=" * 70)
        print("BATCH SUBMITTED")
        print("=" * 70)
        print(f"Batch ID: {batch_id}")
        print(f"Requests: {len(regulations)}")
        print()
        print("Batch processing takes up to 24 hours (50% cheaper).")
        print()
        print("Check status:")
        print(f"  python red_flags.py --state {state} --process-batch {batch_id}")
        print()
        return

    # Set output file name upfront for incremental saves
    OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
    output_file = str(OUTPUTS_DIR / f"red_flag_analysis_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json")

    # Get database connection if needed
    db_conn = None
    if not args.no_database:
        db_conn = get_db_connection()

    try:
        # Analyze regulations (batch_size controls parallelism)
        print(f"\nStarting red flag analysis (batch_size={args.batch_size})...")
        results = await analyze_regulations_batch(
            regulations,
            client,
            output_file,
            batch_size=args.batch_size,
            db_conn=db_conn
        )

        # Final save
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
        print(f"\nAnalysis complete!")
        print(f"  📄 JSON: {output_file}")
        if db_conn:
            print(f"  💾 Database: See database write status below")

        # Auto-copy to web app public directory
        web_data_path = WEB_PUBLIC_DIR / "data.json"
        web_data_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(output_file, web_data_path)
        print(f"📦 Copied to {web_data_path}")

        # Print summary statistics
        num_with_flags = sum(1 for r in results if r['num_flags'] > 0)
        num_high_severity = sum(1 for r in results if r['max_severity'] >= 9)
        num_medium_severity = sum(1 for r in results if 7 <= r['max_severity'] <= 8)

        # Category summary
        print(f"\n=== Analysis Summary ===")
        print(f"Total regulations analyzed: {len(results)}")
        print(f"Regulations with red flags: {num_with_flags}")
        print(f"Regulations with high severity (9-10): {num_high_severity}")
        print(f"Regulations with medium severity (7-8): {num_medium_severity}")
        print(f"\nJSON output: {output_file}")

        if num_with_flags > 0:
            # Flags by category
            print(f"\nRed flags by category:")
            category_flags = {}
            for r in results:
                for flag in r.get('red_flags', []):
                    cat = flag['category']
                    category_flags[cat] = category_flags.get(cat, 0) + 1

            for cat in sorted(category_flags.keys()):
                print(f"  {cat}: {category_flags[cat]}")

        # Refresh analysis stats (aggregate flags to parent documents)
        if db_conn:
            try:
                print("\n=== Refreshing Analysis Stats ===")
                from refresh_hierarchy_stats import refresh_analysis_stats
                refresh_analysis_stats(db_conn, args.state.upper())
            except Exception as e:
                print(f"⚠️ Failed to refresh analysis stats: {e}")
                print(f"  Run manually: python scripts/refresh_hierarchy_stats.py --state {args.state.upper()} --analysis")

    finally:
        if db_conn:
            try:
                db_conn.close()
            except:
                pass

if __name__ == "__main__":
    asyncio.run(main())