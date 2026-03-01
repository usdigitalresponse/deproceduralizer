#!/usr/bin/env python3
"""
Simulate the impact of adopting all pattern improvement recommendations.

Compares:
1. CURRENT patterns from prompts/compliance_issues.yaml
2. IMPROVED patterns with all recommendations applied

Outputs:
- Per-issue type: current matches vs improved matches
- Total NJ sections flagged (current vs improved)
- Patterns removed/added per issue type

Usage:
    python backend/scripts/simulate_pattern_improvements.py
    python backend/scripts/simulate_pattern_improvements.py --issue fax
    python backend/scripts/simulate_pattern_improvements.py --show-samples witness_required
"""

import argparse
import os
import sys
from pathlib import Path
from dataclasses import dataclass, field

import yaml
import psycopg2
from dotenv import load_dotenv

# Load environment
load_dotenv()

# =============================================================================
# IMPROVEMENT RECOMMENDATIONS
# Based on docs/research_pipelines/v1-tiered-llm/compliance_issue_experiments/IMPROVEMENT_ACTION_RECOMMENDATIONS.md
# =============================================================================

# Patterns to REMOVE (Priority 1 + Priority 2)
PATTERNS_TO_REMOVE = {
    'pdf_only': [r'\.pdf\b'],
    'bulletin_board': ['community board'],
    'handwriting_specs': ['block letters'],
    'check_money_order': ['payable to'],  # Listed as check_payment in recommendations
    'obsolete_comm': ['telegraph'],
    'obsolete_software': [r'ascii.{0,10}format', r'\bdos\b'],
    'photo_specs': [r'2.{0,3}x.{0,3}2'],
    'mandated_reports': ['report to the'],
    'physical_inspection': ['during business hours', 'public inspection'],
    'non_refundable_fees': [r'forfeited.{0,10}(fee|deposit|payment)'],
    'no_credit_cards': ['cash or check only'],
    'fixed_window': ['only during', 'filing period'],
    # Note: USB/flash drive patterns KEPT - physical media submission is still a burden
    # even if the technology isn't "obsolete"
    'paper_specs': ['paper stock'],
    'typewriter': ['typewritten', r'\btypewriter\b'],
    'witness_required': [r'\battested\b', 'attestation'],
    'in_person_submission': ['appear in person', r'hand.{0,3}deliver'],
    'in_person_pickup': [r'available.{0,10}pick.{0,3}up', 'picked up'],
    'in_person_hearing': [r'appear at.{0,20}hearing'],
    'storage_location': ['at the facility'],  # Too generic, ~0% TPR
}

# Patterns to ADD (Priority 3)
PATTERNS_TO_ADD = {
    'pdf_only': [
        r'(shall|must).{0,20}(be )?(in |submit.{0,10})?pdf',
        r'pdf.{0,10}format.{0,10}(is |shall be )?required',
        r'shall.{0,20}pdf.?a',
        r'pdf archival.{0,10}format',
    ],
    'typewriter': [
        r'(shall|must).{0,15}(be )?(in )?typewritten',
    ],
    'witness_required': [
        r'(shall|must).{0,15}(be )?witnessed',
        r'witness.{0,10}(is |shall be |are )?required',
        r'require.{0,15}witness',
    ],
    'in_person_submission': [
        r'in person.{0,10}only',
        r'(must|shall|required).{0,15}appear.{0,10}in person',
        r'(must|shall).{0,10}hand.{0,3}deliver',
    ],
    'fax': [
        r'shall.{0,20}fax',
        r'must.{0,15}(be )?fax',
        r'fax.{0,15}(is |shall be )?required',
    ],
    'mail_only': [
        r'(applicant|petitioner|person).{0,20}(must|shall).{0,15}mail',
        r'submit.{0,15}by mail',
        r'only.{0,10}by mail',
    ],
    'in_person_pickup': [
        r'(permit|license|certificate|document).{0,30}(must|shall).{0,20}(be )?(picked up|pick.{0,3}up).{0,10}in person',
        r'(must|shall).{0,20}(pick up|retrieve).{0,20}(permit|license|certificate)',
    ],
    'in_person_hearing': [
        r'(must|shall|required).{0,20}attend.{0,15}in person',
        r'in.{0,3}person.{0,10}attendance.{0,10}(is |shall be )?required',
        r'no.{0,10}(remote|video|telephone).{0,10}(permitted|allowed)',
    ],
}

