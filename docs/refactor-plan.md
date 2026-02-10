# Refactoring Plan: Consolidate Scrapers & Searcher Inheritance

## Repo & Branch

- **Repo**: `~/Documents/repos/newyork`
- **Branch**: `refactor/consolidate-scrapers-and-searcher`

## Work Practices

- **Small commits**: Each logical change gets its own commit (e.g., "extract base class", "wire up NY subclass", "wire up NJ subclass", "add tests").
- **Regular PRs**: Open PRs early and often — leave them open for boss to review/approve. Don't wait until everything is done to PR.
- **Tests**: Write tests before or alongside each change. Run them after every commit. If existing tests break, fix before moving on.

---

## File Locations

All paths relative to repo root (`~/Documents/repos/newyork`):

| File | Path |
|------|------|
| Compliance searcher | `backend/scripts/compliance_issues/searcher.py` |
| Base searcher | `backend/scripts/shared/base_searcher.py` |
| IBR scanner | `backend/scripts/ibr_scanner.py` |
| NY scraper | `backend/scripts/ny_regulations_scraper.py` |
| NJ scraper | `backend/scripts/nj_regulations_scraper.py` |
| Base scraper (NEW) | `backend/scripts/base_regulations_scraper.py` |

---

## Part 1: ComplianceIssueSearcher → BasePatternSearcher

### What changes

**File: `backend/scripts/compliance_issues/searcher.py`**

Make `ComplianceIssueSearcher` extend `BasePatternSearcher` instead of being standalone:

1. Change class definition: `class ComplianceIssueSearcher(BasePatternSearcher):`
2. Update `__init__` to call `super().__init__(state_config, issue_config, with_statutes, batches_subdir='batches/compliance')`
   - Keep `self.run_id = run_id` as the one unique attribute
3. **Delete the entire `search()` method** (~120 lines) — it's identical to `BasePatternSearcher.search()`
4. Extract inline `get_already_analyzed_ids()` from old `search()` into its own method:
   ```python
   def get_already_analyzed_ids(self, conn) -> set[int]:
       issue_type = self.issue_config.db_issue_type
       result = conn.execute(
           "SELECT document_id FROM compliance_issues WHERE state = %s AND issue_type = %s",
           (self.state_config.state_code, issue_type)
       ).fetchall()
       return {row[0] for row in result}
   ```
