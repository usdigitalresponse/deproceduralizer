# Schema Reference

## regulatory_documents

Main table with hierarchy. **73 columns** - use `./scripts/db-query.sh describe regulatory_documents` for full list.

**Core columns:**

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigserial | Primary key |
| `source_index` | integer | Index from source data |
| `type` | varchar(50) | regulation or policy_document |
| `state` | varchar(2) | NY, NJ (CHECK constraint) |
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

**Precomputed stats (denormalized):**

| Column | Type | Description |
|--------|------|-------------|
| `direct_child_count` | integer | Direct children count |
| `descendant_count` | integer | All descendants count |
| `descendant_flag_count` | integer | Sum of red flags in subtree |
| `descendant_max_severity` | integer | Max severity in subtree |
| `has_descendant_analysis` | boolean | Any descendant has analysis |
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
- `chk_rd_state CHECK (state IN ('NY', 'NJ'))`
- `unique_per_url UNIQUE(url)`

**Indexes:** `idx_documents_state`, `idx_documents_type`, `idx_documents_state_type`, `idx_documents_parent`, `idx_documents_hierarchy_level`, `idx_documents_regulatory_status`, `idx_documents_url`, `idx_documents_short_title`, `idx_documents_exclude_from_analysis` (partial), `idx_rd_keywords` (GIN), `idx_rd_applies_to` (GIN), `idx_rd_section_type` (partial), `idx_rd_has_form` (partial), `idx_rd_has_ibr` (partial)

## analyses

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigserial | Primary key |
| `document_id` | bigint | FK to regulatory_documents (nullable) |
| `url` | text NOT NULL | Source URL (for legacy linking) |
| `analyzed_at` | timestamp | When analyzed |
| `model_version` | varchar(100) | LLM model used |
| `has_implementation_issues` | boolean | Has issues |
| `overall_complexity` | varchar(10) | LOW, MEDIUM, MEDIUM-HIGH, HIGH |
| `summary` | text | Analysis summary |
| `requires_technical_review` | boolean | Needs tech review |
| `has_reporting_requirement` | boolean | Has reporting |
| `max_severity` | integer | Highest severity (1-10) |
| `num_flags` | integer | Number of red flags |
| `is_current` | boolean | Latest analysis flag |

**Indexes:** `idx_analyses_url`, `idx_analyses_one_current_per_document` (unique partial - ensures one current per doc)

**Always filter by `is_current = true` for latest analysis.**

## red_flags

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigserial | Primary key |
| `analysis_id` | bigint | FK to analyses |
| `category` | varchar(100) | Constrained to 12 values (see below) |
| `explanation` | text | Detailed explanation |
| `severity` | integer | 1-10 |
| `complexity` | varchar(20) | HIGH/MEDIUM/LOW/MEDIUM-HIGH |
| `matched_phrases` | text[] | Trigger phrases |
| `implementation_approach` | text | Suggested approach |
| `effort_estimate` | varchar(255) | Effort estimate |
| `text_examples` | text[] | Example text from regulation |
| `review_status` | varchar(50) | unreviewed, confirmed, etc. |
| `reviewed_by` | varchar(255) | Who reviewed |
| `reviewed_at` | timestamp | When reviewed |
| `justification_notes` | text | Justification for the model |
| `team_notes` | text | Notes for development team |
| `priority` | integer | Priority ranking |
| `impact_type` | varchar(100) | Type of impact |
| `developer_status` | varchar(50) | unresolved, resolved, pending, backlogged, need_more_info |
| `developer_assigned` | varchar(50) | Michael or Abigail |
| `developer_notes` | text | Notes from developer |
| `resolution_type` | varchar(50) | implemented or not_implemented |
| `resolution_comments` | text | Resolution details |
| `developer_question` | text | Question for reviewer |
| `developer_checked_at` | timestamp | When developer last checked |