# Exclusion patterns (Priority 4) - these would filter OUT matches
# Note: For simplicity, we'll track these but not implement full exclusion logic in SQL
EXCLUSION_PATTERNS = {
    'fax': [r'fax number', r'or fax', r'and/or fax'],
    'mail_only': [r'shall be mailed TO', r'mailed by'],
    'wet_signature': [r'in place of', r'instead of', r'need not', r'except'],
    'original_document': [r'or copy', r'or certified', r'or a copy'],
    'certified_mail': [r'by certified check'],
    'waiting_period': [r'no.*waiting period required', r'waived'],
    'embossed_seal': [r'Seal of Quality', r'inspection seal'],
}


@dataclass
class IssueTypeStats:
    """Stats for a single issue type."""
    issue_type: str
    display_name: str
    current_patterns: list = field(default_factory=list)
    improved_patterns: list = field(default_factory=list)
    patterns_removed: list = field(default_factory=list)
    patterns_added: list = field(default_factory=list)
    current_matches: int = 0
    improved_matches: int = 0

    @property
    def change(self) -> int:
        return self.improved_matches - self.current_matches

    @property
    def change_pct(self) -> float:
        if self.current_matches == 0:
            return 0.0 if self.improved_matches == 0 else 100.0
        return (self.change / self.current_matches) * 100


def load_current_patterns() -> dict:
    """Load current patterns from prompts/compliance_issues.yaml."""
    yaml_path = Path(__file__).parent.parent.parent / 'prompts' / 'compliance_issues.yaml'
    with open(yaml_path) as f:
        config = yaml.safe_load(f)

    patterns = {}
    for issue_type, data in config.items():
        if isinstance(data, dict) and 'patterns' in data:
            patterns[issue_type] = {
                'display_name': data.get('display_name', issue_type),
                'patterns': data['patterns'],
            }
    return patterns


def build_improved_patterns(current: dict) -> dict:
    """Apply all improvements to current patterns."""
    improved = {}

    for issue_type, data in current.items():
        current_patterns = list(data['patterns'])
        patterns_removed = []
        patterns_added = []

        # Remove patterns
        if issue_type in PATTERNS_TO_REMOVE:
            for pattern in PATTERNS_TO_REMOVE[issue_type]:
                pattern_lower = pattern.lower()
                # Find and remove matching patterns (case-insensitive comparison)
                for p in list(current_patterns):
                    if p.lower() == pattern_lower or p == pattern:
                        current_patterns.remove(p)
                        patterns_removed.append(p)

        # Add new patterns
        if issue_type in PATTERNS_TO_ADD:
            for pattern in PATTERNS_TO_ADD[issue_type]:
                if pattern not in current_patterns:
                    current_patterns.append(pattern)
                    patterns_added.append(pattern)

        improved[issue_type] = {
            'display_name': data['display_name'],
            'patterns': current_patterns,
            'patterns_removed': patterns_removed,
            'patterns_added': patterns_added,
            'original_patterns': data['patterns'],
        }

    return improved


def count_matches(conn, patterns: list[str], state: str = 'NJ') -> int:
    """Count NJ sections matching any of the given patterns."""
    if not patterns:
        return 0

    # Build OR clause for all patterns
    pattern_conditions = []
    for p in patterns:
        # Escape single quotes for SQL
        escaped = p.replace("'", "''")
        pattern_conditions.append(f"content ~* '{escaped}'")

    where_clause = ' OR '.join(pattern_conditions)

    query = f"""
        SELECT COUNT(DISTINCT id)
        FROM regulatory_documents
        WHERE jurisdiction = %s
          AND hierarchy_level = 'section'
          AND content IS NOT NULL
          AND (exclude_from_analysis = FALSE OR exclude_from_analysis IS NULL)
          AND ({where_clause})
    """

    with conn.cursor() as cur:
        cur.execute(query, (state,))
        return cur.fetchone()[0]


