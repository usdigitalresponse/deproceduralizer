#!/usr/bin/env python3
"""
Red Flag Analysis Script for New York State Regulations

This script processes individual regulation JSON files and uses GPT-5 mini with structured output
to identify regulatory "red flags" based on the patterns identified by Jennifer Pahlka.
"""

import json
import os
import shutil
from pathlib import Path
from typing import List, Optional, Dict
from enum import Enum
from pydantic import BaseModel
import openai
from openai import AsyncOpenAI
from dotenv import load_dotenv
import asyncio
from datetime import datetime

# Load environment variables
load_dotenv()

class ComplexityLevel(str, Enum):
    """Complexity levels for implementation issues"""
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class RedFlagCategory(str, Enum):
    """12 implementation complexity categories based on Jennifer Pahlka's framework"""

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
    category: str  # Category name
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

def create_analysis_prompt(regulations: List[Dict] = None, section_title: str = "") -> str:
    """
    Build comprehensive Pahlka implementation analysis prompt for a whole section/part.

    Args:
        regulations: List of regulation dicts with title, url, content
        section_title: Title of the section/part being analyzed
    """
    # Build section text with all regulations grouped
    section_text = ""
    if regulations:
        for i, reg in enumerate(regulations, 1):
            section_text += f"\n--- REGULATION {i} ---\n"
            section_text += f"Citation: {reg.get('url', '')}\n"
            section_text += f"Title: {reg.get('title', '')}\n"
            section_text += f"Content:\n{reg.get('content', '')}\n"

    prompt = f"""Analyze this section of New York State regulations for implementation complexity using Jennifer Pahlka's framework from "Recoding America".

SECTION INFO:
{section_title}

FULL SECTION TEXT WITH ALL SUBSECTIONS:
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

async def analyze_section(regulations: List[Dict], section_title: str, client: AsyncOpenAI) -> Dict:
    """Analyze a whole section of regulations for red flags using GPT-5 nano with structured output

    Args:
        regulations: List of regulation dicts (all from the same section)
        section_title: Title describing this section/part
        client: AsyncOpenAI client

    Returns:
        Dict with analysis results and source regulation metadata
    """

    try:
        prompt = create_analysis_prompt(
            regulations=regulations,
            section_title=section_title
        )

        response = await client.beta.chat.completions.parse(
            model="gpt-5-nano-2025-08-07",
            messages=[
                {"role": "system", "content": prompt}
            ],
            response_format=RegulationAnalysis
        )

        analysis = response.choices[0].message.parsed

        # Return analysis with all source regulations included
        return {
            'analysis': analysis,
            'regulations': regulations,
            'section_title': section_title
        }

    except Exception as e:
        print(f"Error analyzing section {section_title}: {e}")
        # Return a default analysis in case of error
        default_analysis = RegulationAnalysis(
            has_implementation_issues=False,
            red_flags=[],
            overall_complexity=None,
            summary=None,
            requires_technical_review=False,
            has_reporting_requirement=False
        )
        return {
            'analysis': default_analysis,
            'regulations': regulations,
            'section_title': section_title
        }

def load_all_regulation_files(directory: str) -> List[Dict]:
    """Load ALL regulation JSON files from directory

    Args:
        directory: Path to directory containing regulation JSON files

    Returns:
        List of regulation dicts with their JSON data
    """

    regulation_files = list(Path(directory).glob("*.json"))
    regulations = []

    for file_path in regulation_files:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                regulations.append(data)

        except Exception as e:
            print(f"Error loading {file_path}: {e}")
            continue

    return regulations


def filter_regulations_by_keyword(regulations: List[Dict], filter_keyword: str) -> List[Dict]:
    """Filter regulations by keyword in title or content

    Args:
        regulations: List of regulation dicts
        filter_keyword: Keyword to search for (e.g., 'housing', 'tenant')

    Returns:
        List of regulations matching the keyword
    """
    filtered = []

    for reg in regulations:
        title = reg.get('title', '').lower()
        content = reg.get('content', '').lower()
        if filter_keyword.lower() in title or filter_keyword.lower() in content:
            filtered.append(reg)

    return filtered


def group_regulations_by_section(regulations: List[Dict]) -> Dict[str, List[Dict]]:
    """Group regulations by their NYCRR part (section)

    Groups regulations by their NYCRR Title and Part to analyze whole sections together.
    All regulations must have NYCRR metadata populated.

    Args:
        regulations: List of regulation dicts

    Returns:
        Dict mapping section keys (Title-X-Part-Y) to lists of regulations in that section
    """
    sections = {}
    missing_hierarchy = []

    for reg in regulations:
        nycrr_title = reg.get('nycrr_title')
        nycrr_part = reg.get('nycrr_part')

        # Require NYCRR information for grouping
        if not nycrr_title or not nycrr_part:
            missing_hierarchy.append({
                'source_index': reg.get('source_index'),
                'title': reg.get('title'),
                'nycrr_title': nycrr_title,
                'nycrr_part': nycrr_part,
                'parent_source_index': reg.get('parent_source_index')
            })
            continue

        section_key = f"Title-{nycrr_title}-Part-{nycrr_part}"

        if section_key not in sections:
            sections[section_key] = []

        sections[section_key].append(reg)

    # Report any regulations that couldn't be grouped
    if missing_hierarchy:
        print(f"\n⚠️  WARNING: {len(missing_hierarchy)} regulations missing NYCRR hierarchy info (skipping these):")
        for reg in missing_hierarchy[:5]:  # Show first 5
            print(f"   - Source {reg['source_index']}: {reg['title'][:50]}...")
        if len(missing_hierarchy) > 5:
            print(f"   ... and {len(missing_hierarchy) - 5} more")
        print()

    return sections


def get_sections_for_regulations(all_sections: Dict[str, List[Dict]], target_regulations: List[Dict]) -> Dict[str, List[Dict]]:
    """Get full sections that contain at least one of the target regulations

    Args:
        all_sections: Dict of all sections with all their regulations
        target_regulations: List of regulations to match against (e.g., filtered by keyword)

    Returns:
        Dict of sections that contain at least one target regulation, with ALL their regulations
    """
    # Build a set of section keys that contain at least one target regulation
    target_section_keys = set()

    for target_reg in target_regulations:
        nycrr_title = target_reg.get('nycrr_title')
        nycrr_part = target_reg.get('nycrr_part')

        if nycrr_title and nycrr_part:
            section_key = f"Title-{nycrr_title}-Part-{nycrr_part}"
            target_section_keys.add(section_key)

    # Return full sections for all matched keys
    matching_sections = {
        key: regs for key, regs in all_sections.items()
        if key in target_section_keys
    }

    return matching_sections


def sample_sections(sections: Dict[str, List[Dict]], sample_size: int = 100) -> Dict[str, List[Dict]]:
    """Sample N sections from the available sections

    Args:
        sections: Dict of sections
        sample_size: Number of sections to sample

    Returns:
        Dict of sampled sections
    """
    import random

    section_keys = list(sections.keys())
    sampled_keys = random.sample(section_keys, min(sample_size, len(section_keys)))

    return {key: sections[key] for key in sampled_keys}

async def analyze_sections_batch(sections: Dict[str, List[Dict]], client: AsyncOpenAI, output_file: str, batch_size: int = 5) -> List[Dict]:
    """Analyze sections of regulations in parallel, saving progress periodically

    Args:
        sections: Dict mapping section keys to lists of regulations
        client: AsyncOpenAI client
        output_file: Path to save results
        batch_size: Number of sections to process in parallel at once

    Returns:
        List of analysis results with source regulation data
    """

    results = []
    completed_count = 0
    section_items = list(sections.items())

    # Process sections in batches for controlled parallelism
    for batch_start in range(0, len(section_items), batch_size):
        batch = section_items[batch_start:batch_start + batch_size]
        print(f"Processing batch {batch_start // batch_size + 1} ({len(batch)} sections)...")

        # Create tasks for parallel execution of sections
        tasks = [
            analyze_section(section_regs, section_key, client)
            for section_key, section_regs in batch
        ]
        section_results = await asyncio.gather(*tasks)

        # Process results from this batch
        for section_result in section_results:
            analysis = section_result['analysis']
            regulations = section_result['regulations']
            section_title = section_result['section_title']

            # Keep red_flags as actual array for JSON output
            red_flags_list = [{
                'category': flag.category,
                'explanation': flag.explanation,
                'severity': flag.severity,
                'complexity': flag.complexity,
                'matched_phrases': flag.matched_phrases,
                'implementation_approach': flag.implementation_approach,
                'effort_estimate': flag.effort_estimate,
                'text_examples': flag.text_examples
            } for flag in analysis.red_flags] if analysis.red_flags else []

            # Create result row for this section
            row = {
                'section_title': section_title,
                'num_regulations': len(regulations),
                'source_indices': [reg.get('source_index') for reg in regulations],
                'regulations': regulations,
                # Analysis fields (apply to whole section)
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

            # Format severity summary for console output
            if analysis.red_flags:
                flag_summary = ', '.join([f"{flag.category}:{flag.severity}" for flag in analysis.red_flags])
                print(f"  {section_title[:60]}... 🚩 {len(analysis.red_flags)} flags ({flag_summary})")
            else:
                print(f"  {section_title[:60]}... No flags")

        # Save to JSON after each batch
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
        print(f"  💾 Saved progress ({completed_count} sections) to {output_file}")

    return results

async def main(filter_keyword: str = None):
    """Main execution function

    Args:
        filter_keyword: Optional keyword to filter regulations (e.g., 'housing')
    """

    # Initialize async OpenAI client
    client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    # Step 1: Load ALL regulations
    print("Loading all regulation files...")
    all_regulations = load_all_regulation_files("individual_regulations")
    print(f"Loaded {len(all_regulations)} total regulations")

    # Step 2: Filter by keyword if specified
    if filter_keyword:
        print(f"Filtering for '{filter_keyword}'...")
        filtered_regulations = filter_regulations_by_keyword(all_regulations, filter_keyword)
        print(f"Found {len(filtered_regulations)} regulations matching '{filter_keyword}'")
    else:
        filtered_regulations = all_regulations
        print("No filter keyword provided - using all regulations")

    if not filtered_regulations:
        print("No regulations matched the filter!")
        return

    # Step 3: Group ALL regulations by section
    print("Grouping all regulations by section...")
    all_sections = group_regulations_by_section(all_regulations)
    print(f"Found {len(all_sections)} total sections")

    # Step 4: Get sections containing at least one filtered regulation
    if filter_keyword:
        print(f"Finding sections that contain '{filter_keyword}' regulations...")
        matching_sections = get_sections_for_regulations(all_sections, filtered_regulations)
        print(f"Found {len(matching_sections)} sections containing '{filter_keyword}'")
    else:
        matching_sections = all_sections
        print(f"Using all {len(matching_sections)} sections")

    # Step 5: Sample 100 sections
    print("Sampling 100 sections...")
    sampled_sections = sample_sections(matching_sections, sample_size=100)
    sampled_count = len(sampled_sections)
    total_regs_in_sample = sum(len(regs) for regs in sampled_sections.values())
    print(f"Sampled {sampled_count} sections containing {total_regs_in_sample} regulations total")

    # Set output file name upfront for incremental saves
    output_file = f"red_flag_analysis_{filter_keyword}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json" if filter_keyword else f"red_flag_analysis_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"

    # Step 6: Analyze sampled sections
    print(f"Starting red flag analysis on {sampled_count} sampled sections...")
    results = await analyze_sections_batch(sampled_sections, client, output_file, batch_size=5)

    # Final save
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"Analysis complete! Results saved to {output_file}")

    # Auto-copy to web app public directory
    web_data_path = Path("apps/web/public/data.json")
    web_data_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy(output_file, web_data_path)
    print(f"📦 Copied to {web_data_path}")

    # Print summary statistics
    num_with_flags = sum(1 for r in results if r['num_flags'] > 0)
    num_high_severity = sum(1 for r in results if r['max_severity'] >= 9)
    num_medium_severity = sum(1 for r in results if 7 <= r['max_severity'] <= 8)
    total_regulations = sum(r['num_regulations'] for r in results)

    print(f"\nTotal sections analyzed: {len(results)}")
    print(f"Total regulations in sections: {total_regulations}")
    print(f"Sections with red flags: {num_with_flags}")
    print(f"Sections with high severity (9-10): {num_high_severity}")
    print(f"Sections with medium severity (7-8): {num_medium_severity}")
    print(f"Results saved to: {output_file}")

if __name__ == "__main__":
    import sys

    filter_keyword = None
    if len(sys.argv) > 1:
        filter_keyword = sys.argv[1]

    asyncio.run(main(filter_keyword=filter_keyword))