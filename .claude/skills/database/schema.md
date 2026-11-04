# Schema Reference

## Jurisdiction Model

The `jurisdiction` column appears on most tables and represents a **jurisdiction**, not strictly a US state:

| Code | Jurisdiction | Regulations Table | Statutes Table |
|------|-------------|-------------------|----------------|
| `NY` | New York State | NYCRR columns (`nycrr_title`, `nycrr_section`, etc.) | NY Consolidated Laws (`nycls_law_id`, `nycls_section`, etc.) |
| `NJ` | New Jersey | NJAC columns (`njac_title`, `njac_chapter`, etc.) | NJSA columns (`njsa_title`, `njsa_section`, etc.) |
| `NYC` | New York City | RCNY columns (`rcny_title`, `rcny_chapter`, `rcny_section`) | NYC Charter + Admin Code (`nyc_doc_type`, `nyc_title`, `nyc_section`, etc.) |

NYC is a sub-state jurisdiction. Its regulations (RCNY + Health Code) live in `regulatory_documents` with `jurisdiction = 'NYC'`, and its statutes (Charter + Admin Code) live in `statutes` with `jurisdiction = 'NYC'`.

**NYC Health Code** records also use the `rcny_*` columns but with different citation format (`NYC Health Code § X.YY` vs `RCNY § X-YY`). Health Code `source_index` values start at 100,000 to avoid collision with RCNY records (which max around ~7,777). Both share `jurisdiction='NYC', type='regulation'`.

When adding a new jurisdiction, you must:
1. Add the code to the `JurisdictionCode` type in `constants.ts` and `VALID_JURISDICTIONS`
2. Add state-specific columns to `regulatory_documents` and/or `statutes`
3. Update CHECK constraints on all tables with a `jurisdiction` column (see migrations 0045-0047 for the NYC pattern)
4. Add CSS variables in `tokens.css` and a `STATE_CONFIG` entry in `types/state.ts`
5. Update `formatStateCitation` in `lib/formatters/citations.ts`

## regulatory_documents

Main table with hierarchy. **74 columns** - use `./scripts/db-query.sh describe regulatory_documents` for full list.

**Core columns:**

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigserial | Primary key |
| `source_index` | integer | Index from source data |
| `type` | varchar(50) | regulation or policy_document |
| `jurisdiction` | varchar(3) | NY, NJ, NYC (CHECK constraint) |
| `title` | text | Document title |
| `url` | text | Source URL |
| `url_type` | varchar(50) | regulation (section) or title (container) |
| `content` | text | Full document content |
| `parent_id` | bigint | FK to parent document |
| `hierarchy_level` | varchar(50) | title/subtitle/chapter/subchapter/article/part/subpart/section |
| `hierarchy_path` | text | Full path in hierarchy |

**Display helpers:**

| Column | Type | Description |
|--------|------|-------------|
| `short_title` | text | Abbreviated title for display |
| `level_identifier` | text | E.g., "1.1" or "A" for hierarchy level |
| `citation` | text | Formatted citation string |

**State-specific columns:**
- NYCRR: `nycrr_title`, `nycrr_title_name`, `nycrr_subtitle`, `nycrr_chapter`, `nycrr_subchapter`, `nycrr_article`, `nycrr_part`, `nycrr_subpart`, `nycrr_section`, etc.
- NJAC: `njac_title`, `njac_chapter`, `njac_subchapter`, `njac_section`, etc.
- NJSA: `njsa_title`, `njsa_chapter`, `njsa_section`, `njsa_citation`
- RCNY: `rcny_title`, `rcny_title_name`, `rcny_chapter`, `rcny_chapter_name`, `rcny_section`, `rcny_section_name`

**Precomputed stats (denormalized):**

| Column | Type | Description |
|--------|------|-------------|
| `direct_child_count` | integer | Direct children count |
| `descendant_count` | integer | All descendants count |
| `compliance_issue_count` | integer | Compliance issues in this doc |
| `descendant_compliance_issue_count` | integer | Compliance issues in subtree |
| `cross_reference_count` | integer | Count of internal cross-references from this doc |

**Regulatory status:**

| Column | Type | Description |
|--------|------|-------------|
| `regulatory_status` | varchar(20) | 'active' (default), 'reserved', 'repealed', 'recodified', 'expired' |
| `recodified_to` | varchar(100) | Target citation where content moved |

**Exclusion from analysis:**

| Column | Type | Description |
|--------|------|-------------|
| `exclude_from_analysis` | boolean | Whether to exclude from LLM analysis (default false) |
| `excluded_at` | timestamp | When exclusion was set |
| `excluded_by` | varchar(255) | Who excluded it |
| `excluded_reason` | text | Why it was excluded |

**Batch-excluded NY categories** (1,283 sections total as of Feb 2025, `excluded_by = 'batch-exclude-ny-2025'`):

| Category | Count | Reason |
|----------|-------|--------|
| Executive Orders (9 NYCRR Parts 1-9) | ~1,010 | Gubernatorial directives, not administrative regulations |
| Military Code (9 NYCRR Parts 490-520) | ~157 | Military justice and civil defense code |
| Chemical/Hazmat Data Tables | 5 | Pure lookup tables (chemical lists, exposure limits, mortality tables) |
| Water Classification Tables (Title 6) | ~19 | Water body classification lists (Table I/II/etc.) |
| Shellfish/Geographic Enumerations (Title 6) | 7 | Geographic boundary data listings |
| Fee Schedules / Rate Tables | 5 | Numeric rate/fee lookup tables |

Script: `backend/scripts/batch_exclude_ny_sections.py` (use `--dry-run` to preview)

**AI-generated summary metadata (from batch summarization pipeline):**

| Column | Type | Description |
|--------|------|-------------|
| `summary` | text | 1-2 sentence AI-generated summary |
| `section_type` | varchar(50) | Category: definitions, requirements, procedures, prohibitions, standards, eligibility, penalties, fees, forms, reporting, scope, exemptions, reserved |
| `keywords` | text[] | 3-5 searchable keywords (PostgreSQL array) |
| `applies_to` | text[] | Entities that must comply (licensees, employers, etc.) |
| `has_form` | boolean | References a specific form (default false) |
| `has_ibr` | boolean | Incorporates external standards by reference - ASTM, NFPA, ISO, etc. (default false) |

**Constraints:**
- `chk_rd_jurisdiction CHECK (jurisdiction IN ('NY', 'NJ', 'NYC'))`
- `unique_per_url UNIQUE(url)`

**Full-text search (migration 0044):**

| Column | Type | Description |
|--------|------|-------------|
| `search_vector` | tsvector | Weighted: title(A) + summary(B) + content(C). Maintained by trigger. |

**Indexes:** `idx_documents_state`, `idx_documents_type`, `idx_documents_state_type`, `idx_documents_parent`, `idx_documents_hierarchy_level`, `idx_documents_regulatory_status`, `idx_documents_url`, `idx_documents_short_title`, `idx_documents_exclude_from_analysis` (partial), `idx_rd_keywords` (GIN), `idx_rd_applies_to` (GIN), `idx_rd_section_type` (partial), `idx_rd_has_form` (partial), `idx_rd_has_ibr` (partial), `idx_regulatory_documents_search_vector` (GIN), `idx_rd_rcny_title` (partial: WHERE jurisdiction = 'NYC'), `idx_rd_jurisdiction_source_type` (unique: jurisdiction, source_index, type - for upsert), `idx_regulatory_documents_citation_trgm` (GIN trigram on citation)

## barrier_analyses

Barrier single-pass pipeline analysis results. One row per document analyzed.

**Note:** Migration `0094_rename_to_barrier.sql` renamed this table, `barrier_issues`, `tournament_examples.barrier_issue_id`, and every related index, constraint, sequence, function, and trigger from their legacy names. Earlier migrations were rewritten to use the new names directly, so 0094 is a no-op on fresh installs.

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigserial | Primary key |
| `document_id` | bigint | FK to regulatory_documents (nullable, partial unique index) |
| `guidance_document_id` | bigint | FK to guidance_documents (nullable, partial unique index) |
| `jurisdiction` | varchar(3) | NY, NJ, or NYC (CHECK constraint) |
| `run_id` | varchar(32) | Pipeline run identifier |

**Analysis Results**

| Column | Type | Description |
|--------|------|-------------|
| `batch_id` | varchar(100) | Anthropic batch API ID |
| `completed_at` | timestamp | When analysis completed |
| `classification` | varchar(30) | `has_issues` or `clean` |
| `confidence` | real | 0.0-1.0 |
| `categories` | jsonb | Array of all category findings |

**Derived**

| Column | Type | Description |
|--------|------|-------------|
| `has_implementation_issues` | boolean | Final determination |
| `overall_complexity` | varchar(10) | HIGH/MEDIUM/LOW |
| `summary` | text | Analysis summary |
| `max_severity` | integer | Highest severity across categories |
| `num_categories_found` | integer | Count of categories found |

**Composite Burden Scores** (auto-maintained by `trg_barrier_issues_burden_recalc` trigger)

| Column | Type | Description |
|--------|------|-------------|
| `composite_burden` | real | `SUM(severity × confidence)` across all issues for this analysis |
| `structural_cluster_count` | integer | Count of distinct structural categories present (from: ADMINISTRATIVE_BURDENS, MANDATED_STEPS_NOT_OUTCOMES, REGULATORY_COMPLEXITY, ONE_SIZE_FITS_ALL, CASCADE_OF_RIGIDITY, UNFUNDED_MANDATE) |
| `adjusted_burden` | real | `composite_burden × (1 + 0.1 × structural_cluster_count)` — the primary ranking metric |

