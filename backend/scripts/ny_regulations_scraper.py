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


class NYRegulationsScraper:
    def __init__(self, cache_dir=None):
        self.base_url = "https://www.law.cornell.edu/regulations/new-york"
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'deproceduralizer/1.0 (+https://github.com/usdigitalresponse/deproceduralizer)'
        })
        self.visited_urls = set()
        self.all_regulations = []
        self.failed_urls = set()
        self.scraped_from_map = {}  # Maps URL -> scraped_from_url
        self.cache_dir = Path(cache_dir) if cache_dir else SCRAPED_DATA_DIR
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
        
        # Check cache first
        if cache_path.exists():
            try:
                with open(cache_path, 'r', encoding='utf-8') as f:
                    cached_data = json.load(f)
                    return cached_data.get('html')
            except Exception:
                pass  # If cache is corrupted, re-fetch
        
        # Try to fetch with retries
        for attempt in range(max_retries):
            try:
                response = self.session.get(url, timeout=30)
                response.raise_for_status()
                html = response.text
                
                # Cache the result
                try:
                    with open(cache_path, 'w', encoding='utf-8') as f:
                        json.dump({'url': url, 'html': html}, f, ensure_ascii=False)
                except Exception as e:
                    print(f"Warning: Could not cache {url}: {e}")
                
                return html
                
            except requests.RequestException as e:
                print(f"Attempt {attempt + 1}/{max_retries} failed for {url}: {e}")
                if attempt < max_retries - 1:
                    time.sleep(2 ** attempt)  # Exponential backoff
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
        
        # Find all title links (main categories)
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
        
        # Look for various link patterns in NY regulations
        for link in soup.find_all('a', href=True):
            href = link.get('href')
            if not href:
                continue
                
            # Skip non-regulation links
            if any(skip in href for skip in ['#', 'mailto:', 'javascript:', 'http://www.', 'https://www.']):
                if not 'cornell.edu' in href:
                    continue
            
            # Convert relative URLs to absolute
            full_url = urljoin(base_url, href)
            
            # Only process Cornell NY regulation URLs
            if 'law.cornell.edu/regulations/new-york' not in full_url:
                continue
                
            # Skip if already visited
            if full_url in self.visited_urls:
                continue
                
            link_text = link.get_text(strip=True)
            if not link_text:
                continue
                
            # Determine link type based on URL pattern
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
        
        # Extract title
        title_elem = soup.find('h1') or soup.find('title')
        title = title_elem.get_text(strip=True) if title_elem else "No title found"
        
        # Extract main content - be more selective about content areas
        content = ""
        
        # Look for main content containers
        main_content = soup.find('div', {'id': 'content'}) or soup.find('main') or soup.find('article')

        if main_content:
            # Remove navigation, ads, and other non-content elements
            for unwanted in main_content(['nav', 'aside', 'footer', 'script', 'style', 'noscript']):
                unwanted.decompose()

            # Convert tables to markdown before extracting text
            convert_tables_to_markdown(main_content)
            content = extract_text_smart(main_content)
        else:
            # Fallback: get all text but filter out obvious navigation
            for script in soup(["script", "style", "nav", "footer"]):
                script.decompose()
            # Convert tables to markdown before extracting text
            convert_tables_to_markdown(soup)
            content = extract_text_smart(soup)
        
        # Clean the content for better readability
        cleaned_content = self.clean_regulation_text(content)

        # Get hierarchy info from breadcrumb
        hierarchy = parse_breadcrumb(soup)

        return {
            'url': url,
            'title': title,
            'content': content,
            'cleaned_content': cleaned_content,
            'url_type': self.classify_url(url),
            # Hierarchy fields
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
            'parent_source_index': None,  # Will be populated in post-processing
            'scraped_from_url': None  # Will be set by crawler
        }
    
    def clean_regulation_text(self, content):
        """Clean and format regulation text for better readability"""
        if not content:
            return ""
        
        # Remove excessive whitespace
        content = re.sub(r'\n\s*\n\s*\n+', '\n\n', content)
        
        # Remove common navigation/UI text
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
            # Skip empty lines
            if not line.strip():
                continue
                
            # Skip navigation patterns
            skip_line = False
            for pattern in skip_patterns:
                if re.match(pattern, line, re.IGNORECASE):
                    skip_line = True
                    break
            
            if not skip_line:
                cleaned_lines.append(line.strip())
        
        # Join lines with proper spacing
        cleaned_content = '\n'.join(cleaned_lines)

        # Fix all types of newline issues
        # Handle literal \n sequences that appear as text
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
    
    def crawl_recursively(self, start_urls, max_pages=None, start_referring_url=None):
        # Queue stores tuples of (url, referring_url)
        # start_referring_url is the page that linked to the start_urls (e.g., main page)
        to_visit = deque((url, start_referring_url) for url in start_urls)
        scraped_count = len(self.all_regulations)  # Start from existing count
        save_interval = 50  # Save progress every 50 pages

        while to_visit and (max_pages is None or scraped_count < max_pages):
            current_url, referring_url = to_visit.popleft()

            # Skip if already processed or failed
            if current_url in self.visited_urls or current_url in self.failed_urls:
                continue

            print(f"Scraping {scraped_count + 1}: {current_url}")
            self.visited_urls.add(current_url)

            # Scrape current page content
            content_data = self.scrape_regulation_content(current_url)
            if content_data:
                content_data['scraped_from_url'] = referring_url
                self.scraped_from_map[current_url] = referring_url  # Save mapping
                self.all_regulations.append(content_data)
                scraped_count += 1

            # Get page HTML to find more links
            html = self.get_page(current_url)
            if html:
                soup = BeautifulSoup(html, 'html.parser')
                new_links = self.find_regulation_links(soup, current_url)

                # Add new links to queue with current_url as referring URL
                for link_info in new_links:
                    if (link_info['url'] not in self.visited_urls and
                        link_info['url'] not in self.failed_urls):
                        to_visit.append((link_info['url'], current_url))

            # Save progress periodically
            if scraped_count % save_interval == 0:
                self.save_progress()
                print(f"Progress saved. Queue size: {len(to_visit)}")

            # Be respectful to the server
            time.sleep(0.5)

        # Final save
        self.save_progress()
        return self.all_regulations
    
    def retry_failed_urls(self, max_retries=2):
        """Retry previously failed URLs"""
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
            time.sleep(1)  # Be extra careful on retries
    
    def scrape_all(self, max_pages=None):
        print("Starting comprehensive scrape of NY regulations...")
        
        # Load any existing scraped data
        existing_files = list(self.cache_dir.glob('*.json'))
        if existing_files:
            print(f"Found {len(existing_files)} cached files")
        
        # Start with main title pages if we don't have visited URLs already
        if not self.visited_urls:
            title_links = self.parse_main_page()
            if not title_links:
                print("No title links found on main page")
                return []
            print(f"Found {len(title_links)} main titles to crawl")
            start_urls = [link['url'] for link in title_links]
        else:
            print(f"Resuming from {len(self.visited_urls)} previously visited URLs")
            # Load existing regulation data from cache
            for cache_file in self.cache_dir.glob('*.json'):
                if cache_file.name in ['progress.json', 'failed_urls.json']:
                    continue
                try:
                    with open(cache_file, 'r', encoding='utf-8') as f:
                        cached_data = json.load(f)
                        if 'url' in cached_data and 'html' in cached_data:
                            # This is a cached HTML file, convert to regulation data
                            content_data = self.scrape_regulation_content(cached_data['url'])
                            if content_data:
                                self.all_regulations.append(content_data)
                except Exception as e:
                    print(f"Error loading cached data from {cache_file}: {e}")
            
            start_urls = []  # Will be populated from cached links
        
        # Start recursive crawling
        # Pass main page URL as referring URL for title pages
        all_data = self.crawl_recursively(start_urls, max_pages, start_referring_url=self.base_url)
        
        # Try failed URLs one more time
        if self.failed_urls:
            print(f"\nRetrying {len(self.failed_urls)} failed URLs...")
            self.retry_failed_urls()
        
        return all_data
    
    def link_parent_source_indices(self, data):
        """
        Post-process to link parent_source_index for all documents.
        Must be called after all documents have source_index assigned.
        """
        print("Linking parent_source_index for all documents...")

        def normalize_path(path):
            """Normalize whitespace in hierarchy path for consistent matching."""
            if not path:
                return path
            # Replace any whitespace sequences (including newlines, tabs) with single space
            return re.sub(r'\s+', ' ', path).strip()

        # Build lookup tables
        # For hierarchy URLs: path -> source_index
        hierarchy_path_to_idx = {}
        # For citation URLs: (title, part) -> source_index (Part containers only)
        part_container_lookup = {}

        for item in data:
            source_idx = item.get('source_index')
            if source_idx is None:
                continue

            hierarchy_path = item.get('hierarchy_path')
            hierarchy_level = item.get('hierarchy_level')
            nycrr_title = item.get('nycrr_title')
            nycrr_part = item.get('nycrr_part')

            # Record hierarchy path (normalized for matching)
            # Only register as potential parent if document has a valid hierarchy_level
            # This prevents linking to orphan documents with hierarchy_level=NULL
            if hierarchy_path and hierarchy_level:
                normalized = normalize_path(hierarchy_path)
                hierarchy_path_to_idx[normalized] = source_idx

            # Record Part containers
            if hierarchy_level == 'part' and nycrr_title is not None and nycrr_part:
                part_container_lookup[(nycrr_title, nycrr_part)] = source_idx

        print(f"  Found {len(part_container_lookup)} Part containers")
        print(f"  Found {len(hierarchy_path_to_idx)} hierarchy paths")

        # Link parents
        linked = 0
        for item in data:
            parent_idx = None
            hierarchy_path = item.get('hierarchy_path')
            hierarchy_level = item.get('hierarchy_level')
            nycrr_title = item.get('nycrr_title')
            nycrr_part = item.get('nycrr_part')

            if hierarchy_path:
                # Use ' > ' as separator and normalize whitespace
                normalized = normalize_path(hierarchy_path)
                parts = normalized.rsplit(' > ', 1)
                if len(parts) > 1:
                    parent_path = parts[0]
                    parent_idx = hierarchy_path_to_idx.get(parent_path)
            elif hierarchy_level == 'section' and nycrr_title is not None and nycrr_part:
                # Citation URL: parent is the Part container
                parent_idx = part_container_lookup.get((nycrr_title, nycrr_part))

            if parent_idx is not None:
                item['parent_source_index'] = parent_idx
                linked += 1

        print(f"  Linked {linked} documents to parents")
        return data

    def save_to_json(self, data, filename='ny_regulations.json'):
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"Data saved to {filename}")


