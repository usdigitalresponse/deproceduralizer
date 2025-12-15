#!/usr/bin/env python3
"""
New Jersey Statutes (N.J.S.A.) Parser

Parses the bulk statutes file from pub.njleg.gov/statutes/STATUTES-TEXT.zip
to extract individual sections with their hierarchy and content.

Citation format: N.J.S.A. Title:Chapter-Section (e.g., 52:27D-119)
"""

import json
import re
import sys
from pathlib import Path
from typing import Optional, Dict, List, Tuple

# Add parent directory to path for config import
sys.path.insert(0, str(Path(__file__).parent.parent))
from config import (
    NJ_STATUTES_INPUT_FILE,
    NJ_STATUTES_OUTPUT_DIR,
    NJ_STATUTES_INDIVIDUAL_DIR,
    NJ_STATUTES_COMPLETE_FILE,
)


# =============================================================================
# PARSING PATTERNS
# =============================================================================

# Pattern for TITLE headers: "TITLE 1         ACTS, LAWS AND STATUTES"
# or "TITLE 2A      	ADMINISTRATION..."
# Requires title name to be mostly uppercase (real headers) not lowercase (inline refs)
TITLE_PATTERN = re.compile(
    r'^TITLE\s+(\d+[A-Za-z]?)\s+([A-Z][A-Z\s,\-\'\"\(\)0-9]+)$'
)

# Pattern for section citations: "52:27D-119.  Short title"
# Matches: 1:1-1., 52:27D-119., 2A:32B-1., 1:1-2.1., 1:1-2a., etc.
SECTION_PATTERN = re.compile(
    r'^(\d+[A-Za-z]?):(\d+[A-Za-z]?)-(\d+(?:\.\d+)?[a-z]?)\.?\s+(.*)$'
)

# Pattern for amendment history at end of sections
AMENDMENT_PATTERN = re.compile(
    r'^(?:amended|L\.\d{4}|P\.L\.\d{4})',
    re.IGNORECASE
)

# Pattern for "et seq." references that indicate statute ranges
ET_SEQ_PATTERN = re.compile(r'C\.(\d+[A-Za-z]?):(\d+[A-Za-z]?)-(\d+(?:\.\d+)?[a-z]?)\s+et\s+seq\.')


# =============================================================================
# PARSING FUNCTIONS
# =============================================================================

def parse_njsa_citation(citation: str) -> Optional[Dict]:
    """
    Parse an N.J.S.A. citation string into components.

    Examples:
        "52:27D-119" -> {'title': '52', 'chapter': '27D', 'section': '119'}
        "1:1-2.1" -> {'title': '1', 'chapter': '1', 'section': '2.1'}
    """
    # Pattern: Title:Chapter-Section
    match = re.match(r'^(\d+[A-Za-z]?):(\d+[A-Za-z]?)-(\d+(?:\.\d+)?[a-z]?)$', citation.strip())
    if match:
        return {
            'title': match.group(1),
            'chapter': match.group(2),
            'section': match.group(3)
        }
    return None


def build_hierarchy_path(title_num: str, title_name: str, chapter: str, section: str, section_name: str) -> str:
    """Build a hierarchy path string for a statute section."""
    parts = []
    if title_num:
        parts.append(f"Title {title_num}" + (f" - {title_name}" if title_name else ""))
    if chapter:
        parts.append(f"Chapter {chapter}")
    if section:
        parts.append(f"§ {title_num}:{chapter}-{section}" + (f" - {section_name}" if section_name else ""))
    return ' > '.join(parts)


def extract_statutory_references(text: str) -> List[str]:
    """
    Extract N.J.S.A. references from regulation text.

    Returns list of citation strings like "52:27D-119", "46:3B-1", etc.
    """
    references = []

    # Pattern for N.J.S.A. citations
    njsa_pattern = re.compile(
        r'N\.J\.S\.A\.\s*(\d+[A-Za-z]?):(\d+[A-Za-z]?)-(\d+(?:\.\d+)?[a-z]?)',
        re.IGNORECASE
    )

    for match in njsa_pattern.finditer(text):
        citation = f"{match.group(1)}:{match.group(2)}-{match.group(3)}"
        if citation not in references:
            references.append(citation)

    return references


