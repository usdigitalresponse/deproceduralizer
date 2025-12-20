"""
Shared utilities for NY and NJ regulation scrapers.

This module contains common functions for:
- HTML text extraction (smarter than get_text with separator='\n')
- HTML table to markdown conversion
- Text cleaning and newline fixing
- Common scraping helpers
"""

import re
from bs4 import BeautifulSoup, NavigableString, Tag


# =============================================================================
# TABLE TO MARKDOWN CONVERSION
# =============================================================================

def table_to_markdown(table: Tag) -> str:
    """
    Convert an HTML table to markdown format.

    Args:
        table: BeautifulSoup Tag element representing a <table>

    Returns:
        Markdown-formatted table string
    """
    if table is None or table.name != 'table':
        return ""

    rows = []
    header_row = None

    # Find all rows (including those in thead, tbody, tfoot)
    all_rows = table.find_all('tr')

    for row_idx, row in enumerate(all_rows):
        cells = row.find_all(['th', 'td'])
        if not cells:
            continue

        # Extract cell text, cleaning whitespace
        cell_texts = []
        for cell in cells:
            # Get text and normalize whitespace
            text = cell.get_text(separator=' ', strip=True)
            text = re.sub(r'\s+', ' ', text)
            # Escape pipe characters in content
            text = text.replace('|', '\\|')
            cell_texts.append(text)

        # If this row has <th> elements, treat as header
        if row.find('th') and header_row is None:
            header_row = cell_texts
        else:
            rows.append(cell_texts)

    # If no explicit header, use first row as header
    if header_row is None and rows:
        header_row = rows.pop(0)

    if not header_row:
        return ""

    # Build markdown table
    lines = []

    # Header row
    lines.append('| ' + ' | '.join(header_row) + ' |')

    # Separator row
    lines.append('| ' + ' | '.join(['---'] * len(header_row)) + ' |')

    # Data rows
    for row in rows:
        # Pad row if needed to match header length
        while len(row) < len(header_row):
            row.append('')
        # Truncate if row is longer than header
        row = row[:len(header_row)]
        lines.append('| ' + ' | '.join(row) + ' |')

    return '\n'.join(lines)


def convert_tables_to_markdown(element: Tag) -> None:
    """
    Find all tables in element and replace them with markdown equivalents.

    Modifies element in place by replacing <table> elements with markdown text.

    Args:
        element: BeautifulSoup Tag or BeautifulSoup object to process
    """
    for table in element.find_all('table'):
        markdown = table_to_markdown(table)
        if markdown:
            # Create a NavigableString with the markdown content
            # wrapped with newlines for proper spacing
            markdown_string = NavigableString('\n\n' + markdown + '\n\n')
            table.replace_with(markdown_string)
        else:
            # Empty table, just remove it
            table.decompose()


# =============================================================================
# SMART TEXT EXTRACTION
# =============================================================================

# Block-level elements that should have newlines after them
BLOCK_ELEMENTS = {
    'p', 'div', 'br', 'hr', 'li', 'tr', 'th', 'td',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'blockquote', 'pre', 'article', 'section', 'header', 'footer',
    'ul', 'ol', 'dl', 'dt', 'dd', 'table', 'thead', 'tbody', 'tfoot',
    'form', 'fieldset', 'address', 'figcaption', 'figure'
}


