#!/usr/bin/env python3
"""
Red Flag Analysis Script for New York State Regulations

This script processes individual regulation JSON files and uses GPT-5 mini with structured output
to identify regulatory "red flags" based on the patterns identified by Jennifer Pahlka.
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
import openai
from openai import AsyncOpenAI
from dotenv import load_dotenv
import asyncio
from datetime import datetime
import psycopg
from psycopg import Connection

# Add parent directory to path for config import
sys.path.insert(0, str(Path(__file__).parent.parent))
from config import INDIVIDUAL_REGULATIONS_DIR, WEB_PUBLIC_DIR, PROJECT_ROOT

# Load environment variables from project root
load_dotenv(PROJECT_ROOT / '.env')

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

        # Get all sampled file paths
        sampled_paths = {reg.url for reg in selected_regulations}

        # Try to sample from under-quota categories
        for category in categories_config.keys():
            if remaining_quota <= 0:
                break

            available_files = [f for f in category_files[category]
                             if f not in sampled_paths]

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
                        sampled_paths.add(regulation_data.url)
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
    """
    prompt = f"""Analyze this regulation section for implementation complexity using Jennifer Pahlka's framework from "Recoding America".

SECTION INFO:
Citation: {citation}
Heading: {heading}

SECTION TEXT:
{section_text}"""

    prompt += """

---

ANALYSIS FRAMEWORK - 12 CATEGORIES:

1. COMPLEXITY_POLICY_DEBT - Cross-reference spaghetti, accreted conditions
   RED FLAG EXAMPLE: "meets criteria in section 202(b)(3)(A)(ii); satisfies 26 U.S.C. 3304(a)(1)(B)"
   BETTER: "household income is below 150% of federal poverty level"
   DETECT: 3+ cross-references to other sections/USC in a single requirement, or subsection chains 3+ levels deep (e.g., §1-2(a)(3)(B)(ii)), or compound conditions requiring navigation across multiple external sources

2. OPTIONS_BECOME_REQUIREMENTS - Suggestion lists become checklists
   RED FLAG EXAMPLE: "may include...all controls identified in NIST Special Publication 800-53"
   BETTER: "shall adopt controls proportionate to data sensitivity...not required to adopt every listed control"
   DETECT: "may include" followed by exhaustive lists (5+ items) without prioritization, or "may consider" followed by "all of the following", or suggestion language combined with comprehensive external standards

3. POLICY_IMPLEMENTATION_SEPARATION - Waterfall, vendor lock-in
   RED FLAG EXAMPLE: "shall establish through contracts with private entities...shall not directly develop or operate"
   BETTER: "shall designate accountable official responsible for how service works...may use contractors but retain ability to change"
   DETECT: Explicit prohibition on government operation/development, mandatory use of specific vendor types, or separation of policy design from implementation responsibility

4. OVERWROUGHT_LEGALESE - Dense definitions that make forms impossible
   RED FLAG EXAMPLE: "gross unearned income as defined in subsection (k)(2)(B)...per Internal Revenue Code §152"
   BETTER: "ask in plain language about money from work and other sources like Social Security, pensions"
   DETECT: Tax code references, nested definitions, legalese that can't be translated to plain forms

5. CASCADE_OF_RIGIDITY - Conflicting absolute goals
   RED FLAG EXAMPLE: "shall maximize access AND minimize improper payments AND ensure uniform administration AND promote personal responsibility AND avoid any potential misuse"
   BETTER: "main goals: (1) people who qualify can get benefits, (2) limit serious abuse. Balance: don't reduce access unless preventing larger harm"
   DETECT: Multiple unprioritized absolute goals, "comply with all applicable", "ensure", "maximize", "minimize" without trade-offs

6. MANDATED_STEPS_NOT_OUTCOMES - Procedure-heavy vs outcome-focused
   RED FLAG EXAMPLE: "require Form X-100 in PDF format...upload all documents in PDF...issue decision within 90 days of receipt of completed Form X-100"
   BETTER: "decide 90% of complete applications within 10 days...may change forms and formats to improve use"
   DETECT: Hard-coded forms/formats, specific tech requirements (PDF, portals, CMS), step checklists instead of metrics

7. ADMINISTRATIVE_BURDENS - Friction: notaries, wet signatures, in-person
   RED FLAG EXAMPLE: "certified birth certificate...notarized affidavit...appear in person every 3 months...original documents...satisfied within 7 days failing which application shall be denied"
   BETTER: "accept any reasonable proof...use existing government records...recertify by mail/online/phone...30 days to respond...multiple contact attempts before denial"
   DETECT: "notarized", "certified", "original", "in person", "wet signature", "appear", "sworn", recurring appearances, unrealistic deadlines, denial by default

8. NO_FEEDBACK_LOOPS - One-shot design, no iteration
   RED FLAG EXAMPLE: "program authorized for 10 years...Comptroller General shall submit report after 9 years"
   BETTER: "Secretary may run pilots to simplify forms...track completion rates and time to decision...if trial helps people get benefits without major errors, extend nationwide...regularly ask frontline staff which rules cause problems"
   DETECT: No pilot authority, no iteration language, one final report, no user testing, no field feedback mechanisms

9. PROCESS_WORSHIP_OVERSIGHT - Compliance-only audits
   RED FLAG EXAMPLE: "Inspector General shall audit compliance with each requirement...report any deviations however minor...any employee authorizing deviation may be subject to disciplinary action"
   BETTER: "IG shall examine whether program reaches qualifying people AND whether rules are reasonable...when agency departs from procedures, consider whether change helped people get benefits or solved documented problem"
   DETECT: Audit "all requirements", punish "any deviation", no outcome focus, blame-oriented language

10. ZERO_RISK_LANGUAGE - Impossible absolutes
    RED FLAG EXAMPLE: "shall take all necessary measures to ensure that no improper payments occur...ensure that no unauthorized access ever occurs"
    BETTER: "use reasonable steps to reduce errors and abuse, recognizing eliminating every small error would keep qualifying people from help...manage security so serious breaches are unlikely and systems remain available"
    DETECT: "ensure no X occurs", "never", "all necessary measures", "zero", absolutes that ignore trade-offs

11. FROZEN_TECHNOLOGY - Hard-coded architectures, formats, platforms
    RED FLAG EXAMPLE: "create website at www.benefits2025.gov using commercial CMS and enterprise service bus architecture...provide downloadable PDF forms...optimized for desktop web browsers"
    BETTER: "provide online service on .gov domain that allows people to see eligibility, apply, check status...usable on mobile devices...Secretary may change underlying technology"
    DETECT: Named systems/architectures (ESB, specific CMS), hard-coded formats (PDF only), specific URLs, browser requirements, vendor names

12. IMPLEMENTATION_OPPORTUNITY - POSITIVE patterns
    GOOD EXAMPLES:
    - "decide 90% of applications within 10 days" (concrete delivery metric)
    - "Secretary shall design forms so most people can complete on mobile phone" (burden reduction)
    - "Secretary may test simpler ways and keep versions that help qualifying people" (iteration authority)
    - "every 5 years review rules and recommend which can be removed because they add steps without improving results" (cleanup)
    - "identify groups where qualifying people aren't getting benefits and propose changes to close gaps" (outcome focus)
    DETECT: Plain language mandates, concrete metrics, burden reduction, pilot authority, outcome focus, regular cleanup

---

REPORTING REQUIREMENTS DETECTION:

Check if the regulation creates any reporting requirements (binary flag):
- "shall report...", "must submit reports...", "shall file...", "shall provide reports..."
- "shall submit annual/quarterly/monthly reports to..."
- "shall notify...", "shall inform...", "shall document and report..."
- "shall issue reports...", "shall maintain records and report..."

EXAMPLES THAT TRIGGER REPORTING FLAG:
- "shall submit quarterly reports to the Commissioner detailing..."
- "must file annual compliance reports with the Department"
- "shall report all incidents within 24 hours"
- "shall notify stakeholders of policy changes"
- "shall maintain documentation and provide annual reports"

EXAMPLES THAT DON'T:
- "shall follow procedures" (procedural requirement, not reporting)
- "shall maintain records" (recordkeeping only, not reporting)
- "shall consider factors" (analytical requirement, not reporting)

has_reporting_requirement: true if section creates any requirement to submit, file, report, or notify; false otherwise.

---

IMPORTANT: Only flag issues that are CLEAR and SUBSTANTIVE matches to the patterns described above.
- Do not flag minor or tangential instances
- Require strong evidence in the matched_phrases
- Be conservative and precise in classifications
- Avoid over-interpreting routine legal language as problematic
- Focus on patterns that would genuinely create implementation barriers or burdens

For each issue found, provide:
- explanation: [why this creates implementation burden or opportunity, 50-200 chars]
- severity: [1-10 scale where 1-3=LOW, 4-6=MEDIUM, 7-10=HIGH]
- complexity: [HIGH | MEDIUM | LOW based on implementation difficulty]
- matched_phrases: [1-20 exact quotes from section text that demonstrate the issue]
- implementation_approach: [how to implement this better, or what approach is needed]
- effort_estimate: [rough estimate of implementation difficulty/timeline, optional]

Overall assessment:
- has_implementation_issues: true if section has ANY category 1-11 issues (false if only category 12 or no issues)
- overall_complexity: [HIGH | MEDIUM | LOW based on highest individual complexity, null if no issues]
- summary: [2-3 sentences about main implementation concerns or opportunities]
- requires_technical_review: true if section needs architects/engineers to design implementation approach
- has_reporting_requirement: true if section creates reporting/filing/notification requirements, false otherwise

Return VALID JSON with red_flags as an array of objects (each with a category field), plus the overall assessment fields.

Example output:
{
  "has_implementation_issues": true,
  "red_flags": [
    {
      "category": "complexity_policy_debt",
      "explanation": "Contains 47 cross-references making it impossible to follow",
      "severity": 8,
      "complexity": "HIGH",
      "matched_phrases": ["See section 4.1.2(a)(3)"],
      "implementation_approach": "Consolidate into clear statements",
      "text_examples": ["meets criteria in section 202(b)(3)"]
    }
  ],
  "overall_complexity": "HIGH",
  "summary": "Has cross-reference and legalese issues.",
  "requires_technical_review": true,
  "has_reporting_requirement": true
}"""

    return prompt

