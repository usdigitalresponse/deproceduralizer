"""JenAI processing unit - the core data structure passed through the pipeline."""
from dataclasses import dataclass
from typing import Optional

from scripts.research_pipeline.models.context import ContextCatalog


@dataclass
class JenAIUnit:
    """One regulatory section being analyzed."""
    document_id: int
    citation: str
    title: str
    content: str
    state: str
    summary: Optional[str] = None
    url: Optional[str] = None
    hierarchy_level: Optional[str] = None
    parent_id: Optional[int] = None
    context_catalog: Optional[ContextCatalog] = None
