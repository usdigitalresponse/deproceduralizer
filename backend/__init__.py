"""
Deproceduralizer Backend Package.

This package provides:
- shared_utils: LLM wrappers, batch API, database utilities
- observability: Langfuse integration for LLM tracing
- config: Path and environment configuration
- scripts: Analysis and processing scripts
"""

from pathlib import Path

# Package root for relative imports
BACKEND_ROOT = Path(__file__).parent

__all__ = ["BACKEND_ROOT"]
