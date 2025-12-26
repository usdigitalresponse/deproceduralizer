#!/usr/bin/env python3
"""
Smoke test for ComplianceIssueSearcher pipeline.

Tests the full end-to-end flow:
1. Regex search finds matches
2. LLM analysis runs without errors
3. Results have expected structure

Usage:
    # Test all issue types for all states with 10 matches each
    python test_compliance_searcher.py --test 10

    # Test specific state
    python test_compliance_searcher.py --state nj --test 5

    # Test specific issue type
    python test_compliance_searcher.py --issue wet_signature --test 10

    # Test specific combination
    python test_compliance_searcher.py --state nj --issue wet_signature --test 10

    # List available issue types
    python test_compliance_searcher.py --list-issues

    # Regex-only mode (no LLM analysis)
    python test_compliance_searcher.py --state nj --issue wet_signature --test 10 --regex-only
"""

import argparse
import asyncio
import sys
from pathlib import Path
from dotenv import load_dotenv

# Add parent directories to path and load environment
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(Path(__file__).parent.parent))
sys.path.insert(0, str(Path(__file__).parent))

# Load environment variables from root .env
load_dotenv(PROJECT_ROOT / '.env')

from compliance_issues.searcher import ComplianceIssueSearcher
from compliance_issues.config import STATES, ISSUE_TYPES, list_issue_types


def test_regex_search(state_code: str, issue_type: str, limit: int) -> list[dict]:
    """Test regex search for a state/issue combination."""
    print(f"\n{'='*70}")
    print(f"Testing: {state_code.upper()} - {issue_type} (limit={limit})")
    print('='*70)

    state_config = STATES[state_code]
    issue_config = ISSUE_TYPES[issue_type]

    print(f"  Issue: {issue_config.display_name}")
    print(f"  Category: {issue_config.category}")
    print(f"  Patterns: {len(issue_config.patterns)}")
    print(f"  Response model: {issue_config.response_model.__name__}")

    # Create searcher (without statutes for faster testing)
    searcher = ComplianceIssueSearcher(
        state_config=state_config,
        issue_config=issue_config,
        with_statutes=False,  # Skip statute lookup for speed
    )

    # Run regex search
    matches = searcher.search(limit=limit)

    if not matches:
        print(f"  No regex matches found for {state_code.upper()} {issue_type}")
        return []

    print(f"  Found {len(matches)} regex matches")

    # Validate match structure
    required_keys = ['document_id', 'title', 'term_matched', 'context']
    for i, match in enumerate(matches[:3]):
        missing = [k for k in required_keys if k not in match]
        if missing:
            print(f"  Match {i} missing keys: {missing}")
        else:
            term = match['term_matched'][:40] if match['term_matched'] else 'N/A'
            print(f"  Match {i}: term={term}...")

    return matches


async def test_llm_analysis(state_code: str, issue_type: str, matches: list[dict]) -> list[dict]:
    """Test LLM analysis on matches."""
    if not matches:
        return []

    state_config = STATES[state_code]
    issue_config = ISSUE_TYPES[issue_type]

    # Create searcher
    searcher = ComplianceIssueSearcher(
        state_config=state_config,
        issue_config=issue_config,
        with_statutes=False,
    )

    print(f"\n  Running LLM analysis on {len(matches)} matches...")

    # Test prompt creation first
    try:
        system_prompt, user_prompt = searcher.create_prompt(matches[0])
        print(f"  Prompt creation successful")
        print(f"    System prompt: {len(system_prompt) if system_prompt else 0} chars")
        print(f"    User prompt: {len(user_prompt)} chars")
    except Exception as e:
        print(f"  Prompt creation failed: {e}")
        return []

    # Run async analysis
    try:
        results = await searcher.analyze_async(matches, batch_size=10)
        print(f"  LLM analysis completed for {len(results)} matches")
    except Exception as e:
        print(f"  LLM analysis failed: {e}")
        import traceback
        traceback.print_exc()
        return []

    # Validate results structure
    for i, result in enumerate(results):
        analysis = result.get('llm_analysis')
        if analysis is None:
            if result.get('analysis_error'):
                print(f"  Result {i}: LLM analysis error")
            else:
                print(f"  Result {i}: No analysis")
            continue

        # Check required fields (new field names match DB columns)
        issues = analysis.get('issues', [])
        print(f"  Result {i}: {len(issues)} issue(s)")
        for j, issue in enumerate(issues[:3], 1):
            req_found = issue.get('requirement_found')
            req_text = issue.get('requirement_text')
            req_by_statute = issue.get('required_by_statute')
            print(f"      Issue {j}:")
            print(f"        requirement_found: {req_found}")
            quote_preview = req_text[:60] if req_text else 'None'
            print(f"        requirement_text: {quote_preview}...")
            print(f"        required_by_statute: {req_by_statute}")

    return results


