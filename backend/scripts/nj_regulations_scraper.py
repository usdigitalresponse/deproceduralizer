#!/usr/bin/env python3
"""
New Jersey Administrative Code (NJAC) Scraper

Scrapes regulations from Cornell LII's New Jersey regulations section.
Extends BaseRegulationsScraper for shared crawling/caching/progress logic.
"""

import logging
import requests
from bs4 import BeautifulSoup
import json
import time
from urllib.parse import urljoin, urlparse
from collections import deque
import os
import hashlib
from pathlib import Path
import re
import sys
import subprocess
import signal
import shutil
from typing import Optional, Dict, Tuple

logger = logging.getLogger(__name__)

from config import (
    NJ_SCRAPED_DATA_DIR,
    NJ_INDIVIDUAL_REGULATIONS_DIR,
    NJ_REGULATIONS_CACHE_FILE,
    NJ_REGULATIONS_COMPLETE_FILE,
)
from scripts.scraper_utils import (
    fix_extraneous_newlines,
    extract_text_smart,
    clean_regulation_text,
    convert_tables_to_markdown,
)
from scripts.base_regulations_scraper import BaseRegulationsScraper, BaseFullPipeline, run_scraper_main
from lib.db import get_db_connection
from lib.migration import migrate_regulations_to_db, populate_parent_ids, cleanup_stale_documents
from lib.stats import refresh_all_stats, format_time


# =============================================================================
# BAD SCRAPE DETECTION
# =============================================================================

def is_bad_url(url: str) -> bool:
    """
    Detect URLs that are malformed scrape results.

    These are URLs where external domains got embedded into Cornell paths, like:
    - https://www.law.cornell.edu/regulations/new-jersey/www.epa.gov/...
    - https://www.law.cornell.edu/regulations/new-jersey/www.energycodes.gov
    """
    # Extract the path portion after /new-jersey/
    if '/regulations/new-jersey/' not in url:
        return False

    after_nj = url.split('/regulations/new-jersey/')[-1]

    # Check if path contains what looks like an external domain
    bad_patterns = [
        'www.',
        '.gov/',
        '.com/',
        '.org/',
        '.edu/',
        '.net/',
    ]

    for pattern in bad_patterns:
        if pattern in after_nj.lower():
            return True

    return False


def is_index_page_content(title: str, content: str) -> bool:
    """
    Detect if content is the NJ Admin Code index page (table of contents).

    These are 404s or redirects that ended up showing the main index instead
    of actual regulation content.
    """
    if not title or not content:
        return False

    # Index page has generic title and starts with list of titles
    is_generic_title = title.strip() == "New Jersey Administrative Code"
    # Check for TOC content (with or without newlines)
    content_start = content.strip()[:100]
    has_toc_content = "New Jersey Administrative Code" in content_start and "Title 1" in content_start

    return is_generic_title and has_toc_content


# =============================================================================
# HIERARCHY PARSING FUNCTIONS
# =============================================================================

