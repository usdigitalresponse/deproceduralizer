#!/usr/bin/env python3
"""Generate HTML review interface for summaries."""

import argparse
import json
import sys
from pathlib import Path

# Color palette for hierarchy levels
LEVEL_COLORS = {
    "section": {"bg": "#dbeafe", "text": "#1e40af"},  # Blue
    "part": {"bg": "#dcfce7", "text": "#166534"},  # Green
    "subpart": {"bg": "#d1fae5", "text": "#065f46"},  # Teal
    "chapter": {"bg": "#fef3c7", "text": "#92400e"},  # Amber
    "subchapter": {"bg": "#fef9c3", "text": "#854d0e"},  # Yellow
    "title": {"bg": "#f3e8ff", "text": "#7c3aed"},  # Purple
    "article": {"bg": "#ffe4e6", "text": "#be123c"},  # Rose
    "subtitle": {"bg": "#e0e7ff", "text": "#4338ca"},  # Indigo
}

DEFAULT_COLOR = {"bg": "#f3f4f6", "text": "#374151"}  # Gray

HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Summary Review - {filename}</title>
    <style>
        * {{ box-sizing: border-box; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
            background: #f9fafb;
            color: #111827;
        }}
        h1 {{ margin-bottom: 8px; }}
        .stats {{
            color: #6b7280;
            margin-bottom: 20px;
            font-size: 0.95em;
        }}
        .stats span {{
            margin-right: 16px;
        }}
        .stats .approved {{ color: #16a34a; font-weight: 600; }}
        .stats .rejected {{ color: #dc2626; font-weight: 600; }}
        .stats .pending {{ color: #d97706; font-weight: 600; }}

        .controls {{
            position: sticky;
            top: 0;
            background: #f9fafb;
            padding: 12px 0;
            border-bottom: 1px solid #e5e7eb;
            margin-bottom: 20px;
            z-index: 100;
            display: flex;
            flex-wrap: wrap;
            gap: 16px;
            align-items: center;
        }}
        .controls label {{
            display: flex;
            align-items: center;
            gap: 6px;
            cursor: pointer;
        }}
        .controls select {{
            padding: 6px 12px;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            background: white;
        }}
        .view-toggle {{
            display: flex;
            gap: 8px;
        }}
        .view-toggle button {{
            padding: 6px 12px;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            background: white;
            cursor: pointer;
        }}
        .view-toggle button.active {{
            background: #3b82f6;
            color: white;
            border-color: #3b82f6;
        }}

        .level-group {{
            margin-bottom: 32px;
        }}
        .level-group h2 {{
            font-size: 1.1em;
            color: #374151;
            margin-bottom: 12px;
            padding: 8px 12px;
            background: #e5e7eb;
            border-radius: 6px;
        }}

        .summary-card {{
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 12px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }}
        .summary-card.approved {{ border-left: 4px solid #16a34a; }}
        .summary-card.rejected {{ border-left: 4px solid #dc2626; }}
        .summary-card.pending {{ border-left: 4px solid #d97706; }}

        .card-header {{
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            align-items: center;
            margin-bottom: 8px;
        }}

        .level-badge {{
            display: inline-block;
            padding: 3px 10px;
            border-radius: 12px;
            font-size: 0.75em;
            font-weight: 600;
            text-transform: uppercase;
        }}
        .state-badge {{
            display: inline-block;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 0.7em;
            font-weight: 600;
            background: #1f2937;
            color: white;
        }}

        .card-title {{
            font-weight: 500;
            color: #111827;
            flex: 1;
            min-width: 200px;
        }}

        .card-meta {{
            font-size: 0.85em;
            color: #6b7280;
            margin-bottom: 12px;
        }}
        .card-meta span {{
            margin-right: 12px;
        }}

        .flag {{
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 0.75em;
            font-weight: 500;
            margin-right: 6px;
        }}
        .flag.truncated {{ background: #fef3c7; color: #92400e; }}
        .flag.definitions {{ background: #dbeafe; color: #1e40af; }}
        .flag.toc {{ background: #f3e8ff; color: #7c3aed; }}
        .flag.multi-chunk {{ background: #fce7f3; color: #be185d; }}
        .flag.error {{ background: #fee2e2; color: #dc2626; }}
        .flag.unparseable {{ background: #e5e7eb; color: #374151; }}

        .summary-text {{
            background: #f8fafc;
            padding: 12px 16px;
            border-radius: 6px;
            line-height: 1.6;
            font-size: 0.95em;
        }}

        .compression {{
            font-size: 0.8em;
            color: #6b7280;
            margin-top: 8px;
        }}

        .doc-id {{
            font-size: 0.8em;
            color: #9ca3af;
        }}

        @media (max-width: 768px) {{
            .controls {{ flex-direction: column; align-items: flex-start; }}
            .card-header {{ flex-direction: column; align-items: flex-start; }}
        }}
    </style>
</head>
<body>
    <h1>Summary Review</h1>
    <div class="stats">
        <span>Total: <strong>{total}</strong></span>
        <span class="approved">Approved: {approved}</span>
        <span class="rejected">Rejected: {rejected}</span>
        <span class="pending">Pending: {pending}</span>
    </div>

    <div class="controls">
        <label><input type="checkbox" id="showPending" checked> Pending</label>
        <label><input type="checkbox" id="showApproved"> Approved</label>
        <label><input type="checkbox" id="showRejected"> Rejected</label>

        <select id="levelFilter">
            <option value="">All Levels</option>
            {level_options}
        </select>

        <select id="stateFilter">
            <option value="">All States</option>
            {state_options}
        </select>

        <div class="view-toggle">
            <button id="listView" class="active">List View</button>
            <button id="groupView">Group by Level</button>
        </div>
    </div>

    <div id="summaries-list">
        {cards}
    </div>

    <div id="summaries-grouped" style="display: none;">
        {grouped_cards}
    </div>

    <script>
        function filterCards() {{
            const showPending = document.getElementById('showPending').checked;
            const showApproved = document.getElementById('showApproved').checked;
            const showRejected = document.getElementById('showRejected').checked;
            const level = document.getElementById('levelFilter').value;
            const state = document.getElementById('stateFilter').value;

            document.querySelectorAll('.summary-card').forEach(card => {{
                const cardStatus = card.dataset.status;
                const cardLevel = card.dataset.level;
                const cardState = card.dataset.state;

                let show = false;
                if (cardStatus === 'pending' && showPending) show = true;
                if (cardStatus === 'approved' && showApproved) show = true;
                if (cardStatus === 'rejected' && showRejected) show = true;

                if (level && cardLevel !== level) show = false;
                if (state && cardState !== state) show = false;

                card.style.display = show ? 'block' : 'none';
            }});

            // Update group visibility
            document.querySelectorAll('.level-group').forEach(group => {{
                const visibleCards = group.querySelectorAll('.summary-card[style="display: block;"]');
                group.style.display = visibleCards.length > 0 ? 'block' : 'none';
            }});
        }}

        function toggleView(view) {{
            const listView = document.getElementById('summaries-list');
            const groupView = document.getElementById('summaries-grouped');
            const listBtn = document.getElementById('listView');
            const groupBtn = document.getElementById('groupView');

            if (view === 'list') {{
                listView.style.display = 'block';
                groupView.style.display = 'none';
                listBtn.classList.add('active');
                groupBtn.classList.remove('active');
            }} else {{
                listView.style.display = 'none';
                groupView.style.display = 'block';
                listBtn.classList.remove('active');
                groupBtn.classList.add('active');
            }}
            filterCards();
        }}

        document.querySelectorAll('.controls input, .controls select').forEach(el => {{
            el.addEventListener('change', filterCards);
        }});

        document.getElementById('listView').addEventListener('click', () => toggleView('list'));
        document.getElementById('groupView').addEventListener('click', () => toggleView('group'));

        // Initial filter
        filterCards();
    </script>
</body>
</html>
"""

CARD_TEMPLATE = """<div class="summary-card {status}" data-status="{status}" data-level="{level}" data-state="{state}">
    <div class="card-header">
        <span class="state-badge">{state}</span>
        <span class="level-badge" style="background: {level_bg}; color: {level_text};">{level}</span>
        <span class="card-title">{title}</span>
        <span class="doc-id">ID: {doc_id}</span>
    </div>
    <div class="card-meta">
        <span>{original_words} words -> {summary_words} words</span>
        <span>Strategy: {strategy}</span>
        <span>{processing_time}ms</span>
        {flags}
    </div>
    <div class="summary-text">{summary}</div>
    <div class="compression">Compression: {compression}</div>
</div>
"""


def generate_html(filepath: str):
    with open(filepath) as f:
        summaries = json.load(f)

    # Stats
    by_status = {"approved": 0, "rejected": 0, "pending": 0}
    levels = set()
    states = set()
    by_level: dict[str, list] = {}

    for s in summaries:
        status = s.get("review_status", "pending")
        by_status[status] = by_status.get(status, 0) + 1
        level = s.get("hierarchy_level", "unknown")
        state = s.get("state", "unknown")
        levels.add(level)
        states.add(state)

        if level not in by_level:
            by_level[level] = []
        by_level[level].append(s)

    # Generate cards for list view
    cards = []
    for s in summaries:
        cards.append(generate_card(s))

    # Generate grouped cards
    grouped_html = []
    for level in sorted(by_level.keys()):
        level_cards = [generate_card(s) for s in by_level[level]]
        grouped_html.append(
            f'<div class="level-group" data-level="{level}">'
            f'<h2>{level.upper()} ({len(level_cards)} documents)</h2>'
            f'{"".join(level_cards)}'
            f'</div>'
        )

    level_options = "\n".join(
        f'<option value="{l}">{l} ({len(by_level.get(l, []))})</option>'
        for l in sorted(levels)
    )
    state_options = "\n".join(f'<option value="{s}">{s}</option>' for s in sorted(states))

    html = HTML_TEMPLATE.format(
        filename=Path(filepath).name,
        total=len(summaries),
        approved=by_status["approved"],
        rejected=by_status["rejected"],
        pending=by_status["pending"],
        level_options=level_options,
        state_options=state_options,
        cards="\n".join(cards),
        grouped_cards="\n".join(grouped_html),
    )

    output_path = Path(filepath).with_suffix(".html")
    with open(output_path, "w") as f:
        f.write(html)

    print(f"Generated: {output_path}")
    return output_path


def generate_card(s: dict) -> str:
    status = s.get("review_status", "pending")
    level = s.get("hierarchy_level", "unknown")
    state = s.get("state", "unknown")
    meta = s.get("metadata", {})

    # Get level colors
    colors = LEVEL_COLORS.get(level, DEFAULT_COLOR)

    # Build flags
    flags_html = []
    if meta.get("was_truncated"):
        flags_html.append('<span class="flag truncated">Truncated</span>')
    if meta.get("contains_definitions"):
        flags_html.append('<span class="flag definitions">Definitions</span>')
    if meta.get("is_index_or_toc"):
        flags_html.append('<span class="flag toc">Index/TOC</span>')
    if meta.get("num_chunks", 1) > 1:
        flags_html.append(
            f'<span class="flag multi-chunk">{meta["num_chunks"]} chunks</span>'
        )
    if meta.get("error"):
        flags_html.append('<span class="flag error">Error</span>')
    if meta.get("is_unparseable"):
        reason = meta.get("unparseable_reason", "unknown")
        flags_html.append(f'<span class="flag unparseable">Unparseable: {reason}</span>')

    # Calculate compression
    orig_words = meta.get("original_word_count", 0)
    summ_words = meta.get("summary_word_count", 0)
    if orig_words > 0:
        ratio = summ_words / orig_words
        compression = f"{orig_words} -> {summ_words} words ({ratio:.1%})"
    else:
        compression = "N/A"

    return CARD_TEMPLATE.format(
        status=status,
        level=level,
        state=state,
        level_bg=colors["bg"],
        level_text=colors["text"],
        title=s.get("title", "Untitled")[:100],
        doc_id=s.get("document_id", "?"),
        original_words=orig_words,
        summary_words=summ_words,
        strategy=meta.get("chunking_strategy", "unknown"),
        processing_time=meta.get("processing_time_ms", 0),
        flags="".join(flags_html),
        summary=s.get("summary", "[No summary]"),
        compression=compression,
    )


def main():
    parser = argparse.ArgumentParser(description="Generate HTML review interface")
    parser.add_argument("filepath", help="Path to summaries JSON file")

    args = parser.parse_args()

    if not Path(args.filepath).exists():
        print(f"Error: File not found: {args.filepath}")
        sys.exit(1)

    output_path = generate_html(args.filepath)
    print(f"\nOpen in browser: file://{output_path.absolute()}")


if __name__ == "__main__":
    main()