class NJStatutesParser:
    """Parser for New Jersey statutes from the official bulk download."""

    def __init__(self, input_file: Path = None):
        self.input_file = input_file or NJ_STATUTES_INPUT_FILE
        self.statutes = []
        self.current_title_num = None
        self.current_title_name = None
        self.titles_found = {}  # title_num -> title_name

    def parse_file(self) -> List[Dict]:
        """Parse the entire statutes file and return list of statute sections."""
        print(f"Parsing {self.input_file}...")

        if not self.input_file.exists():
            print(f"Error: File not found: {self.input_file}")
            return []

        with open(self.input_file, 'r', encoding='utf-8', errors='replace') as f:
            lines = f.readlines()

        print(f"Read {len(lines)} lines")

        current_section = None
        content_lines = []

        for line_num, line in enumerate(lines):
            # Check for TITLE header
            title_match = TITLE_PATTERN.match(line.strip())
            if title_match:
                # Save previous section if exists
                if current_section and content_lines:
                    current_section['content'] = self._clean_content(content_lines)
                    self.statutes.append(current_section)
                    content_lines = []
                    current_section = None

                self.current_title_num = title_match.group(1)
                self.current_title_name = title_match.group(2).strip()
                self.titles_found[self.current_title_num] = self.current_title_name
                print(f"  Found Title {self.current_title_num}: {self.current_title_name}")
                continue

            # Check for section start
            section_match = SECTION_PATTERN.match(line.strip())
            if section_match:
                # Save previous section if exists
                if current_section and content_lines:
                    current_section['content'] = self._clean_content(content_lines)
                    self.statutes.append(current_section)
                    content_lines = []

                title = section_match.group(1)
                chapter = section_match.group(2)
                section = section_match.group(3)
                section_name = section_match.group(4).strip()

                # Update current title if section is from a different title
                if title != self.current_title_num:
                    self.current_title_num = title
                    self.current_title_name = self.titles_found.get(title, '')

                citation = f"{title}:{chapter}-{section}"

                current_section = {
                    'citation': citation,
                    'njsa_title': title,
                    'njsa_title_name': self.current_title_name,
                    'njsa_chapter': chapter,
                    'njsa_section': section,
                    'njsa_section_name': section_name,
                    'hierarchy_level': 'section',
                    'hierarchy_path': build_hierarchy_path(
                        title, self.current_title_name, chapter, section, section_name
                    ),
                    'content': '',
                    'source_line': line_num + 1,
                }
                continue

            # Accumulate content for current section
            if current_section is not None:
                content_lines.append(line)

        # Don't forget the last section
        if current_section and content_lines:
            current_section['content'] = self._clean_content(content_lines)
            self.statutes.append(current_section)

        print(f"Parsed {len(self.statutes)} sections from {len(self.titles_found)} titles")
        return self.statutes

    def _clean_content(self, lines: List[str]) -> str:
        """Clean and format content lines."""
        # Join lines
        text = ''.join(lines)

        # Remove excessive whitespace
        text = re.sub(r'\n\s*\n\s*\n+', '\n\n', text)
        text = re.sub(r'[ \t]+', ' ', text)

        # Clean up line endings
        lines = text.split('\n')
        cleaned = []
        for line in lines:
            stripped = line.strip()
            if stripped:
                cleaned.append(stripped)
            elif cleaned and cleaned[-1] != '':
                cleaned.append('')

        return '\n'.join(cleaned).strip()

    def extract_amendment_history(self, content: str) -> Tuple[str, Optional[str]]:
        """
        Separate amendment history from main content.

        Returns: (clean_content, amendment_history)
        """
        lines = content.split('\n')

        # Look for amendment history at end
        for i in range(len(lines) - 1, -1, -1):
            line = lines[i].strip()
            if not line:
                continue
            if AMENDMENT_PATTERN.match(line):
                # Found amendment line, everything from here is history
                main_content = '\n'.join(lines[:i]).strip()
                amendment = '\n'.join(lines[i:]).strip()
                return main_content, amendment
            else:
                # Non-amendment line found, stop looking
                break

        return content, None

    def add_source_indices(self):
        """Add source_index to all statutes."""
        for idx, statute in enumerate(self.statutes):
            statute['source_index'] = idx

    def link_parent_indices(self):
        """Link sections to their parent chapters/titles."""
        # Build lookup by title and chapter
        chapter_lookup = {}  # (title, chapter) -> first section index

        for statute in self.statutes:
            key = (statute['njsa_title'], statute['njsa_chapter'])
            if key not in chapter_lookup:
                chapter_lookup[key] = statute['source_index']

        # For now, parent linking is simple - sections belong to chapters
        # We could expand this later for title-level containers
        print(f"  Found {len(chapter_lookup)} unique chapters")

    def save_complete(self, output_file: Path = None):
        """Save all statutes to a single JSON file."""
        output_file = output_file or NJ_STATUTES_COMPLETE_FILE
        output_file.parent.mkdir(parents=True, exist_ok=True)

        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(self.statutes, f, indent=2, ensure_ascii=False)

        print(f"Saved {len(self.statutes)} statutes to {output_file}")

    def save_individual_files(self, output_dir: Path = None):
        """Save each statute section as an individual JSON file."""
        output_dir = output_dir or NJ_STATUTES_INDIVIDUAL_DIR
        output_dir.mkdir(parents=True, exist_ok=True)

        for statute in self.statutes:
            # Create filename from citation
            citation = statute['citation'].replace(':', '_').replace('-', '_')
            filename = f"{statute['source_index']:06d}_{citation}.json"

            file_path = output_dir / filename
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(statute, f, indent=2, ensure_ascii=False)

        print(f"Saved {len(self.statutes)} individual files to {output_dir}")

    def get_titles_summary(self) -> Dict:
        """Get summary of titles found."""
        return self.titles_found

    def find_statute(self, citation: str) -> Optional[Dict]:
        """Find a statute by its citation string."""
        for statute in self.statutes:
            if statute['citation'] == citation:
                return statute
        return None

    def find_statutes_by_title(self, title: str) -> List[Dict]:
        """Find all statutes in a given title."""
        return [s for s in self.statutes if s['njsa_title'] == title]

    def find_statutes_by_chapter(self, title: str, chapter: str) -> List[Dict]:
        """Find all statutes in a given chapter."""
        return [s for s in self.statutes
                if s['njsa_title'] == title and s['njsa_chapter'] == chapter]


