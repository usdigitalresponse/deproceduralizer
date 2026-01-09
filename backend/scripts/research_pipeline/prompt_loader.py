"""
Prompt loader for the research pipeline.

Loads tier configurations from prompts/research_pipeline.yaml and
issue-specific configurations from prompts/issue_configs/*.yaml.
"""

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional
import yaml


# Path to prompts directory (relative to this file)
PROMPTS_DIR = Path(__file__).parent.parent.parent.parent / 'prompts'
RESEARCH_PIPELINE_YAML = PROMPTS_DIR / 'research_pipeline.yaml'
ISSUE_CONFIGS_DIR = PROMPTS_DIR / 'issue_configs'


@dataclass
class TierConfig:
    """
    Configuration for a tier prompt.

    V5 uses 4-layer caching structure:
    - static_core: Cached globally (no substitutions)
    - issue_block: Cached per issue type (issue-specific substitutions)
    - batch_context: Cached per subchapter (subchapter-level substitutions)
    - document_template: Unique per document (all substitutions)
    """
    tier_name: str
    description: str
    static_core: str          # Layer 1 - cached globally (system prompt)
    issue_block: str          # Layer 2 - cached per issue type
    batch_context: str        # Layer 3 - cached per subchapter (siblings share)
    document_template: str    # Layer 4 - unique per document
    updated_at: str

    @property
    def system(self) -> str:
        """Backward compatible - static_core is the system prompt."""
        return self.static_core

    @property
    def template(self) -> str:
        """Backward compatible - combines batch_context + document_template."""
        return (self.batch_context or '') + (self.document_template or '')


@dataclass
class IssueConfig:
    """Configuration for an issue type."""
    name: str
    db_issue_type: str
    display_name: str
    category: str
    description: str
    positive_indicators: list[str]
    negative_indicators: list[str]
    severity_baseline: int
    severity_modifiers: dict[str, list[str]]
    patterns: list[str] = field(default_factory=list)
    exclusion_patterns: list[str] = field(default_factory=list)
    examples: dict[str, list[dict]] = field(default_factory=dict)
    updated_at: str = ""


# Cache for loaded configs
_tier_configs_cache: Optional[dict[str, TierConfig]] = None
_issue_configs_cache: dict[str, IssueConfig] = {}


def load_tier_configs() -> dict[str, TierConfig]:
    """
    Load all tier configurations from research_pipeline.yaml.

    Returns:
        Dict mapping tier name ('tier1', 'tier2', etc.) to TierConfig
    """
    global _tier_configs_cache

    if _tier_configs_cache is not None:
        return _tier_configs_cache

    with open(RESEARCH_PIPELINE_YAML, 'r') as f:
        data = yaml.safe_load(f)

    configs = {}
    # V5: 3-tier pipeline with 4-layer caching
    for tier_name in ['tier1', 'tier2', 'tier3']:
        if tier_name not in data:
            continue

        tier_data = data[tier_name]

        # Support both old 3-layer (template) and new 4-layer (batch_context + document_template)
        batch_context = tier_data.get('batch_context', '')
        document_template = tier_data.get('document_template', '')

        # Fallback for old 3-layer structure
        if not batch_context and not document_template:
            document_template = tier_data.get('template', '')

        configs[tier_name] = TierConfig(
            tier_name=tier_name,
            description=tier_data.get('description', ''),
            static_core=tier_data.get('static_core', tier_data.get('system', '')),  # V4 fallback
            issue_block=tier_data.get('issue_block', ''),
            batch_context=batch_context,
            document_template=document_template,
            updated_at=tier_data.get('updated_at', ''),
        )

    _tier_configs_cache = configs
    return configs


def load_issue_config(issue_type: str) -> IssueConfig:
    """
    Load configuration for a specific issue type.

    Args:
        issue_type: The issue type key (e.g., 'in_person_submission', 'wet_signature')

    Returns:
        IssueConfig for the specified issue type

    Raises:
        FileNotFoundError: If the issue config file doesn't exist
        KeyError: If the issue type key isn't found in the file
    """
    global _issue_configs_cache

    if issue_type in _issue_configs_cache:
        return _issue_configs_cache[issue_type]

    config_file = ISSUE_CONFIGS_DIR / f'{issue_type}.yaml'
    if not config_file.exists():
        raise FileNotFoundError(f"Issue config not found: {config_file}")

    with open(config_file, 'r') as f:
        data = yaml.safe_load(f)

    if issue_type not in data:
        raise KeyError(f"Issue type '{issue_type}' not found in {config_file}")

    issue_data = data[issue_type]

    config = IssueConfig(
        name=issue_type,
        db_issue_type=issue_data.get('db_issue_type', issue_type),
        display_name=issue_data.get('display_name', issue_type.replace('_', ' ').title()),
        category=issue_data.get('category', ''),
        description=issue_data.get('description', ''),
        positive_indicators=issue_data.get('positive_indicators', []),
        negative_indicators=issue_data.get('negative_indicators', []),
        severity_baseline=issue_data.get('severity_baseline', 5),
        severity_modifiers=issue_data.get('severity_modifiers', {}),
        patterns=issue_data.get('patterns', []),
        exclusion_patterns=issue_data.get('exclusion_patterns', []),
        examples=issue_data.get('examples', {}),
        updated_at=issue_data.get('updated_at', ''),
    )

    _issue_configs_cache[issue_type] = config
    return config


