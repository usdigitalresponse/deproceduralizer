#!/usr/bin/env python3
"""
Search for wet signature requirements in NJ regulations and analyze with LLM.

Pipeline:
1. Regex search for signature-related terms
2. Extract N.J.S.A. statute references
3. Look up statute text for each reference
4. LLM analysis to determine:
   - Is there actually a wet signature requirement?
   - What's the exact quote?
   - Does the requirement come from statute or agency interpretation?
"""

import json
import sys
import asyncio
from pathlib import Path
import re
import argparse
from typing import Optional, List
from enum import Enum
from pydantic import BaseModel, Field
from dotenv import load_dotenv

# Add parent directory to path for config import
sys.path.insert(0, str(Path(__file__).parent.parent))
from config import (
    NJ_INDIVIDUAL_REGULATIONS_DIR,
    DATA_DIR,
    OUTPUTS_DIR,
    PROJECT_ROOT,
)
from shared_utils import get_async_openai_client, call_llm_parse_async

# Load environment variables
load_dotenv(PROJECT_ROOT / '.env')

# Model version imported from shared_utils for centralized management
from shared_utils import DEFAULT_MODEL as MODEL_VERSION

# Terms that might indicate wet/physical signature requirements
SIGNATURE_TERMS = [
    r"wet signature",
    r"original signature",
    r"ink signature",
    r"handwritten signature",
    r"physical signature",
    r"signed in ink",
    r"manually signed",
    r"hand-signed",
    r"pen and ink",
    r"original.{0,20}signature",
    r"signature.{0,20}original",
    r"notarized signature",
    r"signature.{0,20}notari",
    r"must be signed",
    r"shall be signed",
    r"signature required",
    r"in writing.{0,30}signed",
    r"signed.{0,20}in writing",
    r"facsimile.{0,20}not.{0,20}accept",
    r"electronic.{0,20}signature.{0,20}not",
    r"no electronic",
]

# Pattern for N.J.S.A. references
NJSA_PATTERN = re.compile(
    r'N\.J\.S\.A\.\s*(\d+[A-Za-z]?):(\d+[A-Za-z]?)-(\d+(?:\.\d+)?[a-z]?)',
    re.IGNORECASE
)


# =============================================================================
# PYDANTIC MODELS FOR LLM OUTPUT
# =============================================================================

class SignatureAnalysis(BaseModel):
    """LLM analysis of a potential wet signature requirement"""

    has_wet_signature_requirement: bool = Field(
        description="True ONLY if the regulation explicitly requires a wet, ink, handwritten, original, or physical signature. Generic phrases like 'shall be signed' or 'signature required' do NOT count - those allow electronic signatures. Must explicitly prohibit electronic signatures or require wet/ink/handwritten/original/physical."
    )
    requirement_quote: Optional[str] = Field(
        default=None,
        description="If has_wet_signature_requirement is true, the exact quote that establishes this. Otherwise null."
    )
    from_statute: Optional[bool] = Field(
        default=None,
        description="If has_wet_signature_requirement is true AND statute text was provided, does the wet signature requirement appear in the statute text? True if yes, False if the regulation adds it beyond what the statute requires, null if no statute provided or no wet signature requirement."
    )


# =============================================================================
# STATUTE HANDLING
# =============================================================================

