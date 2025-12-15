#!/usr/bin/env python3
"""Search for wet signature and related terms in scraped regulations."""

import json
from pathlib import Path
import re

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

def search_files():
    data_dir = Path(__file__).parent.parent.parent / "data" / "individual_regulations"

    if not data_dir.exists():
        print(f"Directory not found: {data_dir}")
        return

    files = list(data_dir.glob("*.json"))
    print(f"Searching {len(files)} files...\n")

    matches = []

    for f in files:
        try:
            with open(f, 'r') as fp:
                data = json.load(fp)

            content = data.get('content', '').lower()
            title = data.get('title', '')
            url = data.get('url', '')

            for term in SIGNATURE_TERMS:
                if re.search(term, content, re.IGNORECASE):
                    # Get context around match
                    match = re.search(f".{{0,100}}{term}.{{0,100}}", content, re.IGNORECASE)
                    context = match.group(0) if match else ""

                    matches.append({
                        'file': f.name,
                        'title': title,
                        'url': url,
                        'term': term,
                        'context': context.strip(),
                        'nycrr_title': data.get('nycrr_title'),
                        'nycrr_part': data.get('nycrr_part'),
                    })
                    break  # One match per file is enough

        except Exception as e:
            continue

    print(f"Found {len(matches)} potential matches:\n")
    print("=" * 80)

    for m in matches:
        print(f"\nTitle: {m['title'][:80]}")
        print(f"NYCRR: Title {m['nycrr_title']}, Part {m['nycrr_part']}")
        print(f"Term: {m['term']}")
        print(f"Context: ...{m['context']}...")
        print(f"URL: {m['url']}")
        print("-" * 80)

if __name__ == "__main__":
    search_files()
