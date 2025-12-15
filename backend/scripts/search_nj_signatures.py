#!/usr/bin/env python3
"""Search for wet signature requirements in NJ regulations - triage approach.

Triage strategy: Cast a wide net first to find anything that MIGHT be a wet
signature requirement, then categorize by likelihood.
"""

import csv
import json
from pathlib import Path
import re
from collections import defaultdict
from html import escape

# Tier 1: Strong indicators of wet/physical signature requirements
TIER1_TERMS = [
    r"wet signature",
    r"original signature",
    r"ink signature",
    r"handwritten signature",
    r"physical signature",
    r"signed in ink",
    r"manually signed",
    r"hand-signed",
    r"pen and ink",
    r"signature.{0,20}original",
    r"original.{0,20}signature",
]

# Tier 2: Likely indicators (notarization often implies wet signature)
TIER2_TERMS = [
    r"notarized signature",
    r"signature.{0,20}notari",
    r"notari.{0,20}signature",
    r"acknowledged before",
    r"sworn.{0,20}before",
    r"subscribed.{0,20}before",
    r"affidavit",
    r"under oath",
]

# Tier 3: Electronic signature exclusions (explicitly requires non-electronic)
TIER3_TERMS = [
    r"electronic.{0,20}signature.{0,20}not",
    r"facsimile.{0,20}not.{0,20}accept",
    r"no electronic.{0,20}signature",
    r"not.{0,20}accept.{0,20}electronic",
    r"fax.{0,20}not.{0,20}accept",
]

# Tier 4: General signature requirements (needs manual review)
TIER4_TERMS = [
    r"must be signed",
    r"shall be signed",
    r"signature required",
    r"signed by the applicant",
    r"applicant.{0,10}signature",
    r"signature of.{0,20}applicant",
    r"personally sign",
    r"in writing.{0,30}signed",
    r"signed.{0,20}in writing",
    r"bear.{0,10}signature",
    r"signature.{0,10}required",
    r"requires?.{0,10}signature",
]


def get_context(content: str, term: str, context_chars: int = 500) -> str:
    """Get paragraph-level context around a match."""
    # First find the match position
    match = re.search(term, content, re.IGNORECASE)
    if not match:
        return ""

    start_pos = match.start()
    end_pos = match.end()

    # Try to expand to paragraph boundaries (look for double newlines or section markers)
    # Look backwards for paragraph start
    para_start = max(0, start_pos - context_chars)
    # Try to find a paragraph boundary
    text_before = content[para_start:start_pos]
    para_break = text_before.rfind('\n\n')
    if para_break != -1:
        para_start = para_start + para_break + 2
    else:
        # Try single newline followed by section marker like (a), (b), (1), etc.
        section_match = re.search(r'\n\([a-z0-9]+\)', text_before)
        if section_match:
            para_start = para_start + section_match.start() + 1

    # Look forwards for paragraph end
    para_end = min(len(content), end_pos + context_chars)
    text_after = content[end_pos:para_end]
    para_break = text_after.find('\n\n')
    if para_break != -1:
        para_end = end_pos + para_break
    else:
        # Try to find end at a period followed by newline or section marker
        period_match = re.search(r'\.\s*\n', text_after)
        if period_match:
            para_end = end_pos + period_match.end()

    context = content[para_start:para_end].strip()
    return context