def extract_text_smart(element: Tag) -> str:
    """
    Extract text from HTML element with proper line breaks and indentation.

    Adds newlines after block-level elements (p, div, br, li, h1-h6, etc.)
    while keeping inline content flowing together.
    Preserves indentation from CSS classes like 'indent0', 'indent1', etc.
    Markdown tables (converted from HTML tables) are preserved with their structure.

    Args:
        element: BeautifulSoup Tag element

    Returns:
        Extracted text with appropriate line breaks and indentation
    """
    if element is None:
        return ""

    parts = []

    def is_markdown_table(text: str) -> bool:
        """Check if text looks like a markdown table."""
        lines = text.strip().split('\n')
        if len(lines) < 2:
            return False
        # Check if lines start and end with pipes and have separator row
        return (lines[0].startswith('|') and
                lines[0].endswith('|') and
                len(lines) > 1 and
                '---' in lines[1])

    def get_indent_level(node: Tag) -> int:
        """Extract indent level from class like 'indent0', 'indent1', etc."""
        if not hasattr(node, 'get'):
            return 0
        classes = node.get('class', [])
        if isinstance(classes, str):
            classes = classes.split()
        for cls in classes:
            if cls.startswith('indent'):
                try:
                    return int(cls.replace('indent', ''))
                except ValueError:
                    pass
        return 0

    def walk(node, current_indent=0):
        if isinstance(node, NavigableString):
            text = str(node)
            # Check if this is a markdown table (from our table conversion)
            if is_markdown_table(text):
                # Preserve the markdown table as-is with surrounding newlines
                parts.append('\n\n' + text.strip() + '\n\n')
            else:
                # Normalize whitespace within text nodes to single spaces
                text = re.sub(r'\s+', ' ', text)
                if text.strip():
                    parts.append(text)
        elif isinstance(node, Tag):
            # Skip unwanted elements
            if node.name in ('script', 'style', 'noscript', 'nav', 'footer'):
                return

            # Check for indent class on this element
            indent_level = get_indent_level(node)
            if indent_level > 0:
                # Add newline and indentation before indented content
                parts.append('\n' + '\t' * indent_level)

            # Process children
            for child in node.children:
                walk(child, indent_level if indent_level > 0 else current_indent)

            # Add newline after block-level elements
            if node.name in BLOCK_ELEMENTS:
                parts.append('\n')

    walk(element)

    # Join all parts
    text = ''.join(parts)

    # Clean up multiple spaces (but preserve newlines and tabs)
    text = re.sub(r' +', ' ', text)
    # Clean up spaces around newlines (but keep tabs)
    text = re.sub(r' *\n', '\n', text)
    text = re.sub(r'\n +', '\n', text)
    # Clean up excessive newlines (more than 2 consecutive)
    text = re.sub(r'\n{3,}', '\n\n', text)

    return text.strip()


# =============================================================================
# TEXT CLEANING - FIX EXTRANEOUS NEWLINES
# =============================================================================

def fix_extraneous_newlines(text: str) -> str:
    """
    Fix extraneous newlines that may be introduced during HTML extraction.

    This handles cases where newlines incorrectly break up:
    - Section markers like (a), (1), (ii) from their content
    - List markers like "1.", "i." from their content
    - Mid-sentence breaks
    - Hyphenated word continuations
    - "and" or "or" from following content
    - URLs after colons
    - Orphaned punctuation

    Args:
        text: Raw extracted text

    Returns:
        Cleaned text with extraneous newlines removed
    """
    if not text:
        return text

    # Pattern 1: Section markers like (a), (b), (1), (2), (i), (ii) followed by newlines then content
    # "(a)\n\nThe" -> "(a) The" or "(ii)\nits" -> "(ii) its"
    text = re.sub(r'\(([a-z]|[ivx]+|\d+)\)\s*\n+\s*([A-Za-z])', r'(\1) \2', text)

    # Pattern 2: List markers like "1.", "2.", "i.", "ii." followed by newline then content
    # "1.\nSubmit" -> "1. Submit" or "1.\nsubmit" -> "1. submit"
    text = re.sub(r'^(\d+\.)\s*\n+\s*([A-Za-z])', r'\1 \2', text, flags=re.MULTILINE)
    text = re.sub(r'^([ivx]+\.)\s*\n+\s*([A-Za-z])', r'\1 \2', text, flags=re.MULTILINE)

    # Pattern 3: Mid-sentence breaks - word ending followed by newline and lowercase word
    # "Not later\nthan" -> "Not later than"
    text = re.sub(r'([a-z,])\s*\n+\s*([a-z])', r'\1 \2', text)

    # Pattern 3a: Word ending + newline + digit (mid-sentence)
    # "trib. 3 and\n0.2 mile" -> "trib. 3 and 0.2 mile"
    # "; and\n7. FIPS" -> "; and 7. FIPS" (list continuation)
    text = re.sub(r'([a-z;])\s*\n+\s*(\d)', r'\1 \2', text)

    # Pattern 3b: Word ending followed by SINGLE newline then section marker (mid-sentence)
    # "and\n(viii)" -> "and (viii)", "or\n(c)" -> "or (c)"
    # But preserve double newlines before section markers (those indicate new sections)
    text = re.sub(r'([a-z])[ \t]*\n(?!\n)[ \t]*(\([a-z]|\([ivx]+|\(\d+|\([A-Z]\))', r'\1 \2', text)

    # Pattern 4: "and" or "or" + newline + various (uppercase, quote, bracket, paren, special)
    # "and\nN.J.A.C." -> "and N.J.A.C.", "and\n--item" -> "and --item"
    text = re.sub(r"\b(and|or)\s*\n+\s*([A-Z\"\[\($*<>+\-'§#])", r'\1 \2', text)

    # Pattern 5: Lines ending with hyphenated word continuation
    # "self-\nemployed" -> "self-employed"
    text = re.sub(r'-\s*\n+\s*([a-z])', r'-\1', text)

    # Pattern 6: Section marker at end of line followed by content on next line (with double newline)
    # Sometimes the marker is alone: "(a)\n\ntext" or "(a)\n\nthe"
    text = re.sub(r'\(([a-z])\)\s*\n\n+([A-Za-z])', r'(\1) \2', text)

    # Pattern 7: Colon + newline + URL
    # "at:\nwww.example.com" -> "at: www.example.com"
    text = re.sub(r':\s*\n+\s*(www\.)', r': \1', text)

    # Pattern 8: Word + newline + period (orphaned punctuation)
    # "forms\n." -> "forms."
    text = re.sub(r'([a-z])\s*\n+\s*(\.)', r'\1\2', text)

    # Pattern 9: Possessive/article + double newline + word (clear mid-phrase breaks)
    # "Department's\n\nOperations" -> "Department's Operations"
    text = re.sub(r"(['\"]s|')\s*\n\n+\s*([A-Z][a-z]+)", r'\1 \2', text)

    return text