def list_issue_types() -> list[str]:
    """
    List all available issue types.

    Returns:
        List of issue type names (without .yaml extension)
    """
    if not ISSUE_CONFIGS_DIR.exists():
        return []

    return sorted([
        f.stem for f in ISSUE_CONFIGS_DIR.glob('*.yaml')
        if not f.stem.startswith('_')  # Skip _index.yaml
    ])


# Alias for backwards compatibility
get_all_issue_types = list_issue_types


def load_tier_config(tier_name: str) -> TierConfig:
    """
    Load configuration for a single tier.

    Args:
        tier_name: One of 'tier1', 'tier2', 'tier3' (V5: 3-tier pipeline)

    Returns:
        TierConfig for the specified tier

    Raises:
        KeyError: If tier not found
    """
    configs = load_tier_configs()
    if tier_name not in configs:
        raise KeyError(f"Tier '{tier_name}' not found")
    return configs[tier_name]


def load_all_tier_configs() -> dict[str, TierConfig]:
    """Alias for load_tier_configs for backwards compatibility."""
    return load_tier_configs()


def format_indicators(indicators: list[str]) -> str:
    """
    Format a list of indicators as a bulleted list.

    Args:
        indicators: List of indicator strings

    Returns:
        Formatted string with each indicator on its own line
    """
    if not indicators:
        return "(none specified)"

    return '\n'.join(f'- {indicator}' for indicator in indicators)


def format_severity_modifiers(modifiers: dict[str, list[str]]) -> str:
    """
    Format severity modifiers for prompt template.

    Args:
        modifiers: Dict with 'increases' and 'decreases' lists

    Returns:
        Formatted string showing all modifiers
    """
    parts = []

    increases = modifiers.get('increases', [])
    if increases:
        parts.append("**Increase severity:**")
        parts.extend(f"  {mod}" for mod in increases)

    decreases = modifiers.get('decreases', [])
    if decreases:
        if parts:
            parts.append("")
        parts.append("**Decrease severity:**")
        parts.extend(f"  {mod}" for mod in decreases)

    if not parts:
        return "(no modifiers specified)"

    return '\n'.join(parts)


def format_examples(examples: dict[str, list[dict]]) -> str:
    """
    Format examples for few-shot learning in prompts.

    Args:
        examples: Dict with 'true_positives', 'false_positives', 'justified' lists

    Returns:
        Formatted string with examples
    """
    if not examples:
        return "(no examples available)"

    sections = []

    # True positives (burdensome)
    true_positives = examples.get('true_positives', [])
    if true_positives:
        section = ["### True Positive Examples (Burdensome)", ""]
        for ex in true_positives:
            section.append(f"**{ex.get('citation', 'Unknown')}**")
            section.append(f"> {ex.get('quote', '')}")
            section.append(f"Classification: {ex.get('classification', 'burdensome')}")
            if 'severity' in ex:
                section.append(f"Severity: {ex['severity']}")
            section.append(f"Reasoning: {ex.get('reasoning', '')}")
            section.append("")
        sections.append('\n'.join(section))

    # False positives (unrelated)
    false_positives = examples.get('false_positives', [])
    if false_positives:
        section = ["### False Positive Examples (Unrelated)", ""]
        for ex in false_positives:
            section.append(f"**{ex.get('citation', 'Unknown')}**")
            section.append(f"> {ex.get('quote', '')}")
            section.append(f"Classification: {ex.get('classification', 'unrelated')}")
            section.append(f"Reasoning: {ex.get('reasoning', '')}")
            section.append("")
        sections.append('\n'.join(section))

    # Justified examples
    justified = examples.get('justified', [])
    if justified:
        section = ["### Justified Examples", ""]
        for ex in justified:
            section.append(f"**{ex.get('citation', 'Unknown')}**")
            section.append(f"> {ex.get('quote', '')}")
            section.append(f"Classification: justified")
            if 'severity' in ex:
                section.append(f"Severity: {ex['severity']}")
            section.append(f"Reasoning: {ex.get('reasoning', '')}")
            section.append("")
        sections.append('\n'.join(section))

    return '\n'.join(sections) if sections else "(no examples available)"


