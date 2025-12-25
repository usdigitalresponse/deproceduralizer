#!/usr/bin/env python3
"""
Analyze regex patterns against local regulation data using DuckDB for efficiency.

Outputs markdown tables showing:
1. Issue counts by state (NJ and NY side by side)
2. Overlap distribution (docs matching 1, 2, 3+ issue types)

Usage:
    python analyze_patterns.py                    # Run analysis, output to markdown
    python analyze_patterns.py --sample fax 5    # Show 5 sample matches for 'fax'
    python analyze_patterns.py --pattern "telegram|telex"  # Test a custom pattern
"""

import json
import re
import argparse
from pathlib import Path
from collections import defaultdict, Counter
from datetime import datetime

try:
    import duckdb
    HAS_DUCKDB = True
except ImportError:
    HAS_DUCKDB = False

# =============================================================================
# ALL ISSUE TYPES AND THEIR PATTERNS
# =============================================================================

ISSUE_PATTERNS = {
    # === COMMUNICATION & SUBMISSION ===
    'mail_only': {
        'display': 'Mail-Only Submission',
        'category': 'Communication',
        'patterns': [
            # Core patterns - actual mail requirements
            r"must be mailed",
            r"shall be mailed",
            r"send by mail",
            r"submit.{0,20}by mail",
            r"mail.{0,10}only",
            # Postal service references
            r"u\.?s\.?\s*mail",
            r"\busps\b",
            r"first.{0,10}class.{0,10}mail",
            r"postal.{0,10}service",
            r"postmarked by",
            # SKIP: "by mail", "mailed to", "mailing address" - too noisy
        ],
    },
    'certified_mail': {
        'display': 'Certified/Registered Mail',
        'category': 'Communication',
        'patterns': [
            r"certified mail",
            r"registered mail",
            r"return receipt",
            r"delivery confirmation",
            r"postmarked by",
            r"proof of mailing",
            r"certificate of mailing",
        ],
    },
    'fax': {
        'display': 'Fax Requirements',
        'category': 'Communication',
        'patterns': [
            r"\bfax\b",
            r"facsimile",
            r"fax number",
            r"fax to",
            r"telefax",
            r"fax machine",
            r"fax transmission",
        ],
    },
    'obsolete_comm': {
        'display': 'Obsolete Communication',
        'category': 'Communication',
        'patterns': [
            r"telegram",
            r"telegraph",
            r"\btelex\b",
            r"\bpager\b",
            r"\bbeeper\b",
            # SKIP: \bwire\b, \bcable\b - catches wire transfers, not obsolete tech
        ],
    },
    'landline': {
        'display': 'Landline/Telephone Required',
        'category': 'Communication',
        'patterns': [
            r"by telephone",
            r"telephone call",
            r"call the office",
            r"phone call required",
            r"verbal authorization",
            r"by phone only",
            r"\blandline\b",
            r"touch-tone",
        ],
    },

    # === PAYMENT ===
    'check_money_order': {
        'display': 'Check/Money Order Payment',
        'category': 'Payment',
        'patterns': [
            r"\bcheck\b",
            r"money order",
            r"cashier'?s check",
            r"certified check",
            r"personal check",
            r"bank check",
            r"postal money order",
            r"payable to",
        ],
    },
    'cash_only': {
        'display': 'Cash Only Payment',
        'category': 'Payment',
        'patterns': [
            r"cash.{0,5}only",
            r"exact change",
            r"no change provided",
            # SKIP: \bcurrency\b, cash payment - too many false positives (casino chips, etc)
        ],
    },
    'no_credit_cards': {
        'display': 'No Credit Cards',
        'category': 'Payment',
        'patterns': [
            r"no credit cards?",
            r"credit cards? not accepted",
            r"do not accept credit",
            r"cash or check only",
            r"no electronic payment",
            r"no card payments?",
        ],
    },
    'in_person_payment': {
        'display': 'In-Person Payment',
        'category': 'Payment',
        'patterns': [
            r"pay in person",
            r"payment at the office",
            r"pay at the counter",
            r"in-person payment",
            r"pay at the window",
            r"remit in person",
        ],
    },

    # === SIGNATURES & AUTHENTICATION ===
    'wet_signature': {
        'display': 'Wet Signature',
        'category': 'Signatures',
        'patterns': [
            # Explicit wet/ink/handwritten
            r"wet signature",
            r"ink signature",
            r"handwritten signature",
            # Original signature
            r"original signature",
            # Signed in ink / blue/black ink
            r"signed in ink",
            r"blue ink",
            r"black ink",
            # Manually/physically/personally signed
            r"manually signed",
            r"physical signature",
            r"personally sign",
            # Notarized signature (implies wet)
            r"notarized.{0,20}signature",
            r"signature.{0,20}notari",
            # Bear the signature
            r"bear.{0,10}signature",
            # SKIP: applicant signature - too generic
        ],
    },
    'notarization': {
        'display': 'Notarization Required',
        'category': 'Signatures',
        'patterns': [
            r"notarized",
            r"notary public",
            r"notarization",
            r"notary seal",
            r"acknowledged before",
            r"sworn before",
            r"\bjurat\b",
            r"notarial",
        ],
    },
    'witness_required': {
        'display': 'Witness Required',
        'category': 'Signatures',
        'patterns': [
            r"two witnesses",
            r"2 witnesses",
            r"witness.{0,5}signature",
            r"witnessed by",
            r"\battested\b",
            r"attestation",
            r"in the presence of",
            # SKIP: \bwitness\b - too broad, catches court witnesses
        ],
    },
    'embossed_seal': {
        'display': 'Embossed Seal/Stamp',
        'category': 'Signatures',
        'patterns': [
            r"embossed seal",
            r"raised seal",
            r"official seal",
            r"wet stamp",
            r"rubber stamp",
            r"seal affixed",
            r"impressed seal",
            r"corporate seal",
        ],
    },
    'original_document': {
        'display': 'Original Document Required',
        'category': 'Signatures',
        'patterns': [
            r"no photocopies",
            r"original only",
            r"submit.{0,10}original",
            r"provide.{0,10}original",
            r"original document",
            r"original certificate",
            r"original letter",
            r"must be.{0,5}original",
            r"shall be.{0,5}original",
        ],
    },

    # === PHYSICAL PRESENCE ===
    'in_person_submission': {
        'display': 'In-Person Submission',
        'category': 'Physical Presence',
        'patterns': [
            r"submit.{0,10}in person",
            r"appear in person",
            r"in.{0,3}person.{0,10}submission",
            r"personal appearance",
            r"hand.{0,3}deliver",
            # SKIP: "appear at", "must appear", "shall appear" - too broad
        ],
    },
    'in_person_pickup': {
        'display': 'In-Person Pickup',
        'category': 'Physical Presence',
        'patterns': [
            r"pick up in person",
            r"must be picked up",
            r"collect in person",
            r"available for pickup",
            r"retrieve in person",
            r"claim in person",
        ],
    },
    'in_person_hearing': {
        'display': 'In-Person Hearing/Meeting',
        'category': 'Physical Presence',
        'patterns': [
            r"appear at the hearing",
            r"in-person hearing",
            r"physical attendance",
            r"present at the meeting",
            r"attend in person",
            r"appear before the board",
        ],
    },
    'physical_forms': {
        'display': 'Physical Form Retrieval',
        'category': 'Physical Presence',
        'patterns': [
            r"forms available at",
            r"obtain forms from",
            r"forms may be obtained",
            r"pick up an application",
            r"forms at the office",
        ],
    },
    'physical_inspection': {
        'display': 'Physical Inspection Location',
        'category': 'Physical Presence',
        'patterns': [
            r"available for public inspection",
            r"open to inspection",
            r"maintain for inspection",
            r"available for review at",
            r"inspect at the office",
            r"public inspection",
            r"examine during business hours",
        ],
    },
    'physical_posting': {
        'display': 'Physical Posting Required',
        'category': 'Physical Presence',
        'patterns': [
            r"conspicuously posted",
            r"prominently displayed",
            r"posted at all times",
            r"displayed near the entrance",
            r"posted on the premises",
            r"visible to the public",
            r"post a notice",
            r"display a sign",
        ],
    },
    'bulletin_board': {
        'display': 'Bulletin Board',
        'category': 'Physical Presence',
        'patterns': [
            r"bulletin board",
            r"notice board",
            r"posted on the board",
            r"community board",
            r"public board",
        ],
    },

    # === TECHNOLOGY & MEDIA ===
    'obsolete_media': {
        'display': 'Obsolete Storage Media',
        'category': 'Technology',
        'patterns': [
            r"cd-rom",
            r"floppy disk",
            r"diskette",
            r"usb drive",
            r"flash drive",
            r"magnetic tape",
            r"\bdvd\b",
            r"compact disc",
            r"thumb drive",
            r"punch.{0,5}card",  # Added: 15 matches - some are medication blister packs (false positives)
        ],
    },
    'obsolete_software': {
        'display': 'Obsolete Software/Format',
        'category': 'Technology',
        'patterns': [
            r"wordperfect",
            r"\blotus\b",
            r"\bdos\b",
            r"\bdbase\b",
            r"\.wps\b",
            r"\.wpd\b",
            r"ascii format",
            r"specific software",
        ],
    },
    'pdf_only': {
        'display': 'PDF Only Format',
        'category': 'Technology',
        'patterns': [
            r"pdf format",
            r"submit as pdf",
            r"in pdf",
            r"adobe pdf",
            r"pdf only",
            r"\.pdf\b",
        ],
    },
    'microfiche': {
        'display': 'Microfiche/Microfilm',
        'category': 'Technology',
        'patterns': [
            r"microfiche",
            r"microfilm",
            r"microform",
            r"microcard",
            r"aperture card",
        ],
    },
    'typewriter': {
        'display': 'Typewriter Required',
        'category': 'Technology',
        'patterns': [
            r"typewritten",
            r"typed copy",
            r"\btypewriter\b",
            r"machine-typed",
            r"type-written",
        ],
    },
    'carbon_copy': {
        'display': 'Carbon/Multiple Copies',
        'category': 'Technology',
        'patterns': [
            r"carbon copy",
            r"\btriplicate\b",
            r"duplicate copy",
            r"in duplicate",
            r"three copies",
            r"multiple copies",
            r"\bcc:\b",
        ],
    },
    'newspaper_publication': {
        'display': 'Newspaper Publication',
        'category': 'Technology',
        'patterns': [
            r"newspaper of general circulation",
            r"publish.{0,20}newspaper",
            r"published.{0,20}newspaper",
            r"newspaper.{0,10}notice",
            r"newspaper.{0,10}publication",
            r"legal.{0,5}notice",
            r"local newspaper",
            r"official newspaper",
        ],
    },

    # === DOCUMENT FORMAT ===
    'paper_specs': {
        'display': 'Paper Specifications',
        'category': 'Document Format',
        'patterns': [
            r"8\.?5.{0,5}x.{0,5}11",
            r"letter size",
            r"legal size",
            r"8\.?5.{0,5}x.{0,5}14",
            r"bond paper",
            r"20 lb",
            r"white paper",
            r"paper stock",
            r"colored paper",
        ],
    },
    'photo_specs': {
        'display': 'Photo Specifications',
        'category': 'Document Format',
        'patterns': [
            r"2.{0,3}x.{0,3}2",
            r"passport photo",
            r"photograph size",
            r"recent photograph",
            r"photo dimensions",
            r"\bheadshot\b",
            r"photo attached",
        ],
    },
    'binding_required': {
        'display': 'Binding Required',
        'category': 'Document Format',
        'patterns': [
            r"spiral bound",
            r"three-ring binder",
            r"ring binder",
            # SKIP: \bbound\b (catches "legally bound"), fastened (non-document uses)
        ],
    },
    'letterhead': {
        'display': 'Letterhead Required',
        'category': 'Document Format',
        'patterns': [
            r"on letterhead",
            r"official letterhead",
            r"company letterhead",
            r"agency letterhead",
            r"printed letterhead",
        ],
    },
    'handwriting_specs': {
        'display': 'Handwriting Specifications',
        'category': 'Document Format',
        'patterns': [
            r"block letters",
            r"print clearly",
            r"legible handwriting",
            r"hand-printed",
            r"print in ink",
            r"neat handwriting",
            r"indelib",  # Added: 49 matches - indelible ink/pencil requirements
        ],
    },
    'multiple_copies': {
        'display': 'Multiple Copy Submission',
        'category': 'Document Format',
        'patterns': [
            r"submit.{0,10}copies",
            r"provide.{0,10}copies",
            r"original and.{0,10}cop",
            r"file.{0,10}copies",
            r"copies for distribution",
            r"retain copies",
            r"duplicate copies",
        ],
    },

    # === PROCESS & TRACKING ===
    'physical_log': {
        'display': 'Physical Log/Sign-in',
        'category': 'Process',
        'patterns': [
            r"sign-in sheet",
            r"log book",
            r"visitor log",
            r"sign the register",
            r"entry log",
            r"written log",
            r"daily log",
        ],
    },
    'routing_slip': {
        'display': 'Routing/Transmittal Slip',
        'category': 'Process',
        'patterns': [
            r"routing slip",
            r"transmittal form",
            r"routing form",
            r"tracking sheet",
            r"circulation slip",
            r"cover.{0,10}sheet",  # Added: 30 matches - cover sheets for document submission
        ],
    },
    'fixed_window': {
        'display': 'Fixed Processing Window',
        'category': 'Process',
        'patterns': [
            r"applications accepted",
            r"filing period",
            r"only during",
            r"application window",
            r"open enrollment",
            r"submission period",
            r"accepted between",
        ],
    },
    'waiting_period': {
        'display': 'Mandatory Waiting Period',
        'category': 'Process',
        'patterns': [
            r"waiting period",
            r"must wait",
            r"cooling off",
            r"no sooner than",
            r"minimum of.{0,10}days before",
        ],
    },

    # === REPORTING ===
    'mandated_reports': {
        'display': 'Mandated Reports',
        'category': 'Reporting',
        'patterns': [
            r"annual report",
            r"quarterly report",
            r"submit a report",
            r"file a report",
            r"reporting requirements",
            r"report to the legislature",
            r"report to the governor",
            r"statistical report",
            r"publish a report",
            r"report on the status",
        ],
    },

    # === STORAGE LOCATION ===
    'storage_location': {
        'display': 'Specific Storage Location',
        'category': 'Process',
        'patterns': [
            r"stored at",
            r"maintained at",
            r"kept at the premises",
            r"records location",
            r"on-site storage",
            r"at the facility",
        ],
    },
}


