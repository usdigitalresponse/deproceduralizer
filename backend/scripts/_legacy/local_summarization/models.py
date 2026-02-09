"""Data models for local summarization pipeline."""

from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Optional


@dataclass
class SummaryMetadata:
    """Metadata captured during summarization."""

    # Document info
    document_id: int
    hierarchy_level: str
    state: str

    # Content metrics
    original_char_count: int
    original_word_count: int
    input_char_count: int  # What was actually sent to model

    # Chunking info
    chunking_strategy: str  # 'full', 'head_tail', 'subsection', 'paragraph', 'truncated', 'hierarchical', 'skipped'
    num_chunks: int
    chunk_summaries: list[str] = field(default_factory=list)  # If multi-chunk

    # Output metrics
    summary_char_count: int = 0
    summary_word_count: int = 0

    # Processing info
    model_name: str = "qwen2.5:7b-instruct-q4_K_M"
    model_family: str = "ollama"  # 'claude' or 'ollama' - used for context filtering
    batch_id: Optional[str] = None  # Anthropic batch ID if processed via batch API
    processing_time_ms: int = 0
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())

    # Hierarchical context (for bottom-up summarization)
    parent_id: Optional[int] = None
    child_ids: list[int] = field(default_factory=list)
    child_summaries_used: int = 0  # How many child summaries were included in prompt
    sibling_summaries_used: int = 0  # How many sibling summaries were included
    intro_chars_used: int = 0  # How many chars of intro text used
    ancestor_count: int = 0  # How many ancestors in hierarchy breadcrumb
    phase: str = ""  # Which phase generated this summary (e.g., 'sections', 'chapters')

    # Quality signals
    was_truncated: bool = False
    contains_definitions: bool = False
    is_index_or_toc: bool = False
    is_unparseable: bool = False  # True if content is images, tables, or otherwise not text
    unparseable_reason: Optional[str] = None  # e.g., "image_only", "reserved", "empty"
    generation_tokens: int = 0
    was_manually_edited: bool = False

    # Errors
    error: Optional[str] = None

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class SummaryResult:
    """Complete result for a document."""

    document_id: int
    title: str
    hierarchy_level: str
    state: str
    citation: Optional[str]

    # The actual summary
    summary: str

    # Full metadata
    metadata: SummaryMetadata

    # Review status
    review_status: str = "pending"  # pending, approved, rejected
    reviewer_notes: Optional[str] = None

    def to_dict(self) -> dict:
        d = asdict(self)
        d["metadata"] = self.metadata.to_dict()
        return d

    @classmethod
    def from_dict(cls, data: dict) -> "SummaryResult":
        """Reconstruct from dictionary."""
        metadata_dict = data.pop("metadata")
        metadata = SummaryMetadata(**metadata_dict)
        return cls(metadata=metadata, **data)