# =============================================================================
# FULL PIPELINE (scrape -> clean -> individual files)
# =============================================================================

class FullPipeline:
    """Complete pipeline from scraping to individual clean files."""

    def __init__(self):
        self.caffeinate_proc = None

    def start_caffeinate(self):
        """Start caffeinate to prevent system sleep (macOS)"""
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
        """Stop caffeinate process"""
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
        """Setup clean shutdown handlers"""
        def signal_handler(sig, frame):
            print("\nReceived interrupt signal, cleaning up...")
            self.stop_caffeinate()
            sys.exit(0)

        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)

    def step1_scrape_regulations(self, max_pages=None):
        """Step 1: Scrape all regulations"""
        print("=" * 60)
        print("STEP 1: SCRAPING NY REGULATIONS")
        print("=" * 60)

        scraper = NYRegulationsScraper()

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

        # Assign source_index and link parents
        for idx, item in enumerate(data):
            item['source_index'] = idx
        data = scraper.link_parent_source_indices(data)

        # Save raw scraped data
        scraper.save_to_json(data, str(NY_REGULATIONS_COMPLETE_FILE))

        elapsed = end_time - start_time
        print(f"\nStep 1 Complete: {len(data)} regulations scraped")
        print(f"Time: {int(elapsed//3600)}h {int((elapsed%3600)//60)}m")

        return data

    def step2_process_cache_to_clean_data(self, max_workers=8):
        """Step 2: Convert cached HTML to clean regulation data (parallel)"""
        print("\n" + "=" * 60)
        print("STEP 2: PROCESSING CACHED FILES TO CLEAN DATA (PARALLEL)")
        print("=" * 60)

        from concurrent.futures import ProcessPoolExecutor, as_completed

        cache_dir = SCRAPED_DATA_DIR

        if not cache_dir.exists():
            print(f"No scraped_data directory found at {cache_dir}")
            return False

        html_files = [f for f in cache_dir.glob('*.json')
                      if f.name not in ['progress.json', 'failed_urls.json', 'scraped_from_urls.json']]

        print(f"Processing {len(html_files)} cached files with {max_workers} workers...")

        regulation_data = []
        processed_count = 0

        with ProcessPoolExecutor(max_workers=max_workers) as executor:
            futures = {executor.submit(process_cached_file_ny, str(f)): f for f in html_files}

            for future in as_completed(futures):
                try:
                    result = future.result()
                    if result:
                        regulation_data.append(result)
                        processed_count += 1
                        if processed_count % 500 == 0:
                            print(f"  Processed {processed_count} files...")
                except Exception:
                    pass  # Skip failed files

        if not regulation_data:
            print("No valid regulation data found")
            return False

        print(f"  Processed {len(regulation_data)} total files")

        # Assign source_index and link parents
        for idx, item in enumerate(regulation_data):
            item['source_index'] = idx

        scraper_temp = NYRegulationsScraper()
        regulation_data = scraper_temp.link_parent_source_indices(regulation_data)

        with open(NY_REGULATIONS_CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump(regulation_data, f, indent=2, ensure_ascii=False)

        print(f"Step 2 Complete: {len(regulation_data)} regulations with cleaned content")
        print(f"Saved to {NY_REGULATIONS_CACHE_FILE}")

        return regulation_data

    def step3_create_individual_files(self):
        """Step 3: Create individual JSON files from cleaned data"""
        print("\n" + "=" * 60)
        print("STEP 3: CREATING INDIVIDUAL REGULATION FILES")
        print("=" * 60)

        try:
            with open(NY_REGULATIONS_CACHE_FILE, 'r', encoding='utf-8') as f:
                regulations = json.load(f)
        except FileNotFoundError:
            print(f"{NY_REGULATIONS_CACHE_FILE} not found. Run steps 1-2 first.")
            return False

        print(f"Loaded {len(regulations)} regulations")

        output_dir = INDIVIDUAL_REGULATIONS_DIR
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
                'nycrr_title': regulation.get('nycrr_title'),
                'nycrr_title_name': regulation.get('nycrr_title_name'),
                'nycrr_subtitle': regulation.get('nycrr_subtitle'),
                'nycrr_subtitle_name': regulation.get('nycrr_subtitle_name'),
                'nycrr_chapter': regulation.get('nycrr_chapter'),
                'nycrr_chapter_name': regulation.get('nycrr_chapter_name'),
                'nycrr_subchapter': regulation.get('nycrr_subchapter'),
                'nycrr_subchapter_name': regulation.get('nycrr_subchapter_name'),
                'nycrr_article': regulation.get('nycrr_article'),
                'nycrr_article_name': regulation.get('nycrr_article_name'),
                'nycrr_part': regulation.get('nycrr_part'),
                'nycrr_part_name': regulation.get('nycrr_part_name'),
                'nycrr_subpart': regulation.get('nycrr_subpart'),
                'nycrr_subpart_name': regulation.get('nycrr_subpart_name'),
                'nycrr_section': regulation.get('nycrr_section'),
                'nycrr_section_name': regulation.get('nycrr_section_name'),
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
        """Run the complete pipeline"""
        print("=" * 60)
        print("NY REGULATIONS COMPLETE PIPELINE")
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
            print(f"Individual files: {INDIVIDUAL_REGULATIONS_DIR}")
            print(f"Master file: {NY_REGULATIONS_CACHE_FILE}")

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

    parser = argparse.ArgumentParser(description='NY Regulations Scraper and Pipeline')
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
            SCRAPED_DATA_DIR / 'progress.json',
            SCRAPED_DATA_DIR / 'failed_urls.json',
            SCRAPED_DATA_DIR / 'scraped_from_urls.json',
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
        print(f"\nReady to use! Check {INDIVIDUAL_REGULATIONS_DIR}")
    else:
        print("\nPipeline failed")


if __name__ == "__main__":
    main()