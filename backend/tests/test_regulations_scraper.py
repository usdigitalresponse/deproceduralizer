"""
Tests for NY and NJ regulation scrapers.

Tests pure functions and data-manipulation methods before extracting
a shared base class. No network calls — everything is mocked or uses
in-memory data.
"""
import hashlib
import json
from pathlib import Path

import pytest


# ---------------------------------------------------------------------------
# classify_url
# ---------------------------------------------------------------------------

class TestNYClassifyUrl:
    """Test NYRegulationsScraper.classify_url()."""

    @pytest.fixture
    def scraper(self, tmp_path):
        from scripts.ny_regulations_scraper import NYRegulationsScraper
        return NYRegulationsScraper(cache_dir=str(tmp_path))

    def test_title(self, scraper):
        assert scraper.classify_url('https://example.com/title-18') == 'title'

    def test_regulation(self, scraper):
        assert scraper.classify_url('https://example.com/foo-NYCRR-bar') == 'regulation'

    def test_chapter(self, scraper):
        assert scraper.classify_url('https://example.com/chapter-2') == 'chapter'

    def test_part(self, scraper):
        assert scraper.classify_url('https://example.com/part-433') == 'part'

    def test_section(self, scraper):
        assert scraper.classify_url('https://example.com/section-1') == 'section'

    def test_appendix(self, scraper):
        assert scraper.classify_url('https://example.com/app-A') == 'appendix'
        assert scraper.classify_url('https://example.com/appendix-1') == 'appendix'

    def test_unknown(self, scraper):
        assert scraper.classify_url('https://example.com/other') == 'unknown'


class TestNJClassifyUrl:
    """Test NJRegulationsScraper.classify_url()."""

    @pytest.fixture
    def scraper(self, tmp_path):
        from scripts.nj_regulations_scraper import NJRegulationsScraper
        return NJRegulationsScraper(cache_dir=str(tmp_path))

    def test_title(self, scraper):
        assert scraper.classify_url('https://example.com/title-8') == 'title'

    def test_regulation_njac_dash(self, scraper):
        assert scraper.classify_url('https://example.com/foo-NJAC-bar') == 'regulation'

    def test_regulation_njac_bare(self, scraper):
        assert scraper.classify_url('https://example.com/NJAC-8-43') == 'regulation'

    def test_subchapter(self, scraper):
        assert scraper.classify_url('https://example.com/subchapter-1') == 'subchapter'

    def test_unknown(self, scraper):
        assert scraper.classify_url('https://example.com/other') == 'unknown'


# ---------------------------------------------------------------------------
# clean_regulation_text
# ---------------------------------------------------------------------------

class TestNYCleanRegulationText:
    """Test NYRegulationsScraper.clean_regulation_text()."""

    @pytest.fixture
    def scraper(self, tmp_path):
        from scripts.ny_regulations_scraper import NYRegulationsScraper
        return NYRegulationsScraper(cache_dir=str(tmp_path))

    def test_empty(self, scraper):
        assert scraper.clean_regulation_text("") == ""
        assert scraper.clean_regulation_text(None) == ""

    def test_removes_navigation(self, scraper):
        text = "Menu\nSearch\nActual regulation content here.\nBack to top"
        result = scraper.clean_regulation_text(text)
        assert "Menu" not in result
        assert "Search" not in result
        assert "Back to top" not in result
        assert "Actual regulation content here." in result

    def test_collapses_whitespace(self, scraper):
        text = "Line one.\n\n\n\n\nLine two."
        result = scraper.clean_regulation_text(text)
        assert "\n\n\n" not in result
        assert "Line one." in result
        assert "Line two." in result


class TestNJCleanRegulationText:
    """Test NJRegulationsScraper.clean_regulation_text()."""

    @pytest.fixture
    def scraper(self, tmp_path):
        from scripts.nj_regulations_scraper import NJRegulationsScraper
        return NJRegulationsScraper(cache_dir=str(tmp_path))

    def test_empty(self, scraper):
        assert scraper.clean_regulation_text("") == ""
        assert scraper.clean_regulation_text(None) == ""

    def test_removes_navigation(self, scraper):
        text = "LII\nCornell Law School\nSome NJ regulation text.\nToggle navigation foo"
        result = scraper.clean_regulation_text(text)
        assert "LII" not in result
        assert "Cornell Law School" not in result
        assert "Toggle navigation" not in result
        assert "Some NJ regulation text." in result


# ---------------------------------------------------------------------------
# get_cache_path
# ---------------------------------------------------------------------------

class TestGetCachePath:
    """Test cache path generation (shared logic)."""

    @pytest.fixture
    def ny_scraper(self, tmp_path):
        from scripts.ny_regulations_scraper import NYRegulationsScraper
        return NYRegulationsScraper(cache_dir=str(tmp_path))

    @pytest.fixture
    def nj_scraper(self, tmp_path):
        from scripts.nj_regulations_scraper import NJRegulationsScraper
        return NJRegulationsScraper(cache_dir=str(tmp_path))

    def test_returns_path_in_cache_dir(self, ny_scraper, tmp_path):
        path = ny_scraper.get_cache_path("https://example.com/reg")
        assert path.parent == tmp_path

    def test_deterministic(self, ny_scraper):
        url = "https://example.com/some-regulation"
        assert ny_scraper.get_cache_path(url) == ny_scraper.get_cache_path(url)

    def test_different_urls_different_paths(self, ny_scraper):
        p1 = ny_scraper.get_cache_path("https://example.com/a")
        p2 = ny_scraper.get_cache_path("https://example.com/b")
        assert p1 != p2

    def test_uses_md5_hash(self, nj_scraper, tmp_path):
        url = "https://example.com/test"
        expected = tmp_path / f"{hashlib.md5(url.encode()).hexdigest()}.json"
        assert nj_scraper.get_cache_path(url) == expected


