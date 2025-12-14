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


# =============================================================================
# HIERARCHY PARSING FUNCTIONS
# =============================================================================

def parse_comp_codes_url(url: str) -> Optional[Dict]:
    """
    Parse N-Y-Comp-Codes style URLs into components.
    Examples:
      - N-Y-Comp-Codes-R-Regs-Tit-3SS-2.13 → Title 3, Section 2.13
      - N-Y-Comp-Codes-R--Regs-Tit-3-SS-117.4 → Title 3, Section 117.4
      - N-Y-Comp-Codes-R--Regs-Tit-22-r-202.70.33 → Title 22, Rule 202.70.33
    """
    if '/new-york/' not in url:
        return None

    path = url.split('/new-york/')[1]
    if not path.startswith('N-Y-Comp-Codes'):
        return None

    # Skip forms and full hierarchy paths - these are structural, not sections
    if '-form-' in path.lower() or '-subch-' in path or '-subtit-' in path:
        return None

    result = {
        'nycrr_title': None,
        'nycrr_part': None,
        'nycrr_section': None,
        'hierarchy_level': 'section'
    }

    # Pattern 1: Tit-XSS-Y.Z (e.g., Tit-3SS-2.13)
    match = re.search(r'Tit-(\d+)SS-(\d+)\.(\d+)', path, re.IGNORECASE)
    if match:
        result['nycrr_title'] = int(match.group(1))
        result['nycrr_part'] = match.group(2)
        result['nycrr_section'] = match.group(3)
        return result

    # Pattern 2: Tit-X-SS-Y.Z (e.g., Tit-3-SS-117.4)
    match = re.search(r'Tit-(\d+)-SS-(\d+)\.(\d+)', path, re.IGNORECASE)
    if match:
        result['nycrr_title'] = int(match.group(1))
        result['nycrr_part'] = match.group(2)
        result['nycrr_section'] = match.group(3)
        return result

    # Pattern 3: Tit-X-r-Y.Z.W (rule pattern, e.g., Tit-22-r-202.70.33)
    match = re.search(r'Tit-(\d+)-r-(\d+)\.(\d+)\.(\d+)', path, re.IGNORECASE)
    if match:
        result['nycrr_title'] = int(match.group(1))
        result['nycrr_part'] = match.group(2)
        result['nycrr_section'] = f"{match.group(3)}.{match.group(4)}"
        return result

    # Pattern 4: Tit-X-r-Y.Z.W-X (rule with suffix, e.g., Tit-22-r-202.70.11-d)
    match = re.search(r'Tit-(\d+)-r-(\d+)\.(\d+)\.(\d+)-([a-z])', path, re.IGNORECASE)
    if match:
        result['nycrr_title'] = int(match.group(1))
        result['nycrr_part'] = match.group(2)
        result['nycrr_section'] = f"{match.group(3)}.{match.group(4)}{match.group(5)}"
        return result

    return None