class StatuteChecker:
    """Check and retrieve NJ statute information."""

    def __init__(self):
        self.statute_citations = set()
        self.statutes_by_citation = {}
        self._load_statutes()

    def _load_statutes(self):
        """Load statute data."""
        statutes_file = DATA_DIR / "nj_statutes_complete.json"
        if statutes_file.exists():
            with open(statutes_file, 'r') as f:
                statutes = json.load(f)
            self.statute_citations = {s['citation'] for s in statutes}
            self.statutes_by_citation = {s['citation']: s for s in statutes}
            print(f"Loaded {len(self.statute_citations)} NJ statutes")
        else:
            print(f"Warning: NJ statutes file not found at {statutes_file}")

    def get_statute_text(self, citation: str) -> Optional[dict]:
        """
        Get statute text and metadata for a citation.
        Tries exact match, then subsection fallbacks.
        """
        # Exact match
        if citation in self.statutes_by_citation:
            return self.statutes_by_citation[citation]

        # Try stripping trailing letter (subsection like 5.1b -> 5.1)
        base = re.sub(r'[a-z]$', '', citation)
        if base in self.statutes_by_citation:
            return self.statutes_by_citation[base]

        # Try stripping decimal portion (5.1 -> 5)
        base2 = re.sub(r'\.\d+[a-z]?$', '', citation)
        if base2 in self.statutes_by_citation:
            return self.statutes_by_citation[base2]

        return None

    def extract_references(self, content: str) -> list:
        """Extract all N.J.S.A. references from content."""
        refs = []
        for match in NJSA_PATTERN.finditer(content):
            citation = f"{match.group(1)}:{match.group(2)}-{match.group(3)}"
            refs.append(citation)
        return list(set(refs))

    def get_statute_context(self, citations: list, max_statutes: int = 5) -> str:
        """
        Build context string with statute text for LLM prompt.
        Limits to max_statutes to avoid token overflow.
        """
        if not citations:
            return ""

        context_parts = []
        found_count = 0

        for citation in citations[:max_statutes * 2]:  # Check more in case some missing
            if found_count >= max_statutes:
                break

            statute = self.get_statute_text(citation)
            if statute:
                found_count += 1
                content = statute.get('content', '')[:2000]  # Truncate long statutes
                context_parts.append(
                    f"N.J.S.A. {citation} - {statute.get('njsa_section_name', 'Unknown')}:\n{content}"
                )

        if not context_parts:
            return ""

        return "\n\n---\n\n".join(context_parts)


# =============================================================================
# SEARCH FUNCTION
# =============================================================================

def search_files(statute_checker: StatuteChecker) -> list:
    """Search NJ regulation files for signature terms."""

    data_dir = NJ_INDIVIDUAL_REGULATIONS_DIR

    if not data_dir.exists():
        print(f"Directory not found: {data_dir}")
        return []

    files = list(data_dir.glob("*.json"))
    print(f"Searching {len(files)} NJ files...")

    matches = []

    for f in files:
        try:
            with open(f, 'r') as fp:
                data = json.load(fp)

            content = data.get('content', '')
            content_lower = content.lower()
            title = data.get('title', '')
            url = data.get('url', '')

            for term in SIGNATURE_TERMS:
                if re.search(term, content_lower, re.IGNORECASE):
                    # Get context around match (larger for LLM)
                    match = re.search(f".{{0,300}}{term}.{{0,300}}", content, re.IGNORECASE)
                    context = match.group(0) if match else ""

                    # Extract statute references
                    refs = statute_checker.extract_references(content)

                    result = {
                        'file': f.name,
                        'title': title,
                        'url': url,
                        'term_matched': term,
                        'context': context.strip(),
                        'full_content': content,
                        'njac_title': data.get('njac_title'),
                        'njac_chapter': data.get('njac_chapter'),
                        'njac_section': data.get('njac_section'),
                        'hierarchy_path': data.get('hierarchy_path', ''),
                        'source_index': data.get('source_index'),
                        'statute_citations': refs,
                    }

                    matches.append(result)
                    break  # One match per file

        except Exception as e:
            continue

    print(f"Found {len(matches)} potential matches")
    return matches


# =============================================================================
# LLM ANALYSIS
# =============================================================================

def create_analysis_prompt(regulation: dict, statute_context: str) -> str:
    """Build prompt for LLM analysis."""

    prompt = f"""Does this New Jersey regulation require a WET SIGNATURE?

IMPORTANT: A "wet signature" requirement means the text EXPLICITLY requires one of:
- "wet signature"
- "original signature"
- "ink signature"
- "handwritten signature"
- "physical signature"
- "signed in ink"
- "manually signed"
- Explicit prohibition of electronic/digital/fax signatures

Generic phrases like "shall be signed", "must be signed", "signature required", or "bear the signature of" do NOT count as wet signature requirements. These allow electronic signatures under modern law.

REGULATION TEXT:
{regulation['context']}

"""

    if statute_context:
        prompt += f"""
STATUTE TEXT (N.J.S.A. references found in regulation):
{statute_context}

If there IS a wet signature requirement, check if it appears in the statute text above.
"""

    prompt += """
Answer:
1. has_wet_signature_requirement: Is there an EXPLICIT wet/ink/handwritten/original/physical signature requirement? (true/false)
2. requirement_quote: If true, the exact quote. If false, null.
3. from_statute: If true AND statute text provided, does the requirement come from the statute? (true/false/null)
"""

    return prompt