**Valid Categories (12 - Jennifer Pahlka framework):**
- `administrative_burdens`
- `cascade_of_rigidity`
- `complexity_policy_debt`
- `frozen_technology`
- `implementation_opportunity`
- `mandated_steps_not_outcomes`
- `no_feedback_loops`
- `options_become_requirements`
- `overwrought_legalese`
- `policy_implementation_separation`
- `process_worship_oversight`
- `zero_risk_language`

**Constraints:** `valid_category`, `red_flags_severity_check`, `chk_rf_resolution_type`

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

Tracks compliance issues found in regulations (wet signatures, mail-only submission, etc.).

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigserial | Primary key |
| `document_id` | bigint NOT NULL | FK to regulatory_documents |
| `issue_type` | varchar(50) | `wet_signature`, `mail_only`, `fax`, etc. |
| `occurrence_number` | integer | 1, 2, 3... for multiple issues of same type per document |
| `matched_pattern` | varchar(255) | Regex pattern that triggered scan |
| `matched_context` | text NOT NULL | Text window around the regex match |
| `url` | text | Link to the regulation |
| `requirement_found` | boolean | Did LLM find an actual requirement? |
| `requirement_text` | text | The specific text creating the requirement |
| `is_verbatim` | boolean | True if requirement_text is verbatim from regulation, False if paraphrased, NULL for legacy records |
| `required_by_statute` | boolean | true = statute mandates, false = agency added, null = unknown |
| `statute_citation` | varchar(255) | Citation to statute if applicable |
| `severity` | integer (1-10) | How problematic is this requirement |
| `impact_assessment` | text | LLM explanation of impact |
| `review_status` | varchar(50) | `unreviewed`, `confirmed`, `false_positive`, etc. |
| `reviewed_by` | varchar(255) | Who reviewed it |
| `reviewed_at` | timestamp | When reviewed |
| `justification_notes` | text | Justification for the model |
| `team_notes` | text | Notes for development team (replaced reviewer_notes) |
| `original_severity` | integer (1-10) | LLM's original severity (preserved on first review) |
| `impact_type` | varchar(100) | Type of impact |
| `developer_status` | varchar(50) | `unresolved`, `resolved`, `pending`, `backlogged`, `need_more_info` |
| `developer_assigned` | varchar(50) | Michael or Abigail |
| `developer_notes` | text | Notes from developer |
| `resolution_type` | varchar(50) | `implemented` or `not_implemented` |
| `resolution_comments` | text | Comments about the resolution |
| `developer_question` | text | Question for reviewer |
| `developer_checked_at` | timestamp | When developer last checked |
| `state` | varchar(2) NOT NULL | NY or NJ |
| `created_at` | timestamp | When record was created |

**Constraints:** `compliance_issues_severity_check`, `compliance_issues_state_check`, `unique_document_issue_occurrence UNIQUE(document_id, issue_type, occurrence_number)`

**Issue Types** (41 types defined in `prompts/compliance_issues.yaml`)

### Compliance Issue Filtering

#### LLM Confirmation Status
- `requirement_found = true`: LLM confirmed this is a real compliance issue (has `severity` 1-10)
- `requirement_found = false`: LLM analyzed the regex match but found no actual issue (`severity` is NULL)

The `requirement_found` field indicates whether the LLM found a genuine compliance issue after analyzing the regex-matched context. When `false`, the `requirement_text` field contains an explanation of why no issue was found.

#### Where Filtering is Applied

| Location | Shows | Filter |
|----------|-------|--------|
| Browse tree badges | Confirmed only | `requirement_found = TRUE` |
| Dashboard stats | Confirmed only | `requirement_found = TRUE` |
| Table view counts | Confirmed only | Uses precomputed columns |
| Review mode | All issues | No filter (for QA review) |

Review mode intentionally shows ALL issues (including LLM-rejected matches) so users can verify the LLM's reasoning and identify any false negatives.

#### Precomputed Columns