**Pipeline Tracking**

| Column | Type | Description |
|--------|------|-------------|
| `pipeline_version` | varchar(20) | Default 'v2' |
| `model_version` | varchar(100) | LLM model used |
| `responsible_agency` | text | Administering agency (from NYCRR title mapping or guidance doc agency) |

**Constraints:** `barrier_analyses_one_source_check CHECK (exactly one of document_id or guidance_document_id is set)`, `chk_barrier_jurisdiction CHECK (jurisdiction IN ('NY', 'NJ', 'NYC'))`

**Indexes:** `barrier_analyses_document_id_unique` (partial, WHERE document_id IS NOT NULL), `barrier_analyses_guidance_document_id_unique` (partial, WHERE guidance_document_id IS NOT NULL), `idx_barrier_analyses_state`, `idx_barrier_analyses_run_id`, `idx_barrier_analyses_adjusted_burden_desc` (adjusted_burden DESC NULLS LAST)

**Trigger:** `trg_barrier_issues_burden_recalc` — fires AFTER INSERT/UPDATE/DELETE on `barrier_issues`, recalculates `composite_burden`, `structural_cluster_count`, and `adjusted_burden` for the parent analysis. Function: `recalculate_barrier_burden()`.

## barrier_issues

One row per category finding per document. Links to `barrier_analyses`.

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigserial | Primary key |
| `analysis_id` | bigint NOT NULL | FK to barrier_analyses (ON DELETE CASCADE) |
| `document_id` | bigint | FK to regulatory_documents (ON DELETE CASCADE, nullable) |
| `guidance_document_id` | bigint | FK to guidance_documents (ON DELETE CASCADE, nullable) |
| `category` | varchar(50) | One of 18 categories (CHECK constraint) |
| `explanation` | text NOT NULL | Detailed explanation of the finding |
| `severity` | integer (1-10) | Severity score |
| `complexity` | varchar(20) | HIGH/MEDIUM/LOW |
| `confidence` | real (0.0-1.0) | Confidence in the finding |
| `matched_phrases` | text[] | Trigger phrases from the text |
| `implementation_approach` | text | Suggested implementation approach |
| `effort_estimate` | varchar(255) | Effort estimate |
| `text_examples` | text[] | Example text from the regulation |
| `tags` | text[] | 2-3 kebab-case labels per finding |
| `is_verbatim` | boolean | Whether matched_phrases are verbatim from source text |

**Valid Categories (18 — 15 core + 2 structural + OTHER catch-all):**
- `REGULATORY_COMPLEXITY`, `POLICY_IMPLEMENTATION_SEPARATION`, `CASCADE_OF_RIGIDITY`
- `MANDATED_STEPS_NOT_OUTCOMES`, `ADMINISTRATIVE_BURDENS`, `NO_FEEDBACK_LOOPS`
- `PROCESS_WORSHIP_OVERSIGHT`, `ZERO_RISK_LANGUAGE`, `FROZEN_TECHNOLOGY`
- `OTHER` (catch-all for issues not fitting named categories)
- `MISSING_OUTCOMES`, `UNCLEAR_DELEGATION`, `ACCESS_ASSUMPTION_BARRIERS`
- `FEE_COST_BURDENS`, `DEAD_SUPERSEDED_REFERENCES`, `MISSING_DIGITAL_AUTHORIZATION`
- `ONE_SIZE_FITS_ALL`, `UNFUNDED_MANDATE`

**Review/Developer fields:** `review_status`, `reviewed_by`, `reviewed_at`, `justification_notes`, `team_notes`, `priority`, `impact_type`, `developer_status`, `developer_assigned`, `developer_notes`, `resolution_type`, `resolution_comments`, `developer_question`, `developer_checked_at`

**Constraints:** `barrier_issues_analysis_category_unique UNIQUE(analysis_id, category)`, `barrier_issues_one_source_check CHECK (exactly one of document_id or guidance_document_id is set)`

**Indexes:** `idx_barrier_issues_document`, `idx_barrier_issues_category`, `idx_barrier_issues_review_status`, `idx_barrier_issues_severity`

## definitions

**Definition text fields:**
- `verbatim_text`: Exact text from regulation (always populated)
- `is_verbatim_text_complete`: True if verbatim_text is complete and usable
- `rephrased_definition`: Plain-language version when verbatim is insufficient

**Cross-reference categorization:**
- `reference_completeness`: 'pure_pointer' or 'hybrid'
- `reference_target`: 'same_corpus', 'federal', 'external_standard', 'other'

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigserial | Primary key |
| `document_id` | bigint | FK to regulatory_documents (source - where defined) |
| `url` | text NOT NULL | Source URL |
| `term` | text | Term being defined |
| `verbatim_text` | text | Exact text from regulation |
| `is_verbatim_text_complete` | boolean | Whether verbatim_text is complete |
| `rephrased_definition` | text | Plain-language definition |
| `scope` | text | Applicability scope text |
| `scope_level` | varchar(20) | Hierarchy level: section/part/chapter/title |
| `scope_document_id` | bigint | FK to regulatory_documents (where it applies) |
| `definition_type` | varchar(20) | formal or abbreviation |
| `normalized_term` | text | Lowercase trimmed term |
| `is_cross_reference` | boolean | Points to another source |
| `reference_completeness` | varchar(20) | pure_pointer or hybrid |
| `reference_target` | varchar(30) | same_corpus/federal/external_standard/other |
| `definition_overlap` | float | 0.0-1.0 overlap with regulation |
| `source_location` | text | Where found in document |
| `model_version` | varchar(100) | LLM model used |
| `extracted_at` | timestamp | When extracted |
| `notes` | text | General notes |
| `review_status` | varchar(50) | unreviewed, confirmed, corrected, false_positive |
| `reviewed_at` | timestamp | When reviewed |
| `reviewer_name` | varchar(255) | Who reviewed |
| `justification_notes` | text | Justification (required if correcting) |
| `team_notes` | text | Notes for development team |
| `original_values` | jsonb | Original LLM values when corrections made |
| `developer_status` | varchar(50) | unresolved, resolved, pending, etc. |
| `developer_assigned` | varchar(50) | Michael or Abigail |
| `developer_notes` | text | Notes from developer |
| `resolution_type` | varchar(50) | implemented or not_implemented |
| `resolution_comments` | text | Resolution details |
| `developer_question` | text | Question for reviewer |
| `developer_checked_at` | timestamp | When developer checked |

**Key distinction:**
- `document_id` = **source** document (where definition text is written)
- `scope_document_id` = **scope** document (where definition applies)

**Constraints:** `definitions_review_status_check`, `chk_reference_completeness`, `chk_reference_target`

**Indexes:** `idx_definitions_url`, `idx_definitions_term`, `idx_definitions_scope_document`, `idx_definitions_scope_level`, `idx_definitions_normalized_term`, `idx_definitions_type`, `idx_definitions_review_status`, `idx_definitions_developer_status`, `idx_definitions_developer_filters`, plus trigram indexes

## definition_document_occurrences

Many-to-many join table tracking where definition terms actually appear in document text.

| Column | Type | Description |
|--------|------|-------------|
| `definition_id` | bigint | FK to definitions (composite PK) |
| `document_id` | bigint | FK to regulatory_documents (composite PK) |
| `created_at` | timestamp | When link was created |

**Primary Key**: `(definition_id, document_id)` - composite

**Difference from scope-based applicability:**
- `definitions.document_id` = where definition text IS WRITTEN (source)
- `definitions.scope_document_id` = where definition APPLIES (hierarchy-based scope)
- `definition_document_occurrences` = where term ACTUALLY APPEARS in text

## compliance_issues

Pure regex match store. Tracks individual regex matches found during compliance scanning.

**Note**: LLM analysis fields moved to `compliance_issue_analyses` in PR 6.2. Review/developer tracking fields moved to `compliance_issue_analyses` in PR 6.3. This table now only stores the regex match data.

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigserial | Primary key |
| `document_id` | bigint | FK to regulatory_documents (nullable — see CHECK constraint) |
| `guidance_document_id` | bigint | FK to guidance_documents (nullable — see CHECK constraint). **Migration 0057.** |
| `issue_type` | varchar(50) | `wet_signature`, `mail_only`, `fax`, etc. |
| `occurrence_number` | integer | 1, 2, 3... for multiple issues of same type per document |
| `regex_match_pattern` | varchar(255) | Regex pattern that triggered the initial scan |
| `regex_match_context` | text NOT NULL | Text window around the regex match (~600 chars) |
| `url` | text | Link to the regulation or guidance doc |
| `jurisdiction` | varchar(3) NOT NULL | NY, NJ, or NYC |
| `created_at` | timestamp | When record was created |
| `analysis_id` | bigint | FK to compliance_issue_analyses(id) ON DELETE SET NULL. Many-to-one link (many matches → one analysis). Set by searcher/pipeline after analysis INSERT. |
| `run_id` | varchar(32) | Batch/run ID for tracking which scan created the record |

**Constraints:** `compliance_issues_one_source CHECK ((document_id IS NOT NULL)::int + (guidance_document_id IS NOT NULL)::int = 1)`, `chk_ci_jurisdiction CHECK (jurisdiction IN ('NY', 'NJ', 'NYC'))`, partial unique indexes on `(document_id, issue_type, occurrence_number)` and `(guidance_document_id, issue_type, occurrence_number)`

**Indexes:** `idx_compliance_issues_document`, `idx_ci_guidance_document` (migration 0057b, CONCURRENTLY), `idx_compliance_issues_state`, `idx_compliance_issues_issue_type`, `idx_compliance_issues_state_issue`, `idx_compliance_issues_analysis_id`, `idx_ci_unique_reg` (partial unique, migration 0057b), `idx_ci_unique_guidance` (partial unique, migration 0057b)

