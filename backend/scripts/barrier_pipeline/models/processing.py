"""Barrier processing unit - the core data structure passed through the pipeline."""
from dataclasses import dataclass, field
from typing import Literal, Optional

from scripts.research_pipeline.models.context import ContextCatalog


@dataclass
class BarrierUnit:
    """One regulatory or guidance document section being analyzed."""
    document_id: int  # regulatory_documents.id or guidance_documents.id
    citation: str
    title: str
    content: str
    jurisdiction: str
    summary: Optional[str] = None
    url: Optional[str] = None
    hierarchy_level: Optional[str] = None
    parent_id: Optional[int] = None
    source_type: Literal["regulation", "guidance"] = "regulation"
    context_catalog: Optional[ContextCatalog] = None
    # Metadata fields for agency resolution and prompt context
    title_num: Optional[str] = None
    agency: Optional[str] = None
    doc_type: Optional[str] = None
    date_published: Optional[str] = None
    status: Optional[str] = None
    cites_regulations: list = field(default_factory=list)