def load_local_data(state: str) -> list[dict]:
    """Load regulation data from local JSON file."""
    data_dir = Path(__file__).parent.parent.parent / 'data'
    file_path = data_dir / f'{state.lower()}_regulations_complete.json'

    print(f"Loading {state.upper()} data from {file_path.name}...", end=" ", flush=True)
    with open(file_path) as f:
        data = json.load(f)
    print(f"{len(data)} documents")
    return data


def analyze_with_duckdb(nj_data: list[dict], ny_data: list[dict]) -> dict:
    """Analyze both states using DuckDB for efficiency."""
    print("\nAnalyzing with DuckDB...")

    conn = duckdb.connect(':memory:')

    # Create tables
    conn.execute("""
        CREATE TABLE nj_docs (idx INTEGER, content TEXT);
        CREATE TABLE ny_docs (idx INTEGER, content TEXT);
    """)

    # Insert data
    print("  Loading NJ into DuckDB...", end=" ", flush=True)
    nj_rows = [(i, doc.get('content', '') or '') for i, doc in enumerate(nj_data)]
    conn.executemany("INSERT INTO nj_docs VALUES (?, ?)", nj_rows)
    print("done")

    print("  Loading NY into DuckDB...", end=" ", flush=True)
    ny_rows = [(i, doc.get('content', '') or '') for i, doc in enumerate(ny_data)]
    conn.executemany("INSERT INTO ny_docs VALUES (?, ?)", ny_rows)
    print("done")

    results = {'nj': {}, 'ny': {}}
    nj_doc_issues = defaultdict(set)
    ny_doc_issues = defaultdict(set)

    print(f"  Running {len(ISSUE_PATTERNS)} issue patterns...")

    for issue_key, config in ISSUE_PATTERNS.items():
        # Build combined regex pattern, escaping single quotes for SQL
        escaped_patterns = [p.replace("'", "''") for p in config['patterns']]
        combined = '|'.join(f'({p})' for p in escaped_patterns)

        # Query NJ
        nj_matches = conn.execute(f"""
            SELECT idx FROM nj_docs
            WHERE regexp_matches(lower(content), '{combined}')
        """).fetchall()
        results['nj'][issue_key] = len(nj_matches)
        for (idx,) in nj_matches:
            nj_doc_issues[idx].add(issue_key)

        # Query NY
        ny_matches = conn.execute(f"""
            SELECT idx FROM ny_docs
            WHERE regexp_matches(lower(content), '{combined}')
        """).fetchall()
        results['ny'][issue_key] = len(ny_matches)
        for (idx,) in ny_matches:
            ny_doc_issues[idx].add(issue_key)

    # Calculate overlaps
    results['nj_overlap'] = Counter(len(issues) for issues in nj_doc_issues.values())
    results['ny_overlap'] = Counter(len(issues) for issues in ny_doc_issues.values())
    results['nj_unique_docs'] = len(nj_doc_issues)
    results['ny_unique_docs'] = len(ny_doc_issues)
    results['nj_total'] = sum(results['nj'].values())
    results['ny_total'] = sum(results['ny'].values())

    conn.close()
    return results