**Issue Types** (42 types defined in `prompts/compliance_issues.yaml`)

### Compliance Issue Filtering

**Note**: LLM analysis fields and review/developer fields all live exclusively in `compliance_issue_analyses`. The repository JOINs to analyses to provide these fields. The `compliance_issues` table is a pure regex match store.

#### LLM Confirmation Status (from `compliance_issue_analyses`)
- `requirement_found = true`: LLM confirmed this is a real compliance issue (has `final_severity` 1-10, `verbatim_requirements` populated with quotes)
- `requirement_found = false`: LLM analyzed the regex match but found no actual issue (`final_severity` is NULL, `verbatim_requirements` is empty array)

The `requirement_found` field in `compliance_issue_analyses` indicates whether the LLM found a genuine compliance issue after analyzing the regex-matched context. The `verbatim_requirements` array contains exact quotes from the regulation that support the classification, and is empty when no issue is found.

#### Where Filtering is Applied

| Location | Shows | Filter |
|----------|-------|--------|
| Browse tree badges | Confirmed only | `cia.requirement_found = TRUE` (via JOIN) |
| Dashboard stats | Confirmed only | `cia.requirement_found = TRUE` (via JOIN) |
| Table view counts | Confirmed only | Uses precomputed columns |
| Review mode | All issues | No filter (for QA review) |

Review mode intentionally shows ALL issues (including LLM-rejected matches) so users can verify the LLM's reasoning and identify any false negatives.

#### Precomputed Columns

The following columns on `regulatory_documents` store compliance issue counts:
- `compliance_issue_count`: Direct confirmed issues on this document
- `descendant_compliance_issue_count`: Confirmed issues in all descendant documents

These are updated by `refresh_compliance_stats()` in `backend/lib/stats.py` and only count issues where `requirement_found = TRUE` (in `compliance_issue_analyses`).

### Metric Contract (Analytics & Pipeline)

**Canonical Tables:**
- `compliance_issues` = **regex/match layer** — raw scan results from `scan_compliance_issues.py`. NOT the reporting layer. Do not use for user-facing counts.
- `compliance_issue_analyses` = **canonical reporting layer** — all analytics, pipeline stats, and user-facing counts come from this table.

**Population Rules for User-Facing Counts:**
- All user-facing issue counts MUST filter `requirement_found = TRUE`
- Classification uses `COALESCE(tier3_classification, tier2_classification, tier1_classification)` — each record counted once at its highest completed tier
- Source scoping (regulations vs guidance) uses `guidance_document_id IS NULL` (regulations) or `guidance_document_id IS NOT NULL` (guidance)
- Source filtering helpers: `buildSourceCondition()` (Drizzle) and `buildSourceSqlFragment()` (raw SQL) in `compliance-issues.repository.ts`

**Where `requirement_found` is Set:**
- Set in `backend/scripts/research_pipeline/result_processor.py` during Tier 2/3 processing
- Written to DB in `backend/scripts/research_pipeline/db/analysis_writer.py`
- `burdensome` / `justified` → `requirement_found = true`
- `unrelated` / `all_false_positives` → `requirement_found = false`

**Human Review vs Issue Existence:**
- `review_status` is a separate dimension from `requirement_found` — they must not be conflated
- Human review buckets: `unreviewed`, `confirmed`, `rejected_clear_fp`, `rejected_not_obvious_bad`, `needs_context`, `deferred`
- "Pending Human Review" = `unreviewed + needs_context + deferred`

**Cross-Page Consistency:**
- `/analytics` and `/pipeline` should use the same backend metric definitions for the same concepts
- When source scope is selected, it must apply to all cards, charts, drill-downs, and subtabs
- The `ClassificationBreakdown.coalesced` field provides deduplicated classification counts

## compliance_issue_analyses

Document-level analysis results for the 3-tier research pipeline. One row per (document_id, issue_type) pair.

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigserial | Primary key |
| `document_id` | bigint | FK to regulatory_documents (nullable after migration 0058) |
| `guidance_document_id` | bigint | FK to guidance_documents (migration 0058) |
| `issue_type` | varchar(50) | Issue type being analyzed |
| `jurisdiction` | varchar(3) NOT NULL | NY, NJ, or NYC |
| `grouped_match_count` | integer NOT NULL | Number of regex matches from compliance_issues analyzed together |

**Tier 1: Match Filtering**

| Column | Type | Description |
|--------|------|-------------|
| `tier1_relevant_match_ids` | integer[] | IDs from compliance_issues that passed filtering (DEFAULT '{}') |
| `tier1_dismissed_match_ids` | integer[] | IDs from compliance_issues that were filtered out (DEFAULT '{}') |
| `tier1_dismissed_reasons` | jsonb | Array of {match_id, text, reason} |
| `tier1_classification` | varchar(30) | `all_false_positives` or `needs_research` |
| `tier1_confidence` | real | 0.0-1.0 |
| `tier1_reasoning` | text | Explanation of filtering decisions |
| `tier1_context_requests` | jsonb | ContextRequest objects for Tier 2 |
| `tier1_batch_id` | varchar(100) | Anthropic batch API ID |
| `tier1_completed_at` | timestamp | When Tier 1 completed |

**Tier 2: Summary-Based Research**

| Column | Type | Description |
|--------|------|-------------|
| `tier2_classification` | varchar(30) | `unrelated`, `justified`, `burdensome`, or `needs_full_context` |
| `tier2_confidence` | real | 0.0-1.0 |
| `tier2_reasoning` | text | Step-by-step analysis |
| `verbatim_requirements` | text[] | Document-level requirement quotes (DEFAULT '{}') |
| `severity` | integer (1-10) | Tier 2 severity score |
| `severity_baseline` | integer | Issue-type baseline |
| `severity_calculation` | text | Formula breakdown |
| `argument_for_regulation` | text | Steelman: why burden might be justified |
| `argument_against_regulation` | text | Steelman: why burden is problematic |
| `context_used` | jsonb | All context sources used in analysis |
| `tier2_full_text_requests` | jsonb | ContextRequest objects for Tier 3 |
| `needs_web_search` | boolean | True if web search needed |
| `web_search_topics` | text[] | Suggested search topics (DEFAULT '{}') |
| `potentially_controversial` | boolean | Affects vulnerable populations, civil rights |
| `federal_mandate_suspected` | boolean | Federal statute cited but state discretion unclear |
| `ambiguity_type` | varchar(20) | `internal`, `external`, or `both` |
| `tier2_batch_id` | varchar(100) | Anthropic batch API ID |
| `tier2_completed_at` | timestamp | When Tier 2 completed |

**Tier 3: Full Context Deep Dive**

| Column | Type | Description |
|--------|------|-------------|
| `tier3_classification` | varchar(30) | `burdensome`, `justified`, or `unrelated` |
| `tier3_confidence` | real | 0.0-1.0 |
| `tier3_reasoning` | text | Explanation with full context |
| `tier3_severity_adjustment` | integer (-3 to +3) | Delta from Tier 2 severity |
| `tier3_severity_adjustment_reasoning` | text | Explanation of adjustment |
| `tier3_batch_id` | varchar(100) | Anthropic batch API ID |
| `tier3_completed_at` | timestamp | When Tier 3 completed |

**Tier 3: Web Search Results**

| Column | Type | Description |
|--------|------|-------------|
| `web_search_summary` | text | Summary of web search results |
| `federal_mandate_found` | boolean | True if web search confirmed federal mandate |
| `state_has_discretion` | boolean | True if state has discretion in implementation |

**Derived Fields**

| Column | Type | Description |
|--------|------|-------------|
| `requirement_found` | boolean | True for burdensome/justified |
| `is_justified` | boolean | True only for justified classification |
| `is_verbatim` | boolean | All verbatim_requirements found in source doc |
| `final_severity` | integer | severity + tier3_adjustment |
| `review_summary` | text | 1-2 sentence plain-language summary for quick review triage. Generated by post-pipeline Haiku batch step. |

**Pipeline Tracking**

| Column | Type | Description |
|--------|------|-------------|
| `pipeline_version` | varchar(20) | Default 'v5' |
| `highest_tier_completed` | integer (0-3) | Progress indicator |
| `classification_tier` | integer | Which tier made final classification |
| `responsible_agency` | text | Administering agency (from NYCRR title mapping or guidance doc agency) |
| `tier1_prompt_id` | bigint | FK to prompt_templates(id) — prompt used for Tier 1 |
| `tier2_prompt_id` | bigint | FK to prompt_templates(id) — prompt used for Tier 2 |
| `tier3_prompt_id` | bigint | FK to prompt_templates(id) — prompt used for Tier 3 |
| `created_at` | timestamp | When record was created |
| `updated_at` | timestamp | Last update time |

**V5 Additions (migration 0022)**

The pipeline uses a 3-tier architecture with proactive context, argument framing, and re-runs. Legacy V4 data has been migrated to this shape (tagged `pipeline_version = 'v4-migrated'`).

*Tier 1: Argument Framing & Context Requests*

| Column | Type | Description |
|--------|------|-------------|
| `tier1_argument_framing` | jsonb | Contains `best_argument_burdensome`, `best_argument_justified`, `best_argument_unrelated`. Only populated if `tier1_classification = 'needs_research'`. |
| `tier1_recommendations` | jsonb | Contains `context_requests` array for Tier 2. Each request: `{context_type, identifier, need_level, reason}`. |

*Tier 2: Re-run Tracking*