def parse_citation_url(url: str) -> Optional[Dict]:
    """
    Parse citation-style URLs like '18-NYCRR-433.8' into components.
    """
    if '/new-york/' not in url:
        return None

    path = url.split('/new-york/')[1]
    match = re.match(r'^(\d+)-NYCRR-(.+)$', path)
    if not match:
        return None

    title_num = int(match.group(1))
    rest = match.group(2)

    # Skip appendices and complex hierarchy patterns (forms, exhibits, etc.)
    if 'app' in rest.lower() or 'ch-' in rest or 'form' in rest.lower() or 'exh' in rest.lower():
        return None

    result = {
        'nycrr_title': title_num,
        'nycrr_part': None,
        'nycrr_section': None,
        'hierarchy_level': 'section'
    }

    # part.section (e.g., 433.8 or 2B.36)
    simple_match = re.match(r'^([\dA-Za-z]+)\.(\d+)$', rest)
    if simple_match:
        result['nycrr_part'] = simple_match.group(1)
        result['nycrr_section'] = simple_match.group(2)
        return result

    # part.section with letter suffix (e.g., 20.50a, 202.12a)
    letter_suffix_match = re.match(r'^([\dA-Za-z]+)\.(\d+[a-z])$', rest)
    if letter_suffix_match:
        result['nycrr_part'] = letter_suffix_match.group(1)
        result['nycrr_section'] = letter_suffix_match.group(2)
        return result

    # part.section-letter (e.g., 202.20-i, 202.20-g)
    dash_letter_match = re.match(r'^([\dA-Za-z]+)\.(\d+)-([a-z])$', rest)
    if dash_letter_match:
        result['nycrr_part'] = dash_letter_match.group(1)
        result['nycrr_section'] = f"{dash_letter_match.group(2)}-{dash_letter_match.group(3)}"
        return result

    # part-subpart.section (e.g., 5-1.2)
    subpart_match = re.match(r'^([\dA-Za-z]+)-([\dA-Za-z]+)\.(\d+)$', rest)
    if subpart_match:
        result['nycrr_part'] = subpart_match.group(1)
        result['nycrr_section'] = subpart_match.group(3)
        return result

    # part.section.subsection (e.g., 1200.1.15)
    subsection_match = re.match(r'^([\dA-Za-z]+)\.(\d+)\.(\d+)$', rest)
    if subsection_match:
        result['nycrr_part'] = subsection_match.group(1)
        result['nycrr_section'] = f"{subsection_match.group(2)}.{subsection_match.group(3)}"
        return result

    # part-section-subsection (e.g., 10-C-4)
    dash_subsection_match = re.match(r'^(\d+)-([A-Z])-(\d+)$', rest)
    if dash_subsection_match:
        result['nycrr_part'] = dash_subsection_match.group(1)
        result['nycrr_section'] = f"{dash_subsection_match.group(2)}-{dash_subsection_match.group(3)}"
        return result

    # part.sectionLETTERS (e.g., 861.6A, 202.5bb, 207.4aa)
    letter_suffix_multi = re.match(r'^([\dA-Za-z]+)\.(\d+[A-Za-z]+)$', rest)
    if letter_suffix_multi:
        result['nycrr_part'] = letter_suffix_multi.group(1)
        result['nycrr_section'] = letter_suffix_multi.group(2)
        return result

    # part.section-LETTER (e.g., 6028.3-A, 6029.5-A)
    dash_letter_upper = re.match(r'^([\dA-Za-z]+)\.(\d+)-([A-Z])$', rest)
    if dash_letter_upper:
        result['nycrr_part'] = dash_letter_upper.group(1)
        result['nycrr_section'] = f"{dash_letter_upper.group(2)}-{dash_letter_upper.group(3)}"
        return result

    # part.section(subsection) (e.g., 7.34(1), 7.34(2))
    paren_match = re.match(r'^([\dA-Za-z]+)\.(\d+)\((\d+)\)$', rest)
    if paren_match:
        result['nycrr_part'] = paren_match.group(1)
        result['nycrr_section'] = f"{paren_match.group(2)}({paren_match.group(3)})"
        return result

    # part-subpart.section.subsection (e.g., 98-1.1.16)
    complex_subpart = re.match(r'^(\d+)-(\d+)\.(\d+)\.(\d+)$', rest)
    if complex_subpart:
        result['nycrr_part'] = complex_subpart.group(1)
        result['nycrr_section'] = f"{complex_subpart.group(3)}.{complex_subpart.group(4)}"
        return result

    # part-subpart.section with letter suffix (e.g., 130-1.1a)
    subpart_letter = re.match(r'^(\d+)-(\d+)\.(\d+[a-z]+)$', rest)
    if subpart_letter:
        result['nycrr_part'] = subpart_letter.group(1)
        result['nycrr_section'] = subpart_letter.group(3)
        return result

    # part.section with suffix (e.g., 646-5.3sh)
    suffix_match = re.match(r'^([\dA-Za-z]+)-(\d+)\.(\d+[a-z]+)$', rest)
    if suffix_match:
        result['nycrr_part'] = suffix_match.group(1)
        result['nycrr_section'] = f"{suffix_match.group(2)}.{suffix_match.group(3)}"
        return result

    return None