# =============================================================================
# CROSS-REFERENCE UTILITIES
# =============================================================================

def find_enabling_statutes(regulation_text: str, statutes_parser: NJStatutesParser) -> List[Dict]:
    """
    Given regulation text, find the enabling statutes referenced.

    Returns list of matching statute records.
    """
    refs = extract_statutory_references(regulation_text)
    found_statutes = []

    for ref in refs:
        statute = statutes_parser.find_statute(ref)
        if statute:
            found_statutes.append(statute)

    return found_statutes


# =============================================================================
# MAIN
# =============================================================================

def main():
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(description='NJ Statutes Parser')
    parser.add_argument('--input', type=Path, help='Input file path')
    parser.add_argument('--test', action='store_true', help='Test mode - just parse and show stats')
    parser.add_argument('--find', type=str, help='Find a specific citation (e.g., 52:27D-119)')
    parser.add_argument('--title', type=str, help='Show all sections in a title')

    args = parser.parse_args()

    input_file = args.input or NJ_STATUTES_INPUT_FILE

    print("=" * 60)
    print("NJ STATUTES PARSER")
    print("=" * 60)
    print()

    parser_obj = NJStatutesParser(input_file)

    # Parse the file
    statutes = parser_obj.parse_file()

    if not statutes:
        print("No statutes parsed!")
        return

    # Add indices
    parser_obj.add_source_indices()
    parser_obj.link_parent_indices()

    # Show summary
    print()
    print("=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Total sections: {len(statutes)}")
    print(f"Titles found: {len(parser_obj.titles_found)}")
    print()

    # Handle specific queries
    if args.find:
        statute = parser_obj.find_statute(args.find)
        if statute:
            print(f"Found: {args.find}")
            print(f"  Title: {statute['njsa_title']} - {statute['njsa_title_name']}")
            print(f"  Section name: {statute['njsa_section_name']}")
            print(f"  Content preview:")
            content = statute['content'][:500] + "..." if len(statute['content']) > 500 else statute['content']
            for line in content.split('\n')[:10]:
                print(f"    {line}")
        else:
            print(f"Not found: {args.find}")
        return

    if args.title:
        sections = parser_obj.find_statutes_by_title(args.title)
        print(f"Title {args.title}: {len(sections)} sections")
        for s in sections[:20]:
            print(f"  {s['citation']}: {s['njsa_section_name']}")
        if len(sections) > 20:
            print(f"  ... and {len(sections) - 20} more")
        return

    if args.test:
        # Show sample entries
        print("Sample entries:")
        for s in statutes[:5]:
            print(f"  {s['citation']}: {s['njsa_section_name']}")
        print()

        # Show title summary
        print("Titles:")
        for title_num in sorted(parser_obj.titles_found.keys(), key=lambda x: (len(x), x)):
            count = len([s for s in statutes if s['njsa_title'] == title_num])
            print(f"  Title {title_num}: {parser_obj.titles_found[title_num]} ({count} sections)")
        return

    # Full run - save files
    print("Saving files...")
    parser_obj.save_complete()
    parser_obj.save_individual_files()

    print()
    print("=" * 60)
    print("COMPLETE")
    print("=" * 60)
    print(f"Complete file: {NJ_STATUTES_COMPLETE_FILE}")
    print(f"Individual files: {NJ_STATUTES_INDIVIDUAL_DIR}")


if __name__ == "__main__":
    main()