def get_db_connection() -> Optional[Connection]:
    """Create connection to Neon PostgreSQL

    Returns:
        Connection object or None if connection fails
    """
    try:
        database_url = os.getenv("DATABASE_URL")
        if not database_url:
            print("Warning: DATABASE_URL not set in .env, skipping database writes")
            return None
        conn = psycopg.connect(database_url, connect_timeout=30)
        print("✓ Connected to database")
        return conn
    except Exception as e:
        print(f"Warning: Database connection failed: {e}")
        print("  Continuing with JSON-only mode...")
        return None

def save_analysis_to_database(conn: Connection,
                             regulation: RegulationData,
                             analysis: RegulationAnalysis) -> Optional[int]:
    """Save regulation analysis to database

    Args:
        conn: Database connection
        regulation: Regulation data
        analysis: Analysis results

    Returns:
        analysis_id if successful, None otherwise
    """
    try:
        with conn.cursor() as cur:
            # 1. Insert/Update regulatory_documents
            cur.execute("""
                INSERT INTO regulatory_documents
                (source_index, type, state, title, url, url_type, content,
                 hierarchy_level, hierarchy_path, nycrr_title, nycrr_part, nycrr_section)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (state, source_index, type) DO UPDATE SET
                    title = EXCLUDED.title,
                    url = EXCLUDED.url,
                    content = EXCLUDED.content
                RETURNING id
            """, (
                regulation.source_index, "regulation", "NY",
                regulation.title, regulation.url, regulation.url_type,
                regulation.content, regulation.hierarchy_level,
                regulation.hierarchy_path, regulation.nycrr_title,
                regulation.nycrr_part, regulation.nycrr_section
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
                doc_id, "gpt-5-nano-2025-08-07",
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

    try:
        prompt = create_analysis_prompt(
            section_text=regulation_data.content,
            citation=regulation_data.url,
            heading=regulation_data.title
        )

        response = await client.beta.chat.completions.parse(
            model="gpt-5-nano-2025-08-07",
            messages=[
                {"role": "system", "content": prompt}
            ],
            response_format=RegulationAnalysis
        )

        analysis = response.choices[0].message.parsed
        return analysis

    except Exception as e:
        print(f"Error analyzing regulation {regulation_data.source_index}: {e}")
        # Return a default analysis in case of error
        return RegulationAnalysis(
            has_implementation_issues=False,
            red_flags=[],
            overall_complexity=None,
            summary=None,
            requires_technical_review=False,
            has_reporting_requirement=False
        )

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
                if analysis_id:
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
        description='Analyze NY regulations for red flags with multi-category sampling'
    )

    parser.add_argument(
        '--sample-size', '-n',
        type=int,
        default=100,
        help='Total number of regulations to analyze (default: 100)'
    )

    parser.add_argument(
        '--categories',
        nargs='+',
        choices=['housing', 'child_care', 'permitting', 'all'],
        default=['all'],
        help='Categories to include (default: all three)'
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

    return parser.parse_args()

async def main():
    """Main execution function"""

    # Parse arguments
    args = parse_arguments()

    # Initialize async OpenAI client
    client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    # Load regulations with balanced multi-category sampling
    print(f"Loading regulations with balanced multi-category sampling...")
    print(f"  Target: {args.sample_size} total")
    print(f"  Categories: {', '.join(args.categories) if 'all' not in args.categories else 'all'}")

    regulations = load_regulations_multi_category(
        "individual_regulations",
        CATEGORY_KEYWORDS,
        args.sample_size,
        selected_categories=args.categories if 'all' not in args.categories else None
    )

    print(f"Loaded {len(regulations)} regulation files")

    if not regulations:
        print("No regulation files found!")
        return

    # Print category distribution
    category_dist = {}
    for reg in regulations:
        cat = reg.primary_category or "unknown"
        category_dist[cat] = category_dist.get(cat, 0) + 1

    print(f"\nSampling distribution:")
    for cat, count in sorted(category_dist.items()):
        print(f"  {cat}: {count}")

    # Set output file name upfront for incremental saves
    output_file = f"red_flag_analysis_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"

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

    finally:
        if db_conn:
            try:
                db_conn.close()
            except:
                pass

if __name__ == "__main__":
    asyncio.run(main())