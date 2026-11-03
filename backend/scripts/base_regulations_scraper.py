"""
Base classes for state regulation scrapers.

Provides shared logic for scraping regulations from Cornell LII.
State-specific scrapers (NY, NJ) extend these classes and override
the abstract methods for state-specific parsing.
"""

import logging
import requests
from bs4 import BeautifulSoup
import json
import time
from urllib.parse import urljoin
from collections import deque
import hashlib
from pathlib import Path
import re
import sys
import subprocess
import signal
import shutil
from abc import ABC, abstractmethod
from typing import Optional, Dict

from scripts.scraper_utils import fix_extraneous_newlines
from lib.db import get_db_connection
from lib.migration import migrate_regulations_to_db, populate_parent_ids, cleanup_stale_documents
from lib.stats import refresh_all_stats, format_time

logger = logging.getLogger(__name__)


class BaseRegulationsScraper(ABC):
    """
    Abstract base class for scraping regulations from Cornell LII.

    Subclasses must implement:
    - parse_main_page(): Find title links on the state's main page
    - find_regulation_links(soup, base_url): Find regulation links on a page
    - scrape_regulation_content(url): Extract content from a regulation page
    - clean_regulation_text(content): Clean raw text
    - classify_url(url): Classify URL type (title, regulation, etc.)
    - link_parent_source_indices(data): Link documents to their parents

    Subclass __init__ must call super().__init__(base_url, default_cache_dir, cache_dir).
    """

    def __init__(self, base_url: str, default_cache_dir: Path, cache_dir=None):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            # Identify the scraper honestly rather than posing as a browser.
            'User-Agent': 'deproceduralizer/1.0 (+https://github.com/usdigitalresponse/deproceduralizer)'
        })
        self.visited_urls = set()
        self.all_regulations = []
        self.failed_urls = set()
        self.scraped_from_map = {}
        self.cache_dir = Path(cache_dir) if cache_dir else default_cache_dir
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.progress_file = self.cache_dir / 'progress.json'
        self.failed_file = self.cache_dir / 'failed_urls.json'
        self.scraped_from_file = self.cache_dir / 'scraped_from_urls.json'
        self.load_progress()

    def load_progress(self):
        """Load previously visited URLs, failed URLs, and scraped_from mappings."""
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
        """Save current progress."""
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
        """Generate cache file path for a URL."""
        url_hash = hashlib.md5(url.encode()).hexdigest()
        return self.cache_dir / f"{url_hash}.json"

    def get_page(self, url, max_retries=3):
        """Get page with retry logic and caching."""
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

    def crawl_recursively(self, start_urls, max_pages=None, start_referring_url=None):
        """BFS crawl starting from given URLs."""
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
        """Retry previously failed URLs."""
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
        """Scrape all regulations starting from the main page."""
        state_name = self.__class__.__name__.replace('RegulationsScraper', '')
        print(f"Starting comprehensive scrape of {state_name} regulations...")

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

    def save_to_json(self, data, filename='regulations.json'):
        """Save data to JSON file."""
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"Data saved to {filename}")

    # --- Abstract methods (state-specific) ---

    @abstractmethod
    def parse_main_page(self):
        """Parse the main page to find title links."""
        pass

    @abstractmethod
    def find_regulation_links(self, soup, base_url):
        """Find regulation links on a page."""
        pass

    @abstractmethod
    def scrape_regulation_content(self, url):
        """Scrape content from a regulation page."""
        pass

    @abstractmethod
    def clean_regulation_text(self, content):
        """Clean raw regulation text."""
        pass

    @abstractmethod
    def classify_url(self, url):
        """Classify a URL as title, regulation, chapter, etc."""
        pass

    @abstractmethod
    def link_parent_source_indices(self, data):
        """Link documents to their parent documents."""
        pass