5. Keep `save_to_database()` and `print_summary()` as-is (they're unique to this class)
6. Update imports to add `BasePatternSearcher` from `scripts.shared.base_searcher`

**No changes to**: `scan_compliance_issues.py`, `ibr_scanner.py`, `base_searcher.py`

### Commits & PRs for Part 1

1. **Commit**: "Add tests for ComplianceIssueSearcher search behavior"
   - Write tests that capture current behavior before refactoring
   - Run tests, confirm green
2. **Commit**: "Refactor ComplianceIssueSearcher to extend BasePatternSearcher"
   - The actual class change + deleted duplicate code
   - Run tests, confirm still green
3. **Open PR**: "Refactor: ComplianceIssueSearcher inherits from BasePatternSearcher"
   - Leave open for boss approval

### Net result
- ~120 lines deleted (duplicate `search()` method)
- Single source of truth for pattern matching logic
- Future bug fixes to `search()` apply to both compliance and IBR scanners

---

## Part 2: Scraper Consolidation

### Strategy

Create a `BaseRegulationsScraper` class and a `BaseFullPipeline` class that contain the shared logic. NY and NJ files become thin subclasses that override only the state-specific parts.

### New file: `backend/scripts/base_regulations_scraper.py`

Contains two classes:

#### `BaseRegulationsScraper` — abstract base for the scraper classes

**Moved from NY/NJ (identical in both, ~150 lines):**
- `__init__(self, base_url, cache_dir)` — with state-specific args passed by subclass
- `load_progress()` / `save_progress()`
- `get_cache_path(url)` / `get_page(url, max_retries=3)`
- `crawl_recursively(start_urls, ...)`
- `retry_failed_urls(max_retries=2)`
- `save_to_json(data, filename)`
- `scrape_all(max_pages=None)` — check if NJ differs in resume logic; unify or keep in subclass

**Abstract methods (subclasses must implement):**
- `parse_breadcrumb(soup)` — completely different regex patterns per state
- `parse_main_page()` — different URL pattern
- `find_regulation_links(soup, base_url)` — different URL checks + NJ has `is_bad_url()`
- `scrape_regulation_content(url)` — different hierarchy field names + NJ has `is_index_page_content()`
- `clean_regulation_text(content)` — NY has extra regex lines
- `classify_url(url)` — different state patterns
- `link_parent_source_indices(data)` — NY uses Part, NJ uses Chapter as container

**State config properties (set in subclass `__init__`):**
- `state_code` — 'NY' or 'NJ'
- `state_name` — 'New York' or 'New Jersey'
- `hierarchy_prefix` — 'nycrr' or 'njac'
- `regulation_pattern` — '-NYCRR-' or '-NJAC-'/'NJAC'
- `hierarchy_fields` — list of field names

#### `BaseFullPipeline` — abstract base for the pipeline classes

**Moved from NY/NJ (identical in both, ~120 lines):**
- `__init__(self)` / `start_caffeinate()` / `stop_caffeinate()`
- `setup_signal_handlers()`
- `run_full_pipeline(max_pages, skip_db)` — parameterized with state name + constants
- `main()` — as a module-level function, parameterized

**Abstract/config properties (set in subclass):**
- `state_code`, `state_name`
- `scraper_class` — NYRegulationsScraper or NJRegulationsScraper
- `process_cached_file_fn` — the module-level function
- `cache_dir`, `cache_file`, `complete_file`, `individual_dir` — path constants
- `hierarchy_fields` — list of field name tuples for step3

### Changes to existing files

**`ny_regulations_scraper.py`** — becomes ~400 lines (down from 1182):
- Imports from `base_regulations_scraper`
- `parse_breadcrumb()` stays (160 lines, entirely NY-specific)
- `process_cached_file_ny()` stays (module-level function, used in ProcessPoolExecutor)
- `NYRegulationsScraper` extends `BaseRegulationsScraper`, overrides abstract methods
- `FullPipeline` extends `BaseFullPipeline`, sets NY config constants

**`nj_regulations_scraper.py`** — becomes ~450 lines (down from 1201):
- Same structure as NY but with NJ-specific overrides
- Keeps `is_bad_url()` and `is_index_page_content()` as NJ-only helpers
- `parse_breadcrumb()` stays (169 lines, entirely NJ-specific)

### Commits & PRs for Part 2

1. **Commit**: "Add tests for NY and NJ scraper shared methods"
   - Test `load_progress`, `save_progress`, `get_cache_path`, `crawl_recursively`, etc.
   - Run tests, confirm green
2. **Commit**: "Add tests for NY and NJ scraper state-specific methods"
   - Test `parse_breadcrumb`, `find_regulation_links`, etc. per state
   - Run tests, confirm green
3. **Open PR**: "Add test coverage for regulation scrapers"
   - Leave open for boss — this is value even if the refactor doesn't happen
4. **Commit**: "Extract BaseRegulationsScraper and BaseFullPipeline"
   - New file with shared logic
   - Run tests, confirm green
5. **Commit**: "Refactor NYRegulationsScraper to extend BaseRegulationsScraper"
   - Run tests, confirm green
6. **Commit**: "Refactor NJRegulationsScraper to extend BaseRegulationsScraper"
   - Run tests, confirm green
7. **Commit**: "Refactor FullPipeline classes to extend BaseFullPipeline"
   - Run tests, confirm green
8. **Open PR**: "Refactor: Consolidate NY/NJ scrapers into shared base classes"
   - Leave open for boss

### Net result
- ~800 lines deleted across both files
- Shared logic lives in one place
- Adding a future state would be ~200 lines instead of ~1200

---

## Files Modified Summary

| File | Action | Lines Before | Lines After (est) |
|------|--------|-------------|-------------------|
| `backend/scripts/compliance_issues/searcher.py` | Edit | 281 | ~160 |
| `backend/scripts/base_regulations_scraper.py` | **New** | 0 | ~450 |
| `backend/scripts/ny_regulations_scraper.py` | Edit | 1182 | ~400 |
| `backend/scripts/nj_regulations_scraper.py` | Edit | 1201 | ~450 |
| Tests (new) | **New** | 0 | ~300+ |
| **Total** | | 2664 | ~1460 + tests |

**Net reduction: ~1200 lines** (excluding new tests)

---

## Verification Commands

```bash
# Part 1: Searcher refactor
python -c "from scripts.compliance_issues.searcher import ComplianceIssueSearcher; print('OK')"
python backend/scripts/scan_compliance_issues.py --state nj --dry-run --limit 5

# Part 2: Scraper refactor
python -c "from scripts.base_regulations_scraper import BaseRegulationsScraper; print('OK')"
python backend/scripts/ny_regulations_scraper.py --test --yes --skip-db
python backend/scripts/nj_regulations_scraper.py --test --yes --skip-db

# Tests (run after every commit)
pytest backend/tests/ -v
```

---

## Implementation Order

1. **Part 1** first (searcher — quick win, low risk)
   - Write tests → refactor → PR
2. **Part 2** second (scrapers — larger change)
   - Write tests → extract base → wire NY → wire NJ → PR
3. Run tests after every commit
4. One commit per logical change, PRs left open for review
