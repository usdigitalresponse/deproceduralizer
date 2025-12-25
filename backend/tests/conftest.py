"""Pytest fixtures for backend tests."""
import pytest
import sys
from pathlib import Path

# Add backend to path
BACKEND_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(BACKEND_DIR))
sys.path.insert(0, str(BACKEND_DIR / 'scripts'))


def pytest_configure(config):
    """Register custom markers."""
    config.addinivalue_line("markers", "llm: marks tests as requiring LLM API calls (deselect with '-m \"not llm\"')")
    config.addinivalue_line("markers", "db: marks tests as requiring database connection (deselect with '-m \"not db\"')")