class BaseFullPipeline(ABC):
    """
    Abstract base class for the full scrape-to-database pipeline.

    Subclasses must set config properties and implement create_scraper().
    """

    # --- Config properties (set by subclass) ---
    state_code: str = ''          # 'NY' or 'NJ'
    state_name: str = ''          # 'New York' or 'New Jersey'
    scraped_data_dir: Path = None
    individual_dir: Path = None
    cache_file: Path = None
    complete_file: Path = None
    hierarchy_prefix: str = ''    # 'nycrr' or 'njac'

    # Hierarchy fields to include in individual files (set by subclass)
    hierarchy_fields: list[str] = []

    def __init__(self):
        self.caffeinate_proc = None

    @abstractmethod
    def create_scraper(self) -> BaseRegulationsScraper:
        """Create the state-specific scraper instance."""
        pass

    @abstractmethod
    def process_cached_file_fn(self):
        """Return the module-level process_cached_file function for this state."""
        pass

    def start_caffeinate(self):
        """Start caffeinate to prevent system sleep (macOS)."""
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
        """Stop caffeinate process."""
        if self.caffeinate_proc:
            try:
                self.caffeinate_proc.terminate()
                self.caffeinate_proc.wait(timeout=5)
                print("Caffeinate stopped")
            except subprocess.TimeoutExpired as e:
                logger.warning(f"Process termination timed out, attempting forceful kill: {e}")
                try:
                    self.caffeinate_proc.kill()
                except (ProcessLookupError, OSError) as kill_err:
                    logger.warning(f"Failed to kill caffeinate process: {type(kill_err).__name__}: {kill_err}")
            except (ProcessLookupError, OSError) as e:
                logger.warning(f"Error stopping caffeinate: {type(e).__name__}: {e}")

    def setup_signal_handlers(self):
        """Setup clean shutdown handlers."""
        def signal_handler(sig, frame):
            print("\nReceived interrupt signal, cleaning up...")
            self.stop_caffeinate()
            sys.exit(0)

        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)

    def step1_scrape_regulations(self, max_pages=None):
        """Step 1: Scrape all regulations."""
        print("=" * 60)
        print(f"STEP 1: SCRAPING {self.state_code} REGULATIONS")
        print("=" * 60)

        scraper = self.create_scraper()

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

        scraper.save_to_json(data, str(self.complete_file))

        elapsed = end_time - start_time
        print(f"\nStep 1 Complete: {len(data)} regulations scraped")
        print(f"Time: {int(elapsed//3600)}h {int((elapsed%3600)//60)}m")

        return data

    def step2_process_cache_to_clean_data(self, max_workers=8):
        """Step 2: Convert cached HTML to clean regulation data (parallel)."""
        print("\n" + "=" * 60)
        print("STEP 2: PROCESSING CACHED FILES TO CLEAN DATA (PARALLEL)")
        print("=" * 60)

        from concurrent.futures import ProcessPoolExecutor, as_completed

        cache_dir = self.scraped_data_dir

        if not cache_dir.exists():
            print(f"No scraped_data directory found at {cache_dir}")
            return False

        html_files = [f for f in cache_dir.glob('*.json')
                      if f.name not in ['progress.json', 'failed_urls.json', 'scraped_from_urls.json']]

        print(f"Processing {len(html_files)} cached files with {max_workers} workers...")

        regulation_data = []
        processed_count = 0
        error_count = 0

        process_fn = self.process_cached_file_fn()

        with ProcessPoolExecutor(max_workers=max_workers) as executor:
            futures = {executor.submit(process_fn, str(f)): f for f in html_files}

            for future in as_completed(futures):
                try:
                    result = future.result()
                    if result:
                        regulation_data.append(result)
                        processed_count += 1
                        if processed_count % 500 == 0:
                            print(f"  Processed {processed_count} files...")
                except Exception as e:
                    error_count += 1
                    failed_file = futures[future]
                    print(f"  ⚠ Failed to process {failed_file.name}: {type(e).__name__}: {e}")

        if error_count > 0:
            print(f"  ⚠ {error_count} files failed to process out of {len(html_files)}")

        if not regulation_data:
            print("No valid regulation data found")
            return False

        print(f"  Processed {len(regulation_data)} total files")

        for idx, item in enumerate(regulation_data):
            item['source_index'] = idx

        scraper_temp = self.create_scraper()
        regulation_data = scraper_temp.link_parent_source_indices(regulation_data)

        with open(self.cache_file, 'w', encoding='utf-8') as f:
            json.dump(regulation_data, f, indent=2, ensure_ascii=False)

        print(f"Step 2 Complete: {len(regulation_data)} regulations with cleaned content")
        print(f"Saved to {self.cache_file}")

        return regulation_data

    def step3_create_individual_files(self):
        """Step 3: Create individual JSON files from cleaned data."""
        print("\n" + "=" * 60)
        print("STEP 3: CREATING INDIVIDUAL REGULATION FILES")
        print("=" * 60)

        try:
            with open(self.cache_file, 'r', encoding='utf-8') as f:
                regulations = json.load(f)
        except FileNotFoundError:
            print(f"{self.cache_file} not found. Run steps 1-2 first.")
            return False

        print(f"Loaded {len(regulations)} regulations")

        output_dir = self.individual_dir
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
            }

            # Add state-specific hierarchy fields
            for field in self.hierarchy_fields:
                individual_file[field] = regulation.get(field)

            individual_file['parent_source_index'] = regulation.get('parent_source_index')
            individual_file['scraped_from_url'] = regulation.get('scraped_from_url')

            file_path = output_dir / filename
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(individual_file, f, indent=2, ensure_ascii=False)

            created_count += 1
            if created_count % 1000 == 0:
                print(f"  Created {created_count}/{len(regulations)} files...")

        print(f"Step 3 Complete: {created_count} individual files created")
        print(f"Location: {output_dir}/")

        return True

    def step4_migrate_to_database(self):
        """Step 4: Migrate regulations to database and refresh stats."""
        print("\n" + "=" * 60)
        print("STEP 4: MIGRATING TO DATABASE")
        print("=" * 60)

        start_time = time.time()

        print("\n[4.1] Migrating regulations to database...")
        migrated = migrate_regulations_to_db(self.state_code)
        if migrated == 0:
            print("WARNING: No regulations migrated")
            return False

        print("\n[4.2] Populating parent IDs...")
        populate_parent_ids(self.state_code)

        print("\n[4.3] Cleaning up stale documents...")
        cleanup_stale_documents(self.state_code)

        print("\n[4.4] Refreshing hierarchy stats...")
        conn = get_db_connection()
        if conn:
            updated = refresh_all_stats(conn, self.state_code)
            conn.close()
            print(f"  Updated stats for {updated} documents")
        else:
            print("WARNING: Could not connect to database for stats refresh")

        elapsed = time.time() - start_time
        print(f"\nStep 4 Complete: {migrated} regulations in database")
        print(f"Time: {format_time(elapsed)}")

        return True

    def run_full_pipeline(self, max_pages=None, skip_db=False):
        """Run the complete pipeline."""
        print("=" * 60)
        print(f"{self.state_code} REGULATIONS COMPLETE PIPELINE")
        print("Scrape → Clean → Individual Files → Database")
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

            if not skip_db:
                success = self.step4_migrate_to_database()
                if not success:
                    return False
            else:
                print("\n[SKIPPED] Step 4: Database migration (--skip-db flag)")

            print("\n" + "=" * 60)
            print("PIPELINE COMPLETE!")
            print("=" * 60)
            print(f"Regulations scraped and cleaned: {len(clean_data)}")
            print(f"Individual files: {self.individual_dir}")
            print(f"Master file: {self.cache_file}")
            if not skip_db:
                print(f"Database: regulations migrated and stats refreshed")

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


def run_scraper_main(pipeline_class, scraped_data_dir: Path, state_name: str):
    """Shared main() entry point for state scraper CLIs."""
    import argparse

    parser = argparse.ArgumentParser(description=f'{state_name} Regulations Scraper and Pipeline')
    parser.add_argument('--test', action='store_true', help='Test mode: limit to 100 pages')
    parser.add_argument('--small', action='store_true', help='Small run: limit to 1000 pages')
    parser.add_argument('--yes', '-y', action='store_true', help='Auto-confirm (skip prompt)')
    parser.add_argument('--max-pages', type=int, help='Custom max pages limit')
    parser.add_argument('--fresh', action='store_true', help='Clear progress and start fresh')
    parser.add_argument('--skip-db', action='store_true', help='Skip database migration step')

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
            scraped_data_dir / 'progress.json',
            scraped_data_dir / 'failed_urls.json',
            scraped_data_dir / 'scraped_from_urls.json',
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

    pipeline = pipeline_class()
    success = pipeline.run_full_pipeline(max_pages, skip_db=args.skip_db)

    if success:
        print(f"\nReady to use!")
    else:
        print("\nPipeline failed")