def analyze_with_python(nj_data: list[dict], ny_data: list[dict]) -> dict:
    """Analyze both states using pure Python (fallback)."""
    print("\nAnalyzing with Python...")

    # Pre-compile all patterns
    compiled = {}
    for issue_key, config in ISSUE_PATTERNS.items():
        compiled[issue_key] = [re.compile(p, re.IGNORECASE) for p in config['patterns']]

    results = {'nj': {}, 'ny': {}}

    for state, data in [('nj', nj_data), ('ny', ny_data)]:
        print(f"  Processing {state.upper()}...", end=" ", flush=True)
        doc_issues = defaultdict(set)
        issue_counts = defaultdict(int)

        for idx, doc in enumerate(data):
            content = doc.get('content', '') or ''
            if not content:
                continue
            content_lower = content.lower()

            for issue_key, patterns in compiled.items():
                for pattern in patterns:
                    if pattern.search(content_lower):
                        issue_counts[issue_key] += 1
                        doc_issues[idx].add(issue_key)
                        break

        results[state] = dict(issue_counts)
        results[f'{state}_overlap'] = Counter(len(issues) for issues in doc_issues.values())
        results[f'{state}_unique_docs'] = len(doc_issues)
        results[f'{state}_total'] = sum(issue_counts.values())
        print("done")

    return results


