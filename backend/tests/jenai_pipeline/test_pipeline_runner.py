"""Tests for JenAI pipeline runner — realtime vs batch mode."""
import pytest
from unittest.mock import patch, MagicMock, AsyncMock

from scripts.jenai_pipeline.pipeline_runner import run_pipeline
from scripts.jenai_pipeline.models.llm_outputs import Tier1Output, Tier1CategoryFinding


def _make_sections(n: int) -> list[dict]:
    """Create mock section dicts."""
    return [
        {
            'id': 1000 + i,
            'citation': f'18 NYCRR 414.{i}',
            'title': f'Test Section {i}',
            'content': 'x' * 300,
            'state': 'NY',
            'summary': f'Summary {i}',
            'url': f'http://example.com/{i}',
            'hierarchy_level': 'section',
            'parent_id': 999,
        }
        for i in range(n)
    ]


def _make_tier1_output(classification: str = 'clean') -> Tier1Output:
    return Tier1Output(
        classification=classification,
        reasoning='Test reasoning',
        categories=[],
        context_requests=[],
    )


@patch('scripts.jenai_pipeline.pipeline_runner.get_sections_for_analysis')
class TestDryRun:
    def test_dry_run_returns_section_count(self, mock_query):
        mock_query.return_value = _make_sections(5)
        result = run_pipeline(state='ny', dry_run=True)
        assert result['sections'] == 5
        assert result['dry_run'] is True

    def test_dry_run_does_not_call_batch(self, mock_query):
        mock_query.return_value = _make_sections(3)
        with patch('scripts.jenai_pipeline.pipeline_runner.BatchManager') as mock_bm:
            run_pipeline(state='ny', dry_run=True)
            mock_bm.assert_not_called()

    def test_no_sections_found(self, mock_query):
        mock_query.return_value = []
        result = run_pipeline(state='ny', dry_run=True)
        assert result['sections'] == 0


@patch('scripts.jenai_pipeline.pipeline_runner.get_sections_for_analysis')
class TestPartPassthrough:
    def test_part_passed_to_query(self, mock_query):
        mock_query.return_value = []
        run_pipeline(state='ny', title=18, part='414', dry_run=True)
        call_kwargs = mock_query.call_args[1]
        assert call_kwargs['part'] == '414'
        assert call_kwargs['title'] == 18

    def test_no_part_by_default(self, mock_query):
        mock_query.return_value = []
        run_pipeline(state='ny', dry_run=True)
        call_kwargs = mock_query.call_args[1]
        assert call_kwargs['part'] is None


@patch('scripts.jenai_pipeline.pipeline_runner.get_sections_for_analysis')
class TestForcePassthrough:
    def test_force_disables_exclude_analyzed(self, mock_query):
        mock_query.return_value = []
        run_pipeline(state='ny', force=True, dry_run=True)
        call_kwargs = mock_query.call_args[1]
        assert call_kwargs['exclude_analyzed'] is False

    def test_default_excludes_analyzed(self, mock_query):
        mock_query.return_value = []
        run_pipeline(state='ny', dry_run=True)
        call_kwargs = mock_query.call_args[1]
        assert call_kwargs['exclude_analyzed'] is True


@patch('scripts.jenai_pipeline.pipeline_runner.get_sections_for_analysis')
class TestDocumentIdPassthrough:
    def test_document_ids_passed_to_query(self, mock_query):
        mock_query.return_value = []
        run_pipeline(state='ny', document_ids=[81899], dry_run=True)
        call_kwargs = mock_query.call_args[1]
        assert call_kwargs['document_ids'] == [81899]

    def test_document_ids_disables_exclude_analyzed(self, mock_query):
        mock_query.return_value = []
        run_pipeline(state='ny', document_ids=[81899], dry_run=True)
        call_kwargs = mock_query.call_args[1]
        assert call_kwargs['exclude_analyzed'] is False

    def test_no_document_ids_by_default(self, mock_query):
        mock_query.return_value = []
        run_pipeline(state='ny', dry_run=True)
        call_kwargs = mock_query.call_args[1]
        assert call_kwargs['document_ids'] is None


@patch('scripts.jenai_pipeline.pipeline_runner.save_tier1_results', return_value=2)
@patch('scripts.jenai_pipeline.pipeline_runner.prepare_tier1_batch')
@patch('scripts.jenai_pipeline.pipeline_runner.get_sections_for_analysis')
class TestRealtimeMode:
    def test_realtime_does_not_use_batch_manager(self, mock_query, mock_prep, mock_save):
        mock_query.return_value = _make_sections(2)
        mock_prep.return_value = (
            [
                {'custom_id': 'jenai_1000', 'params': {'messages': [{'content': 'test'}], 'system': 'sys'}},
                {'custom_id': 'jenai_1001', 'params': {'messages': [{'content': 'test'}], 'system': 'sys'}},
            ],
            {'jenai_1000': 1000, 'jenai_1001': 1001},
        )

        with patch('scripts.jenai_pipeline.pipeline_runner.BatchManager') as mock_bm, \
             patch('scripts.jenai_pipeline.pipeline_runner._run_realtime_tier') as mock_rt:
            run_pipeline(state='ny', dry_run=False, realtime=True, max_tier=1)
            mock_bm.assert_not_called()
            mock_rt.assert_called_once()

    def test_batch_mode_uses_batch_manager(self, mock_query, mock_prep, mock_save):
        mock_query.return_value = _make_sections(2)

        mock_results = MagicMock()
        mock_results.custom_id = 'jenai_1000'

        mock_manager = MagicMock()
        mock_manager.submit_batch.return_value = 'batch_123'
        mock_manager.get_batch_results.return_value = []

        mock_prep.return_value = (
            [{'custom_id': 'jenai_1000', 'params': {}}],
            {'jenai_1000': 1000},
        )

        with patch('scripts.jenai_pipeline.pipeline_runner.BatchManager', return_value=mock_manager), \
             patch('scripts.jenai_pipeline.pipeline_runner._run_realtime_tier') as mock_rt:
            run_pipeline(state='ny', dry_run=False, realtime=False, max_tier=1)
            mock_manager.submit_batch.assert_called_once()
            mock_rt.assert_not_called()