def format_tier_prompt(
    tier: TierConfig,
    issue: IssueConfig,
    batch_context_vars: Optional[dict[str, Any]] = None,
    **document_vars: Any
) -> dict[str, str]:
    """
    Format a tier prompt with issue-specific content and context.

    V5 uses 4-layer caching structure:
    - Layer 1 (static_core): Cached globally - NO substitutions
    - Layer 2 (issue_block): Cached per issue - issue-specific substitutions
    - Layer 3 (batch_context): Cached per subchapter - batch context substitutions
    - Layer 4 (document_template): Unique per document - all substitutions

    Args:
        tier: The tier configuration
        issue: The issue configuration
        batch_context_vars: Variables for batch_context (subchapter-level, cacheable)
        **document_vars: Variables for document_template (document-specific)

    Returns:
        Dict with 4 keys:
        - 'system': The static_core (system prompt, globally cached)
        - 'issue_block': Formatted issue block (cached per issue type)
        - 'batch_context': Formatted batch context (cached per subchapter)
        - 'document_template': Formatted document template (never cached)
        - 'user': Combined user prompt (issue_block + batch_context + document_template)
    """
    batch_context_vars = batch_context_vars or {}

    # Format issue-specific variables
    issue_vars = {
        'issue_type': issue.db_issue_type,
        'issue_description': issue.description.strip(),
        'positive_indicators': format_indicators(issue.positive_indicators),
        'negative_indicators': format_indicators(issue.negative_indicators),
        'severity_baseline': str(issue.severity_baseline),
        'severity_modifiers': format_severity_modifiers(issue.severity_modifiers),
        'issue_examples': format_examples(issue.examples),
    }

    # Merge all vars for document template (needs access to everything)
    all_vars = {**issue_vars, **batch_context_vars, **document_vars}

    # Layer 1: Static core = system prompt (no substitutions - fully cached)
    system_prompt = tier.static_core

    # Layer 2: Issue block (substitute issue-specific vars only)
    issue_block = tier.issue_block or ''
    for key, value in issue_vars.items():
        placeholder = '{' + key + '}'
        if placeholder in issue_block:
            issue_block = issue_block.replace(placeholder, str(value))

    # Layer 3: Batch context (substitute batch context vars - cacheable per subchapter)
    batch_context = tier.batch_context or ''
    batch_vars = {**issue_vars, **batch_context_vars}  # Issue vars may be in batch_context too
    for key, value in batch_vars.items():
        placeholder = '{' + key + '}'
        if placeholder in batch_context:
            batch_context = batch_context.replace(placeholder, str(value))

    # Layer 4: Document template (substitute all vars including document-specific)
    document_template = tier.document_template or ''
    for key, value in all_vars.items():
        placeholder = '{' + key + '}'
        if placeholder in document_template:
            document_template = document_template.replace(placeholder, str(value))

    # Combine for backward-compatible user prompt
    user_prompt = issue_block + batch_context + document_template

    return {
        'system': system_prompt,
        'issue_block': issue_block,
        'batch_context': batch_context,
        'document_template': document_template,
        'user': user_prompt,
    }


def clear_cache() -> None:
    """Clear all cached configurations."""
    global _tier_configs_cache, _issue_configs_cache
    _tier_configs_cache = None
    _issue_configs_cache = {}


# Aliases for backwards compatibility with issue_config_loader naming
def format_indicators_for_prompt(config: IssueConfig) -> tuple[str, str]:
    """
    Format positive/negative indicators as bulleted lists for prompts.

    Args:
        config: IssueConfig to format

    Returns:
        Tuple of (positive_indicators_str, negative_indicators_str)
    """
    return (
        format_indicators(config.positive_indicators),
        format_indicators(config.negative_indicators),
    )


def format_severity_for_prompt(config: IssueConfig) -> str:
    """
    Format severity baseline and modifiers for prompt.

    Args:
        config: IssueConfig to format

    Returns:
        Formatted string with baseline and modifiers
    """
    lines = [f"Baseline severity: {config.severity_baseline}"]
    modifiers_str = format_severity_modifiers(config.severity_modifiers)
    if modifiers_str != "(no modifiers specified)":
        lines.append(modifiers_str)
    return '\n'.join(lines)


def format_examples_for_prompt(config: IssueConfig, limit: int = 3) -> str:
    """
    Format few-shot examples for prompt.

    Args:
        config: IssueConfig to format
        limit: Maximum number of examples per category

    Returns:
        Formatted string with examples
    """
    return format_examples(config.examples)
