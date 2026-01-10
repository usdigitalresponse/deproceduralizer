"""Tests for analysis_writer serialization."""
import json
import pytest
from scripts.research_pipeline.models.context import ContextRequest


class TestTier2ContextRequestsSerialization:
    """Ensure tier2_context_requests_made is JSON-serializable."""

    def test_context_requests_serialize_to_json(self):
        """ContextRequest Pydantic objects must serialize via model_dump."""
        requests = [
            ContextRequest(
                context_type="definition",
                identifier="permit",
                need_level="summary",
                reason="Need to understand permit requirements",
                scope_document_id=123,
            ),
            ContextRequest(
                context_type="cross_reference",
                identifier="N.J.A.C. 7:1-1.1",
                need_level="full_text",
                reason="Cross-referenced section may provide context",
            ),
        ]

        # This is what the fixed code does
        serialized = [r.model_dump(by_alias=True) for r in requests]
        json_str = json.dumps(serialized)

        # Should not raise
        assert json_str
        parsed = json.loads(json_str)
        assert len(parsed) == 2
        assert parsed[0]["contextType"] == "definition"  # by_alias=True uses camelCase
        assert parsed[0]["identifier"] == "permit"
        assert parsed[0]["needLevel"] == "summary"
        assert parsed[0]["scopeDocumentId"] == 123
        assert parsed[1]["contextType"] == "cross_reference"
        assert parsed[1]["needLevel"] == "full_text"

    def test_raw_pydantic_objects_not_serializable(self):
        """Direct json.dumps on Pydantic objects should fail (regression guard)."""
        requests = [
            ContextRequest(
                context_type="definition",
                identifier="permit",
                need_level="summary",
                reason="Test reason",
            ),
        ]

        # This is what the OLD broken code did
        with pytest.raises(TypeError, match="not JSON serializable"):
            json.dumps(requests)

    def test_empty_list_serializes(self):
        """Empty list should serialize to '[]'."""
        requests: list[ContextRequest] = []
        serialized = [r.model_dump(by_alias=True) for r in requests]
        json_str = json.dumps(serialized)
        assert json_str == "[]"
