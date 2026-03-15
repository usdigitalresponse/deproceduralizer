"""
Tests for make_custom_id / parse_custom_id roundtrip.

Run with: cd backend && pytest tests/research_pipeline/test_ids.py -v
"""

import pytest

from scripts.research_pipeline.ids import make_custom_id, parse_custom_id


class TestMakeCustomId:
    """Tests for make_custom_id."""

    def test_regulation_default(self):
        assert make_custom_id(12345, "mail_only") == "mail_only_12345"

    def test_regulation_explicit(self):
        assert make_custom_id(12345, "mail_only", "regulation") == "mail_only_12345"

    def test_guidance(self):
        assert make_custom_id(12345, "mail_only", "guidance") == "g_mail_only_12345"

    def test_underscore_issue_type(self):
        assert make_custom_id(999, "in_person_submission") == "in_person_submission_999"

    def test_guidance_underscore_issue_type(self):
        assert make_custom_id(999, "in_person_submission", "guidance") == "g_in_person_submission_999"


class TestParseCustomId:
    """Tests for parse_custom_id."""

    def test_regulation(self):
        assert parse_custom_id("mail_only_12345") == ("mail_only", 12345, "regulation")

    def test_guidance(self):
        assert parse_custom_id("g_mail_only_12345") == ("mail_only", 12345, "guidance")

    def test_guidance_underscore_issue_type(self):
        assert parse_custom_id("g_in_person_submission_999") == ("in_person_submission", 999, "guidance")

    def test_regulation_underscore_issue_type(self):
        assert parse_custom_id("in_person_submission_999") == ("in_person_submission", 999, "regulation")

    def test_invalid_raises(self):
        with pytest.raises(ValueError):
            parse_custom_id("invalid")

    def test_non_numeric_id_raises(self):
        with pytest.raises(ValueError):
            parse_custom_id("mail_only_abc")


class TestRoundtrip:
    """Tests for make_custom_id -> parse_custom_id roundtrip."""

    @pytest.mark.parametrize("doc_id,issue_type,source_type", [
        (42, "wet_signature", "regulation"),
        (42, "wet_signature", "guidance"),
        (99999, "in_person_submission", "regulation"),
        (1, "mail_only", "guidance"),
        (12345, "notarization", "regulation"),
    ])
    def test_roundtrip(self, doc_id, issue_type, source_type):
        custom_id = make_custom_id(doc_id, issue_type, source_type)
        parsed_issue, parsed_id, parsed_source = parse_custom_id(custom_id)
        assert parsed_issue == issue_type
        assert parsed_id == doc_id
        assert parsed_source == source_type