def count_all_unique_sections(conn, all_patterns: dict, state: str = 'NJ') -> int:
    """Count unique sections matching ANY issue type."""
    all_pattern_conditions = []

    for issue_type, data in all_patterns.items():
        for p in data.get('patterns', []):
            escaped = p.replace("'", "''")
            all_pattern_conditions.append(f"content ~* '{escaped}'")

    if not all_pattern_conditions:
        return 0

    where_clause = ' OR '.join(all_pattern_conditions)

    query = f"""
        SELECT COUNT(DISTINCT id)
        FROM regulatory_documents
        WHERE jurisdiction = %s
          AND hierarchy_level = 'section'
          AND content IS NOT NULL
          AND (exclude_from_analysis = FALSE OR exclude_from_analysis IS NULL)
          AND ({where_clause})
    """

    with conn.cursor() as cur:
        cur.execute(query, (state,))
        return cur.fetchone()[0]


def get_total_sections(conn, state: str = 'NJ') -> int:
    """Get total number of analyzable sections."""
    query = """
        SELECT COUNT(*)
        FROM regulatory_documents
        WHERE jurisdiction = %s
          AND hierarchy_level = 'section'
          AND content IS NOT NULL
          AND (exclude_from_analysis = FALSE OR exclude_from_analysis IS NULL)
    """
    with conn.cursor() as cur:
        cur.execute(query, (state,))
        return cur.fetchone()[0]


def show_samples(conn, patterns: list[str], issue_type: str, n: int = 5, state: str = 'NJ'):
    """Show sample matches for an issue type."""
    if not patterns:
        print(f"No patterns for {issue_type}")
        return

    pattern_conditions = []
    for p in patterns:
        escaped = p.replace("'", "''")
        pattern_conditions.append(f"content ~* '{escaped}'")

    where_clause = ' OR '.join(pattern_conditions)

    query = f"""
        SELECT id, citation, substring(content, 1, 500) as preview
        FROM regulatory_documents
        WHERE jurisdiction = %s
          AND hierarchy_level = 'section'
          AND content IS NOT NULL
          AND (exclude_from_analysis = FALSE OR exclude_from_analysis IS NULL)
          AND ({where_clause})
        ORDER BY RANDOM()
        LIMIT %s
    """

    with conn.cursor() as cur:
        cur.execute(query, (state, n))
        rows = cur.fetchall()

    print(f"\n{'='*70}")
    print(f"SAMPLE MATCHES: {issue_type}")
    print(f"Patterns: {patterns[:3]}{'...' if len(patterns) > 3 else ''}")
    print(f"{'='*70}\n")

    for i, (doc_id, citation, preview) in enumerate(rows, 1):
        print(f"[{i}] ID: {doc_id} | {citation}")
        print(f"    {preview[:200]}...")
        print()