def search_files():
    data_dir = Path(__file__).parent.parent.parent / "data" / "nj_individual_regulations"

    if not data_dir.exists():
        print(f"Directory not found: {data_dir}")
        return

    files = list(data_dir.glob("*.json"))
    print(f"Searching {len(files)} NJ regulation files...\n")

    results = {
        "tier1": [],  # Strong wet signature indicators
        "tier2": [],  # Notarization/oath requirements
        "tier3": [],  # Electronic signature exclusions
        "tier4": [],  # General signature requirements
    }

    seen_files = set()  # Track files to avoid duplicates across tiers

    for f in files:
        try:
            with open(f, 'r') as fp:
                data = json.load(fp)

            content = data.get('content', '')
            content_lower = content.lower()
            title = data.get('title', '')
            url = data.get('url', '')

            # Check tiers in order (higher priority first)
            matched_tier = None
            matched_term = None

            for tier, terms in [("tier1", TIER1_TERMS), ("tier2", TIER2_TERMS),
                               ("tier3", TIER3_TERMS), ("tier4", TIER4_TERMS)]:
                if f.name in seen_files:
                    break

                for term in terms:
                    if re.search(term, content_lower, re.IGNORECASE):
                        matched_tier = tier
                        matched_term = term
                        seen_files.add(f.name)
                        break

                if matched_tier:
                    break

            if matched_tier:
                context = get_context(content_lower, matched_term)
                results[matched_tier].append({
                    'file': f.name,
                    'title': title,
                    'url': url,
                    'term': matched_term,
                    'context': context,
                    'njac_title': data.get('njac_title'),
                    'njac_title_name': data.get('njac_title_name'),
                    'njac_chapter': data.get('njac_chapter'),
                    'njac_chapter_name': data.get('njac_chapter_name'),
                    'njac_subchapter': data.get('njac_subchapter'),
                    'njac_section': data.get('njac_section'),
                })

        except Exception as e:
            continue

    # Print summary
    print("=" * 80)
    print("TRIAGE RESULTS SUMMARY")
    print("=" * 80)
    print(f"\nTier 1 (Strong wet signature indicators): {len(results['tier1'])} matches")
    print(f"Tier 2 (Notarization/oath requirements):  {len(results['tier2'])} matches")
    print(f"Tier 3 (Electronic signature exclusions): {len(results['tier3'])} matches")
    print(f"Tier 4 (General signature requirements):  {len(results['tier4'])} matches")
    print(f"\nTotal unique regulations with potential wet signature requirements: {sum(len(v) for v in results.values())}")

    # Print detailed results by tier
    for tier_name, tier_label in [
        ("tier1", "TIER 1: STRONG WET SIGNATURE INDICATORS"),
        ("tier2", "TIER 2: NOTARIZATION/OATH REQUIREMENTS"),
        ("tier3", "TIER 3: ELECTRONIC SIGNATURE EXCLUSIONS"),
        ("tier4", "TIER 4: GENERAL SIGNATURE REQUIREMENTS"),
    ]:
        print(f"\n\n{'=' * 80}")
        print(tier_label)
        print(f"{'=' * 80}")

        for m in results[tier_name]:
            print(f"\nTitle: {m['title'][:100]}")
            print(f"NJAC: Title {m['njac_title']} ({m['njac_title_name']})")
            print(f"      Chapter {m['njac_chapter']}, Subchapter {m['njac_subchapter']}")
            print(f"Term matched: {m['term']}")
            print(f"Context: ...{m['context'][:200]}...")
            print(f"URL: {m['url']}")
            print("-" * 80)

    # Save results to JSON for further processing
    output_path = Path(__file__).parent.parent.parent / "data" / "outputs" / "nj_wet_signature_triage.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, 'w') as fp:
        json.dump(results, fp, indent=2)

    print(f"\n\nResults saved to: {output_path}")

    return results


def generate_csv(results: dict, output_path: Path):
    """Generate CSV export of all results."""
    rows = []

    tier_labels = {
        "tier1": "Tier 1: Strong wet signature indicators",
        "tier2": "Tier 2: Notarization/oath requirements",
        "tier3": "Tier 3: Electronic signature exclusions",
        "tier4": "Tier 4: General signature requirements",
    }

    for tier_name, tier_label in tier_labels.items():
        for match in results[tier_name]:
            rows.append({
                "tier": tier_name,
                "tier_label": tier_label,
                "title": match["title"],
                "njac_title": match["njac_title"],
                "njac_title_name": match["njac_title_name"],
                "njac_chapter": match["njac_chapter"],
                "njac_chapter_name": match.get("njac_chapter_name", ""),
                "njac_subchapter": match["njac_subchapter"],
                "njac_section": match["njac_section"],
                "term_matched": match["term"],
                "context": match["context"],
                "url": match["url"],
                "file": match["file"],
            })

    with open(output_path, 'w', newline='', encoding='utf-8') as f:
        if rows:
            writer = csv.DictWriter(f, fieldnames=rows[0].keys())
            writer.writeheader()
            writer.writerows(rows)

    print(f"CSV saved to: {output_path}")


