#!/usr/bin/env python3
"""
Complete NY Regulations Pipeline - From 0 to Individual Clean Files
Runs the entire process: scrape -> clean -> extract individual files
"""

import sys
import subprocess
import signal
import os
import json
import time
import re
from pathlib import Path

# Add parent directory to path for config import
sys.path.insert(0, str(Path(__file__).parent.parent))
from config import (
    SCRAPED_DATA_DIR,
    INDIVIDUAL_REGULATIONS_DIR,
    NY_REGULATIONS_CACHE_FILE,
    NY_REGULATIONS_COMPLETE_FILE,
    DATA_DIR,
    ensure_data_dirs
)
from ny_regulations_scraper import NYRegulationsScraper

class FullPipeline:
    def __init__(self):
        self.caffeinate_proc = None
        
    def start_caffeinate(self):
        """Start caffeinate to prevent system sleep"""
        try:
            print("🔋 Starting caffeinate to prevent system sleep...")
            self.caffeinate_proc = subprocess.Popen(['caffeinate', '-d'], 
                                                  stdout=subprocess.DEVNULL, 
                                                  stderr=subprocess.DEVNULL)
            print("✅ Caffeinate started successfully")
        except Exception as e:
            print(f"⚠️  Could not start caffeinate: {e}")
    
    def stop_caffeinate(self):
        """Stop caffeinate process"""
        if self.caffeinate_proc:
            try:
                self.caffeinate_proc.terminate()
                self.caffeinate_proc.wait(timeout=5)
                print("🔋 Caffeinate stopped")
            except:
                try:
                    self.caffeinate_proc.kill()
                except:
                    pass
    
    def setup_signal_handlers(self):
        """Setup clean shutdown handlers"""
        def signal_handler(sig, frame):
            print("\n🛑 Received interrupt signal, cleaning up...")
            self.stop_caffeinate()
            sys.exit(0)
        
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)
    
    def step1_scrape_regulations(self, max_pages=None):
        """Step 1: Scrape all regulations"""
        print("=" * 60)
        print("📥 STEP 1: SCRAPING NY REGULATIONS")
        print("=" * 60)
        
        scraper = NYRegulationsScraper()
        
        print("🚀 Starting comprehensive scrape...")
        print("Features: caffeinate, auto-resume, retry logic, progress saving, content cleaning")
        print()
        
        if scraper.visited_urls:
            print(f"📈 Resuming from {len(scraper.visited_urls)} previously visited URLs")
        
        start_time = time.time()
        data = scraper.scrape_all(max_pages=max_pages)
        end_time = time.time()
        
        if not data:
            print("❌ No data was scraped")
            return False
            
        # Save raw scraped data
        scraper.save_to_json(data, str(NY_REGULATIONS_COMPLETE_FILE))
        
        elapsed = end_time - start_time
        print(f"\n✅ Step 1 Complete: {len(data)} regulations scraped")
        print(f"⏱️  Time: {int(elapsed//3600)}h {int((elapsed%3600)//60)}m")
        
        return data
    
    def step2_process_cache_to_clean_data(self):
        """Step 2: Convert cached HTML to clean regulation data"""
        print("\n" + "=" * 60)
        print("🧹 STEP 2: PROCESSING CACHED FILES TO CLEAN DATA")
        print("=" * 60)
        
        scraper = NYRegulationsScraper()
        cache_dir = SCRAPED_DATA_DIR

        if not cache_dir.exists():
            print(f"❌ No scraped_data directory found at {cache_dir}")
            return False
        
        # Find all cached HTML files
        html_files = list(cache_dir.glob('*.json'))
        regulation_data = []
        
        print(f"🔍 Processing {len(html_files)} cached files...")
        
        processed_count = 0
        for i, html_file in enumerate(html_files):
            if html_file.name in ['progress.json', 'failed_urls.json']:
                continue
                
            try:
                with open(html_file, 'r', encoding='utf-8') as f:
                    cached_data = json.load(f)
                
                if 'html' in cached_data and 'url' in cached_data:
                    url = cached_data['url']
                    html = cached_data['html']
                    
                    # Convert to clean regulation data
                    from bs4 import BeautifulSoup
                    soup = BeautifulSoup(html, 'html.parser')
                    
                    # Extract title
                    title_elem = soup.find('h1') or soup.find('title')
                    title = title_elem.get_text(strip=True) if title_elem else "No title found"
                    
                    # Extract actual regulation content (not navigation/ads)
                    content = ""
                    
                    # Look for the actual regulation text container
                    reg_content = soup.find('div', class_='statereg-text')
                    if reg_content:
                        content = reg_content.get_text(separator='\n', strip=True)
                    else:
                        # Fallback to main content
                        main_content = soup.find('div', {'id': 'content'}) or soup.find('main')
                        if main_content:
                            for unwanted in main_content(['nav', 'aside', 'footer', 'script', 'style', 'noscript', 'header']):
                                unwanted.decompose()
                            content = main_content.get_text(separator='\n', strip=True)
                    
                    # Clean the content
                    cleaned_content = scraper.clean_regulation_text(content)
                    
                    regulation = {
                        'url': url,
                        'title': title,
                        'content': content,
                        'cleaned_content': cleaned_content,
                        'url_type': scraper.classify_url(url)
                    }
                    
                    regulation_data.append(regulation)
                    processed_count += 1
                    
                    if processed_count % 500 == 0:
                        print(f"  Processed {processed_count} files...")
                        
            except Exception as e:
                continue
        
        if not regulation_data:
            print("❌ No valid regulation data found")
            return False
        
        # Save clean regulation data
        with open(NY_REGULATIONS_CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump(regulation_data, f, indent=2, ensure_ascii=False)

        print(f"✅ Step 2 Complete: {len(regulation_data)} regulations with cleaned content")
        print(f"💾 Saved to {NY_REGULATIONS_CACHE_FILE}")
        
        return regulation_data
    
    def step3_create_individual_files(self):
        """Step 3: Create individual JSON files from cleaned data"""
        print("\n" + "=" * 60)
        print("📁 STEP 3: CREATING INDIVIDUAL REGULATION FILES")
        print("=" * 60)
        
        # Load the clean data
        try:
            with open(NY_REGULATIONS_CACHE_FILE, 'r', encoding='utf-8') as f:
                regulations = json.load(f)
        except FileNotFoundError:
            print(f"❌ {NY_REGULATIONS_CACHE_FILE} not found. Run steps 1-2 first.")
            return False

        print(f"📄 Loaded {len(regulations)} regulations")

        # Create output directory
        output_dir = INDIVIDUAL_REGULATIONS_DIR
        if output_dir.exists():
            print("🗑️  Removing old individual files...")
            import shutil
            shutil.rmtree(output_dir)
        output_dir.mkdir()
        
        print("📝 Creating individual files...")
        
        created_count = 0
        for regulation in regulations:
            url = regulation['url']
            
            # Create clean filename
            url_part = url.split('/')[-1] if '/' in url else url
            clean_name = re.sub(r'[^\w\-\.]', '_', url_part)
            filename = f"{clean_name}.json"
            
            # Create individual file with cleaned content
            individual_file = {
                'url': regulation['url'],
                'title': regulation['title'],
                'content': regulation['cleaned_content'],  # Use cleaned version!
                'url_type': regulation.get('url_type', 'unknown')
            }
            
            file_path = output_dir / filename
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(individual_file, f, indent=2, ensure_ascii=False)
            
            created_count += 1
            if created_count % 1000 == 0:
                print(f"  Created {created_count}/{len(regulations)} files...")
        
        print(f"✅ Step 3 Complete: {created_count} individual files created")
        print(f"📁 Location: {output_dir}/")
        
        return True
    
    def run_full_pipeline(self, max_pages=None):
        """Run the complete pipeline"""
        print("🗽" * 20)
        print("NY REGULATIONS COMPLETE PIPELINE")
        print("From 0 to Individual Clean Files")
        print("🗽" * 20)
        print()
        
        self.setup_signal_handlers()
        self.start_caffeinate()
        
        try:
            # Step 1: Scrape
            data = self.step1_scrape_regulations(max_pages)
            if not data:
                return False
            
            # Step 2: Clean
            clean_data = self.step2_process_cache_to_clean_data()
            if not clean_data:
                return False
            
            # Step 3: Individual files
            success = self.step3_create_individual_files()
            if not success:
                return False
            
            print("\n" + "🎉" * 20)
            print("PIPELINE COMPLETE!")
            print("🎉" * 20)
            print(f"✅ {len(clean_data)} regulations scraped and cleaned")
            print(f"📁 Individual files: {INDIVIDUAL_REGULATIONS_DIR}")
            print(f"📄 Master file: {NY_REGULATIONS_CACHE_FILE}")
            
            return True
            
        except KeyboardInterrupt:
            print("\n🛑 Pipeline interrupted by user")
            return False
        except Exception as e:
            print(f"❌ Pipeline failed: {e}")
            import traceback
            traceback.print_exc()
            return False
        finally:
            self.stop_caffeinate()

def main():
    pipeline = FullPipeline()
    
    # Parse arguments
    max_pages = None
    auto_confirm = False
    
    if '--test' in sys.argv:
        max_pages = 100
        auto_confirm = True
        print("🧪 Test mode: limiting to 100 pages")
    elif '--small' in sys.argv:
        max_pages = 1000
        print("📊 Small run: limiting to 1000 pages")
    
    if '--yes' in sys.argv:
        auto_confirm = True
    
    # Confirm before starting
    if not auto_confirm:
        response = input("Run the complete pipeline from scratch? This will take several hours. (y/N): ")
        if response.lower() not in ['y', 'yes']:
            print("Pipeline cancelled.")
            return
    
    # Run it
    success = pipeline.run_full_pipeline(max_pages)
    
    if success:
        print(f"\n🎯 Ready to use! Check {INDIVIDUAL_REGULATIONS_DIR}")
    else:
        print("\n❌ Pipeline failed")

if __name__ == "__main__":
    main()