def main():
    parser = argparse.ArgumentParser(description='Simulate pattern improvement impact')
    parser.add_argument('--issue', '-i', dest='issue_type', help='Analyze specific issue type only')
    parser.add_argument('--show-samples', '-s', help='Show sample matches for issue type')
    parser.add_argument('--samples', '-n', type=int, default=5, help='Number of samples to show')
    parser.add_argument('--state', default='NJ', help='State to analyze (default: NJ)')
    parser.add_argument('--improved-only', action='store_true', help='Only show improved patterns')
    args = parser.parse_args()

    # Connect to database
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        print("ERROR: DATABASE_URL not set")
        sys.exit(1)

    conn = psycopg2.connect(database_url)

    try:
        # Load patterns
        print("Loading current patterns from prompts/compliance_issues.yaml...")
        current = load_current_patterns()
        print(f"  Found {len(current)} issue types")

        print("Building improved patterns...")
        improved = build_improved_patterns(current)

        # Count changes
        total_removed = sum(len(d['patterns_removed']) for d in improved.values())
        total_added = sum(len(d['patterns_added']) for d in improved.values())
        print(f"  Patterns to remove: {total_removed}")
        print(f"  Patterns to add: {total_added}")

        # Handle --show-samples
        if args.show_samples:
            if args.show_samples not in improved:
                print(f"Unknown issue type: {args.show_samples}")
                print(f"Available: {', '.join(sorted(improved.keys()))}")
                return

            data = improved[args.show_samples]
            patterns = data['patterns'] if args.improved_only else data['original_patterns']
            show_samples(conn, patterns, args.show_samples, args.samples, args.state)
            return

        # Get total sections
        total_sections = get_total_sections(conn, args.state)
        print(f"\nTotal {args.state} sections (excluding analysis-excluded): {total_sections:,}")

        # Filter to specific issue type if requested
        issue_types = [args.issue_type] if args.issue_type else list(improved.keys())

        if args.issue_type and args.issue_type not in improved:
            print(f"Unknown issue type: {args.issue_type}")
            print(f"Available: {', '.join(sorted(improved.keys()))}")
            return

        # Analyze each issue type
        print(f"\nAnalyzing {len(issue_types)} issue types...")
        results = []

        for i, issue_type in enumerate(issue_types, 1):
            data = improved[issue_type]
            print(f"  [{i}/{len(issue_types)}] {issue_type}...", end=" ", flush=True)

            stats = IssueTypeStats(
                issue_type=issue_type,
                display_name=data['display_name'],
                current_patterns=data['original_patterns'],
                improved_patterns=data['patterns'],
                patterns_removed=data['patterns_removed'],
                patterns_added=data['patterns_added'],
            )

            # Count matches
            stats.current_matches = count_matches(conn, data['original_patterns'], args.state)
            stats.improved_matches = count_matches(conn, data['patterns'], args.state)

            print(f"{stats.current_matches:,} → {stats.improved_matches:,} ({stats.change:+,})")
            results.append(stats)

        # Summary table
        print(f"\n{'='*90}")
        print(f"PATTERN IMPROVEMENT IMPACT SUMMARY ({args.state})")
        print(f"{'='*90}")
        print(f"\n{'Issue Type':<30} {'Current':>10} {'Improved':>10} {'Change':>10} {'% Change':>10}")
        print('-' * 70)

        for stats in sorted(results, key=lambda x: x.change):
            change_str = f"{stats.change:+,}"
            pct_str = f"{stats.change_pct:+.1f}%"
            print(f"{stats.issue_type:<30} {stats.current_matches:>10,} {stats.improved_matches:>10,} {change_str:>10} {pct_str:>10}")

        print('-' * 70)

        # Totals (unique sections)
        print("\nCalculating unique sections flagged (any issue type)...")

        # Build current and improved pattern dicts for unique count
        current_for_unique = {k: {'patterns': v['patterns']} for k, v in current.items()}
        improved_for_unique = {k: {'patterns': v['patterns']} for k, v in improved.items()}

        current_unique = count_all_unique_sections(conn, current_for_unique, args.state)
        improved_unique = count_all_unique_sections(conn, improved_for_unique, args.state)

        print(f"\n{'='*70}")
        print("UNIQUE SECTIONS FLAGGED")
        print(f"{'='*70}")
        print(f"  Current patterns:  {current_unique:>8,} sections ({current_unique/total_sections*100:.1f}% of {total_sections:,})")
        print(f"  Improved patterns: {improved_unique:>8,} sections ({improved_unique/total_sections*100:.1f}% of {total_sections:,})")
        print(f"  Change:            {improved_unique - current_unique:>+8,} sections ({(improved_unique - current_unique)/current_unique*100:+.1f}%)")

        # Show which issue types have changes
        print(f"\n{'='*70}")
        print("ISSUE TYPES WITH PATTERN CHANGES")
        print(f"{'='*70}")

        for stats in results:
            if stats.patterns_removed or stats.patterns_added:
                print(f"\n{stats.issue_type}:")
                if stats.patterns_removed:
                    print(f"  REMOVED: {stats.patterns_removed}")
                if stats.patterns_added:
                    print(f"  ADDED: {stats.patterns_added}")

    finally:
        conn.close()


if __name__ == "__main__":
    main()
