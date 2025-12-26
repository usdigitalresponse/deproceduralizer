"""
Configuration for compliance issue detection.

Loads issue type definitions from compliance_issues.yaml (single source of truth).
Only state configurations are defined here in Python.
"""

import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Type, Pattern

import yaml

# Add parent directories to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from config import DATA_DIR

from .models import RESPONSE_MODELS, BaseComplianceAnalysis


# =============================================================================
# STATE CONFIGURATION
# =============================================================================

@dataclass
class StateConfig:
    """
    Configuration for a state's regulations and optional statute data.

    Regulations are queried from the regulatory_documents table in the database.

    Attributes:
        state_code: Two-letter state code ('NJ' or 'NY')
        citation_prefix: Prefix for database fields ('njac' or 'nycrr')
        statute_file: Optional path to statute JSON file (local file for now)
        statute_pattern: Optional regex pattern for extracting statute citations
        statute_citation_prefix: Human-readable prefix for statute citations
    """
    state_code: str
    citation_prefix: str
    # Statute configuration (optional - decoupled from state)
    statute_file: Optional[Path] = None
    statute_pattern: Optional[Pattern] = None
    statute_citation_prefix: Optional[str] = None

    def has_statute_data(self) -> bool:
        """Check if statute data is available for this state."""
        return self.statute_file is not None and self.statute_file.exists()


# State configurations
STATES: dict[str, StateConfig] = {
    'nj': StateConfig(
        state_code='NJ',
        citation_prefix='njac',
        statute_file=DATA_DIR / 'nj_statutes_complete.json',
        statute_pattern=re.compile(
            r'N\.J\.S\.A\.\s*(\d+[A-Za-z]?):(\d+[A-Za-z]?)-(\d+(?:\.\d+)?[a-z]?)',
            re.IGNORECASE
        ),
        statute_citation_prefix='N.J.S.A.',
    ),
    'ny': StateConfig(
        state_code='NY',
        citation_prefix='nycrr',
        # NY statute data can be added later
        statute_file=None,
        statute_pattern=None,
        statute_citation_prefix=None,
    ),
}


# =============================================================================
# ISSUE TYPE CONFIGURATION (loaded from YAML)
# =============================================================================

@dataclass
class IssueTypeConfig:
    """
    Configuration for a compliance issue type.
    Loaded from compliance_issues.yaml.
    """
    name: str
    display_name: str
    db_issue_type: str
    category: str
    description: str
    response_model: Type[BaseComplianceAnalysis]
    patterns: list[str]
    prompt: dict  # Contains 'system' and 'template'

    @property
    def compiled_patterns(self) -> list[re.Pattern]:
        """Compile regex patterns (cached on first access)."""
        if not hasattr(self, '_compiled_patterns'):
            self._compiled_patterns = [
                re.compile(p, re.IGNORECASE) for p in self.patterns
            ]
        return self._compiled_patterns


# Issue types that use dedicated tables (not compliance_issues table)
# These are excluded from ISSUE_TYPES but can be loaded separately via _load_issue_config()
DEDICATED_TABLE_ISSUE_TYPES = {'incorporation_by_reference'}


def _load_issue_types(include_dedicated: bool = False) -> dict[str, IssueTypeConfig]:
    """Load issue type configurations from YAML file.

    Args:
        include_dedicated: If True, include issue types that use dedicated tables.
                          Default False to avoid accidental duplicate processing.
    """
    yaml_path = Path(__file__).parent / 'compliance_issues.yaml'

    with open(yaml_path, 'r') as f:
        data = yaml.safe_load(f)

    issue_types = {}
    for name, config in data.items():
        # Skip issue types with dedicated tables unless explicitly requested
        if not include_dedicated and name in DEDICATED_TABLE_ISSUE_TYPES:
            continue

        # Get response model class from name
        model_name = config.get('response_model', 'BaseComplianceAnalysis')
        response_model = RESPONSE_MODELS.get(model_name, BaseComplianceAnalysis)

        issue_types[name] = IssueTypeConfig(
            name=name,
            display_name=config['display_name'],
            db_issue_type=config['db_issue_type'],
            category=config.get('category', ''),
            description=config.get('description', ''),
            response_model=response_model,
            patterns=config.get('patterns', []),
            prompt=config.get('prompt', {}),
        )

    return issue_types


def _load_issue_config(name: str) -> IssueTypeConfig:
    """Load a single issue type config by name (including dedicated table types)."""
    all_types = _load_issue_types(include_dedicated=True)
    if name not in all_types:
        raise ValueError(f"Unknown issue type: {name}")
    return all_types[name]


# Load issue types from YAML (excluding dedicated table types by default)
ISSUE_TYPES: dict[str, IssueTypeConfig] = _load_issue_types()


def get_issue_types_by_category() -> dict[str, list[str]]:
    """Group issue type names by category."""
    by_category: dict[str, list[str]] = {}
    for name, config in ISSUE_TYPES.items():
        cat = config.category or "Other"
        if cat not in by_category:
            by_category[cat] = []
        by_category[cat].append(name)
    return by_category


def list_issue_types() -> None:
    """Print all available issue types grouped by category."""
    print("\nAvailable issue types:")
    print("=" * 70)

    by_category = get_issue_types_by_category()
    for cat in sorted(by_category.keys()):
        print(f"\n{cat}:")
        for name in sorted(by_category[cat]):
            config = ISSUE_TYPES[name]
            print(f"  {name:25} - {config.display_name}")

    print(f"\nTotal: {len(ISSUE_TYPES)} issue types")