async def analyze_match(
    match: dict,
    statute_checker: StatuteChecker,
    client,
) -> dict:
    """Analyze a single match with LLM."""

    # Get statute context
    statute_context = statute_checker.get_statute_context(match['statute_citations'])

    # Build prompt
    prompt = create_analysis_prompt(match, statute_context)

    # Call LLM
    analysis = await call_llm_parse_async(
        client=client,
        prompt=prompt,
        response_format=SignatureAnalysis,
        model=MODEL_VERSION,
    )

    if analysis is None:
        print(f"  ⚠️ LLM analysis failed for {match['title'][:50]}...")
        return {
            **match,
            'llm_analysis': None,
            'analysis_error': True,
        }

    return {
        **match,
        'llm_analysis': analysis.model_dump(),
        'analysis_error': False,
    }


async def analyze_batch(
    matches: list,
    statute_checker: StatuteChecker,
    batch_size: int = 5,
) -> list:
    """Analyze matches in batches."""

    client = get_async_openai_client()
    results = []

    print(f"\nAnalyzing {len(matches)} matches with LLM...")

    for i in range(0, len(matches), batch_size):
        batch = matches[i:i + batch_size]
        print(f"  Batch {i // batch_size + 1}/{(len(matches) + batch_size - 1) // batch_size}...")

        tasks = [analyze_match(m, statute_checker, client) for m in batch]
        batch_results = await asyncio.gather(*tasks)
        results.extend(batch_results)

        # Save progress periodically
        if (i + batch_size) % 20 == 0:
            print(f"    Completed {min(i + batch_size, len(matches))}/{len(matches)}")

    return results


# =============================================================================
# OUTPUT
# =============================================================================

def print_results(results: list):
    """Print results to console."""
    print("\n" + "=" * 80)
    print("ANALYSIS RESULTS")
    print("=" * 80)

    # Summary stats
    total = len(results)
    with_requirement = sum(
        1 for r in results
        if r.get('llm_analysis', {}).get('has_wet_signature_requirement', False)
    )
    with_statute_refs = sum(1 for r in results if r.get('statute_citations'))
    from_statute = sum(
        1 for r in results
        if r.get('llm_analysis', {}).get('from_statute') is True
    )
    from_agency = sum(
        1 for r in results
        if r.get('llm_analysis', {}).get('has_wet_signature_requirement') and
           r.get('llm_analysis', {}).get('from_statute') is False
    )

    print(f"\nTotal regex matches searched: {total}")
    print(f"Actual wet signature requirements: {with_requirement}")
    print(f"  - With statute references: {with_statute_refs}")
    print(f"  - Requirement from statute: {from_statute}")
    print(f"  - Requirement from agency (not in statute): {from_agency}")
    print()

    # Show wet signature requirements
    wet_sig_results = [
        r for r in results
        if r.get('llm_analysis', {}).get('has_wet_signature_requirement', False)
    ]

    if wet_sig_results:
        print("\n" + "-" * 80)
        print("WET SIGNATURE REQUIREMENTS FOUND:")
        print("-" * 80)

        for r in wet_sig_results[:30]:
            analysis = r.get('llm_analysis', {})
            from_stat = analysis.get('from_statute')
            source = "FROM STATUTE" if from_stat is True else "AGENCY-ADDED" if from_stat is False else "?"
            print(f"\n[{source}] {r['title'][:60]}...")
            print(f"   N.J.A.C. {r.get('njac_section', 'Unknown')}")
            print(f"   Quote: \"{analysis.get('requirement_quote', 'N/A')[:100]}\"")
            if r.get('statute_citations'):
                print(f"   Statute refs: {', '.join(r['statute_citations'][:3])}")


def save_results(results: list, output_file: Path):
    """Save results to JSON file."""
    output_file.parent.mkdir(parents=True, exist_ok=True)

    # Remove full_content to reduce file size
    cleaned_results = []
    for r in results:
        cleaned = {k: v for k, v in r.items() if k != 'full_content'}
        cleaned_results.append(cleaned)

    with open(output_file, 'w') as f:
        json.dump(cleaned_results, f, indent=2, ensure_ascii=False)
    print(f"\nSaved results to {output_file}")