# ---------------------------------------------------------------------------
# link_parent_source_indices
# ---------------------------------------------------------------------------

class TestNYLinkParentSourceIndices:
    """Test NY parent linking (uses Part containers)."""

    @pytest.fixture
    def scraper(self, tmp_path):
        from scripts.ny_regulations_scraper import NYRegulationsScraper
        return NYRegulationsScraper(cache_dir=str(tmp_path))

    def test_links_via_hierarchy_path(self, scraper):
        data = [
            {
                'source_index': 0,
                'hierarchy_path': 'LII > State Regulations > Title 18',
                'hierarchy_level': 'title',
                'nycrr_title': 18,
                'nycrr_part': None,
            },
            {
                'source_index': 1,
                'hierarchy_path': 'LII > State Regulations > Title 18 > Chapter II',
                'hierarchy_level': 'chapter',
                'nycrr_title': 18,
                'nycrr_part': None,
            },
        ]
        result = scraper.link_parent_source_indices(data)
        assert result[1].get('parent_source_index') == 0

    def test_links_section_to_part(self, scraper):
        """Sections without hierarchy_path link to their Part container."""
        data = [
            {
                'source_index': 0,
                'hierarchy_path': 'Part 433',
                'hierarchy_level': 'part',
                'nycrr_title': 18,
                'nycrr_part': '433',
            },
            {
                'source_index': 1,
                'hierarchy_path': None,
                'hierarchy_level': 'section',
                'nycrr_title': 18,
                'nycrr_part': '433',
            },
        ]
        result = scraper.link_parent_source_indices(data)
        assert result[1].get('parent_source_index') == 0

    def test_no_parent_for_root(self, scraper):
        data = [
            {
                'source_index': 0,
                'hierarchy_path': 'LII',
                'hierarchy_level': 'title',
                'nycrr_title': 18,
                'nycrr_part': None,
            },
        ]
        result = scraper.link_parent_source_indices(data)
        assert result[0].get('parent_source_index') is None


class TestNJLinkParentSourceIndices:
    """Test NJ parent linking (uses Chapter containers)."""

    @pytest.fixture
    def scraper(self, tmp_path):
        from scripts.nj_regulations_scraper import NJRegulationsScraper
        return NJRegulationsScraper(cache_dir=str(tmp_path))

    def test_links_section_to_chapter(self, scraper):
        """NJ sections without hierarchy_path link to Chapter container."""
        data = [
            {
                'source_index': 0,
                'hierarchy_path': 'Chapter 43',
                'hierarchy_level': 'chapter',
                'njac_title': 8,
                'njac_chapter': '43',
            },
            {
                'source_index': 1,
                'hierarchy_path': None,
                'hierarchy_level': 'section',
                'njac_title': 8,
                'njac_chapter': '43',
            },
        ]
        result = scraper.link_parent_source_indices(data)
        assert result[1].get('parent_source_index') == 0


# ---------------------------------------------------------------------------
# NJ-specific helpers
# ---------------------------------------------------------------------------

class TestNJHelpers:
    """Test NJ-only helper functions."""

    def test_is_bad_url_external_domain(self):
        from scripts.nj_regulations_scraper import is_bad_url
        bad = "https://www.law.cornell.edu/regulations/new-jersey/www.epa.gov/foo"
        assert is_bad_url(bad) is True

    def test_is_bad_url_normal(self):
        from scripts.nj_regulations_scraper import is_bad_url
        good = "https://www.law.cornell.edu/regulations/new-jersey/title-8"
        assert is_bad_url(good) is False

    def test_is_bad_url_not_nj(self):
        from scripts.nj_regulations_scraper import is_bad_url
        assert is_bad_url("https://example.com/other") is False

    def test_is_index_page_content_true(self):
        from scripts.nj_regulations_scraper import is_index_page_content
        assert is_index_page_content(
            "New Jersey Administrative Code",
            "New Jersey Administrative Code Title 1 - blah"
        ) is True

    def test_is_index_page_content_false(self):
        from scripts.nj_regulations_scraper import is_index_page_content
        assert is_index_page_content(
            "§ 8:43-1.1 - Scope",
            "This regulation covers..."
        ) is False


# ---------------------------------------------------------------------------
# save_progress / load_progress round-trip
# ---------------------------------------------------------------------------

class TestProgressPersistence:
    """Test that progress save/load round-trips correctly."""

    def test_ny_round_trip(self, tmp_path):
        from scripts.ny_regulations_scraper import NYRegulationsScraper
        scraper = NYRegulationsScraper(cache_dir=str(tmp_path))
        scraper.visited_urls = {'https://example.com/a', 'https://example.com/b'}
        scraper.failed_urls = {'https://example.com/fail'}
        scraper.all_regulations = [{'url': 'x'}]
        scraper.save_progress()

        scraper2 = NYRegulationsScraper(cache_dir=str(tmp_path))
        assert scraper2.visited_urls == {'https://example.com/a', 'https://example.com/b'}
        assert scraper2.failed_urls == {'https://example.com/fail'}

    def test_nj_round_trip(self, tmp_path):
        from scripts.nj_regulations_scraper import NJRegulationsScraper
        scraper = NJRegulationsScraper(cache_dir=str(tmp_path))
        scraper.visited_urls = {'https://example.com/nj1'}
        scraper.failed_urls = set()
        scraper.all_regulations = []
        scraper.save_progress()

        scraper2 = NJRegulationsScraper(cache_dir=str(tmp_path))
        assert scraper2.visited_urls == {'https://example.com/nj1'}