def highlight_term_in_context(context: str, term: str) -> str:
    """Highlight the matched term in the context with HTML span."""
    # First find what the regex actually matched in the original context
    match = re.search(term, context, re.IGNORECASE)
    if not match:
        # If no match found, just return escaped context
        return escape(context)

    matched_text = match.group(0)
    start, end = match.start(), match.end()

    # Build the highlighted string with proper escaping
    before = escape(context[:start])
    highlighted_part = f'<span class="highlight">{escape(matched_text)}</span>'
    after = escape(context[end:])

    return before + highlighted_part + after


def generate_html(results: dict, output_path: Path):
    """Generate HTML table viewer with highlighted matches and filters."""

    tier_info = {
        "tier1": {"label": "Tier 1: Strong Wet Signature Indicators", "color": "#dc3545", "bg": "#f8d7da"},
        "tier2": {"label": "Tier 2: Notarization/Oath Requirements", "color": "#fd7e14", "bg": "#ffe5d0"},
        "tier3": {"label": "Tier 3: Electronic Signature Exclusions", "color": "#6f42c1", "bg": "#e2d9f3"},
        "tier4": {"label": "Tier 4: General Signature Requirements", "color": "#0d6efd", "bg": "#cfe2ff"},
    }

    # Collect all unique terms
    all_terms = set()
    all_titles = set()
    for tier_results in results.values():
        for m in tier_results:
            all_terms.add(m["term"])
            if m["njac_title"] and m["njac_title_name"]:
                all_titles.add((str(m["njac_title"]), m["njac_title_name"]))

    html = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NJ Wet Signature Requirements - Triage Results</title>
    <style>
        * { box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0; padding: 20px; background: #f5f5f5;
            line-height: 1.5;
        }
        .container { max-width: 1600px; margin: 0 auto; }
        h1 { color: #333; margin-bottom: 10px; }
        .summary {
            background: white; padding: 20px; border-radius: 8px;
            margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .summary-stats { display: flex; gap: 15px; flex-wrap: wrap; margin-top: 15px; }
        .stat-box {
            padding: 10px 20px; border-radius: 6px;
            font-weight: bold; font-size: 1em;
        }
        .filters {
            background: white; padding: 15px 20px; border-radius: 8px;
            margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            display: flex; gap: 15px; flex-wrap: wrap; align-items: center;
        }
        .filters label { font-weight: 500; font-size: 0.9em; }
        .filters select, .filters input {
            padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px;
            font-size: 13px;
        }
        .filters input[type="text"] { width: 200px; }
        .filter-group { display: flex; align-items: center; gap: 6px; }
        .results-count {
            margin-left: auto; font-weight: 500; color: #666;
        }
        .table-container {
            background: white; border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        table {
            width: 100%; border-collapse: collapse;
            font-size: 0.9em;
        }
        thead {
            background: #f8f9fa; position: sticky; top: 0;
        }
        th {
            padding: 12px 15px; text-align: left; font-weight: 600;
            border-bottom: 2px solid #dee2e6; color: #495057;
            cursor: pointer; user-select: none;
        }
        th:hover { background: #e9ecef; }
        td {
            padding: 12px 15px; border-bottom: 1px solid #eee;
            vertical-align: top;
        }
        tr:hover { background: #f8f9fa; }
        .tier-badge {
            display: inline-block; padding: 3px 8px; border-radius: 4px;
            font-size: 0.75em; font-weight: 600; white-space: nowrap;
        }
        .tier1-badge { background: #f8d7da; color: #842029; }
        .tier2-badge { background: #ffe5d0; color: #984c0c; }
        .tier3-badge { background: #e2d9f3; color: #59359a; }
        .tier4-badge { background: #cfe2ff; color: #084298; }
        .term-cell {
            font-family: monospace; font-size: 0.85em;
            background: #f0f0f0; padding: 2px 6px; border-radius: 3px;
        }
        .context-cell {
            max-width: 600px; line-height: 1.6;
        }
        .context-wrapper { position: relative; }
        .context-text {
            max-height: 100px; overflow: hidden;
            transition: max-height 0.3s ease;
        }
        .context-text.expanded { max-height: 2000px; }
        .expand-btn {
            display: inline-block; margin-top: 8px;
            font-size: 0.8em; color: #0d6efd;
            cursor: pointer; user-select: none;
        }
        .expand-btn:hover { text-decoration: underline; }
        .highlight {
            background: #fff3cd; padding: 1px 3px; border-radius: 2px;
            font-weight: 600; color: #856404;
        }
        .url-link {
            color: #0d6efd; text-decoration: none; font-size: 0.85em;
            display: block; word-break: break-all;
        }
        .url-link:hover { text-decoration: underline; }
        .title-cell { font-weight: 500; }
        .njac-cell { font-size: 0.85em; color: #666; white-space: nowrap; }
        .hidden { display: none !important; }
        @media (max-width: 1200px) {
            .context-cell { max-width: 400px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>NJ Wet Signature Requirements - Triage Results</h1>

        <div class="summary">
            <p>Searched <strong>62,460</strong> New Jersey regulations for potential wet signature requirements.</p>
            <div class="summary-stats">
"""

    # Add summary stats
    total = sum(len(results[t]) for t in tier_info.keys())
    for tier_name, info in tier_info.items():
        count = len(results[tier_name])
        html += f'                <div class="stat-box" style="background: {info["bg"]}; color: {info["color"]};">{info["label"].split(":")[0]}: {count}</div>\n'

    html += f"""            </div>
        </div>

        <div class="filters">
            <div class="filter-group">
                <label>Tier:</label>
                <select id="tierFilter" onchange="filterTable()">
                    <option value="all">All Tiers</option>
                    <option value="tier1">Tier 1: Strong Indicators</option>
                    <option value="tier2">Tier 2: Notarization/Oath</option>
                    <option value="tier3">Tier 3: Electronic Exclusions</option>
                    <option value="tier4">Tier 4: General Requirements</option>
                </select>
            </div>

            <div class="filter-group">
                <label>Phrase Type:</label>
                <select id="termFilter" onchange="filterTable()">
                    <option value="all">All Phrases</option>
"""

    # Add term options grouped by tier
    tier1_terms = sorted(set(m["term"] for m in results["tier1"]))
    tier2_terms = sorted(set(m["term"] for m in results["tier2"]))
    tier3_terms = sorted(set(m["term"] for m in results["tier3"]))
    tier4_terms = sorted(set(m["term"] for m in results["tier4"]))

    if tier1_terms:
        html += '                    <optgroup label="Tier 1: Strong Indicators">\n'
        for term in tier1_terms:
            html += f'                        <option value="{escape(term)}">{escape(term)}</option>\n'
        html += '                    </optgroup>\n'
    if tier2_terms:
        html += '                    <optgroup label="Tier 2: Notarization/Oath">\n'
        for term in tier2_terms:
            html += f'                        <option value="{escape(term)}">{escape(term)}</option>\n'
        html += '                    </optgroup>\n'
    if tier3_terms:
        html += '                    <optgroup label="Tier 3: Electronic Exclusions">\n'
        for term in tier3_terms:
            html += f'                        <option value="{escape(term)}">{escape(term)}</option>\n'
        html += '                    </optgroup>\n'
    if tier4_terms:
        html += '                    <optgroup label="Tier 4: General Requirements">\n'
        for term in tier4_terms:
            html += f'                        <option value="{escape(term)}">{escape(term)}</option>\n'
        html += '                    </optgroup>\n'

    html += """                </select>
            </div>

            <div class="filter-group">
                <label>NJAC Title:</label>
                <select id="titleFilter" onchange="filterTable()">
                    <option value="all">All Titles</option>
"""

    for title_num, title_name in sorted(all_titles, key=lambda x: (x[0].isdigit(), x[0].zfill(10) if x[0].isdigit() else x[0])):
        html += f'                    <option value="{title_num}">Title {title_num}: {escape(title_name[:35])}</option>\n'

    html += f"""                </select>
            </div>

            <div class="filter-group">
                <label>Search:</label>
                <input type="text" id="searchFilter" placeholder="Search..." oninput="filterTable()">
            </div>

            <div class="results-count">
                Showing <span id="visibleCount">{total}</span> of {total} results
            </div>
        </div>

        <div class="table-container">
            <table id="resultsTable">
                <thead>
                    <tr>
                        <th style="width: 100px;">Tier</th>
                        <th style="width: 140px;">Phrase Matched</th>
                        <th style="width: 250px;">Regulation</th>
                        <th style="width: 100px;">NJAC</th>
                        <th>Context (with highlight)</th>
                        <th style="width: 200px;">Source URL</th>
                    </tr>
                </thead>
                <tbody>
"""

    # Build table rows
    tier_badge_class = {
        "tier1": "tier1-badge",
        "tier2": "tier2-badge",
        "tier3": "tier3-badge",
        "tier4": "tier4-badge",
    }
    tier_short = {
        "tier1": "Tier 1",
        "tier2": "Tier 2",
        "tier3": "Tier 3",
        "tier4": "Tier 4",
    }

    for tier_name in ["tier1", "tier2", "tier3", "tier4"]:
        for m in results[tier_name]:
            highlighted_context = highlight_term_in_context(m["context"], m["term"])
            title_escaped = escape(m["title"])
            term_escaped = escape(m["term"])
            njac_info = f"{m['njac_title']}:{m['njac_chapter']}-{m['njac_subchapter']}"

            row_id = f"ctx_{tier_name}_{len(results[tier_name])}"
            html += f"""                    <tr data-tier="{tier_name}" data-term="{term_escaped}" data-njac-title="{m['njac_title']}" data-searchtext="{escape(m['title'].lower())} {escape(m['context'].lower())} {term_escaped.lower()}">
                        <td><span class="tier-badge {tier_badge_class[tier_name]}">{tier_short[tier_name]}</span></td>
                        <td><span class="term-cell">{term_escaped}</span></td>
                        <td class="title-cell">{title_escaped}</td>
                        <td class="njac-cell">{njac_info}</td>
                        <td class="context-cell">
                            <div class="context-wrapper">
                                <div class="context-text">{highlighted_context}</div>
                                <span class="expand-btn" onclick="toggleExpand(this)">[+] Show more</span>
                            </div>
                        </td>
                        <td><a class="url-link" href="{m['url']}" target="_blank">{m['url']}</a></td>
                    </tr>
"""

    html += """                </tbody>
            </table>
        </div>
    </div>

    <script>
        function toggleExpand(btn) {
            const textDiv = btn.previousElementSibling;
            if (textDiv.classList.contains('expanded')) {
                textDiv.classList.remove('expanded');
                btn.textContent = '[+] Show more';
            } else {
                textDiv.classList.add('expanded');
                btn.textContent = '[-] Show less';
            }
        }

        function filterTable() {
            const tierFilter = document.getElementById('tierFilter').value;
            const termFilter = document.getElementById('termFilter').value;
            const titleFilter = document.getElementById('titleFilter').value;
            const searchFilter = document.getElementById('searchFilter').value.toLowerCase();

            let visibleCount = 0;
            const rows = document.querySelectorAll('#resultsTable tbody tr');

            rows.forEach(row => {
                const tier = row.dataset.tier;
                const term = row.dataset.term;
                const njacTitle = row.dataset.njacTitle;
                const searchText = row.dataset.searchtext;

                let visible = true;

                if (tierFilter !== 'all' && tier !== tierFilter) {
                    visible = false;
                }
                if (termFilter !== 'all' && term !== termFilter) {
                    visible = false;
                }
                if (titleFilter !== 'all' && njacTitle !== titleFilter) {
                    visible = false;
                }
                if (searchFilter && !searchText.includes(searchFilter)) {
                    visible = false;
                }

                if (visible) {
                    row.classList.remove('hidden');
                    visibleCount++;
                } else {
                    row.classList.add('hidden');
                }
            });

            document.getElementById('visibleCount').textContent = visibleCount;
        }
    </script>
</body>
</html>
"""

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html)

    print(f"HTML viewer saved to: {output_path}")


if __name__ == "__main__":
    results = search_files()

    if results:
        output_dir = Path(__file__).parent.parent.parent / "data" / "outputs"
        output_dir.mkdir(parents=True, exist_ok=True)

        generate_csv(results, output_dir / "nj_wet_signature_triage.csv")
        generate_html(results, output_dir / "nj_wet_signature_triage.html")
