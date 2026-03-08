"""
Prompt loading and caching from YAML files.
"""

from pathlib import Path
from typing import Dict, Optional

import yaml

from config import PROJECT_ROOT


# Cache for loaded prompts
_prompts_cache: Optional[Dict] = None


def _get_prompts_path() -> Path:
    """Get the path to core.yaml in the prompts directory."""
    return PROJECT_ROOT / "prompts" / "core.yaml"


def _load_prompts() -> Dict:
    """Load prompts from YAML file (cached)."""
    global _prompts_cache
    if _prompts_cache is None:
        prompts_path = _get_prompts_path()
        with open(prompts_path, 'r') as f:
            _prompts_cache = yaml.safe_load(f)
    return _prompts_cache


def load_prompt(prompt_name: str, **kwargs) -> str:
    """
    Load a prompt template and fill in variables.

    Args:
        prompt_name: Name of the prompt in prompts.yaml (e.g., "definition_extraction")
        **kwargs: Variables to substitute in the template (e.g., title="...", content="...")

    Returns:
        Formatted prompt string with variables filled in

    Example:
        prompt = load_prompt("definition_extraction",
                            title="Test Title",
                            content="The regulation text...")
    """
    prompts = _load_prompts()

    if prompt_name not in prompts:
        available = list(prompts.keys())
        raise ValueError(f"Unknown prompt '{prompt_name}'. Available: {available}")

    prompt_data = prompts[prompt_name]
    template = prompt_data.get("template", "")

    # Fill in variables
    return template.format(**kwargs)


def load_prompt_parts(prompt_name: str, **kwargs) -> dict:
    """
    Load a prompt with separate system and user parts for optimal caching.

    For Anthropic's prompt caching to work, static content should go in
    the system message (cached across requests) and dynamic content in
    the user message (unique per request).

    Args:
        prompt_name: Name of the prompt in prompts.yaml
        **kwargs: Variables for the user template

    Returns:
        Dict with 'system' (static, cached) and 'user' (dynamic) keys.
        If prompt has no 'system' key, returns {'system': None, 'user': formatted_template}

    Example:
        parts = load_prompt_parts("definition_extraction", title="...", content="...")
        # parts = {'system': "You are an expert...", 'user': "Extract from: ..."}
    """
    prompts = _load_prompts()

    if prompt_name not in prompts:
        available = list(prompts.keys())
        raise ValueError(f"Unknown prompt '{prompt_name}'. Available: {available}")

    prompt_data = prompts[prompt_name]

    system = prompt_data.get("system")  # Static, cacheable
    template = prompt_data.get("template", "")  # Dynamic per-request

    return {
        "system": system.strip() if system else None,
        "user": template.format(**kwargs) if template else None,
    }


def get_prompt_description(prompt_name: str) -> str:
    """Get the description of a prompt."""
    prompts = _load_prompts()
    if prompt_name not in prompts:
        raise ValueError(f"Unknown prompt '{prompt_name}'")
    return prompts[prompt_name].get("description", "")


def list_prompts() -> list:
    """List all available prompt names."""
    prompts = _load_prompts()
    return list(prompts.keys())
