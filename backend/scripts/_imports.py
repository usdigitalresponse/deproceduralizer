"""
Import helper for backend scripts.

Usage in scripts:
    # At the top of your script, replace:
    #   import sys
    #   from pathlib import Path
    #   sys.path.insert(0, str(Path(__file__).parent.parent))
    #
    # With:
    #   from _imports import *
    #
    # This sets up the path and re-exports common imports.

Example:
    from _imports import *
    from lib.db import get_db_connection
    from lib.llm import call_llm_parse
    from config import OUTPUTS_DIR
    from observability import LLMTraceContext
"""

import sys
from pathlib import Path

# Add backend directory to path (parent of scripts/)
_backend_dir = Path(__file__).parent.parent
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))

# Re-export Path for convenience (commonly used in scripts)
__all__ = ["Path"]
