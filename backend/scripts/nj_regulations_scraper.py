#!/usr/bin/env python3
"""
New Jersey Administrative Code (NJAC) Scraper

Scrapes regulations from Cornell LII's New Jersey regulations section.
Adapted from ny_regulations_scraper.py for NJ-specific patterns.
"""

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

# Add parent directory to path for config import
sys.path.insert(0, str(Path(__file__).parent.parent))
from config import (
    NJ_SCRAPED_DATA_DIR,
    NJ_INDIVIDUAL_REGULATIONS_DIR,
    NJ_REGULATIONS_CACHE_FILE,
    NJ_REGULATIONS_COMPLETE_FILE,
)


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
    has_toc_content = content.strip().startswith("New Jersey Administrative Code\n\nTitle 1")

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


class NJRegulationsScraper:
    def __init__(self, cache_dir=None):
        self.base_url = "https://www.law.cornell.edu/regulations/new-jersey"
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'deproceduralizer/1.0 (+https://github.com/usdigitalresponse/deproceduralizer)'
        })
        self.visited_urls = set()
        self.all_regulations = []
        self.failed_urls = set()
        self.scraped_from_map = {}
        self.cache_dir = Path(cache_dir) if cache_dir else NJ_SCRAPED_DATA_DIR
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.progress_file = self.cache_dir / 'progress.json'
        self.failed_file = self.cache_dir / 'failed_urls.json'
        self.scraped_from_file = self.cache_dir / 'scraped_from_urls.json'
        self.load_progress()

    def load_progress(self):
        """Load previously visited URLs, failed URLs, and scraped_from mappings"""
        if self.progress_file.exists():
            try:
                with open(self.progress_file, 'r') as f:
                    data = json.load(f)
                    self.visited_urls = set(data.get('visited_urls', []))
                    print(f"Loaded {len(self.visited_urls)} previously visited URLs")
            except Exception as e:
                print(f"Error loading progress: {e}")

        if self.failed_file.exists():
            try:
                with open(self.failed_file, 'r') as f:
                    self.failed_urls = set(json.load(f))
                    print(f"Loaded {len(self.failed_urls)} previously failed URLs")
            except Exception as e:
                print(f"Error loading failed URLs: {e}")

        if self.scraped_from_file.exists():
            try:
                with open(self.scraped_from_file, 'r') as f:
                    self.scraped_from_map = json.load(f)
                    print(f"Loaded {len(self.scraped_from_map)} scraped_from URL mappings")
            except Exception as e:
                print(f"Error loading scraped_from mappings: {e}")

    def save_progress(self):
        """Save current progress"""
        try:
            with open(self.progress_file, 'w') as f:
                json.dump({
                    'visited_urls': list(self.visited_urls),
                    'total_scraped': len(self.all_regulations)
                }, f, indent=2)

            if self.failed_urls:
                with open(self.failed_file, 'w') as f:
                    json.dump(list(self.failed_urls), f, indent=2)

            if self.scraped_from_map:
                with open(self.scraped_from_file, 'w') as f:
                    json.dump(self.scraped_from_map, f, indent=2)
        except Exception as e:
            print(f"Error saving progress: {e}")

    def get_cache_path(self, url):
        """Generate cache file path for a URL"""
        url_hash = hashlib.md5(url.encode()).hexdigest()
        return self.cache_dir / f"{url_hash}.json"

    def get_page(self, url, max_retries=3):
        """Get page with retry logic and caching"""
        cache_path = self.get_cache_path(url)

        if cache_path.exists():
            try:
                with open(cache_path, 'r', encoding='utf-8') as f:
                    cached_data = json.load(f)
                    return cached_data.get('html')
            except Exception:
                pass

        for attempt in range(max_retries):
            try:
                response = self.session.get(url, timeout=30)
                response.raise_for_status()
                html = response.text

                try:
                    with open(cache_path, 'w', encoding='utf-8') as f:
                        json.dump({'url': url, 'html': html}, f, ensure_ascii=False)
                except Exception as e:
                    print(f"Warning: Could not cache {url}: {e}")

                return html

            except requests.RequestException as e:
                print(f"Attempt {attempt + 1}/{max_retries} failed for {url}: {e}")
                if attempt < max_retries - 1:
                    time.sleep(2 ** attempt)
                else:
                    print(f"All attempts failed for {url}")
                    self.failed_urls.add(url)
                    return None

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
            content = main_content.get_text(separator='\n', strip=True)
        else:
            for script in soup(["script", "style", "nav", "footer"]):
                script.decompose()
            content = soup.get_text(separator='\n', strip=True)

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

    def crawl_recursively(self, start_urls, max_pages=None, start_referring_url=None):
        to_visit = deque((url, start_referring_url) for url in start_urls)
        scraped_count = len(self.all_regulations)
        save_interval = 50

        while to_visit and (max_pages is None or scraped_count < max_pages):
            current_url, referring_url = to_visit.popleft()

            if current_url in self.visited_urls or current_url in self.failed_urls:
                continue

            print(f"Scraping {scraped_count + 1}: {current_url}")
            self.visited_urls.add(current_url)

            content_data = self.scrape_regulation_content(current_url)
            if content_data:
                content_data['scraped_from_url'] = referring_url
                self.scraped_from_map[current_url] = referring_url
                self.all_regulations.append(content_data)
                scraped_count += 1

            html = self.get_page(current_url)
            if html:
                soup = BeautifulSoup(html, 'html.parser')
                new_links = self.find_regulation_links(soup, current_url)

                for link_info in new_links:
                    if (link_info['url'] not in self.visited_urls and
                        link_info['url'] not in self.failed_urls):
                        to_visit.append((link_info['url'], current_url))

            if scraped_count % save_interval == 0:
                self.save_progress()
                print(f"Progress saved. Queue size: {len(to_visit)}")

            time.sleep(0.5)

        self.save_progress()
        return self.all_regulations

    def retry_failed_urls(self, max_retries=2):
        if not self.failed_urls:
            print("No failed URLs to retry")
            return

        print(f"Retrying {len(self.failed_urls)} failed URLs...")
        failed_copy = self.failed_urls.copy()
        self.failed_urls.clear()

        for url in failed_copy:
            print(f"Retrying: {url}")
            content_data = self.scrape_regulation_content(url)
            if content_data:
                self.all_regulations.append(content_data)
                self.visited_urls.add(url)
                print(f"✅ Retry successful: {url}")
            else:
                self.failed_urls.add(url)
            time.sleep(1)

    def scrape_all(self, max_pages=None):
        print("Starting comprehensive scrape of NJ regulations...")

        existing_files = list(self.cache_dir.glob('*.json'))
        if existing_files:
            print(f"Found {len(existing_files)} cached files")

        if not self.visited_urls:
            title_links = self.parse_main_page()
            if not title_links:
                print("No title links found on main page")
                return []
            print(f"Found {len(title_links)} main titles to crawl")
            start_urls = [link['url'] for link in title_links]
        else:
            print(f"Resuming from {len(self.visited_urls)} previously visited URLs")
            for cache_file in self.cache_dir.glob('*.json'):
                if cache_file.name in ['progress.json', 'failed_urls.json', 'scraped_from_urls.json']:
                    continue
                try:
                    with open(cache_file, 'r', encoding='utf-8') as f:
                        cached_data = json.load(f)
                        if 'url' in cached_data and 'html' in cached_data:
                            content_data = self.scrape_regulation_content(cached_data['url'])
                            if content_data:
                                self.all_regulations.append(content_data)
                except Exception as e:
                    print(f"Error loading cached data from {cache_file}: {e}")

            start_urls = []

        all_data = self.crawl_recursively(start_urls, max_pages, start_referring_url=self.base_url)

        if self.failed_urls:
            print(f"\nRetrying {len(self.failed_urls)} failed URLs...")
            self.retry_failed_urls()

        return all_data

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

            if hierarchy_path:
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

    def save_to_json(self, data, filename='nj_regulations.json'):
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"Data saved to {filename}")


