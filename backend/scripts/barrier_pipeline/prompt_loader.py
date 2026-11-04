"""Load Barrier prompts from prompts/barriers.yaml."""
import yaml
from config import PROJECT_ROOT

_cache = None


def load_barrier_prompts() -> dict:
    """Load all Barrier prompt sections from prompts/barriers.yaml."""
    global _cache
    if _cache is None:
        path = PROJECT_ROOT / "prompts" / "barriers.yaml"
        with open(path) as f:
            _cache = yaml.safe_load(f)
    return _cache
