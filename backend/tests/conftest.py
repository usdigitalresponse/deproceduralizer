"""Pytest fixtures for backend tests."""
import pytest


def pytest_configure(config):
    """Register custom markers."""
    config.addinivalue_line("markers", "llm: marks tests as requiring LLM API calls (deselect with '-m \"not llm\"')")
    config.addinivalue_line("markers", "db: marks tests as requiring database connection (deselect with '-m \"not db\"')")