def parse_breadcrumb(soup: BeautifulSoup) -> Dict:
    """
    Parse the breadcrumb navigation to extract hierarchy info for NJ regulations.

    Extracts from <ol class="breadcrumb"> which contains items like:
    - "N.J. Admin. Code tit. 8 - HEALTH" (Title)
    - "Chapter 43 - Standards for Licensure"
    - "Subchapter 1 - General Provisions"
    - "§ 8:43-1.1 - Scope" (Section)
    """
    result = {
        'njac_title': None, 'njac_title_name': None,
        'njac_subtitle': None, 'njac_subtitle_name': None,
        'njac_chapter': None, 'njac_chapter_name': None,
        'njac_subchapter': None, 'njac_subchapter_name': None,
        'njac_article': None, 'njac_article_name': None,
        'njac_part': None, 'njac_part_name': None,
        'njac_subpart': None, 'njac_subpart_name': None,
        'njac_section': None, 'njac_section_name': None,
        'hierarchy_level': None,
        'hierarchy_path': None,
    }

    breadcrumb = soup.find('ol', class_='breadcrumb')
    if not breadcrumb:
        return result

    items = breadcrumb.find_all('li')
    last_level = None

    # Capture the full raw breadcrumb path (all items)
    all_breadcrumb_items = []
    for item in items:
        text = item.get_text(strip=True)
        if text:
            all_breadcrumb_items.append(text)

    # Store the full raw breadcrumb path
    if all_breadcrumb_items:
        result['hierarchy_path'] = ' > '.join(all_breadcrumb_items)

    for item in items:
        text = item.get_text(strip=True)

        # Skip navigation items for structured parsing (but they're in hierarchy_path)
        if text in ['LII', 'State Regulations', 'New Jersey Administrative Code']:
            continue

        # Parse NJAC Title: "N.J. Admin. Code tit. 8 - HEALTH"
        # or section: "N.J. Admin. Code § 8:43-1.1 - Scope"
        if text.startswith('N.J. Admin. Code') or text.startswith('N.J.A.C.'):
            # Check for section pattern first: "§ X:Y-Z.W - NAME"
            section_match = re.search(r'§\s*([\d:.\-A-Za-z]+)\s*(?:-\s*(.+))?$', text)
            if section_match:
                result['njac_section'] = section_match.group(1)
                if section_match.group(2):
                    result['njac_section_name'] = section_match.group(2).strip()
                # Extract title from section citation (e.g., "8" from "8:43-1.1")
                title_from_section = re.match(r'(\d+):', section_match.group(1))
                if title_from_section:
                    result['njac_title'] = int(title_from_section.group(1))
                last_level = 'section'
                continue

            # Check for chapter pattern: "tit. X, ch. Y - NAME"
            chapter_match = re.search(r'[Tt]it\.?\s*(\d+[A-Za-z]?).*?ch\.?\s*([\dA-Za-z]+)\s*(?:-\s*(.+))?$', text)
            if chapter_match:
                result['njac_title'] = chapter_match.group(1)
                try:
                    result['njac_title'] = int(chapter_match.group(1))
                except ValueError:
                    result['njac_title'] = chapter_match.group(1)
                result['njac_chapter'] = chapter_match.group(2)
                if chapter_match.group(3):
                    result['njac_chapter_name'] = chapter_match.group(3).strip()
                last_level = 'chapter'
                continue

            # Title only: "N.J. Admin. Code tit. 8 - HEALTH"
            title_match = re.search(r'[Tt]it\.?\s*(\d+[A-Za-z]?)\s*(?:-\s*(.+))?$', text)
            if title_match:
                try:
                    result['njac_title'] = int(title_match.group(1))
                except ValueError:
                    result['njac_title'] = title_match.group(1)
                if title_match.group(2):
                    result['njac_title_name'] = title_match.group(2).strip()
                last_level = 'title'
                continue

        # Parse "Title X - NAME" (sometimes used instead of tit.)
        title_match = re.match(r'^Title\s+(\d+[A-Za-z]?)\s*(?:-\s*(.+))?$', text)
        if title_match:
            try:
                result['njac_title'] = int(title_match.group(1))
            except ValueError:
                result['njac_title'] = title_match.group(1)
            if title_match.group(2):
                result['njac_title_name'] = title_match.group(2).strip()
            last_level = 'title'
            continue

        # Parse "Chapter X - NAME"
        chapter_match = re.match(r'^Chapter\s+([\dA-Za-z]+)\s*(?:-\s*(.+))?$', text)
        if chapter_match:
            result['njac_chapter'] = chapter_match.group(1)
            if chapter_match.group(2):
                result['njac_chapter_name'] = chapter_match.group(2).strip()
            last_level = 'chapter'
            continue

        # Parse "Subchapter X - NAME"
        subchapter_match = re.match(r'^Subchapter\s+([\dA-Za-z]+)\s*(?:-\s*(.+))?$', text)
        if subchapter_match:
            result['njac_subchapter'] = subchapter_match.group(1)
            if subchapter_match.group(2):
                result['njac_subchapter_name'] = subchapter_match.group(2).strip()
            last_level = 'subchapter'
            continue

        # Parse "Subtitle X - NAME"
        subtitle_match = re.match(r'^Subtitle\s+([A-Za-z\d]+)\s*(?:-\s*(.+))?$', text)
        if subtitle_match:
            result['njac_subtitle'] = subtitle_match.group(1)
            if subtitle_match.group(2):
                result['njac_subtitle_name'] = subtitle_match.group(2).strip()
            last_level = 'subtitle'
            continue

        # Parse "Article X - NAME"
        article_match = re.match(r'^Article\s+([\dA-Za-z]+)\s*(?:-\s*(.+))?$', text)
        if article_match:
            result['njac_article'] = article_match.group(1)
            if article_match.group(2):
                result['njac_article_name'] = article_match.group(2).strip()
            last_level = 'article'
            continue

        # Parse "Part X - NAME"
        part_match = re.match(r'^Part\s+([\dA-Za-z]+)\s*(?:-\s*(.+))?$', text)
        if part_match:
            result['njac_part'] = part_match.group(1)
            if part_match.group(2):
                result['njac_part_name'] = part_match.group(2).strip()
            last_level = 'part'
            continue

        # Parse "Subpart X - NAME"
        subpart_match = re.match(r'^Subpart\s+([\dA-Za-z]+)\s*(?:-\s*(.+))?$', text)
        if subpart_match:
            result['njac_subpart'] = subpart_match.group(1)
            if subpart_match.group(2):
                result['njac_subpart_name'] = subpart_match.group(2).strip()
            last_level = 'subpart'
            continue

        # Parse "§ X.Y - NAME" or "Section X.Y - NAME"
        section_match = re.match(r'^(?:§|Section)\s*([\d:.\-A-Za-z]+)\s*(?:-\s*(.+))?$', text)
        if section_match:
            result['njac_section'] = section_match.group(1)
            if section_match.group(2):
                result['njac_section_name'] = section_match.group(2).strip()
            last_level = 'section'
            continue

    result['hierarchy_level'] = last_level

    # hierarchy_path is already set from the raw breadcrumb above
    return result