# =============================================================================
# FULL PIPELINE
# =============================================================================

class FullPipeline:
    """Complete pipeline from scraping to individual clean files."""

    def __init__(self):
        self.caffeinate_proc = None

    def start_caffeinate(self):
        try:
            print("Starting caffeinate to prevent system sleep...")
            self.caffeinate_proc = subprocess.Popen(
                ['caffeinate', '-d'],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
            print("Caffeinate started successfully")
        except Exception as e:
            print(f"Could not start caffeinate: {e}")

    def stop_caffeinate(self):
        if self.caffeinate_proc:
            try:
                self.caffeinate_proc.terminate()
                self.caffeinate_proc.wait(timeout=5)
                print("Caffeinate stopped")
            except:
                try:
                    self.caffeinate_proc.kill()
                except:
                    pass

    def setup_signal_handlers(self):
        def signal_handler(sig, frame):
            print("\nReceived interrupt signal, cleaning up...")
            self.stop_caffeinate()
            sys.exit(0)

        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)

    def step1_scrape_regulations(self, max_pages=None):
        print("=" * 60)
        print("STEP 1: SCRAPING NJ REGULATIONS")
        print("=" * 60)

        scraper = NJRegulationsScraper()

        print("Starting comprehensive scrape...")
        print("Features: caffeinate, auto-resume, retry logic, progress saving")
        print()

        if scraper.visited_urls:
            print(f"Resuming from {len(scraper.visited_urls)} previously visited URLs")

        start_time = time.time()
        data = scraper.scrape_all(max_pages=max_pages)
        end_time = time.time()

        if not data:
            print("No data was scraped")
            return False

        for idx, item in enumerate(data):
            item['source_index'] = idx
        data = scraper.link_parent_source_indices(data)

        scraper.save_to_json(data, str(NJ_REGULATIONS_COMPLETE_FILE))

        elapsed = end_time - start_time
        print(f"\nStep 1 Complete: {len(data)} regulations scraped")
        print(f"Time: {int(elapsed//3600)}h {int((elapsed%3600)//60)}m")

        return data

    def step2_process_cache_to_clean_data(self):
        print("\n" + "=" * 60)
        print("STEP 2: PROCESSING CACHED FILES TO CLEAN DATA")
        print("=" * 60)

        scraper = NJRegulationsScraper()
        cache_dir = NJ_SCRAPED_DATA_DIR

        if not cache_dir.exists():
            print(f"No scraped_data directory found at {cache_dir}")
            return False

        html_files = list(cache_dir.glob('*.json'))
        regulation_data = []

        print(f"Processing {len(html_files)} cached files...")

        processed_count = 0
        for html_file in html_files:
            if html_file.name in ['progress.json', 'failed_urls.json', 'scraped_from_urls.json']:
                continue

            try:
                with open(html_file, 'r', encoding='utf-8') as f:
                    cached_data = json.load(f)

                if 'html' in cached_data and 'url' in cached_data:
                    url = cached_data['url']
                    html = cached_data['html']

                    soup = BeautifulSoup(html, 'html.parser')

                    title_elem = soup.find('h1') or soup.find('title')
                    title = title_elem.get_text(strip=True) if title_elem else "No title found"

                    content = ""
                    reg_content = soup.find('div', class_='statereg-text')
                    if reg_content:
                        content = reg_content.get_text(separator='\n', strip=True)
                    else:
                        main_content = soup.find('div', {'id': 'content'}) or soup.find('main')
                        if main_content:
                            for unwanted in main_content(['nav', 'aside', 'footer', 'script', 'style', 'noscript', 'header']):
                                unwanted.decompose()
                            content = main_content.get_text(separator='\n', strip=True)

                    cleaned_content = scraper.clean_regulation_text(content)
                    hierarchy = parse_breadcrumb(soup)

                    regulation = {
                        'url': url,
                        'title': title,
                        'content': content,
                        'cleaned_content': cleaned_content,
                        'url_type': scraper.classify_url(url),
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
                        'scraped_from_url': scraper.scraped_from_map.get(url),
                    }

                    regulation_data.append(regulation)
                    processed_count += 1

                    if processed_count % 500 == 0:
                        print(f"  Processed {processed_count} files...")

            except Exception:
                continue

        if not regulation_data:
            print("No valid regulation data found")
            return False

        for idx, item in enumerate(regulation_data):
            item['source_index'] = idx

        scraper_temp = NJRegulationsScraper()
        regulation_data = scraper_temp.link_parent_source_indices(regulation_data)

        with open(NJ_REGULATIONS_CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump(regulation_data, f, indent=2, ensure_ascii=False)

        print(f"Step 2 Complete: {len(regulation_data)} regulations with cleaned content")
        print(f"Saved to {NJ_REGULATIONS_CACHE_FILE}")

        return regulation_data

    def step3_create_individual_files(self):
        print("\n" + "=" * 60)
        print("STEP 3: CREATING INDIVIDUAL REGULATION FILES")
        print("=" * 60)

        try:
            with open(NJ_REGULATIONS_CACHE_FILE, 'r', encoding='utf-8') as f:
                regulations = json.load(f)
        except FileNotFoundError:
            print(f"{NJ_REGULATIONS_CACHE_FILE} not found. Run steps 1-2 first.")
            return False

        print(f"Loaded {len(regulations)} regulations")

        output_dir = NJ_INDIVIDUAL_REGULATIONS_DIR
        if output_dir.exists():
            print("Removing old individual files...")
            shutil.rmtree(output_dir)
        output_dir.mkdir(parents=True)

        print("Creating individual files...")

        created_count = 0
        for regulation in regulations:
            source_index = regulation.get('source_index', created_count)
            url = regulation['url']

            url_part = url.split('/')[-1] if '/' in url else url
            clean_name = re.sub(r'[^\w\-\.]', '_', url_part)
            filename = f"{source_index:06d}_{clean_name}.json"

            individual_file = {
                'url': regulation['url'],
                'title': regulation['title'],
                'content': regulation.get('cleaned_content', regulation.get('content', '')),
                'url_type': regulation.get('url_type', 'unknown'),
                'source_index': source_index,
                'hierarchy_level': regulation.get('hierarchy_level'),
                'hierarchy_path': regulation.get('hierarchy_path'),
                'njac_title': regulation.get('njac_title'),
                'njac_title_name': regulation.get('njac_title_name'),
                'njac_subtitle': regulation.get('njac_subtitle'),
                'njac_subtitle_name': regulation.get('njac_subtitle_name'),
                'njac_chapter': regulation.get('njac_chapter'),
                'njac_chapter_name': regulation.get('njac_chapter_name'),
                'njac_subchapter': regulation.get('njac_subchapter'),
                'njac_subchapter_name': regulation.get('njac_subchapter_name'),
                'njac_article': regulation.get('njac_article'),
                'njac_article_name': regulation.get('njac_article_name'),
                'njac_part': regulation.get('njac_part'),
                'njac_part_name': regulation.get('njac_part_name'),
                'njac_subpart': regulation.get('njac_subpart'),
                'njac_subpart_name': regulation.get('njac_subpart_name'),
                'njac_section': regulation.get('njac_section'),
                'njac_section_name': regulation.get('njac_section_name'),
                'parent_source_index': regulation.get('parent_source_index'),
                'scraped_from_url': regulation.get('scraped_from_url'),
            }

            file_path = output_dir / filename
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(individual_file, f, indent=2, ensure_ascii=False)

            created_count += 1
            if created_count % 1000 == 0:
                print(f"  Created {created_count}/{len(regulations)} files...")

        print(f"Step 3 Complete: {created_count} individual files created")
        print(f"Location: {output_dir}/")

        return True

    def run_full_pipeline(self, max_pages=None):
        print("=" * 60)
        print("NJ REGULATIONS COMPLETE PIPELINE")
        print("From 0 to Individual Clean Files")
        print("=" * 60)
        print()

        self.setup_signal_handlers()
        self.start_caffeinate()

        try:
            data = self.step1_scrape_regulations(max_pages)
            if not data:
                return False

            clean_data = self.step2_process_cache_to_clean_data()
            if not clean_data:
                return False

            success = self.step3_create_individual_files()
            if not success:
                return False

            print("\n" + "=" * 60)
            print("PIPELINE COMPLETE!")
            print("=" * 60)
            print(f"Regulations scraped and cleaned: {len(clean_data)}")
            print(f"Individual files: {NJ_INDIVIDUAL_REGULATIONS_DIR}")
            print(f"Master file: {NJ_REGULATIONS_CACHE_FILE}")

            return True

        except KeyboardInterrupt:
            print("\nPipeline interrupted by user")
            return False
        except Exception as e:
            print(f"Pipeline failed: {e}")
            import traceback
            traceback.print_exc()
            return False
        finally:
            self.stop_caffeinate()


def main():
    """Main entry point with CLI argument parsing."""
    import argparse

    parser = argparse.ArgumentParser(description='NJ Regulations Scraper and Pipeline')
    parser.add_argument('--test', action='store_true', help='Test mode: limit to 100 pages')
    parser.add_argument('--small', action='store_true', help='Small run: limit to 1000 pages')
    parser.add_argument('--yes', '-y', action='store_true', help='Auto-confirm (skip prompt)')
    parser.add_argument('--max-pages', type=int, help='Custom max pages limit')
    parser.add_argument('--fresh', action='store_true', help='Clear progress and start fresh')

    args = parser.parse_args()

    max_pages = args.max_pages
    if args.test:
        max_pages = 100
        print("Test mode: limiting to 100 pages")
    elif args.small:
        max_pages = 1000
        print("Small run: limiting to 1000 pages")

    if args.fresh:
        print("Clearing progress files for fresh start...")
        progress_files = [
            NJ_SCRAPED_DATA_DIR / 'progress.json',
            NJ_SCRAPED_DATA_DIR / 'failed_urls.json',
            NJ_SCRAPED_DATA_DIR / 'scraped_from_urls.json',
        ]
        for pf in progress_files:
            if pf.exists():
                pf.unlink()
                print(f"  Removed {pf.name}")
        print()

    if not args.yes and not args.test:
        response = input("Run the complete pipeline? This may take several hours. (y/N): ")
        if response.lower() not in ['y', 'yes']:
            print("Pipeline cancelled.")
            return

    pipeline = FullPipeline()
    success = pipeline.run_full_pipeline(max_pages)

    if success:
        print(f"\nReady to use! Check {NJ_INDIVIDUAL_REGULATIONS_DIR}")
    else:
        print("\nPipeline failed")


if __name__ == "__main__":
    main()
