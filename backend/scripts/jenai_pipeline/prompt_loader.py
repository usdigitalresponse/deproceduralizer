"""Load JenAI prompts from prompts/jenai.yaml."""
import yaml
from config import PROJECT_ROOT

_cache = None


def load_jenai_prompts() -> dict:
    """Load all JenAI prompt sections from prompts/jenai.yaml."""
    global _cache
    if _cache is None:
        path = PROJECT_ROOT / "prompts" / "jenai.yaml"
        with open(path) as f:
            _cache = yaml.safe_load(f)
    return _cache
