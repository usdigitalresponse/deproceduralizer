"""
Tests that all YAML prompt files parse without errors.

Catches syntax issues like unquoted strings with embedded quotes,
bad indentation, and malformed sequences before they cause runtime
YAMLExceptions at server startup.
"""

import os
from pathlib import Path

import pytest
import yaml

PROMPTS_DIR = Path(__file__).resolve().parents[2] / "prompts"


def _collect_yaml_files():
    """Collect all .yaml files under prompts/, returning (path, label) tuples."""
    files = []
    for root, _dirs, filenames in os.walk(PROMPTS_DIR):
        for name in sorted(filenames):
            if name.endswith(".yaml"):
                full = Path(root) / name
                label = str(full.relative_to(PROMPTS_DIR))
                files.append(pytest.param(full, id=label))
    return files


@pytest.mark.parametrize("yaml_path", _collect_yaml_files())
def test_yaml_parses_without_error(yaml_path: Path):
    """Each YAML file under prompts/ must parse successfully."""
    content = yaml_path.read_text()
    try:
        yaml.safe_load(content)
    except yaml.YAMLError as exc:
        pytest.fail(f"YAML parse error in {yaml_path.name}: {exc}")


@pytest.mark.parametrize("yaml_path", _collect_yaml_files())
def test_yaml_is_not_empty(yaml_path: Path):
    """Each YAML file must contain a non-empty document."""
    content = yaml_path.read_text()
    parsed = yaml.safe_load(content)
    assert parsed is not None, f"{yaml_path.name} parsed to None (empty document)"