def generate_markdown(results: dict, output_path: Path):
    """Generate markdown report with tables."""
    lines = [
        "# Compliance Issue Pattern Analysis",
        "",
        f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "",
        "## Summary",
        "",
        "| Metric | NJ | NY | Combined |",
        "|--------|---:|---:|----------|",
        f"| Total Documents | 62,460 | 61,620 | 124,080 |",
        f"| Documents with Issues | {results['nj_unique_docs']:,} | {results['ny_unique_docs']:,} | {results['nj_unique_docs'] + results['ny_unique_docs']:,} |",
        f"| Total Issue Matches | {results['nj_total']:,} | {results['ny_total']:,} | {results['nj_total'] + results['ny_total']:,} |",
        f"| Coverage | {results['nj_unique_docs']/62460*100:.1f}% | {results['ny_unique_docs']/61620*100:.1f}% | {(results['nj_unique_docs'] + results['ny_unique_docs'])/124080*100:.1f}% |",
        "",
        "## Issue Counts by Type",
        "",
        "| Issue Type | Category | NJ | NY | Total |",
        "|------------|----------|---:|---:|------:|",
    ]

    # Sort by total count
    all_issues = sorted(
        ISSUE_PATTERNS.keys(),
        key=lambda k: results['nj'].get(k, 0) + results['ny'].get(k, 0),
        reverse=True
    )

    for issue_key in all_issues:
        nj_count = results['nj'].get(issue_key, 0)
        ny_count = results['ny'].get(issue_key, 0)
        total = nj_count + ny_count
        display = ISSUE_PATTERNS[issue_key]['display']
        category = ISSUE_PATTERNS[issue_key]['category']
        lines.append(f"| {display} | {category} | {nj_count:,} | {ny_count:,} | {total:,} |")

    lines.extend([
        "",
        "## Document Overlap Analysis",
        "",
        "Shows how many documents match multiple issue types (indicates complexity).",
        "",
        "| # Issue Types | NJ Docs | NY Docs | Total |",
        "|---------------|--------:|--------:|------:|",
    ])

    # Get all overlap counts
    all_counts = set(results['nj_overlap'].keys()) | set(results['ny_overlap'].keys())
    for n in sorted(all_counts):
        nj = results['nj_overlap'].get(n, 0)
        ny = results['ny_overlap'].get(n, 0)
        lines.append(f"| {n} | {nj:,} | {ny:,} | {nj + ny:,} |")

    lines.extend([
        "",
        "## LLM Call Estimates",
        "",
        "| Approach | NJ | NY | Total |",
        "|----------|---:|---:|------:|",
        f"| Separate calls (1 per issue per doc) | {results['nj_total']:,} | {results['ny_total']:,} | {results['nj_total'] + results['ny_total']:,} |",
        f"| Combined calls (1 per doc) | {results['nj_unique_docs']:,} | {results['ny_unique_docs']:,} | {results['nj_unique_docs'] + results['ny_unique_docs']:,} |",
        f"| Savings | {results['nj_total'] - results['nj_unique_docs']:,} ({(results['nj_total'] - results['nj_unique_docs'])/results['nj_total']*100:.1f}%) | {results['ny_total'] - results['ny_unique_docs']:,} ({(results['ny_total'] - results['ny_unique_docs'])/results['ny_total']*100:.1f}%) | |",
        "",
    ])

    output_path.write_text('\n'.join(lines))
    print(f"\nReport written to: {output_path}")