def generate_html(results: list, output_file: Path):
    """Generate HTML table viewer with LLM analysis results."""
    from html import escape

    # Count stats
    total = len(results)
    wet_sig_yes = sum(1 for r in results if r.get('llm_analysis', {}).get('has_wet_signature_requirement'))
    wet_sig_no = total - wet_sig_yes
    with_statute = sum(1 for r in results if r.get('statute_citations'))
    from_statute = sum(1 for r in results if r.get('llm_analysis', {}).get('from_statute') is True)
    from_agency = sum(1 for r in results if r.get('llm_analysis', {}).get('has_wet_signature_requirement') and r.get('llm_analysis', {}).get('from_statute') is False)

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NJ Wet Signature Analysis</title>
    <style>
        * {{ box-sizing: border-box; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0; padding: 20px; background: #f5f5f5;
            line-height: 1.5;
        }}
        .container {{ max-width: 1800px; margin: 0 auto; }}
        h1 {{ color: #333; margin-bottom: 10px; }}
        .summary {{
            background: white; padding: 20px; border-radius: 8px;
            margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }}
        .summary-stats {{ display: flex; gap: 15px; flex-wrap: wrap; margin-top: 15px; }}
        .stat-box {{ padding: 10px 20px; border-radius: 6px; font-weight: bold; }}
        .stat-yes {{ background: #d4edda; color: #155724; }}
        .stat-no {{ background: #e2e3e5; color: #383d41; }}
        .stat-agency {{ background: #fff3cd; color: #856404; }}
        .stat-statute {{ background: #cce5ff; color: #004085; }}
        .filters {{
            background: white; padding: 15px 20px; border-radius: 8px;
            margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            display: flex; gap: 15px; flex-wrap: wrap; align-items: center;
        }}
        .filters select, .filters input {{
            padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px;
        }}
        .filters input[type="text"] {{ width: 250px; }}
        .results-count {{ margin-left: auto; font-weight: 500; color: #666; }}
        .table-container {{
            background: white; border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow-x: auto;
        }}
        table {{ width: 100%; border-collapse: collapse; font-size: 0.9em; }}
        thead {{ background: #f8f9fa; position: sticky; top: 0; }}
        th {{
            padding: 12px 10px; text-align: left; font-weight: 600;
            border-bottom: 2px solid #dee2e6; cursor: pointer;
        }}
        th:hover {{ background: #e9ecef; }}
        td {{ padding: 10px; border-bottom: 1px solid #eee; vertical-align: top; }}
        tr:hover {{ background: #f8f9fa; }}
        .yes {{ color: #155724; font-weight: 600; }}
        .no {{ color: #6c757d; }}
        .from-statute {{ background: #cce5ff; color: #004085; padding: 2px 6px; border-radius: 3px; font-size: 0.85em; }}
        .from-agency {{ background: #fff3cd; color: #856404; padding: 2px 6px; border-radius: 3px; font-size: 0.85em; }}
        .quote {{ font-style: italic; color: #555; max-width: 400px; }}
        .citation {{ font-family: monospace; font-size: 0.85em; white-space: nowrap; }}
        .statute-refs {{ font-size: 0.8em; color: #666; max-width: 200px; }}
        .url-link {{ color: #007bff; text-decoration: none; font-size: 0.85em; }}
        .url-link:hover {{ text-decoration: underline; }}
        .hidden {{ display: none !important; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>NJ Wet Signature Analysis</h1>

        <div class="summary">
            <p>Analyzed <strong>{total}</strong> potential matches from regex search.</p>
            <div class="summary-stats">
                <div class="stat-box stat-yes">Wet Signature: {wet_sig_yes}</div>
                <div class="stat-box stat-no">No Wet Sig: {wet_sig_no}</div>
                <div class="stat-box stat-statute">From Statute: {from_statute}</div>
                <div class="stat-box stat-agency">Agency-Added: {from_agency}</div>
            </div>
        </div>

        <div class="filters">
            <label>Wet Signature:</label>
            <select id="wetSigFilter" onchange="filterTable()">
                <option value="all">All</option>
                <option value="yes">Yes Only</option>
                <option value="no">No Only</option>
            </select>
            <label>Source:</label>
            <select id="sourceFilter" onchange="filterTable()">
                <option value="all">All</option>
                <option value="statute">From Statute</option>
                <option value="agency">Agency-Added</option>
            </select>
            <label>Has Statute Ref:</label>
            <select id="statuteRefFilter" onchange="filterTable()">
                <option value="all">All</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
            </select>
            <input type="text" id="searchFilter" placeholder="Search title/quote..." oninput="filterTable()">
            <div class="results-count">Showing <span id="visibleCount">{total}</span> of {total}</div>
        </div>

        <div class="table-container">
            <table id="resultsTable">
                <thead>
                    <tr>
                        <th>Wet Sig?</th>
                        <th>Source</th>
                        <th>Citation</th>
                        <th>Title</th>
                        <th>Requirement Quote</th>
                        <th>Statute Refs</th>
                        <th>Link</th>
                    </tr>
                </thead>
                <tbody>
"""

    for r in results:
        analysis = r.get('llm_analysis', {}) or {}
        has_wet = analysis.get('has_wet_signature_requirement', False)
        quote = analysis.get('requirement_quote') or ''
        from_stat = analysis.get('from_statute')
        statute_refs = r.get('statute_citations', [])

        wet_sig_display = '<span class="yes">YES</span>' if has_wet else '<span class="no">no</span>'

        if has_wet and from_stat is True:
            source_display = '<span class="from-statute">From Statute</span>'
            source_data = 'statute'
        elif has_wet and from_stat is False:
            source_display = '<span class="from-agency">Agency-Added</span>'
            source_data = 'agency'
        else:
            source_display = '-'
            source_data = 'none'

        statute_refs_display = ', '.join(statute_refs[:3]) if statute_refs else '-'
        if len(statute_refs) > 3:
            statute_refs_display += f' (+{len(statute_refs)-3})'

        has_statute_data = 'yes' if statute_refs else 'no'
        search_text = f"{r.get('title', '')} {quote}".lower()

        html += f"""                    <tr data-wetsig="{'yes' if has_wet else 'no'}" data-source="{source_data}" data-hasstatute="{has_statute_data}" data-search="{escape(search_text)}">
                        <td>{wet_sig_display}</td>
                        <td>{source_display}</td>
                        <td class="citation">{r.get('njac_section') or '-'}</td>
                        <td>{escape(r.get('title', '')[:80])}</td>
                        <td class="quote">{escape(quote[:200]) if quote else '-'}</td>
                        <td class="statute-refs">{escape(statute_refs_display)}</td>
                        <td><a class="url-link" href="{r.get('url', '')}" target="_blank">View</a></td>
                    </tr>
"""

    html += """                </tbody>
            </table>
        </div>
    </div>

    <script>
        function filterTable() {
            const wetSig = document.getElementById('wetSigFilter').value;
            const source = document.getElementById('sourceFilter').value;
            const hasStatute = document.getElementById('statuteRefFilter').value;
            const search = document.getElementById('searchFilter').value.toLowerCase();

            let visible = 0;
            document.querySelectorAll('#resultsTable tbody tr').forEach(row => {
                let show = true;
                if (wetSig !== 'all' && row.dataset.wetsig !== wetSig) show = false;
                if (source !== 'all' && row.dataset.source !== source) show = false;
                if (hasStatute !== 'all' && row.dataset.hasstatute !== hasStatute) show = false;
                if (search && !row.dataset.search.includes(search)) show = false;

                row.classList.toggle('hidden', !show);
                if (show) visible++;
            });
            document.getElementById('visibleCount').textContent = visible;
        }
    </script>
</body>
</html>
"""

    output_file.parent.mkdir(parents=True, exist_ok=True)
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f"HTML viewer saved to {output_file}")


# =============================================================================
# MAIN
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description='Search for wet signature requirements in NJ regulations and analyze with LLM'
    )
    parser.add_argument('--no-llm', action='store_true',
                        help='Skip LLM analysis (just do regex search)')
    parser.add_argument('--limit', type=int, default=None,
                        help='Limit number of matches to analyze')
    parser.add_argument('--output', type=Path,
                        help='Output file path')
    parser.add_argument('--batch-size', type=int, default=5,
                        help='Batch size for LLM calls (default: 5)')

    args = parser.parse_args()

    # Initialize statute checker
    statute_checker = StatuteChecker()

    # Search for matches
    matches = search_files(statute_checker)

    if not matches:
        print("No matches found.")
        return

    # Limit if requested
    if args.limit:
        matches = matches[:args.limit]
        print(f"Limited to {len(matches)} matches")

    # LLM analysis
    if not args.no_llm:
        results = asyncio.run(analyze_batch(
            matches,
            statute_checker,
            batch_size=args.batch_size,
        ))
    else:
        results = matches

    # Output
    print_results(results)

    # Save JSON
    output_file = args.output or OUTPUTS_DIR / "nj_wet_signature_analysis.json"
    save_results(results, output_file)

    # Generate HTML (only if LLM analysis was done)
    if not args.no_llm:
        html_file = output_file.with_suffix('.html')
        generate_html(results, html_file)


if __name__ == "__main__":
    main()