The following columns on `regulatory_documents` store compliance issue counts:
- `compliance_issue_count`: Direct confirmed issues on this document
- `descendant_compliance_issue_count`: Confirmed issues in all descendant documents

These are updated by `refresh_compliance_stats()` in `backend/shared_utils.py` and only count issues where `requirement_found = TRUE`.

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
| `state` | varchar(2) NOT NULL | NY or NJ |
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

**Constraints:** `chk_ibr_state`, `chk_ibr_resolution_type`

## statutes

Stores statute content (N.J.S.A., etc.) - separate from regulatory_documents.
Hierarchy: Title → Chapter → Section (for NJ statutes).

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigserial | Primary key |
| `citation` | varchar(50) NOT NULL | Full citation (e.g., "52:27D-119") |
| `state` | varchar(2) NOT NULL | NY, NJ (default 'NJ') |
| `title` | text NOT NULL | Human-readable title/name |
| `content` | text NOT NULL | Full text content (for sections) |
| `njsa_title` | varchar(10) | Title number |
| `njsa_title_name` | text | Title name |
| `njsa_chapter` | varchar(20) | Chapter number |
| `njsa_section` | varchar(20) | Section number |
| `njsa_section_name` | text | Section name |
| `parent_id` | bigint | FK to parent statute (self-referencing) |
| `hierarchy_level` | varchar(50) | title, chapter, section |
| `hierarchy_path` | text | Full path for display |
| `source_index` | integer | Index from parsing process |
| `created_at` | timestamp | When created |

**Constraints:** `chk_statutes_state`, `statutes_state_citation_key UNIQUE(state, citation)`

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

## cross_references

Internal cross-references between regulatory documents (e.g., "18 NYCRR 505.14" or "section 624.8 of this Part").

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigserial | Primary key |
| `source_document_id` | bigint NOT NULL | FK to regulatory_documents (ON DELETE CASCADE) |
| `ref_type` | varchar(50) NOT NULL | `nycrr`, `njac`, `ny_short_form`, `same_section` |
| `raw_text` | text NOT NULL | Exact matched text from regulation |
| `normalized_citation` | text NOT NULL | Cleaned citation for lookup |
| `start_offset` | integer | Character offset where match starts |
| `end_offset` | integer | Character offset where match ends |
| `context_before` | text | ~50 chars before match for display |
| `context_after` | text | ~50 chars after match for display |
| `components` | jsonb | Parsed components (title, section, scope, etc.) |
| `target_document_id` | bigint | FK to regulatory_documents (ON DELETE SET NULL) |
| `is_resolved` | boolean | Whether citation was resolved to a target doc |
| `resolution_notes` | text | Why resolution failed (for unresolved refs) |
| `state` | varchar(2) NOT NULL | NY or NJ |
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
- `cross_references_state_check CHECK (state IN ('NY', 'NJ'))`
- `cross_references_source_document_id_raw_text_key UNIQUE(source_document_id, raw_text)`

**Indexes:** `idx_crossrefs_source_doc`, `idx_crossrefs_target_doc`, `idx_crossrefs_state`, `idx_crossrefs_ref_type`, `idx_crossrefs_unresolved` (partial: WHERE is_resolved = FALSE)

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
| `state` | varchar(2) NOT NULL | NY or NJ |
| `created_at` | timestamp | When created |
| `updated_at` | timestamp | When last updated |

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

## Enum Types

```sql
CREATE TYPE note_type AS ENUM ('anchored', 'document');
CREATE TYPE feedback_type AS ENUM ('suggestion', 'bug', 'question', 'other');
```

## Views

### latest_analyses

Documents with current analysis:
```sql
SELECT d.*, a.id as analysis_id, a.analyzed_at, a.has_implementation_issues,
       a.overall_complexity, a.requires_technical_review, a.has_reporting_requirement,
       a.num_flags, a.max_severity, a.summary
FROM regulatory_documents d
LEFT JOIN analyses a ON d.id = a.document_id AND a.is_current = TRUE;
```

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