def sample_matches(state: str, issue_key: str, n: int = 5):
    """Show sample matches for an issue type."""
    if issue_key not in ISSUE_PATTERNS:
        print(f"Unknown issue type: {issue_key}")
        print(f"Available: {', '.join(sorted(ISSUE_PATTERNS.keys()))}")
        return

    data = load_local_data(state)
    patterns = [re.compile(p, re.IGNORECASE) for p in ISSUE_PATTERNS[issue_key]['patterns']]

    print(f"\n{'='*70}")
    print(f"SAMPLE MATCHES: {ISSUE_PATTERNS[issue_key]['display']}")
    print(f"Patterns: {ISSUE_PATTERNS[issue_key]['patterns']}")
    print(f"{'='*70}\n")

    found = 0
    for doc in data:
        content = doc.get('content', '') or ''
        if not content:
            continue

        for pattern in patterns:
            match = pattern.search(content)
            if match:
                start = max(0, match.start() - 100)
                end = min(len(content), match.end() + 100)
                context = content[start:end]

                title = doc.get('title', 'No title')[:60]
                print(f"[{found+1}] {title}")
                print(f"    Matched: '{match.group()}'")
                print(f"    Context: ...{context}...")
                print()

                found += 1
                break

        if found >= n:
            break

    if found == 0:
        print("No matches found.")