async def run_tests(
    states: list[str],
    issues: list[str],
    limit: int,
    regex_only: bool = False
):
    """Run smoke tests for specified states and issues."""
    print("\n" + "="*70)
    print("COMPLIANCE ISSUE SEARCHER SMOKE TESTS")
    print("="*70)
    print(f"States: {states}")
    print(f"Issues: {len(issues)} issue type(s)")
    print(f"Limit per combo: {limit}")
    print(f"Mode: {'Regex only' if regex_only else 'Full (Regex + LLM)'}")

    all_results = {}

    for state_code in states:
        for issue_type in issues:
            # Test regex search
            matches = test_regex_search(state_code, issue_type, limit)

            if matches and not regex_only:
                # Test LLM analysis
                results = await test_llm_analysis(state_code, issue_type, matches)
                confirmed_count = sum(
                    1 for r in results
                    for issue in (r.get('llm_analysis') or {}).get('issues', [])
                    if issue.get('requirement_found')
                )
                all_results[f"{state_code}_{issue_type}"] = {
                    'regex_matches': len(matches),
                    'llm_analyzed': len(results),
                    'with_issue': confirmed_count,
                }

                # Save all analyzed results to database (tracks what's been scanned)
                state_config = STATES[state_code]
                issue_config = ISSUE_TYPES[issue_type]
                searcher = ComplianceIssueSearcher(
                    state_config=state_config,
                    issue_config=issue_config,
                    with_statutes=False,
                )
                saved = searcher.save_to_database(results)
                print(f"  Saved {saved} results to database ({confirmed_count} confirmed)")
            elif matches:
                all_results[f"{state_code}_{issue_type}"] = {
                    'regex_matches': len(matches),
                    'llm_analyzed': 0,
                    'with_issue': 0,
                }

    # Print summary
    print("\n" + "="*70)
    print("SUMMARY")
    print("="*70)

    total_regex = 0
    total_llm = 0
    total_issues = 0

    for key, stats in sorted(all_results.items()):
        total_regex += stats['regex_matches']
        total_llm += stats['llm_analyzed']
        total_issues += stats['with_issue']
        print(f"\n{key}:")
        print(f"  Regex matches: {stats['regex_matches']}")
        if not regex_only:
            print(f"  LLM analyzed: {stats['llm_analyzed']}")
            print(f"  Confirmed issues: {stats['with_issue']}")

    print(f"\n{'='*70}")
    print(f"TOTALS: {total_regex} regex matches", end="")
    if not regex_only:
        print(f", {total_llm} analyzed, {total_issues} confirmed issues")
    else:
        print()

    print("\nSmoke tests completed!")


def main():
    parser = argparse.ArgumentParser(
        description="Smoke test for ComplianceIssueSearcher",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --test 10                          # Test all with 10 matches each
  %(prog)s --state nj --test 5                # Test NJ only
  %(prog)s --issue wet_signature --test 10    # Test wet_signature only
  %(prog)s --list-issues                      # List all issue types
  %(prog)s --state nj --regex-only --test 20  # Regex only, no LLM
        """
    )
    parser.add_argument(
        '--test', '-t',
        type=int,
        metavar='N',
        help='Limit to N matches per state/issue combo'
    )
    parser.add_argument(
        '--state', '-s',
        choices=['nj', 'ny', 'all'],
        default='all',
        help='State to test (default: all)'
    )
    parser.add_argument(
        '--issue', '-i',
        help='Issue type to test (use --list-issues to see options, default: all)'
    )
    parser.add_argument(
        '--list-issues',
        action='store_true',
        help='List all available issue types and exit'
    )
    parser.add_argument(
        '--regex-only',
        action='store_true',
        help='Only run regex search, skip LLM analysis'
    )

    args = parser.parse_args()

    if args.list_issues:
        list_issue_types()
        return

    if args.test is None:
        parser.error("--test N is required (or use --list-issues)")

    # Determine states to test
    if args.state == 'all':
        states = ['nj', 'ny']
    else:
        states = [args.state]

    # Determine issues to test
    if args.issue:
        if args.issue not in ISSUE_TYPES:
            print(f"Error: Unknown issue type '{args.issue}'")
            print("Use --list-issues to see available options")
            sys.exit(1)
        issues = [args.issue]
    else:
        # Default: all issue types
        issues = sorted(ISSUE_TYPES.keys())

    asyncio.run(run_tests(states, issues, args.test, args.regex_only))


if __name__ == "__main__":
    main()