def parse_hierarchy_url(url: str) -> Optional[Dict]:
    """
    Parse hierarchy-style URLs like 'title-22/subtitle-A/chapter-II/part-221'.
    """
    if '/new-york/' not in url:
        return None

    path = url.split('/new-york/')[1]
    if not path.startswith('title-'):
        return None

    result = {
        'hierarchy_path': path,
        'nycrr_title': None,
        'nycrr_part': None,
        'hierarchy_level': None
    }

    components = path.split('/')
    for comp in components:
        if comp.startswith('title-'):
            try:
                result['nycrr_title'] = int(comp.replace('title-', ''))
            except ValueError:
                pass
        elif comp.startswith('part-'):
            result['nycrr_part'] = comp.replace('part-', '')

    last = components[-1]
    for prefix in ['subpart-', 'part-', 'article-', 'subchapter-', 'chapter-', 'subtitle-', 'title-']:
        if last.startswith(prefix):
            result['hierarchy_level'] = prefix.rstrip('-')
            break
    else:
        result['hierarchy_level'] = 'section'

    return result


def get_hierarchy_info(url: str) -> Dict:
    """Get hierarchy info from URL, trying all formats."""
    # Try citation URL first (most common)
    parsed = parse_citation_url(url)
    if parsed:
        parsed['hierarchy_path'] = None
        return parsed

    # Try comp-codes URL format
    parsed = parse_comp_codes_url(url)
    if parsed:
        parsed['hierarchy_path'] = None
        return parsed

    # Try hierarchy URL format
    parsed = parse_hierarchy_url(url)
    if parsed:
        parsed['nycrr_section'] = None
        return parsed

    return {
        'hierarchy_level': None,
        'hierarchy_path': None,
        'nycrr_title': None,
        'nycrr_part': None,
        'nycrr_section': None
    }


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
            
            content = main_content.get_text(separator='\n', strip=True)
        else:
            # Fallback: get all text but filter out obvious navigation
            for script in soup(["script", "style", "nav", "footer"]):
                script.decompose()
            content = soup.get_text(separator='\n', strip=True)
        
        # Clean the content for better readability
        cleaned_content = self.clean_regulation_text(content)
        
        # Get hierarchy info from URL
        hierarchy = get_hierarchy_info(url)

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
            'nycrr_part': hierarchy.get('nycrr_part'),
            'nycrr_section': hierarchy.get('nycrr_section'),
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
    
    def crawl_recursively(self, start_urls, max_pages=None):
        # Queue stores tuples of (url, referring_url)
        to_visit = deque((url, None) for url in start_urls)
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
        all_data = self.crawl_recursively(start_urls, max_pages)
        
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

            # Record hierarchy path
            if hierarchy_path:
                hierarchy_path_to_idx[hierarchy_path] = source_idx

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
                # Hierarchy URL: parent is one level up
                parts = hierarchy_path.rstrip('/').rsplit('/', 1)
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

    def step2_process_cache_to_clean_data(self):
        """Step 2: Convert cached HTML to clean regulation data"""
        print("\n" + "=" * 60)
        print("STEP 2: PROCESSING CACHED FILES TO CLEAN DATA")
        print("=" * 60)

        scraper = NYRegulationsScraper()
        cache_dir = SCRAPED_DATA_DIR

        if not cache_dir.exists():
            print(f"No scraped_data directory found at {cache_dir}")
            return False

        html_files = list(cache_dir.glob('*.json'))
        regulation_data = []

        print(f"Processing {len(html_files)} cached files...")

        processed_count = 0
        for html_file in html_files:
            if html_file.name in ['progress.json', 'failed_urls.json']:
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
                    hierarchy = get_hierarchy_info(url)

                    regulation = {
                        'url': url,
                        'title': title,
                        'content': content,
                        'cleaned_content': cleaned_content,
                        'url_type': scraper.classify_url(url),
                        'hierarchy_level': hierarchy.get('hierarchy_level'),
                        'hierarchy_path': hierarchy.get('hierarchy_path'),
                        'nycrr_title': hierarchy.get('nycrr_title'),
                        'nycrr_part': hierarchy.get('nycrr_part'),
                        'nycrr_section': hierarchy.get('nycrr_section'),
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
                'nycrr_part': regulation.get('nycrr_part'),
                'nycrr_section': regulation.get('nycrr_section'),
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