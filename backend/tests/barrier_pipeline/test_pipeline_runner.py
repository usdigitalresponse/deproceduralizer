"""Tests for Barrier pipeline runner — realtime vs batch mode."""
import pytest
from unittest.mock import patch, MagicMock, AsyncMock

from scripts.barrier_pipeline.pipeline_runner import run_pipeline
from scripts.barrier_pipeline.models.llm_outputs import AnalysisOutput, IssueFinding
from scripts.barrier_pipeline.config import BarrierCategory


def _make_sections(n: int) -> list[dict]:
    """Create mock section dicts."""
    return [
        {
            'id': 1000 + i,
            'citation': f'18 NYCRR 414.{i}',
            'title': f'Test Section {i}',
            'content': 'x' * 300,
            'jurisdiction': 'NY',
            'summary': f'Summary {i}',
            'url': f'http://example.com/{i}',
            'hierarchy_level': 'section',
            'parent_id': 999,
        }
        for i in range(n)
    ]


def _make_analysis_output(classification: str = 'clean') -> AnalysisOutput:
    return AnalysisOutput(
        classification=classification,
        reasoning='Test reasoning',
        summary='Test summary',
        categories=[],
        overall_confidence=0.9,
        overall_complexity='LOW',
    )


@patch('scripts.barrier_pipeline.pipeline_runner.get_sections_for_analysis')
class TestDryRun:
    def test_dry_run_returns_section_count(self, mock_query):
        mock_query.return_value = _make_sections(5)
        result = run_pipeline(jurisdiction='ny', dry_run=True)
        assert result['sections'] == 5
        assert result['dry_run'] is True

    def test_dry_run_does_not_call_batch(self, mock_query):
        mock_query.return_value = _make_sections(3)
        with patch('scripts.barrier_pipeline.pipeline_runner.run_batch_tier') as mock_bt:
            run_pipeline(jurisdiction='ny', dry_run=True)
            mock_bt.assert_not_called()

    def test_no_sections_found(self, mock_query):
        mock_query.return_value = []
        result = run_pipeline(jurisdiction='ny', dry_run=True)
        assert result['sections'] == 0


@patch('scripts.barrier_pipeline.pipeline_runner.get_sections_for_analysis')
class TestPartPassthrough:
    def test_part_passed_to_query(self, mock_query):
        mock_query.return_value = []
        run_pipeline(jurisdiction='ny', title=18, part='414', dry_run=True)
        call_kwargs = mock_query.call_args[1]
        assert call_kwargs['part'] == '414'
        assert call_kwargs['title'] == 18

    def test_no_part_by_default(self, mock_query):
        mock_query.return_value = []
        run_pipeline(jurisdiction='ny', dry_run=True)
        call_kwargs = mock_query.call_args[1]
        assert call_kwargs['part'] is None


@patch('scripts.barrier_pipeline.pipeline_runner.get_sections_for_analysis')
class TestForcePassthrough:
    def test_force_disables_exclude_analyzed(self, mock_query):
        mock_query.return_value = []
        run_pipeline(jurisdiction='ny', force=True, dry_run=True)
        call_kwargs = mock_query.call_args[1]
        assert call_kwargs['exclude_analyzed'] is False

    def test_default_excludes_analyzed(self, mock_query):
        mock_query.return_value = []
        run_pipeline(jurisdiction='ny', dry_run=True)
        call_kwargs = mock_query.call_args[1]
        assert call_kwargs['exclude_analyzed'] is True


@patch('scripts.barrier_pipeline.pipeline_runner.get_sections_for_analysis')
class TestDocumentIdPassthrough:
    def test_document_ids_passed_to_query(self, mock_query):
        mock_query.return_value = []
        run_pipeline(jurisdiction='ny', document_ids=[81899], dry_run=True)
        call_kwargs = mock_query.call_args[1]
        assert call_kwargs['document_ids'] == [81899]

    def test_document_ids_disables_exclude_analyzed(self, mock_query):
        mock_query.return_value = []
        run_pipeline(jurisdiction='ny', document_ids=[81899], dry_run=True)
        call_kwargs = mock_query.call_args[1]
        assert call_kwargs['exclude_analyzed'] is False

    def test_no_document_ids_by_default(self, mock_query):
        mock_query.return_value = []
        run_pipeline(jurisdiction='ny', dry_run=True)
        call_kwargs = mock_query.call_args[1]
        assert call_kwargs['document_ids'] is None


@patch('scripts.barrier_pipeline.pipeline_runner.save_analysis_results', return_value=2)
@patch('scripts.barrier_pipeline.pipeline_runner.prepare_analysis_batch')
@patch('scripts.barrier_pipeline.pipeline_runner.get_sections_for_analysis')
class TestRealtimeMode:
    def test_realtime_does_not_use_batch_tier(self, mock_query, mock_prep, mock_save):
        mock_query.return_value = _make_sections(2)
        mock_prep.return_value = (
            [
                {'custom_id': 'barrier_1000', 'params': {'messages': [{'content': 'test'}], 'system': 'sys'}},
                {'custom_id': 'barrier_1001', 'params': {'messages': [{'content': 'test'}], 'system': 'sys'}},
            ],
            {'barrier_1000': 1000, 'barrier_1001': 1001},
        )

        with patch('scripts.barrier_pipeline.pipeline_runner.run_batch_tier') as mock_bt, \
             patch('scripts.barrier_pipeline.pipeline_runner.run_realtime_tier') as mock_rt, \
             patch('scripts.barrier_pipeline.pipeline_runner.run_topic_classification'):
            run_pipeline(jurisdiction='ny', dry_run=False, realtime=True)
            mock_bt.assert_not_called()
            mock_rt.assert_called_once()

    def test_batch_mode_uses_batch_tier(self, mock_query, mock_prep, mock_save):
        mock_query.return_value = _make_sections(2)

        mock_prep.return_value = (
            [{'custom_id': 'barrier_1000', 'params': {}}],
            {'barrier_1000': 1000},
        )

        with patch('scripts.barrier_pipeline.pipeline_runner.run_batch_tier') as mock_bt, \
             patch('scripts.barrier_pipeline.pipeline_runner.run_realtime_tier') as mock_rt, \
             patch('scripts.barrier_pipeline.pipeline_runner.run_topic_classification'):
            mock_bt.return_value = 'batch_123'
            run_pipeline(jurisdiction='ny', dry_run=False, realtime=False)
            mock_bt.assert_called_once()
            mock_rt.assert_not_called()
