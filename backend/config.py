"""
Backend configuration with centralized path management.

All paths are relative to the project root to ensure consistency
across all Python scripts regardless of where they're run from.
"""
from pathlib import Path

# Base directories
BACKEND_DIR = Path(__file__).parent
PROJECT_ROOT = BACKEND_DIR.parent
DATA_DIR = PROJECT_ROOT / 'data'
FRONTEND_DIR = PROJECT_ROOT / 'frontend'

# Data paths
INDIVIDUAL_REGULATIONS_DIR = DATA_DIR / 'individual_regulations'
SCRAPED_DATA_DIR = DATA_DIR / 'scraped_data'
RAW_DATA_DIR = DATA_DIR / 'raw'
OUTPUTS_DIR = DATA_DIR / 'outputs'

# Frontend paths
WEB_PUBLIC_DIR = FRONTEND_DIR / 'apps' / 'web' / 'public'

# Common data files - New York
NY_REGULATIONS_CACHE_FILE = DATA_DIR / 'ny_regulations_from_cache.json'
NY_REGULATIONS_COMPLETE_FILE = DATA_DIR / 'ny_regulations_complete.json'

# Common data files - New Jersey Regulations
NJ_SCRAPED_DATA_DIR = DATA_DIR / 'nj_scraped_data'
NJ_INDIVIDUAL_REGULATIONS_DIR = DATA_DIR / 'nj_individual_regulations'
NJ_REGULATIONS_CACHE_FILE = DATA_DIR / 'nj_regulations_from_cache.json'
NJ_REGULATIONS_COMPLETE_FILE = DATA_DIR / 'nj_regulations_complete.json'

# Common data files - New Jersey Statutes
NJ_STATUTES_INPUT_FILE = PROJECT_ROOT / 'STATUTES-TEXT' / 'STATUTES.TXT'
NJ_STATUTES_OUTPUT_DIR = DATA_DIR / 'nj_statutes'
NJ_STATUTES_INDIVIDUAL_DIR = NJ_STATUTES_OUTPUT_DIR / 'individual'
NJ_STATUTES_COMPLETE_FILE = DATA_DIR / 'nj_statutes_complete.json'

# Common data files - New York Statutes (OpenLegislation API)
NY_STATUTES_OUTPUT_DIR = DATA_DIR / 'ny_statutes'
NY_STATUTES_TREES_DIR = NY_STATUTES_OUTPUT_DIR / 'trees'
NY_STATUTES_SECTIONS_DIR = NY_STATUTES_OUTPUT_DIR / 'sections'
NY_STATUTES_INDIVIDUAL_DIR = NY_STATUTES_OUTPUT_DIR / 'individual'
NY_STATUTES_COMPLETE_FILE = DATA_DIR / 'ny_statutes_complete.json'


# Hierarchy level ordering per state (bottom-up, excluding 'section').
# Sections are always summarized first, then these levels in order.
# Only levels present in the data for a given title are used.
HIERARCHY_ORDER = {
    # NYCRR: section → subpart → part → article → subchapter → chapter → title
    "NY": ["subpart", "part", "article", "subchapter", "chapter", "subtitle", "title"],
    # NJAC: section → part → subchapter → chapter → title
    "NJ": ["part", "subchapter", "chapter", "subtitle", "title"],
}


def ensure_data_dirs():
    """Create data directories if they don't exist."""
    for dir_path in [DATA_DIR, INDIVIDUAL_REGULATIONS_DIR, SCRAPED_DATA_DIR, OUTPUTS_DIR,
                     NJ_SCRAPED_DATA_DIR, NJ_INDIVIDUAL_REGULATIONS_DIR,
                     NJ_STATUTES_OUTPUT_DIR, NJ_STATUTES_INDIVIDUAL_DIR,
                     NY_STATUTES_OUTPUT_DIR, NY_STATUTES_TREES_DIR,
                     NY_STATUTES_SECTIONS_DIR, NY_STATUTES_INDIVIDUAL_DIR]:
        dir_path.mkdir(parents=True, exist_ok=True)