def clean_regulation_text(content: str) -> str:
    """
    Clean regulation text content.

    Applies standard cleaning operations:
    - Handle literal \n sequences
    - Fix extraneous newlines
    - Normalize whitespace

    Args:
        content: Raw regulation content

    Returns:
        Cleaned content
    """
    if not content:
        return content

    # Handle literal \n sequences that appear as text
    cleaned = re.sub(r'\\n', '\n', content)

    # Fix extraneous newlines from HTML extraction
    cleaned = fix_extraneous_newlines(cleaned)

    # Normalize multiple spaces (but not newlines)
    cleaned = re.sub(r' {2,}', ' ', cleaned)

    return cleaned.strip()


# =============================================================================
# HTML CONTENT EXTRACTION HELPERS
# =============================================================================

def remove_unwanted_elements(soup: BeautifulSoup, selectors: list = None):
    """
    Remove unwanted elements from soup in place.

    Args:
        soup: BeautifulSoup object
        selectors: List of tag names or CSS selectors to remove
    """
    if selectors is None:
        selectors = ['nav', 'aside', 'footer', 'script', 'style', 'noscript']

    for selector in selectors:
        for element in soup.select(selector) if '.' in selector or '#' in selector else soup(selector):
            element.decompose()


def find_main_content(soup: BeautifulSoup) -> Tag:
    """
    Find the main content element in the page.

    Tries common content container selectors.

    Args:
        soup: BeautifulSoup object

    Returns:
        Main content Tag, or soup itself if not found
    """
    # Try common content containers
    selectors = [
        ('div', {'id': 'content'}),
        ('div', {'class': 'content'}),
        ('main', {}),
        ('article', {}),
        ('div', {'id': 'main'}),
        ('div', {'class': 'main-content'}),
    ]

    for tag, attrs in selectors:
        element = soup.find(tag, attrs) if attrs else soup.find(tag)
        if element:
            return element

    return soup


def extract_page_content(
    soup: BeautifulSoup,
    use_smart_extraction: bool = True,
    preserve_tables: bool = True
) -> str:
    """
    Extract main content from a page.

    Args:
        soup: BeautifulSoup object
        use_smart_extraction: If True, use smart extraction. If False, use get_text.
        preserve_tables: If True, convert HTML tables to markdown format.

    Returns:
        Extracted and cleaned text content
    """
    # Find main content area
    main_content = find_main_content(soup)

    # Remove unwanted elements
    remove_unwanted_elements(main_content)

    # Convert tables to markdown if requested
    if preserve_tables:
        convert_tables_to_markdown(main_content)

    # Extract text
    if use_smart_extraction:
        content = extract_text_smart(main_content)
    else:
        content = main_content.get_text(separator='\n', strip=True)

    # Clean the content
    return clean_regulation_text(content)