def test_pattern(state: str, pattern_str: str):
    """Test a custom regex pattern."""
    try:
        pattern = re.compile(pattern_str, re.IGNORECASE)
    except re.error as e:
        print(f"Invalid regex: {e}")
        return

    data = load_local_data(state)
    count = 0
    samples = []

    for doc in data:
        content = doc.get('content', '') or ''
        if not content:
            continue

        match = pattern.search(content)
        if match:
            count += 1
            if len(samples) < 3:
                start = max(0, match.start() - 50)
                end = min(len(content), match.end() + 50)
                samples.append({
                    'title': doc.get('title', '')[:50],
                    'match': match.group(),
                    'context': content[start:end],
                })

    print(f"\nPattern: {pattern_str}")
    print(f"Matches: {count}")
    print("\nSamples:")
    for s in samples:
        print(f"  [{s['title']}] '{s['match']}'")
        print(f"    ...{s['context']}...")


def main():
    parser = argparse.ArgumentParser(description='Analyze regex patterns against regulation data')
    parser.add_argument('--state', '-s', default='nj', choices=['nj', 'ny'], help='State for sampling')
    parser.add_argument('--sample', nargs=2, metavar=('ISSUE', 'N'), help='Show N samples for ISSUE type')
    parser.add_argument('--pattern', '-p', help='Test a custom regex pattern')
    parser.add_argument('--list', '-l', action='store_true', help='List all issue types')
    parser.add_argument('--output', '-o', default='data/outputs/pattern_analysis.md', help='Output markdown file')
    parser.add_argument('--no-duckdb', action='store_true', help='Use Python instead of DuckDB')

    args = parser.parse_args()

    if args.list:
        print(f"\nAvailable issue types ({len(ISSUE_PATTERNS)}):")
        for key in sorted(ISSUE_PATTERNS.keys()):
            print(f"  {key:<30} {ISSUE_PATTERNS[key]['display']}")
        return

    if args.sample:
        issue_key, n = args.sample
        sample_matches(args.state, issue_key, int(n))
        return

    if args.pattern:
        test_pattern(args.state, args.pattern)
        return

    # Full analysis
    nj_data = load_local_data('nj')
    ny_data = load_local_data('ny')

    if HAS_DUCKDB and not args.no_duckdb:
        results = analyze_with_duckdb(nj_data, ny_data)
    else:
        if not args.no_duckdb:
            print("DuckDB not available, using Python fallback")
        results = analyze_with_python(nj_data, ny_data)

    # Generate markdown report
    output_path = Path(__file__).parent.parent.parent / args.output
    output_path.parent.mkdir(parents=True, exist_ok=True)
    generate_markdown(results, output_path)

    # Also print summary to console
    print(f"\n{'='*70}")
    print("SUMMARY")
    print(f"{'='*70}")
    print(f"NJ: {results['nj_unique_docs']:,} docs with issues ({results['nj_total']:,} total matches)")
    print(f"NY: {results['ny_unique_docs']:,} docs with issues ({results['ny_total']:,} total matches)")
    print(f"Combined: {results['nj_unique_docs'] + results['ny_unique_docs']:,} docs")


if __name__ == "__main__":
    main()
