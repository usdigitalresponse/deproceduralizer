"""Tests for JenAI CLI argument parsing."""
import pytest
from scripts.jenai_pipeline.cli import build_parser


@pytest.fixture
def parser():
    return build_parser()


class TestRequiredArgs:
    def test_state_is_required(self, parser):
        with pytest.raises(SystemExit):
            parser.parse_args([])

    def test_valid_state_ny(self, parser):
        args = parser.parse_args(['--state', 'ny'])
        assert args.state == 'ny'

    def test_valid_state_nj(self, parser):
        args = parser.parse_args(['--state', 'NJ'])
        assert args.state == 'nj'

    def test_invalid_state_rejected(self, parser):
        with pytest.raises(SystemExit):
            parser.parse_args(['--state', 'ca'])


class TestFilterFlags:
    def test_title_default_none(self, parser):
        args = parser.parse_args(['--state', 'ny'])
        assert args.title is None

    def test_title_parsed(self, parser):
        args = parser.parse_args(['--state', 'ny', '--title', '18'])
        assert args.title == 18

    def test_part_default_none(self, parser):
        args = parser.parse_args(['--state', 'ny'])
        assert args.part is None

    def test_part_parsed(self, parser):
        args = parser.parse_args(['--state', 'ny', '--part', '413'])
        assert args.part == '413'

    def test_limit_default_none(self, parser):
        args = parser.parse_args(['--state', 'ny'])
        assert args.limit is None

    def test_limit_parsed(self, parser):
        args = parser.parse_args(['--state', 'ny', '--limit', '20'])
        assert args.limit == 20


class TestExecutionFlags:
    def test_execute_default_false(self, parser):
        args = parser.parse_args(['--state', 'ny'])
        assert args.execute is False

    def test_execute_flag(self, parser):
        args = parser.parse_args(['--state', 'ny', '--execute'])
        assert args.execute is True

    def test_realtime_default_false(self, parser):
        args = parser.parse_args(['--state', 'ny'])
        assert args.realtime is False

    def test_realtime_flag(self, parser):
        args = parser.parse_args(['--state', 'ny', '--realtime'])
        assert args.realtime is True

    def test_force_default_false(self, parser):
        args = parser.parse_args(['--state', 'ny'])
        assert args.force is False

    def test_force_flag(self, parser):
        args = parser.parse_args(['--state', 'ny', '--force'])
        assert args.force is True

    def test_include_all_types_default_false(self, parser):
        args = parser.parse_args(['--state', 'ny'])
        assert args.include_all_types is False

    def test_include_all_types_flag(self, parser):
        args = parser.parse_args(['--state', 'ny', '--include-all-types'])
        assert args.include_all_types is True


class TestRemovedTierFlags:
    """Verify that old tier flags are no longer accepted."""

    def test_max_tier_rejected(self, parser):
        with pytest.raises(SystemExit):
            parser.parse_args(['--state', 'ny', '--max-tier', '1'])

    def test_tier2_only_rejected(self, parser):
        with pytest.raises(SystemExit):
            parser.parse_args(['--state', 'ny', '--tier2-only'])


class TestDocumentIdFlag:
    def test_document_id_default_none(self, parser):
        args = parser.parse_args(['--state', 'ny'])
        assert args.document_id is None

    def test_single_document_id(self, parser):
        args = parser.parse_args(['--state', 'ny', '--document-id', '81899'])
        assert args.document_id == [81899]

    def test_multiple_document_ids(self, parser):
        args = parser.parse_args(['--state', 'ny', '--document-id', '81899', '78696'])
        assert args.document_id == [81899, 78696]


class TestCombinedFlags:
    def test_typical_realtime_run(self, parser):
        args = parser.parse_args([
            '--state', 'ny', '--title', '18', '--part', '414',
            '--execute', '--realtime',
        ])
        assert args.state == 'ny'
        assert args.title == 18
        assert args.part == '414'
        assert args.execute is True
        assert args.realtime is True

    def test_force_with_include_all(self, parser):
        args = parser.parse_args([
            '--state', 'ny', '--force', '--include-all-types',
        ])
        assert args.force is True
        assert args.include_all_types is True