def process_cached_file(file_path: str) -> Optional[Dict]:
    """
    Process a single cached HTML file. Used for parallel processing.

    Args:
        file_path: Path to the cached JSON file

    Returns:
        Regulation dict or None if processing fails
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            cached_data = json.load(f)

        if 'html' not in cached_data or 'url' not in cached_data:
            return None

        url = cached_data['url']
        html = cached_data['html']

        soup = BeautifulSoup(html, 'html.parser')

        title_elem = soup.find('h1') or soup.find('title')
        title = title_elem.get_text(strip=True) if title_elem else "No title found"

        # Skip index page content
        if is_index_page_content(title, ""):
            return None

        content = ""
        reg_content = soup.find('div', class_='statereg-text')
        if reg_content:
            convert_tables_to_markdown(reg_content)
            content = extract_text_smart(reg_content)
        else:
            main_content = soup.find('div', {'id': 'content'}) or soup.find('main')
            if main_content:
                for unwanted in main_content(['nav', 'aside', 'footer', 'script', 'style', 'noscript', 'header']):
                    unwanted.decompose()
                convert_tables_to_markdown(main_content)
                content = extract_text_smart(main_content)

        # Skip if no content or index page
        if is_index_page_content(title, content):
            return None

        # Clean the content
        cleaned_content = clean_regulation_text(content)
        hierarchy = parse_breadcrumb(soup)

        # Classify URL
        url_type = 'unknown'
        if '/title-' in url:
            url_type = 'title'
        elif '-NJAC-' in url or 'NJAC' in url:
            url_type = 'regulation'
        elif '/chapter-' in url:
            url_type = 'chapter'
        elif '/part-' in url:
            url_type = 'part'
        elif '/section-' in url:
            url_type = 'section'
        elif '/subchapter-' in url:
            url_type = 'subchapter'
        elif '/app-' in url or '/appendix' in url:
            url_type = 'appendix'

        return {
            'url': url,
            'title': title,
            'content': content,
            'cleaned_content': cleaned_content,
            'url_type': url_type,
            'hierarchy_level': hierarchy.get('hierarchy_level'),
            'hierarchy_path': hierarchy.get('hierarchy_path'),
            'njac_title': hierarchy.get('njac_title'),
            'njac_title_name': hierarchy.get('njac_title_name'),
            'njac_subtitle': hierarchy.get('njac_subtitle'),
            'njac_subtitle_name': hierarchy.get('njac_subtitle_name'),
            'njac_chapter': hierarchy.get('njac_chapter'),
            'njac_chapter_name': hierarchy.get('njac_chapter_name'),
            'njac_subchapter': hierarchy.get('njac_subchapter'),
            'njac_subchapter_name': hierarchy.get('njac_subchapter_name'),
            'njac_article': hierarchy.get('njac_article'),
            'njac_article_name': hierarchy.get('njac_article_name'),
            'njac_part': hierarchy.get('njac_part'),
            'njac_part_name': hierarchy.get('njac_part_name'),
            'njac_subpart': hierarchy.get('njac_subpart'),
            'njac_subpart_name': hierarchy.get('njac_subpart_name'),
            'njac_section': hierarchy.get('njac_section'),
            'njac_section_name': hierarchy.get('njac_section_name'),
            'scraped_from_url': None,  # Will need to be populated from scraped_from_map
        }

    except Exception:
        return None


# =============================================================================
# NJ SCRAPER (extends base)
# =============================================================================

class NJRegulationsScraper(BaseRegulationsScraper):
    def __init__(self, cache_dir=None):
        super().__init__(
            base_url="https://www.law.cornell.edu/regulations/new-jersey",
            default_cache_dir=NJ_SCRAPED_DATA_DIR,
            cache_dir=cache_dir,
        )

    def parse_main_page(self):
        html = self.get_page(self.base_url)
        if not html:
            return []

        soup = BeautifulSoup(html, 'html.parser')
        title_links = []

        for link in soup.find_all('a', href=True):
            href = link.get('href')
            if href and '/regulations/new-jersey/title-' in href:
                full_url = urljoin(self.base_url, href)
                title = link.get_text(strip=True)
                if title and full_url not in self.visited_urls:
                    title_links.append({
                        'title': title,
                        'url': full_url,
                        'type': 'title'
                    })

        return title_links

    def find_regulation_links(self, soup, base_url):
        links = []

        for link in soup.find_all('a', href=True):
            href = link.get('href')
            if not href:
                continue

            if any(skip in href for skip in ['#', 'mailto:', 'javascript:', 'http://www.', 'https://www.']):
                if 'cornell.edu' not in href:
                    continue

            full_url = urljoin(base_url, href)

            # Only process Cornell NJ regulation URLs
            if 'law.cornell.edu/regulations/new-jersey' not in full_url:
                continue

            # Skip malformed URLs with external domains embedded
            if is_bad_url(full_url):
                continue

            if full_url in self.visited_urls:
                continue

            link_text = link.get_text(strip=True)
            if not link_text:
                continue

            link_type = 'unknown'
            if '/title-' in href:
                link_type = 'title'
            elif '-NJAC-' in href or 'NJAC' in href:
                link_type = 'regulation'
            elif '/chapter-' in href or '/part-' in href or '/section-' in href:
                link_type = 'subsection'
            elif '/app-' in href or '/appendix' in href:
                link_type = 'appendix'

            links.append({
                'title': link_text,
                'url': full_url,
                'type': link_type
            })

        return links

    def scrape_regulation_content(self, url):
        html = self.get_page(url)
        if not html:
            return None

        soup = BeautifulSoup(html, 'html.parser')

        title_elem = soup.find('h1') or soup.find('title')
        title = title_elem.get_text(strip=True) if title_elem else "No title found"

        content = ""
        main_content = soup.find('div', {'id': 'content'}) or soup.find('main') or soup.find('article')

        if main_content:
            for unwanted in main_content(['nav', 'aside', 'footer', 'script', 'style', 'noscript']):
                unwanted.decompose()
            # Convert tables to markdown before extracting text
            convert_tables_to_markdown(main_content)
            content = extract_text_smart(main_content)
        else:
            for script in soup(["script", "style", "nav", "footer"]):
                script.decompose()
            # Convert tables to markdown before extracting text
            convert_tables_to_markdown(soup)
            content = extract_text_smart(soup)

        # Skip index page content (404s/redirects that show TOC instead of regulation)
        if is_index_page_content(title, content):
            return None

        cleaned_content = self.clean_regulation_text(content)
        hierarchy = parse_breadcrumb(soup)

        return {
            'url': url,
            'title': title,
            'content': content,
            'cleaned_content': cleaned_content,
            'url_type': hierarchy.get('hierarchy_level') or self.classify_url(url),
            'hierarchy_level': hierarchy.get('hierarchy_level'),
            'hierarchy_path': hierarchy.get('hierarchy_path'),
            'njac_title': hierarchy.get('njac_title'),
            'njac_title_name': hierarchy.get('njac_title_name'),
            'njac_subtitle': hierarchy.get('njac_subtitle'),
            'njac_subtitle_name': hierarchy.get('njac_subtitle_name'),
            'njac_chapter': hierarchy.get('njac_chapter'),
            'njac_chapter_name': hierarchy.get('njac_chapter_name'),
            'njac_subchapter': hierarchy.get('njac_subchapter'),
            'njac_subchapter_name': hierarchy.get('njac_subchapter_name'),
            'njac_article': hierarchy.get('njac_article'),
            'njac_article_name': hierarchy.get('njac_article_name'),
            'njac_part': hierarchy.get('njac_part'),
            'njac_part_name': hierarchy.get('njac_part_name'),
            'njac_subpart': hierarchy.get('njac_subpart'),
            'njac_subpart_name': hierarchy.get('njac_subpart_name'),
            'njac_section': hierarchy.get('njac_section'),
            'njac_section_name': hierarchy.get('njac_section_name'),
            'parent_source_index': None,
            'scraped_from_url': None
        }

    def clean_regulation_text(self, content):
        """Clean and format regulation text for better readability"""
        if not content:
            return ""

        content = re.sub(r'\n\s*\n\s*\n+', '\n\n', content)

        lines = content.split('\n')
        cleaned_lines = []

        skip_patterns = [
            r'^\s*Menu\s*$',
            r'^\s*Search\s*$',
            r'^\s*Home\s*$',
            r'^\s*Back to top\s*$',
            r'^\s*Print\s*$',
            r'^\s*Share\s*$',
            r'^\s*LII\s*$',
            r'^\s*Legal Information Institute\s*$',
            r'^\s*Cornell Law School\s*$',
            r'^\s*Compare\s*$',
            r'^\s*Table of Contents\s*$',
            r'^\s*›\s*$',
            r'^\s*»\s*$',
            r'^\s*\|\s*$',
            r'^\s*Related\s*$',
            r'^\s*Previous\s*$',
            r'^\s*Next\s*$',
            r'^\s*Toggle navigation.*$',
            r'^\s*Skip to main content.*$'
        ]

        for line in lines:
            if not line.strip():
                continue

            skip_line = False
            for pattern in skip_patterns:
                if re.match(pattern, line, re.IGNORECASE):
                    skip_line = True
                    break

            if not skip_line:
                cleaned_lines.append(line.strip())

        cleaned_content = '\n'.join(cleaned_lines)
        cleaned_content = re.sub(r'\\n', '\n', cleaned_content)

        # Fix extraneous newlines from HTML inline element extraction
        cleaned_content = fix_extraneous_newlines(cleaned_content)

        cleaned_content = re.sub(r'([0-9)])\n([A-Z][a-z])', r'\1\n\n\2', cleaned_content)
        cleaned_content = re.sub(r'([a-z])\n([A-Z][a-z])', r'\1\n\n\2', cleaned_content)
        cleaned_content = re.sub(r'\n\s*\n\s*\n+', '\n\n', cleaned_content)

        return cleaned_content.strip()

    def classify_url(self, url):
        if '/title-' in url:
            return 'title'
        elif '-NJAC-' in url or 'NJAC' in url:
            return 'regulation'
        elif '/chapter-' in url:
            return 'chapter'
        elif '/part-' in url:
            return 'part'
        elif '/section-' in url:
            return 'section'
        elif '/subchapter-' in url:
            return 'subchapter'
        elif '/app-' in url or '/appendix' in url:
            return 'appendix'
        else:
            return 'unknown'

    def link_parent_source_indices(self, data):
        """Post-process to link parent_source_index for all documents."""
        print("Linking parent_source_index for all documents...")

        def normalize_path(path):
            """Normalize whitespace in hierarchy path for consistent matching."""
            if not path:
                return path
            # Replace any whitespace sequences (including newlines, tabs) with single space
            import re
            return re.sub(r'\s+', ' ', path).strip()

        hierarchy_path_to_idx = {}
        chapter_container_lookup = {}

        for item in data:
            source_idx = item.get('source_index')
            if source_idx is None:
                continue

            hierarchy_path = item.get('hierarchy_path')
            hierarchy_level = item.get('hierarchy_level')
            njac_title = item.get('njac_title')
            njac_chapter = item.get('njac_chapter')

            # Only register as potential parent if document has a valid hierarchy_level
            # This prevents linking to orphan documents with hierarchy_level=NULL
            if hierarchy_path and hierarchy_level:
                # Store with normalized path for matching
                normalized = normalize_path(hierarchy_path)
                hierarchy_path_to_idx[normalized] = source_idx

            if hierarchy_level == 'chapter' and njac_title is not None and njac_chapter:
                chapter_container_lookup[(njac_title, njac_chapter)] = source_idx

        print(f"  Found {len(chapter_container_lookup)} Chapter containers")
        print(f"  Found {len(hierarchy_path_to_idx)} hierarchy paths")

        linked = 0
        for item in data:
            parent_idx = None
            hierarchy_path = item.get('hierarchy_path')
            hierarchy_level = item.get('hierarchy_level')
            njac_title = item.get('njac_title')
            njac_chapter = item.get('njac_chapter')

            if hierarchy_path:
                # Use ' > ' as separator (not '/') and normalize whitespace
                normalized = normalize_path(hierarchy_path)
                parts = normalized.rsplit(' > ', 1)
                if len(parts) > 1:
                    parent_path = parts[0]
                    parent_idx = hierarchy_path_to_idx.get(parent_path)
            elif hierarchy_level == 'section' and njac_title is not None and njac_chapter:
                parent_idx = chapter_container_lookup.get((njac_title, njac_chapter))

            if parent_idx is not None:
                item['parent_source_index'] = parent_idx
                linked += 1

        print(f"  Linked {linked} documents to parents")
        return data


# =============================================================================
# NJ FULL PIPELINE (extends base)
# =============================================================================

NJ_HIERARCHY_FIELDS = [
    'njac_title', 'njac_title_name',
    'njac_subtitle', 'njac_subtitle_name',
    'njac_chapter', 'njac_chapter_name',
    'njac_subchapter', 'njac_subchapter_name',
    'njac_article', 'njac_article_name',
    'njac_part', 'njac_part_name',
    'njac_subpart', 'njac_subpart_name',
    'njac_section', 'njac_section_name',
]


class FullPipeline(BaseFullPipeline):
    state_code = 'NJ'
    state_name = 'New Jersey'
    scraped_data_dir = NJ_SCRAPED_DATA_DIR
    individual_dir = NJ_INDIVIDUAL_REGULATIONS_DIR
    cache_file = NJ_REGULATIONS_CACHE_FILE
    complete_file = NJ_REGULATIONS_COMPLETE_FILE
    hierarchy_prefix = 'njac'
    hierarchy_fields = NJ_HIERARCHY_FIELDS

    def create_scraper(self):
        return NJRegulationsScraper()

    def process_cached_file_fn(self):
        return process_cached_file


def main():
    run_scraper_main(FullPipeline, NJ_SCRAPED_DATA_DIR, 'NJ')


if __name__ == "__main__":
    main()
