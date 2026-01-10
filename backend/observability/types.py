"""
Type definitions for observability.
"""

from dataclasses import dataclass, field
from typing import Optional, Dict, Any


@dataclass
class LLMTraceContext:
    """
    Context for tracing LLM calls through Langfuse.

    This context is passed through LLM call functions to enable
    consistent tracing across pipeline stages.

    Attributes:
        run_id: Unique identifier for the pipeline run (e.g., "abc123")
        session_name: Name for the Langfuse session (e.g., "compliance_issues_nj_2025-01-01")
        trace_id: Optional specific trace ID (auto-generated if not provided)
        stage: Pipeline stage name (e.g., "tier1_triage", "tier2_research")
        state: State being processed (e.g., "NJ", "NY")
        issue_type: Type of compliance issue (e.g., "excessive_documentation")
        prompt_name: Name of the prompt being used (e.g., "tier1_triage")
        document_id: ID of the document being processed
        extra: Additional metadata to include in traces
    """

    run_id: str
    session_name: Optional[str] = None
    trace_id: Optional[str] = None
    stage: Optional[str] = None
    state: Optional[str] = None
    issue_type: Optional[str] = None
    prompt_name: Optional[str] = None
    document_id: Optional[int] = None
    extra: Dict[str, Any] = field(default_factory=dict)

    def to_metadata(self) -> Dict[str, Any]:
        """Convert context to metadata dict for Langfuse."""
        metadata = {
            "run_id": self.run_id,
        }
        if self.stage:
            metadata["stage"] = self.stage
        if self.state:
            metadata["state"] = self.state
        if self.issue_type:
            metadata["issue_type"] = self.issue_type
        if self.prompt_name:
            metadata["prompt_name"] = self.prompt_name
        if self.document_id:
            metadata["document_id"] = self.document_id
        if self.extra:
            metadata.update(self.extra)
        return metadata

    def get_session_id(self) -> str:
        """Get session ID for Langfuse (uses session_name or run_id)."""
        return self.session_name or self.run_id
