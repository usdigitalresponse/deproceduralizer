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
    SCRAPED_DATA_DIR,
    INDIVIDUAL_REGULATIONS_DIR,
    NY_REGULATIONS_CACHE_FILE,
    NY_REGULATIONS_COMPLETE_FILE,
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
# HIERARCHY PARSING FUNCTIONS
# =============================================================================

def parse_breadcrumb(soup: BeautifulSoup) -> Dict:
    """
    Parse the breadcrumb navigation to extract hierarchy info.

    Extracts from <ol class="breadcrumb"> which contains items like:
    - "N.Y. Comp. Codes R. & Regs. tit. 18 - SOCIAL SERVICES" (Title)
    - "Chapter II - Medical Assistance"
    - "Subchapter C - Vulnerable Persons"
    - "Part 433 - Incident Reporting"
    - "§ 433.8 - Incident review committees" (Section)
    """
    result = {
        'nycrr_title': None, 'nycrr_title_name': None,
        'nycrr_subtitle': None, 'nycrr_subtitle_name': None,
        'nycrr_chapter': None, 'nycrr_chapter_name': None,
        'nycrr_subchapter': None, 'nycrr_subchapter_name': None,
        'nycrr_article': None, 'nycrr_article_name': None,
        'nycrr_part': None, 'nycrr_part_name': None,
        'nycrr_subpart': None, 'nycrr_subpart_name': None,
        'nycrr_section': None, 'nycrr_section_name': None,
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
        if text in ['LII', 'State Regulations', 'New York Codes, Rules, and Regulations']:
            continue

        # Parse NYCRR Title: "N.Y. Comp. Codes R. & Regs. tit. 18 - SOCIAL SERVICES"
        # or "N.Y. Comp. Codes R. & Regs. Tit. 18 § 433.8" (section level)
        if text.startswith('N.Y. Comp. Codes'):
            # Check for section pattern first: "tit. X § Y.Z - NAME" or just "Tit. X § Y.Z"
            section_match = re.search(r'[Tt]it\.?\s*(\d+)\s*§\s*([\d.]+(?:[a-zA-Z])?)\s*(?:-\s*(.+))?$', text)
            if section_match:
                result['nycrr_title'] = int(section_match.group(1))
                result['nycrr_section'] = section_match.group(2)
                if section_match.group(3):
                    result['nycrr_section_name'] = section_match.group(3).strip()
                last_level = 'section'
                continue

            # Check for part pattern: "tit. X, ch. Y, subch. Z, pt. W - NAME"
            part_match = re.search(r'[Tt]it\.?\s*(\d+).*?pt\.?\s*([\dA-Za-z]+)\s*(?:-\s*(.+))?$', text)
            if part_match:
                result['nycrr_title'] = int(part_match.group(1))
                result['nycrr_part'] = part_match.group(2)
                if part_match.group(3):
                    result['nycrr_part_name'] = part_match.group(3).strip()
                last_level = 'part'
                continue

            # Title only: "N.Y. Comp. Codes R. & Regs. tit. 18 - SOCIAL SERVICES"
            title_match = re.search(r'[Tt]it\.?\s*(\d+)\s*(?:-\s*(.+))?$', text)
            if title_match:
                result['nycrr_title'] = int(title_match.group(1))
                if title_match.group(2):
                    result['nycrr_title_name'] = title_match.group(2).strip()
                last_level = 'title'
                continue

        # Parse "Chapter X - NAME"
        chapter_match = re.match(r'^Chapter\s+([IVXLCDM\d]+)\s*(?:-\s*(.+))?$', text)
        if chapter_match:
            result['nycrr_chapter'] = chapter_match.group(1)
            if chapter_match.group(2):
                result['nycrr_chapter_name'] = chapter_match.group(2).strip()
            last_level = 'chapter'
            continue

        # Parse "Subchapter X - NAME"
        subchapter_match = re.match(r'^Subchapter\s+([A-Za-z\d]+)\s*(?:-\s*(.+))?$', text)
        if subchapter_match:
            result['nycrr_subchapter'] = subchapter_match.group(1)
            if subchapter_match.group(2):
                result['nycrr_subchapter_name'] = subchapter_match.group(2).strip()
            last_level = 'subchapter'
            continue

        # Parse "Subtitle X - NAME"
        subtitle_match = re.match(r'^Subtitle\s+([A-Za-z\d]+)\s*(?:-\s*(.+))?$', text)
        if subtitle_match:
            result['nycrr_subtitle'] = subtitle_match.group(1)
            if subtitle_match.group(2):
                result['nycrr_subtitle_name'] = subtitle_match.group(2).strip()
            last_level = 'subtitle'
            continue

        # Parse "Article X - NAME"
        article_match = re.match(r'^Article\s+([\dA-Za-z]+)\s*(?:-\s*(.+))?$', text)
        if article_match:
            result['nycrr_article'] = article_match.group(1)
            if article_match.group(2):
                result['nycrr_article_name'] = article_match.group(2).strip()
            last_level = 'article'
            continue

        # Parse "Part X - NAME"
        part_match = re.match(r'^Part\s+([\dA-Za-z]+)\s*(?:-\s*(.+))?$', text)
        if part_match:
            result['nycrr_part'] = part_match.group(1)
            if part_match.group(2):
                result['nycrr_part_name'] = part_match.group(2).strip()
            last_level = 'part'
            continue

        # Parse "Subpart X - NAME"
        subpart_match = re.match(r'^Subpart\s+([\dA-Za-z]+)\s*(?:-\s*(.+))?$', text)
        if subpart_match:
            result['nycrr_subpart'] = subpart_match.group(1)
            if subpart_match.group(2):
                result['nycrr_subpart_name'] = subpart_match.group(2).strip()
            last_level = 'subpart'
            continue

        # Parse "§ X.Y - NAME" or "Section X.Y - NAME"
        section_match = re.match(r'^(?:§|Section)\s*([\d.]+[a-zA-Z]?)\s*(?:-\s*(.+))?$', text)
        if section_match:
            result['nycrr_section'] = section_match.group(1)
            if section_match.group(2):
                result['nycrr_section_name'] = section_match.group(2).strip()
            last_level = 'section'
            continue

        # Parse "Title X - NAME" (subdivision within part, not NYCRR title)
        # This comes after checking for N.Y. Comp. Codes pattern
        title_div_match = re.match(r'^Title\s+([A-Za-z\d]+)\s*(?:-\s*(.+))?$', text)
        if title_div_match:
            # Store as a special "division" type - these are nested titles within parts
            # We'll use subpart field for this since it's the closest semantic match
            result['nycrr_subpart'] = f"Title-{title_div_match.group(1)}"
            if title_div_match.group(2):
                result['nycrr_subpart_name'] = title_div_match.group(2).strip()
            last_level = 'subpart'
            continue

    result['hierarchy_level'] = last_level

    # hierarchy_path is already set from the raw breadcrumb above
    return result


def process_cached_file_ny(file_path: str) -> Optional[Dict]:
    """
    Process a single cached HTML file for NY. Used for parallel processing.

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

        # Clean the content
        cleaned_content = clean_regulation_text(content)
        hierarchy = parse_breadcrumb(soup)

        # Classify URL
        url_type = 'unknown'
        if '/title-' in url:
            url_type = 'title'
        elif '-NYCRR-' in url:
            url_type = 'regulation'
        elif '/chapter-' in url:
            url_type = 'chapter'
        elif '/part-' in url:
            url_type = 'part'
        elif '/section-' in url:
            url_type = 'section'
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
            'nycrr_title': hierarchy.get('nycrr_title'),
            'nycrr_title_name': hierarchy.get('nycrr_title_name'),
            'nycrr_subtitle': hierarchy.get('nycrr_subtitle'),
            'nycrr_subtitle_name': hierarchy.get('nycrr_subtitle_name'),
            'nycrr_chapter': hierarchy.get('nycrr_chapter'),
            'nycrr_chapter_name': hierarchy.get('nycrr_chapter_name'),
            'nycrr_subchapter': hierarchy.get('nycrr_subchapter'),
            'nycrr_subchapter_name': hierarchy.get('nycrr_subchapter_name'),
            'nycrr_article': hierarchy.get('nycrr_article'),
            'nycrr_article_name': hierarchy.get('nycrr_article_name'),
            'nycrr_part': hierarchy.get('nycrr_part'),
            'nycrr_part_name': hierarchy.get('nycrr_part_name'),
            'nycrr_subpart': hierarchy.get('nycrr_subpart'),
            'nycrr_subpart_name': hierarchy.get('nycrr_subpart_name'),
            'nycrr_section': hierarchy.get('nycrr_section'),
            'nycrr_section_name': hierarchy.get('nycrr_section_name'),
            'scraped_from_url': None,
        }

    except Exception:
        return None


# =============================================================================
# NY SCRAPER (extends base)
# =============================================================================

class NYRegulationsScraper(BaseRegulationsScraper):
    def __init__(self, cache_dir=None):
        super().__init__(
            base_url="https://www.law.cornell.edu/regulations/new-york",
            default_cache_dir=SCRAPED_DATA_DIR,
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
            if href and '/regulations/new-york/title-' in href:
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
                if not 'cornell.edu' in href:
                    continue

            full_url = urljoin(base_url, href)

            if 'law.cornell.edu/regulations/new-york' not in full_url:
                continue

            if full_url in self.visited_urls:
                continue

            link_text = link.get_text(strip=True)
            if not link_text:
                continue

            link_type = 'unknown'
            if '/title-' in href:
                link_type = 'title'
            elif '-NYCRR-' in href:
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
            convert_tables_to_markdown(main_content)
            content = extract_text_smart(main_content)
        else:
            for script in soup(["script", "style", "nav", "footer"]):
                script.decompose()
            convert_tables_to_markdown(soup)
            content = extract_text_smart(soup)

        cleaned_content = self.clean_regulation_text(content)
        hierarchy = parse_breadcrumb(soup)

        return {
            'url': url,
            'title': title,
            'content': content,
            'cleaned_content': cleaned_content,
            'url_type': self.classify_url(url),
            'hierarchy_level': hierarchy.get('hierarchy_level'),
            'hierarchy_path': hierarchy.get('hierarchy_path'),
            'nycrr_title': hierarchy.get('nycrr_title'),
            'nycrr_title_name': hierarchy.get('nycrr_title_name'),
            'nycrr_subtitle': hierarchy.get('nycrr_subtitle'),
            'nycrr_subtitle_name': hierarchy.get('nycrr_subtitle_name'),
            'nycrr_chapter': hierarchy.get('nycrr_chapter'),
            'nycrr_chapter_name': hierarchy.get('nycrr_chapter_name'),
            'nycrr_subchapter': hierarchy.get('nycrr_subchapter'),
            'nycrr_subchapter_name': hierarchy.get('nycrr_subchapter_name'),
            'nycrr_article': hierarchy.get('nycrr_article'),
            'nycrr_article_name': hierarchy.get('nycrr_article_name'),
            'nycrr_part': hierarchy.get('nycrr_part'),
            'nycrr_part_name': hierarchy.get('nycrr_part_name'),
            'nycrr_subpart': hierarchy.get('nycrr_subpart'),
            'nycrr_subpart_name': hierarchy.get('nycrr_subpart_name'),
            'nycrr_section': hierarchy.get('nycrr_section'),
            'nycrr_section_name': hierarchy.get('nycrr_section_name'),
            'parent_source_index': None,
            'scraped_from_url': None
        }

    def clean_regulation_text(self, content):
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

        # Handle patterns like "7802)\nChapter" -> "7802)\n\nChapter"
        cleaned_content = re.sub(r'([0-9)])\n([A-Z][a-z])', r'\1\n\n\2', cleaned_content)
        cleaned_content = re.sub(r'([a-z])\n([A-Z][a-z])', r'\1\n\n\2', cleaned_content)

        # Clean up section numbering and formatting
        cleaned_content = re.sub(r'^(\d+\.\d+\.\d+)\s+', r'\1. ', cleaned_content, flags=re.MULTILINE)
        cleaned_content = re.sub(r'^(\([a-z]\))\s+', r'\1 ', cleaned_content, flags=re.MULTILINE)

        # Remove excessive spacing around punctuation
        cleaned_content = re.sub(r'\s+([.,;:])', r'\1', cleaned_content)
        cleaned_content = re.sub(r'([.,;:])\s+', r'\1 ', cleaned_content)

        # Final cleanup of excessive newlines
        cleaned_content = re.sub(r'\n\s*\n\s*\n+', '\n\n', cleaned_content)

        return cleaned_content.strip()

    def classify_url(self, url):
        if '/title-' in url:
            return 'title'
        elif '-NYCRR-' in url:
            return 'regulation'
        elif '/chapter-' in url:
            return 'chapter'
        elif '/part-' in url:
            return 'part'
        elif '/section-' in url:
            return 'section'
        elif '/app-' in url or '/appendix' in url:
            return 'appendix'
        else:
            return 'unknown'

    def link_parent_source_indices(self, data):
        """
        Post-process to link parent_source_index for all documents.
        Must be called after all documents have source_index assigned.
        """
        print("Linking parent_source_index for all documents...")

        def normalize_path(path):
            if not path:
                return path
            return re.sub(r'\s+', ' ', path).strip()

        hierarchy_path_to_idx = {}
        part_container_lookup = {}

        for item in data:
            source_idx = item.get('source_index')
            if source_idx is None:
                continue

            hierarchy_path = item.get('hierarchy_path')
            hierarchy_level = item.get('hierarchy_level')
            nycrr_title = item.get('nycrr_title')
            nycrr_part = item.get('nycrr_part')

            if hierarchy_path and hierarchy_level:
                normalized = normalize_path(hierarchy_path)
                hierarchy_path_to_idx[normalized] = source_idx

            if hierarchy_level == 'part' and nycrr_title is not None and nycrr_part:
                part_container_lookup[(nycrr_title, nycrr_part)] = source_idx

        print(f"  Found {len(part_container_lookup)} Part containers")
        print(f"  Found {len(hierarchy_path_to_idx)} hierarchy paths")

        linked = 0
        for item in data:
            parent_idx = None
            hierarchy_path = item.get('hierarchy_path')
            hierarchy_level = item.get('hierarchy_level')
            nycrr_title = item.get('nycrr_title')
            nycrr_part = item.get('nycrr_part')

            if hierarchy_path:
                normalized = normalize_path(hierarchy_path)
                parts = normalized.rsplit(' > ', 1)
                if len(parts) > 1:
                    parent_path = parts[0]
                    parent_idx = hierarchy_path_to_idx.get(parent_path)
            elif hierarchy_level == 'section' and nycrr_title is not None and nycrr_part:
                parent_idx = part_container_lookup.get((nycrr_title, nycrr_part))

            if parent_idx is not None:
                item['parent_source_index'] = parent_idx
                linked += 1

        print(f"  Linked {linked} documents to parents")
        return data


# =============================================================================
# NY FULL PIPELINE (extends base)
# =============================================================================

NY_HIERARCHY_FIELDS = [
    'nycrr_title', 'nycrr_title_name',
    'nycrr_subtitle', 'nycrr_subtitle_name',
    'nycrr_chapter', 'nycrr_chapter_name',
    'nycrr_subchapter', 'nycrr_subchapter_name',
    'nycrr_article', 'nycrr_article_name',
    'nycrr_part', 'nycrr_part_name',
    'nycrr_subpart', 'nycrr_subpart_name',
    'nycrr_section', 'nycrr_section_name',
]


class FullPipeline(BaseFullPipeline):
    state_code = 'NY'
    state_name = 'New York'
    scraped_data_dir = SCRAPED_DATA_DIR
    individual_dir = INDIVIDUAL_REGULATIONS_DIR
    cache_file = NY_REGULATIONS_CACHE_FILE
    complete_file = NY_REGULATIONS_COMPLETE_FILE
    hierarchy_prefix = 'nycrr'
    hierarchy_fields = NY_HIERARCHY_FIELDS

    def create_scraper(self):
        return NYRegulationsScraper()

    def process_cached_file_fn(self):
        return process_cached_file_ny


def main():
    run_scraper_main(FullPipeline, SCRAPED_DATA_DIR, 'NY')


if __name__ == "__main__":
    main()