| Column | Type | Description |
|--------|------|-------------|
| `tier2_rerun_count` | integer (0-2) | Number of times Tier 2 was re-run with additional context. Max 2. |
| `tier2_context_requests_made` | jsonb | Array of context requests made during re-runs. Each: `{context_type, identifier, need_level, reason, timestamp}`. |
| `tier2_forced_classification` | boolean | True if classification was forced after exceeding max re-runs. Indicates lower confidence. |
| `claims_no_alternative` | boolean | True if Tier 2 claims no electronic/remote alternative exists. Triggers Tier 3 if severity >= 7. |
| `cites_federal_statute` | boolean | True if document cites a federal statute. Triggers Tier 3 for verification. |
| `federal_citation` | text | The federal citation found (e.g., "42 CFR 483.24"). NULL if `cites_federal_statute` is false. |

*Tier 3: Structured Flags (V5 Tier 3 = Web Verification)*

| Column | Type | Description |
|--------|------|-------------|
| `tier3_flags` | jsonb | Structured verification flags with evidence. Contains `superseded_by_law`, `federal_mandate_confirmed`, `state_discretion_found`, `modernized_alternative_found`, `advocacy_for_change`. Each is an EvidencedFlag with `value`, `scope`, `reason`, and `evidence` array. |
| `tier3_evidence_gap` | boolean | True if web search found no relevant evidence. |
| `tier3_trigger_reason` | text | Human-readable reason for Tier 3 escalation (e.g., "High-risk issue (notarization) + justified", "Random sample (10%)", "Low confidence (0.82) + severity 7"). Added in migration 0025. |

**V5.1 Additions (migration 0024): Easy Cleanup Detection**

Identifies "low-hanging fruit" where the regulation text is outdated but practical alternatives already exist.

| Column | Type | Description |
|--------|------|-------------|
| `easy_cleanup_candidate` | boolean | True if this is a low-hanging fruit cleanup opportunity (DEFAULT false) |
| `cleanup_type` | varchar(50) | `alternative_in_practice`, `alternative_authorized`, or `peer_state_solution` |
| `cleanup_evidence` | text | URL or citation proving the alternative exists |
| `cleanup_recommendation` | text | Specific suggested regulation text change |
| `cleanup_effort` | varchar(20) | `trivial`, `easy`, or `medium` |

**Cleanup Categories:**
- `alternative_in_practice` (effort: trivial): Agency already accepts modern alternative not mentioned in regulation (e.g., agency has online payment but reg says "certified check")
- `alternative_authorized` (effort: easy): State has authorized modern alternative but regulation not updated (e.g., NJ RON since 2021 but reg still requires in-person notary)
- `peer_state_solution` (effort: medium): Other states have proven modern approaches

**Important:** When easy cleanup is detected, classification remains `burdensome` (the regulation TEXT still creates burden), but severity is lowered 1-2 points and `easy_cleanup_candidate = true` flags it as actionable.

**V5.2 Additions (migration 0028): Web Search Disambiguation**

Helps Tier 3 web search avoid returning results about similar-sounding but different programs.

| Column | Type | Description |
|--------|------|-------------|
| `program_context` | text | Specific program/agency context for web search disambiguation (e.g., "NJ Division of Gaming Enforcement casino key employee licensing under N.J.A.C. 13:69D") |
| `not_to_confuse_with` | text[] | List of similar-sounding programs to ignore in searches (DEFAULT '{}') |
| `search_scope_guidance` | text | Guidance for Tier 3 on what to focus on vs avoid (e.g., "Focus on NJ DGE employee licensing, not federal banking requirements") |

**Reform Prioritization (Issue #253)**

| Column | Type | Description |
|--------|------|-------------|
| `primary_affected_population` | varchar(50) | Who is most affected: `families`, `small_businesses`, `licensed_professionals`, `government_staff`, `vulnerable_populations`, `general_public`, `healthcare_providers`, `childcare_providers`, `nonprofits` |
| `domain_relevance_score` | integer | Title-based domain priority boost (-2 to +2). Computed post-Tier-2 from NYCRR/NJAC/RCNY title mappings |
| `reform_priority_score` | integer | Composite score = severity + domain_relevance + population modifier. For ranking burdensome issues by reform value |

**Report Utility Assessment (Issue #253, mandated_reports/reporting_frequency only)**

| Column | Type | Description |
|--------|------|-------------|
| `report_serves_public` | boolean | True if report serves clear public interest (epidemiological, safety, transparency) |
| `report_duplicates_existing` | boolean | True if information already available via FOIL, dashboards, federal reporting |
| `report_frequency_excessive` | boolean | True if frequency is disproportionate to oversight value |

**Example Values:**
```json
{
  "program_context": "NJ Division of Gaming Enforcement casino key employee licensing under N.J.A.C. 13:69D",
  "not_to_confuse_with": [
    "Federal TSA PreCheck or REAL ID programs",
    "Bank Secrecy Act requirements for casino patrons (different from employees)",
    "General employment background check laws"
  ],
  "search_scope_guidance": "Focus on NJ DGE employee licensing procedures and peer state gaming commission alternatives, not federal banking or transportation security"
}
```

**Human Review (PR 6.3 — moved from compliance_issues)**

| Column | Type | Description |
|--------|------|-------------|
| `review_status` | varchar(50) | `unreviewed`, `confirmed`, `false_positive`, etc. (DEFAULT 'unreviewed') |
| `reviewed_by` | varchar(255) | Who reviewed it |
| `reviewed_at` | timestamp | When reviewed |
| `justification_notes` | text | Reviewer's justification notes |
| `team_notes` | text | Notes for the development team |
| `impact_type` | varchar(100) | Type of impact |
| `reviewer_severity` | integer (1-10) | Reviewer-assigned severity (aliased as `severity` in repository queries) |
| `reviewer_original_severity` | integer (1-10) | Original severity before reviewer adjustment (aliased as `originalSeverity`) |

**Developer Tracking (PR 6.3 — moved from compliance_issues)**

| Column | Type | Description |
|--------|------|-------------|
| `developer_status` | varchar(50) | `unresolved`, `resolved`, `pending`, etc. (DEFAULT 'unresolved') |
| `developer_assigned` | varchar(50) | Michael or Abigail |
| `developer_notes` | text | Notes from developer |
| `resolution_type` | varchar(50) | `implemented` or `not_implemented` |
| `resolution_comments` | text | Resolution details |
| `developer_question` | text | Question for reviewer |
| `developer_checked_at` | timestamp | When developer last checked |

**Constraints:**
- `cia_one_source` CHECK: exactly one of `document_id` / `guidance_document_id` is set (migration 0058)
- `idx_cia_unique_reg` UNIQUE on `(document_id, issue_type) WHERE document_id IS NOT NULL`
- `idx_cia_unique_guidance` UNIQUE on `(guidance_document_id, issue_type) WHERE guidance_document_id IS NOT NULL`

**Indexes:**
- Guidance: `idx_cia_guidance_document` (partial, WHERE guidance_document_id IS NOT NULL)
- Classification: `idx_cia_tier1_classification`, `idx_cia_tier2_classification`, `idx_cia_tier3_classification`
- Pipeline progression: `idx_cia_needs_tier2`, `idx_cia_needs_tier3`
- Lookups: `idx_cia_state_issue`, `idx_cia_document`, `idx_cia_pipeline_version`
- JSONB: `idx_cia_context_used` (GIN)
- Severity: `idx_cia_high_severity`, `idx_cia_state_severity`
- Results: `idx_cia_burdensome`, `idx_cia_justified`
- Review/Developer: `idx_cia_review_status`, `idx_cia_developer_status`, `idx_cia_developer_assigned`
- V5: `idx_compliance_issue_analyses_v5_tier3_triggers` (partial index for V5 Tier 3 routing)
- V5.1: `idx_compliance_issue_analyses_tier3_trigger_reason` (partial), `idx_compliance_issue_analyses_easy_cleanup` (partial)
- Query optimization: `idx_cia_doc_issue`, `idx_cia_state_tier2`, `idx_cia_highest_tier`
- Full-text search (migration 0044): `idx_compliance_issue_analyses_search_vector` (GIN) — `search_vector tsvector` column with tier2_reasoning + tier3_reasoning + verbatim_requirements, maintained by trigger

## prompt_templates

Deduplicated prompt templates for observability. Each unique canonical request (model + system + messages + tools + tool_choice + max_tokens) gets one row, identified by SHA-256 content hash. Linked from `compliance_issue_analyses` via `tier1_prompt_id`, `tier2_prompt_id`, `tier3_prompt_id` FKs. Added in migration 0060.

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigserial | Primary key |
| `content_hash` | text NOT NULL UNIQUE | SHA-256 of canonical request params |
| `pipeline` | text NOT NULL | `research`, `barrier`, `summarization` |
| `tier` | integer | 1, 2, 3 (NULL for single-pass pipelines) |
| `model` | text NOT NULL | Model name (e.g., `claude-sonnet-4-5-20250929`) |
| `system_prompt` | text | Extracted system prompt text |
| `user_message` | text | Extracted user message text (all parts concatenated) |
| `tools_schema` | jsonb | Tool definitions |
| `full_request` | jsonb | Complete request params for exact reproduction |
| `created_at` | timestamptz | DEFAULT NOW() |

**Indexes:**
- `idx_prompt_templates_pipeline_tier` on `(pipeline, tier)`

**Backfill:** Run `cd backend && python3 -m scripts.backfill_prompt_templates` to populate from historical batch `requests.json`/`.jsonl` files.

## compliance_issue_analysis_reviews

Per-tier review tracking for 3-tier pipeline analyses. Supports reviewing the entire analysis (tier=NULL) or individual tier outputs.

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigserial | Primary key |
| `analysis_id` | bigint NOT NULL | FK to compliance_issue_analyses (ON DELETE CASCADE) |
| `tier` | integer | NULL = whole analysis, 1/2/3 = specific tier output |
| `review_status` | varchar(50) | unreviewed, confirmed, rejected, etc. (default 'unreviewed') |
| `reviewed_by` | varchar(255) | Who reviewed |
| `reviewed_at` | timestamp | When reviewed |
| `justification_notes` | text | Reviewer notes justifying the decision |
| `team_notes` | text | Notes for the development team |
| `override_classification` | varchar(30) | Reviewer can override to unrelated/justified/burdensome |
| `override_severity` | integer (1-10) | Reviewer can override severity score |
| `override_reasoning` | text | Explanation for the override |
| `created_at` | timestamp | When created |
| `updated_at` | timestamp | When last updated |

**Tier Scope:**
- `tier = NULL`: Review applies to the entire analysis (final classification/severity)
- `tier = 1`: Review applies specifically to Tier 1 match filtering output
- `tier = 2`: Review applies specifically to Tier 2 classification output
- `tier = 3`: Review applies specifically to Tier 3 web search output

**Constraints:**
- `ciar_tier_check CHECK (tier IS NULL OR tier BETWEEN 1 AND 3)`
- `ciar_override_severity_check CHECK (override_severity IS NULL OR override_severity BETWEEN 1 AND 10)`
- `unique_ciar_analysis_tier UNIQUE(analysis_id, tier)` - one review per analysis+tier combination

**Indexes:** `idx_analysis_reviews_analysis`, `idx_analysis_reviews_status`, `idx_analysis_reviews_tier`

## incorporations_by_reference

Tracks external standards incorporated by reference (NFPA codes, ICC codes, ASTM standards, CFR references, etc.).

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigserial | Primary key |
| `document_id` | bigint | FK to regulatory_documents |
| `incorporated_document` | text | Name of incorporated document |
| `source_organization` | varchar(100) | Publisher (ICC, NFPA, ANSI, ASTM, CFR) |
| `version` | text | Version/edition |
| `requirement_quote` | text | Exact quote from regulation |
| `term_matched` | varchar(255) | Regex pattern that matched |
| `context` | text NOT NULL | Context snippet around match |
| `llm_confirmed` | boolean | Always true for saved records |
| `jurisdiction` | varchar(3) NOT NULL | NY, NJ, or NYC |
| `url` | text NOT NULL | Source URL |
| `review_status` | varchar(50) | unreviewed, confirmed, false_positive, etc. |
| `reviewed_by` | varchar(255) | Who reviewed |
| `reviewed_at` | timestamp | When reviewed |
| `justification_notes` | text | Reviewer notes |
| `team_notes` | text | Notes for development team |
| `priority` | integer | Priority level |
| `developer_status` | varchar(50) | unresolved, resolved, pending, etc. |
| `developer_assigned` | varchar(50) | Michael or Abigail |
| `developer_notes` | text | Developer notes |
| `resolution_type` | varchar(50) | implemented or not_implemented |
| `resolution_comments` | text | Resolution comments |
| `developer_question` | text | Question for reviewer |
| `developer_checked_at` | timestamp | When developer checked |
| `created_at` | timestamp | When record was created |

**Constraints:** `chk_ibr_jurisdiction`, `chk_ibr_resolution_type`

## fines_fees_penalties

Structured extraction of monetary charges (fines, fees, penalties, surcharges, forfeitures) from regulations and guidance documents. Follows the IBR pattern with a dedicated table.

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigserial | Primary key |
| `document_id` | bigint | FK to regulatory_documents (nullable) |
| `guidance_document_id` | bigint | FK to guidance_documents (nullable) |
| `penalty_type` | varchar(50) NOT NULL | fine, fee, penalty, surcharge, forfeiture, other |
| `amount` | text | Display string ("$500", "up to $10,000") |
| `amount_min` | numeric(12,2) | Parsed minimum amount |
| `amount_max` | numeric(12,2) | Parsed maximum amount |
| `per_unit` | text | "per violation", "per day", etc. |
| `who_pays` | text | Subject of the charge |
| `responsible_agency` | text | Administering agency (raw LLM-extracted) |
| `agency_id` | bigint | FK to agencies(id) — canonical agency lookup |
| `violation_description` | text | What triggers the charge |
| `requirement_quote` | text | Exact quote from source |
| `context` | text NOT NULL | Context snippet |
| `term_matched` | text | Regex pattern that matched |
| `llm_confirmed` | boolean | LLM verified as real charge |
| `jurisdiction` | varchar(3) NOT NULL | NY, NJ, or NYC |
| `url` | text | Source URL |
| `review_status` | varchar(50) | Review workflow status |
| `reviewed_by` | varchar(255) | Reviewer |
| `reviewed_at` | timestamp | Review timestamp |
| `team_notes` | text | Team notes |
| `priority` | integer | Priority level |
| `developer_status` | varchar(50) | Developer workflow status |
| `developer_assigned` | varchar(50) | Assigned developer |
| `developer_notes` | text | Developer notes |
| `resolution_type` | varchar(50) | Resolution type |
| `resolution_comments` | text | Resolution comments |
| `developer_question` | text | Question for reviewer |
| `developer_checked_at` | timestamp | Developer check timestamp |
| `jurisdiction_level` | varchar(20) | federal, state, county, local, other |
| `jurisdiction_level_other` | text | Free-text if jurisdiction_level is 'other' |
| `issuing_entity_confidence` | numeric(3,2) | Confidence (0.0–1.0) in agency attribution |
| `who_pays_normalized` | varchar(40) | LLM-classified category (15 values). CHECK constraint. |
| `activity_category` | varchar(40) | Activity domain (17 values: hunting_fishing_wildlife, business_licensing, manufacturing_industrial, healthcare_facility, childcare_provider, professional_licensing, environmental_permit, construction_building, food_service, transportation, cannabis_alcohol, real_estate_housing, education, financial_services, social_services, utilities_telecom, other) |
| `estimated_annual_payers` | varchar(30) | Volume magnitude: tens, hundreds, thousands, ten_thousands, hundred_thousands |
| `justification` | text | What the charge funds; cost-recovery vs revenue-generating |
| `justification_quote` | text | Verbatim regulation quote supporting justification |
| `created_at` | timestamp | Creation timestamp |

**Constraints:** `fines_one_source_check` (exactly one of document_id or guidance_document_id must be set), `chk_fines_jurisdiction`, `chk_fines_who_pays_normalized`, `chk_fines_jurisdiction_level`, `chk_fines_activity_category` (validates activity_category enum values), `chk_fines_estimated_annual_payers` (validates estimated_annual_payers enum values)

**Indexes:** `idx_fines_jurisdiction`, `idx_fines_document_id`, `idx_fines_guidance_document_id`, `idx_fines_penalty_type`, `idx_fines_responsible_agency`, `idx_fines_llm_confirmed`, `idx_fines_agency_id`, `idx_fines_who_pays_normalized`, `idx_fines_activity_category` (partial index on activity_category WHERE NOT NULL)

**Migrations:** `0062_fines_fees_penalties.sql`, `0063_widen_fines_columns.sql`, `0067_agencies_lookup.sql` (added `agency_id` FK), `0080_fines_jurisdiction_level.sql`, `0083_fines_who_pays_normalized.sql`, `0084_fines_justification_quote.sql`, `0085_fines_activity_enrichment.sql`

## agencies

Canonical agency lookup table for deduplicating `responsible_agency` across fines (and eventually compliance/Barrier). Stores one row per (jurisdiction, canonical_name) pair.

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigserial | Primary key |
| `jurisdiction` | varchar(3) NOT NULL | NY, NJ, or NYC |
| `canonical_name` | text NOT NULL | Canonical display name (InitCap) |
| `abbreviation` | varchar(50) | Optional abbreviation (e.g., DOH) |
| `level` | varchar(20) | Government level: federal, state, county, city, village, town, authority, judiciary, generic |
| `created_at` | timestamp | Creation timestamp |

**Constraints:** `chk_agencies_jurisdiction`, `uq_agencies_jurisdiction_name` (unique on jurisdiction + canonical_name), `chk_agencies_level` (CHECK on valid level values)

**Indexes:** `idx_agencies_jurisdiction`, `idx_agencies_level` (partial: WHERE level IS NOT NULL)

**Migrations:** `0067_agencies_lookup.sql`, `0068_seed_agencies.sql`, `0071_deep_agency_dedup.sql`, `0072_agency_level.sql`

## agency_aliases

Maps variant spellings, abbreviations, and case variants to a canonical agency in the `agencies` table.

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigserial | Primary key |
| `agency_id` | bigint NOT NULL | FK to agencies(id) ON DELETE CASCADE |
| `alias` | text NOT NULL | Alias string (exact match for lookup) |
| `source` | varchar(50) | Origin: 'canonical', 'title_map', 'llm', 'guidance', 'manual' |
| `created_at` | timestamp | Creation timestamp |

**Constraints:** `uq_agency_aliases` (unique on agency_id + alias)

**Indexes:** `idx_agency_aliases_agency_id`, `idx_agency_aliases_alias`

**Migrations:** `0067_agencies_lookup.sql`, `0068_seed_agencies.sql`

## statutes

Stores statute content (N.J.S.A., NY Consolidated Laws, NYC Charter/Admin Code) - separate from regulatory_documents.
Hierarchy: Title → Chapter → Section (NJ), Law → Article → Section (NY), Charter/Title → Chapter → Section (NYC).

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigserial | Primary key |
| `citation` | varchar(50) NOT NULL | Full citation (e.g., "52:27D-119", "SOS 488", "NYC Admin 23-1201", "NYC Charter 8") |
| `jurisdiction` | varchar(3) NOT NULL | NJ, NY, NYC (default 'NJ') |
| `title` | text NOT NULL | Human-readable title/name |
| `content` | text NOT NULL | Full text content (for sections) |
| `njsa_title` | varchar(10) | NJ: Title number |
| `njsa_title_name` | text | NJ: Title name |
| `njsa_chapter` | varchar(20) | NJ: Chapter number |
| `njsa_section` | varchar(20) | NJ: Section number |
| `njsa_section_name` | text | NJ: Section name |
| `nycls_law_id` | varchar(10) | NY: Law ID (e.g., "SOS", "EDN") |
| `nycls_law_name` | text | NY: Law name (e.g., "Social Services") |
| `nycls_article` | varchar(20) | NY: Article ID |
| `nycls_article_name` | text | NY: Article name |
| `nycls_section` | varchar(20) | NY: Section number |
| `nycls_section_name` | text | NY: Section name |
| `nyc_doc_type` | varchar(20) | NYC: 'charter' or 'admin_code' |
| `nyc_title` | varchar(10) | NYC: Admin Code title number |
| `nyc_chapter` | varchar(20) | NYC: Chapter ID |
| `nyc_section` | varchar(30) | NYC: Section number |
| `nyc_section_name` | text | NYC: Section title |
| `parent_id` | bigint | FK to parent statute (self-referencing) |
| `hierarchy_level` | varchar(50) | title, chapter, section, law, article |
| `hierarchy_path` | text | Full path for display |
| `descendant_linked_regulation_count` | integer | Precomputed: total regulation links in subtree |
| `descendant_enabling_authority_count` | integer | Precomputed: total enabling authority links in subtree |
| `source_index` | integer | Index from parsing process |
| `created_at` | timestamp | When created |

**Full-text search (migration 0044):**

| Column | Type | Description |
|--------|------|-------------|
| `search_vector` | tsvector | Weighted: title(A) + content(C). Maintained by trigger. |

**Indexes:** `idx_statutes_nycls_law_id`, `idx_statutes_search_vector` (GIN)
**Constraints:** `chk_statutes_jurisdiction`, `unique_jurisdiction_citation UNIQUE(jurisdiction, citation)`

## statute_references

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigserial | Primary key |
| `document_id` | bigint NOT NULL | FK to regulatory_documents |
| `usc_citations` | text | US Code citations |
| `cfr_citations` | text | CFR citations |
| `public_laws` | text | Public law references |
| `acts` | text | Act references |
| `state_title` | varchar(100) | State title reference |
| `state_section` | varchar(100) | State section reference |

## regulation_statute_links

Many-to-many crosswalk between regulations and statutes.

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigserial | Primary key |
| `regulation_id` | bigint NOT NULL | FK to regulatory_documents |
| `statute_id` | bigint | FK to statutes (nullable for unmatched) |
| `citation` | varchar(50) NOT NULL | Citation as found in text |
| `context` | text | Surrounding text where citation was found |
| `link_type` | varchar(50) | `enabling_authority`, `definition`, `requirement`, `reference` |
| `match_status` | varchar(50) | `matched`, `corrected`, `unmatched`, `obsolete` |
| `original_citation` | varchar(50) | If corrected, original text |
| `correction_notes` | text | Why correction was made |
| `reviewed_at` | timestamp | When reviewed |
| `reviewed_by` | varchar(255) | Who reviewed |
| `created_at` | timestamp | When created |

**Constraints:** `unique_regulation_statute_link UNIQUE(regulation_id, citation)`

## statute_mandate_checks

LLM analysis of whether cited statutes actually mandate flagged regulatory issues.
Post-pipeline step for regulations with statute links.

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigserial | Primary key |
| `analysis_id` | bigint NOT NULL | FK to compliance_issue_analyses (ON DELETE CASCADE) |
| `statute_id` | bigint NOT NULL | FK to statutes (ON DELETE CASCADE) |
| `link_id` | bigint | FK to regulation_statute_links (ON DELETE SET NULL) |
| `statute_mandated` | boolean NOT NULL | Whether statute mandates the flagged issue |
| `confidence` | real NOT NULL | LLM confidence score (0.0-1.0) |
| `reasoning` | text NOT NULL | Step-by-step explanation |
| `statute_text_excerpt` | text | Key excerpt from statute |
| `model` | varchar(100) | Model used for analysis |
| `created_at` | timestamp | When created |

**Indexes:** `idx_statute_mandate_checks_analysis`, `idx_statute_mandate_checks_mandated`
**Constraints:** `UNIQUE(analysis_id, statute_id)`

## guidance_documents

Sub-regulatory guidance documents (ADMs, LCMs, INFs, GIS, TSBs, etc.) from NY state agencies. Imported from the nys-documents catalog. **Migration 0054.**

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigserial | Primary key |
| `catalog_id` | text | ID from nys-documents enriched_catalog.json (e.g. "00370") |
| `canonical_ref` | text | Standard doc reference (e.g. "23-OCFS-ADM-15-R1") |
| `title` | text NOT NULL | Document title |
| `agency` | text NOT NULL | OCFS, OTDA, DOH, etc. |
| `agency_division` | text | E.g. "Division of Child Welfare" |
| `doc_type` | text | ADM, LCM, INF, GIS, TSB-M, letter, advisory, etc. |
| `domain` | text | childcare, social_services, tax, etc. |
| `date_published` | date | Publication date |
| `date_effective` | date | Effective date |
| `date_revised` | date | Last revision date |
| `date_expires` | date | Expiration date |
| `year` | integer | Year of publication |
| `content` | text | Full document text |
| `url` | text | Source URL |
| `file_format` | text | pdf, docx, html, etc. |
| `status` | text | active, superseded, canceled, expired (default: active) |
| `supersedes` | text[] | canonical_refs this doc replaces |
| `superseded_by` | text | canonical_ref that replaced this doc |
| `revision_of` | text | canonical_ref of original (for R1, R2, etc.) |
| `sender_name` | text | Name of sender from enrichment |
| `sender_title` | text | Title of sender |
| `distribution_to` | text[] | Distribution list |
| `programs` | text[] | Referenced NY programs |
| `cites_regulations` | text[] | NYCRR citations (e.g. "18 NYCRR 428.6") |
| `cites_federal` | text[] | Federal statute citations |
| `cites_documents` | text[] | Other guidance doc refs |
| `source_project` | text | childcare, guidance, statewide_expansion |
| `text_path` | text | Path in nys-documents repo |
| `created_at` | timestamptz | Row creation time |
| `updated_at` | timestamptz | Last update time (auto-updated by trigger on any column change — migration 0058) |
| `search_vector` | tsvector | Full-text search (auto-populated by trigger; recomputed only when title/content change — migration 0058) |
| `is_attachment` | boolean | True if title matches attachment/enclosure/appendix patterns (default false) |
| `policy_category` | text | Rule-based category: `policy_directive`, `legal_interpretation`, `tax_guidance`, `informational`, `reference_material`, `non_policy`, `data_dump`, `unclassified` |
| `summary` | text | AI-generated summary (migration 0081) |
| `section_type` | varchar(50) | Primary category (requirements, procedures, etc.) (migration 0081) |
| `keywords` | text[] | 3-5 searchable terms (migration 0081) |
| `applies_to` | text[] | Who must comply (migration 0081) |
| `has_form` | boolean | References a specific form (default false, migration 0081) |
| `has_ibr` | boolean | Incorporates external standards (default false, migration 0081) |
| `target_audience` | text[] | 1-3 audience tags from controlled vocabulary (migration 0081) |
| `audience_direction` | varchar(20) | public, government, or both (migration 0078) |
| `audience_expertise` | varchar(20) | lay, specialized, or mixed (migration 0078) |
| `audience_explanation` | text | 1-2 sentence description of who the doc is for (migration 0078) |
| `flesch_kincaid_grade` | real | Flesch-Kincaid Grade Level score (migration 0086) |
| `flesch_reading_ease` | real | Flesch Reading Ease score (migration 0086) |
| `gunning_fog` | real | Gunning Fog Index (migration 0086) |
| `automated_readability_index` | real | Automated Readability Index (migration 0086) |
| `coleman_liau_index` | real | Coleman-Liau Index (migration 0086) |
| `smog_index` | real | SMOG Index (migration 0086) |
| `dale_chall_readability_score` | real | Dale-Chall Readability Score (migration 0086) |
| `linsear_write_formula` | real | Linsear Write Formula score (migration 0086) |
| `reading_grade_level` | varchar(50) | Consensus reading grade level label (migration 0086) |
| `difficult_word_count` | integer | Count of difficult/uncommon words (migration 0086) |
| `word_count` | integer | Total word count (migration 0086) |
| `sentence_count` | integer | Total sentence count (migration 0086) |
| `exclude_from_analysis` | boolean | Exclude from all LLM analysis pipelines (default false, migration 0068) |
| `excluded_at` | timestamp | When the document was excluded (migration 0068) |
| `excluded_by` | varchar(255) | Who excluded the document (migration 0068) |
| `excluded_reason` | text | Reason for exclusion (migration 0068) |

**Indexes:** `idx_gd_catalog_id` (unique, partial), `idx_gd_text_path` (unique, partial — migration 0059), `idx_gd_agency`, `idx_gd_doc_type`, `idx_gd_canonical_ref` (partial), `idx_gd_status`, `idx_gd_search` (GIN), `idx_gd_year`, `idx_gd_policy_category` (partial), `idx_guidance_exclude_from_analysis` (partial, migration 0068)

**Classification pipeline** (`--classify --execute`, 5 passes):
1. **Attachments**: title regex for attachment/appendix/enclosure → `is_attachment = true`
2. **Doc type mapping**: `doc_type` → `policy_category` (e.g. ADM → policy_directive, INF → informational)
3. **Title overrides**: reclassify docs with non-policy titles regardless of doc_type (EIS, master plans, clinical reports, reference guides, trail plans → `reference_material`)
4. **Title fallbacks**: classify remaining `unclassified` (doc_type='other') by title patterns (license lists → data_dump, forms → non_policy, etc.)
5. **Raw PDF detection**: docs whose content starts with `%PDF-` (never text-extracted) → `data_dump`

**Regex scan** (`--regex-scan`): scans eligible docs (policy_directive + informational, non-attachment, with text content) against 42 compliance issue regex patterns from `prompts/compliance_issues.yaml`. Dry-run by default (output only). Use `--regex-scan --execute` to save matches to `compliance_issues` table via `guidance_document_id` FK (migration 0057).

**Pipeline:** `cd backend && python3 -m scripts.guidance_pipeline`

## cross_references

Internal cross-references between regulatory documents and guidance documents (e.g., "18 NYCRR 505.14" or "section 624.8 of this Part").

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigserial | Primary key |
| `source_document_id` | bigint | FK to regulatory_documents (ON DELETE CASCADE) — nullable, see CHECK constraint |
| `source_guidance_id` | bigint | FK to guidance_documents (ON DELETE CASCADE) — nullable, see CHECK constraint |
| `ref_type` | varchar(50) NOT NULL | `nycrr`, `njac`, `ny_short_form`, `same_section` |
| `raw_text` | text NOT NULL | Exact matched text from regulation |
| `normalized_citation` | text NOT NULL | Cleaned citation for lookup |
| `start_offset` | integer | Character offset where match starts |
| `end_offset` | integer | Character offset where match ends |
| `context_before` | text | ~50 chars before match for display |
| `context_after` | text | ~50 chars after match for display |
| `components` | jsonb | Parsed components (title, section, scope, etc.) |
| `target_document_id` | bigint | FK to regulatory_documents (ON DELETE SET NULL) |
| `target_guidance_id` | bigint | FK to guidance_documents (ON DELETE SET NULL) |
| `is_resolved` | boolean | Whether citation was resolved to a target doc |
| `resolution_notes` | text | Why resolution failed (for unresolved refs) |
| `jurisdiction` | varchar(3) NOT NULL | NY, NJ, or NYC |
| `source_jurisdiction` | varchar(3) NOT NULL | Jurisdiction of the source document (NY, NJ, NYC) |
| `target_jurisdiction` | varchar(3) | Jurisdiction of the target document (nullable — unresolved refs may lack this) |
| `created_at` | timestamp | When record was created |

**Reference Types:**
- `nycrr`: Full-form NY references (e.g., "18 NYCRR 505.14")
- `njac`: Full-form NJ references (e.g., "N.J.A.C. 8:43-1.2")
- `ny_short_form`: Context-dependent NY references (e.g., "section 624.8 of this Part")
- `same_section`: Internal references (e.g., "paragraph (a) of this section")

**Components JSONB Structure:**
```json
{
  "title": "18",
  "section": "505.14",
  "section_base": "505",
  "chapter": null,
  "scope": "Part",           // For short-form: Part, Subpart, Title
  "requires_context": true,  // For short-form refs
  "subsection_ref": "(a)",   // For same-section refs
  "is_relative": true,       // For same-section refs
  "state": "NY"
}
```

**Constraints:**
- `chk_crossref_source CHECK ((source_document_id IS NOT NULL)::int + (source_guidance_id IS NOT NULL)::int = 1)` — exactly one source must be set
- `chk_crossref_target CHECK ((target_document_id IS NOT NULL)::int + (target_guidance_id IS NOT NULL)::int <= 1)` — at most one target
- `chk_cr_jurisdiction CHECK (jurisdiction IN ('NY', 'NJ', 'NYC'))`
- `chk_crossref_source_jurisdiction CHECK (source_jurisdiction IN ('NY', 'NJ', 'NYC'))`
- `chk_crossref_target_jurisdiction CHECK (target_jurisdiction IN ('NY', 'NJ', 'NYC'))`
- `cross_references_source_document_id_raw_text_offset_key UNIQUE(source_document_id, raw_text, start_offset)` - allows same text at different positions

**Indexes:** `idx_crossrefs_source_doc`, `idx_crossrefs_target_doc`, `idx_crossrefs_state`, `idx_crossrefs_ref_type`, `idx_crossrefs_unresolved` (partial: WHERE is_resolved = FALSE), `idx_cross_references_normalized_citation`, `idx_crossrefs_source_jurisdiction`, `idx_crossrefs_cross_jurisdiction` (partial: WHERE source != target)

**Abbreviated References:**
For comma-separated citation lists like "N.J.A.C. 7:1A-3.1, 4.1, 5.1", each abbreviated section gets its own row:
- `raw_text`: Just the abbreviated text (e.g., "4.1")
- `normalized_citation`: Full inferred citation (e.g., "N.J.A.C. 7:1A-4.1")
- `components.is_abbreviated`: true
- `components.inferred_from`: Parent citation it was inferred from

## document_notes

User annotations on regulations with optional text anchoring.

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigserial | Primary key |
| `document_id` | bigint NOT NULL | FK to regulatory_documents |
| `note_type` | note_type enum | anchored, document |
| `anchor_start_offset` | integer | Character offset for text anchoring |
| `anchor_end_offset` | integer | End offset for anchored text |
| `anchor_text` | text | The selected text (for validation) |
| `content` | text NOT NULL | Note content |
| `author_name` | varchar(255) | Who wrote it |
| `jurisdiction` | varchar(3) NOT NULL | NY, NJ, or NYC (CHECK constraint) |
| `created_at` | timestamp | When created |
| `updated_at` | timestamp | When last updated |

**Constraints:** `chk_document_notes_jurisdiction CHECK (jurisdiction IN ('NY', 'NJ', 'NYC'))`

## bookmarks

User bookmarks for pipeline analyses, regulatory documents, guidance documents, and fines/fees/penalties. Supports bookmarking:
- A specific analysis (document + issue type)
- A regulatory document without a specific analysis
- A guidance document
- A fine/fee/penalty

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigserial | Primary key |
| `document_id` | bigint | FK to regulatory_documents (ON DELETE CASCADE) - nullable |
| `analysis_id` | bigint | FK to compliance_issue_analyses (ON DELETE CASCADE) - null for document/guidance/fine bookmarks |
| `guidance_document_id` | bigint | FK to guidance_documents (ON DELETE CASCADE) - null for regulatory doc/fine bookmarks |
| `fine_id` | bigint | FK to fines_fees_penalties (ON DELETE CASCADE) - null for non-fine bookmarks |
| `issue_type` | varchar(50) | Denormalized from analysis for filtering (null for document/guidance/fine bookmarks) |
| `jurisdiction` | varchar(3) NOT NULL | NY, NJ, or NYC (CHECK constraint) |
| `notes` | text | Optional user notes explaining why bookmarked |
| `created_by` | varchar(255) | Who created the bookmark |
| `created_at` | timestamp | When bookmark was created |
| `updated_at` | timestamp | When last updated |

**Bookmark Types:**
- **Analysis bookmark**: `analysis_id` set, `document_id` auto-filled from analysis
- **Document bookmark**: `document_id` set, `analysis_id` null, `guidance_document_id` null, `fine_id` null
- **Guidance bookmark**: `guidance_document_id` set, `document_id` null, `analysis_id` null, `fine_id` null
- **Fine bookmark**: `fine_id` set, all others null

**Constraints:**
- `chk_bookmarks_jurisdiction CHECK (jurisdiction IN ('NY', 'NJ', 'NYC'))`
- `chk_bookmarks_source_type CHECK ((fine_id IS NOT NULL AND document_id IS NULL AND guidance_document_id IS NULL) OR (fine_id IS NULL AND (document_id IS NOT NULL OR guidance_document_id IS NOT NULL)))`

**Indexes:**
- `idx_bookmarks_unique_analysis UNIQUE(analysis_id)` - one bookmark per analysis
- `idx_bookmarks_unique_document UNIQUE(document_id) WHERE analysis_id IS NULL` - one document bookmark per doc
- `idx_bookmarks_unique_guidance_document UNIQUE(guidance_document_id) WHERE guidance_document_id IS NOT NULL AND analysis_id IS NULL` - one guidance bookmark per doc
- `idx_bookmarks_unique_fine UNIQUE(fine_id) WHERE fine_id IS NOT NULL` - one bookmark per fine
- `idx_bookmarks_document`, `idx_bookmarks_analysis`, `idx_bookmarks_guidance_document`, `idx_bookmarks_fine`, `idx_bookmarks_state`, `idx_bookmarks_created_at`

## marker_groups

User-defined colored tag groups for organizing bookmarks. Supports predefined (seeded) and custom (user-created) groups, with optional jurisdiction scoping.

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigserial | Primary key |
| `name` | varchar(100) NOT NULL | Display name (e.g. "Easy Win", "Priority") |
| `color` | varchar(7) | Hex color code, default `#6b7280` |
| `icon` | varchar(50) | Optional icon name (nullable, currently unused) |
| `jurisdiction` | varchar(3) | NULL = global, or 'NY'/'NJ'/'NYC' for jurisdiction-specific |
| `sort_order` | integer | Display ordering, default 0 |
| `is_custom` | boolean | false = predefined seed data, true = user-created |
| `category` | varchar(30) | Marker category (e.g. 'triage' for triage quick-tags), NULL for regular markers |
| `created_by` | varchar(255) | Who created the group |
| `created_at` | timestamptz | When created |
| `updated_at` | timestamptz | When last updated |

**Seed data:** Easy Win (#22c55e), Needs Review (#d97706, triage), Legal Question (#ef4444), Report Draft (#3b82f6), Priority (#8b5cf6), Confirmed (#16a34a, triage), Incorrect (#dc2626, triage)

**Constraints:** `uq_marker_groups_name_jurisdiction UNIQUE(name, COALESCE(jurisdiction, '__global__'))` - unique names per jurisdiction scope

**Migration:** `0088_marker_groups.sql`, `0090_triage_marker_groups.sql`

## bookmark_markers

Many-to-many junction between bookmarks and marker_groups. Assigns colored tags to bookmarks.

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigserial | Primary key |
| `bookmark_id` | bigint NOT NULL | FK to bookmarks (ON DELETE CASCADE) |
| `marker_group_id` | bigint NOT NULL | FK to marker_groups (ON DELETE CASCADE) |
| `created_at` | timestamptz | When assigned |

**Constraints:** `uq_bookmark_markers UNIQUE(bookmark_id, marker_group_id)`

**Indexes:** `idx_bookmark_markers_bookmark_id`, `idx_bookmark_markers_marker_group_id`

## document_tags

Flexible tagging for scan scoping. Tags use a flat namespace with prefixes.

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigserial | Primary key |
| `document_id` | bigint NOT NULL | FK to regulatory_documents (ON DELETE CASCADE) |
| `tag` | varchar(100) NOT NULL | Tag string (e.g., `scan:compliance`, `topic:childcare`) |
| `created_at` | timestamptz | When tag was added |
| `created_by` | varchar(100) | Who/what added the tag |

**Tag conventions:**
- `scan:compliance` — include in compliance issue scanning
- `scan:summarize` — include in summarization pipeline
- `topic:childcare` — relates to childcare regulation
- `topic:permitting` — relates to permitting/building regulation
- `priority:high` — high priority for analysis

**Constraints:** `UNIQUE(document_id, tag)`

**Indexes:** `idx_document_tags_tag`, `idx_document_tags_document_id`

**Usage:** `scan_compliance_issues.py --state nyc --tag scan:compliance` filters to only tagged documents.

## prompt_feedback

Stores user feedback on LLM prompts defined in `prompts/core.yaml`.

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigserial | Primary key |
| `prompt_name` | varchar(100) NOT NULL | Key in prompts/core.yaml |
| `feedback_type` | feedback_type enum | suggestion, bug, question, other |
| `content` | text NOT NULL | Feedback content |
| `highlighted_text` | text | Optional: specific part of template |
| `author_name` | varchar(255) | Who submitted |
| `created_at` | timestamp | When submitted |
| `updated_at` | timestamp | Last updated |

## llm_api_cache

Caches LLM API responses to avoid redundant calls across pipeline runs. Used by research pipeline, Barrier pipeline, and summarization.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key (gen_random_uuid()) |
| `request_hash` | text NOT NULL UNIQUE | SHA-256 of canonical request params (model, system, messages, tools, tool_choice, max_tokens) |
| `pipeline` | text | `research`, `barrier`, `summarization`, etc. |
| `tier` | integer | 1, 2, 3, or NULL |
| `document_id` | bigint | FK to regulatory_documents (nullable) |
| `model` | text NOT NULL | LLM model used |
| `request_body` | jsonb NOT NULL | Full request payload |
| `response_body` | jsonb NOT NULL | Full response payload |
| `input_tokens` | integer | Input token count |
| `output_tokens` | integer | Output token count |
| `cache_read_tokens` | integer | Anthropic prompt cache read tokens |
| `cache_write_tokens` | integer | Anthropic prompt cache write tokens |
| `stale_after` | timestamptz | NULL = never stale |
| `created_at` | timestamptz | When cached |
| `prompt_hash` | text | Hash of just the prompt template |

**Implementation:** `backend/lib/cache.py` (CacheManager class). Integrated into `run_batch_tier()` and `run_realtime_tier()` in `lib/batch.py`. Enabled by default; disable with `--no-cache` CLI flag.

**Indexes:** `llm_api_cache_request_hash_key` (unique on `request_hash`), `idx_cache_semantic` (`pipeline`, `tier`), `idx_cache_document` (`document_id`), `idx_cache_stale` (partial on `stale_after` WHERE NOT NULL)

## Tables Without Drizzle Definitions

The following tables exist in the database (created by migrations) but are intentionally **not** defined in the Drizzle schema. Do not add them to Drizzle — they are accessed via raw SQL only.

| Table / Column | Migration | Why No Drizzle Definition | Used By |
|----------------|-----------|---------------------------|---------|
| `llm_api_cache` | 0052 | Python-only table, accessed via raw SQL | `backend/lib/cache.py` (CacheManager class) |
| `compliance_issue_analysis_reviews` | 0026 | Created but **currently unused** — no code reads or writes to this table | Nothing (dead table) |
| `search_vector` on `regulatory_documents` | 0044 | Trigger-maintained tsvector column, queried via raw SQL full-text search | SQL triggers + raw queries |
| `search_vector` on `statutes` | 0044 | Trigger-maintained tsvector column | SQL triggers + raw queries |
| `search_vector` on `compliance_issue_analyses` | 0044 | Trigger-maintained tsvector column | SQL triggers + raw queries |
| `search_vector` on `guidance_documents` | 0054, 0058 | Trigger-maintained tsvector column; 0058 fixes trigger to fire on all column updates (not just title/content) while conditionally recomputing search_vector | SQL triggers + raw queries |
| Guidance-related indexes on `compliance_issues` | 0057b | `idx_ci_guidance_document`, `idx_ci_unique_reg`, `idx_ci_unique_guidance` — created CONCURRENTLY to avoid write locks | Raw SQL (partial unique indexes) |

**Note:** `compliance_issue_analysis_reviews` was designed for per-tier review tracking but was superseded by the `review_status`/`reviewed_by` fields added directly to `compliance_issue_analyses` in PR 6.3. It remains in the database as a dead table.

## Enum Types

```sql
CREATE TYPE note_type AS ENUM ('anchored', 'document');
CREATE TYPE feedback_type AS ENUM ('suggestion', 'bug', 'question', 'other');
```

## Views

### document_hierarchy

Parent-child relationships:
```sql
SELECT p.id as parent_id, p.title as parent_title, p.hierarchy_level as parent_level,
       c.id as child_id, c.title as child_title, c.hierarchy_level as child_level
FROM regulatory_documents p
JOIN regulatory_documents c ON c.parent_id = p.id;
```

## Helper Functions

### natural_sort_num(text) → integer

Extracts numeric prefix from alphanumeric string for natural sorting.
- `"24A"` → `24`
- `"100"` → `100`
- `"Part 3"` → `3`
- `""` or `NULL` → `0`

### natural_sort_alpha(text) → text

Extracts alpha suffix from alphanumeric string for natural sorting.
- `"24A"` → `"A"`
- `"100"` → `""`
- `"3B"` → `"B"`

**Usage in ORDER BY (handles both NY and NJ):**
```sql
ORDER BY
  natural_sort_num(COALESCE(rd.nycrr_part, rd.njac_chapter)) NULLS LAST,
  natural_sort_alpha(COALESCE(rd.nycrr_part, rd.njac_chapter)) NULLS LAST,
  natural_sort_num(COALESCE(rd.nycrr_section, rd.njac_subchapter, rd.njac_section)) NULLS LAST,
  natural_sort_alpha(COALESCE(rd.nycrr_section, rd.njac_subchapter, rd.njac_section)) NULLS LAST,
  natural_sort_num(regexp_replace(rd.title, '^[^0-9]*', '', 'g')) NULLS LAST,
  rd.title NULLS LAST
```

This ensures "Chapter 2" sorts before "Chapter 11" and "Section 24A" sorts between "24" and "25".

## share_tokens

One-time shareable authentication tokens for granting temporary site access.

| Column | Type | Description |
|--------|------|-------------|
| `id` | serial | Primary key |
| `token` | text | Cryptographically random 64-character hex string (from 32 random bytes) |
| `used` | boolean | Whether this token has been consumed (default: false) |
| `created_at` | timestamp | When the token was generated |
| `used_at` | timestamp | When the token was first used (nullable) |

**Purpose:**
- Allows authenticated users to generate shareable links for one-time site access
- Each token can only be used once - after consumption, it's marked as used
- Tokens never expire based on time, only on usage
- Used tokens are kept in the database for audit trail

**Workflow:**
1. Authenticated user clicks "Share" button in header
2. System generates cryptographically random token via `generateShareToken()` server action
3. Token stored in database with `used = false`
4. User shares link: `https://example.com/auth?token={token}`
5. Recipient visits link → system validates token via `validateShareToken()`
6. If valid and unused: mark `used = true`, set `used_at = NOW()`, authenticate user
7. If invalid or already used: show error and password form

**Indexes:**
- `idx_share_tokens_token` - Fast token lookup
- `idx_share_tokens_used` - Query used/unused tokens

**Constraints:**
- `token` is UNIQUE
- Both columns have NOT NULL constraints

**Security:**
- Tokens are 64-character hex strings (256 bits of entropy)
- Generated using Node.js `crypto.randomBytes(32)`
- Validation happens server-side in auth actions
- Client-side auth guard is intentionally lightweight (can be bypassed via devtools, but that's acceptable per requirements)
