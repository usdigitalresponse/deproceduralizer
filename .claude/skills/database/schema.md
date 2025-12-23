# Schema Reference

## regulatory_documents

Main table with hierarchy. **50 columns** - use `./scripts/db-query.sh describe regulatory_documents` for full list.

**Core columns:**

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigserial | Primary key |
| `source_index` | integer | Index from source data |
| `type` | varchar(50) | TITLE, PART, SECTION, etc. |
| `state` | varchar(2) | NY, NJ |
| `title` | text | Document title |
| `url` | text | Source URL |
| `content` | text | Full document content |
| `parent_id` | bigint | FK to parent document |
| `hierarchy_level` | varchar(50) | Level in hierarchy |
| `hierarchy_path` | text | Full path in hierarchy |

**State-specific columns:**
- NYCRR: `nycrr_title`, `nycrr_title_name`, `nycrr_chapter`, `nycrr_part`, `nycrr_section`, etc.
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

**Unique Constraint**: `(state, source_index, type)`

## analyses

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigserial | Primary key |
| `document_id` | bigint | FK to regulatory_documents |
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

**Always filter by `is_current = true` for latest analysis.**

## red_flags

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigserial | Primary key |
| `analysis_id` | bigint | FK to analyses |
| `category` | varchar(100) | Constrained to 12 values (see below) |
| `explanation` | text | Detailed explanation |
| `severity` | integer | 1-10 |
| `complexity` | varchar(20) | Complexity rating |
| `matched_phrases` | text[] | Trigger phrases |
| `implementation_approach` | text | Suggested approach |
| `review_status` | varchar(50) | unreviewed, confirmed, false_positive, needs_context, deferred |
| `developer_status` | varchar(50) | unresolved, resolved, pending, backlogged, need_more_info |
| `developer_assigned` | varchar(50) | Michael or Abigail |

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

**Constraint**: `valid_category` CHECK enforces these 12 values.

## definitions

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigserial | Primary key |
| `document_id` | bigint | FK to regulatory_documents |
| `url` | text | Source URL |
| `term` | text | Term being defined |
| `verbatim_text` | text | Exact text from regulation |
| `is_verbatim` | boolean | Whether verbatim_text is complete |
| `rephrased_definition` | text | Plain-language definition |
| `scope` | text | Applicability scope text |
| `scope_level` | varchar(20) | Hierarchy level: section/part/chapter/title |
| `scope_document_id` | bigint | FK to regulatory_documents (scope entity) |
| `definition_type` | varchar(20) | formal or abbreviation |
| `normalized_term` | text | GENERATED: LOWER(TRIM(term)) |
| `is_cross_reference` | boolean | Points to another source |
| `definition_overlap` | float | 0.0-1.0 overlap with regulation |
| `source_location` | text | Where found in document |
| `model_version` | varchar(100) | LLM model used |
| `extracted_at` | timestamp | When extracted |
| `notes` | text | General notes |
| `review_status` | varchar(50) | unreviewed, confirmed, corrected, false_positive |
| `reviewed_at` | timestamp | When reviewed |
| `reviewer_name` | varchar(255) | Who reviewed |
| `correction_reason` | text | Why correction was made (required if correcting) |
| `model_feedback` | text | Feedback to improve future LLM extractions |
| `original_values` | jsonb | Original LLM values when corrections are made |

**Review Status Values:**
- `unreviewed` - Default, not yet reviewed
- `confirmed` - LLM extraction was correct
- `corrected` - Fields were edited/corrected
- `false_positive` - Not actually a definition

**Indexes:** `idx_definitions_scope_document`, `idx_definitions_scope_level`, `idx_definitions_normalized_term`, `idx_definitions_type`, `idx_definitions_review_status`

## definition_document_occurrences

Many-to-many join table tracking where definition terms actually appear in document text.
Uses word-boundary matching ('applicant' matches 'Applicant' but not 'reapplicant').

| Column | Type | Description |
|--------|------|-------------|
| `definition_id` | bigint | FK to definitions (composite PK) |
| `document_id` | bigint | FK to regulatory_documents (composite PK) |
| `created_at` | timestamp | When link was created |

**Primary Key**: `(definition_id, document_id)` - composite

**Indexes:** `idx_def_doc_occurrences_definition`, `idx_def_doc_occurrences_document`

**Difference from scope-based applicability:**
- `definitions.scope_document_id` = where definition APPLIES (hierarchy-based)
- `definition_document_occurrences` = where term ACTUALLY APPEARS in text

**Population:** Run `python link_definitions.py run --state NY` or integrated into `batch_definitions.py` pipeline.

## compliance_issues

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigserial | Primary key |
| `document_id` | bigint | FK to regulatory_documents |
| `issue_type` | varchar(50) | wet_signature, in_person, paper_form |
| `term_matched` | varchar(255) | Trigger term |
| `context` | text | Context snippet |
| `requirement_quote` | text | Requirement text |
| `from_statute` | boolean | From statute vs regulation |
| `llm_confirmed` | boolean | LLM confirmed |
| `review_status` | varchar(50) | unreviewed, confirmed, false_positive |
| `state` | varchar(2) | NY or NJ |

## statute_references

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigserial | Primary key |
| `document_id` | bigint | FK to regulatory_documents |
| `usc_citations` | text[] | US Code citations |
| `cfr_citations` | text[] | CFR citations |
| `public_laws` | text[] | Public law references |
| `acts` | text[] | Act references |

## regulation_statute_links

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigserial | Primary key |
| `regulation_id` | bigint | FK to regulatory_documents (regulation) |
| `statute_id` | bigint | FK to regulatory_documents (statute) |
| `citation` | varchar(50) | Citation (e.g., "52:27D-119") |
| `context` | text | Surrounding text |
| `link_type` | varchar(50) | enabling_authority, reference, amendment |

**Unique Constraint**: `(regulation_id, statute_id, citation)`

## definition_extraction_log

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigserial | Primary key |
| `source_index` | integer | Which regulation processed |
| `processed_at` | timestamp | When processed |
| `model_version` | varchar(100) | Model used |
| `definitions_found` | integer | Count extracted |

**Unique Constraint**: `source_index`

## Views

### latest_analyses

Documents with current analysis:
```sql
SELECT d.*, a.id as analysis_id, a.analyzed_at, a.has_implementation_issues,
       a.overall_complexity, a.num_flags, a.max_severity, a.summary
FROM regulatory_documents d
LEFT JOIN analyses a ON d.id = a.document_id AND a.is_current = TRUE;
```

### document_hierarchy

Parent-child relationships:
```sql
SELECT p.id as parent_id, p.title as parent_title,
       c.id as child_id, c.title as child_title
FROM regulatory_documents p
JOIN regulatory_documents c ON c.parent_id = p.id;
```

## prompt_feedback

Stores user feedback on LLM prompts defined in `prompts.yaml`.

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigserial | Primary key |
| `prompt_name` | varchar(100) | Key in prompts.yaml (e.g., 'red_flags_analysis') |
| `feedback_type` | feedback_type enum | suggestion, bug, question, other |
| `content` | text | Feedback content |
| `highlighted_text` | text | Optional: specific part of template |
| `author_name` | varchar(255) | Who submitted |
| `created_at` | timestamp | When submitted |
| `updated_at` | timestamp | Last updated |

**Indexes**: `prompt_name`, `created_at DESC`, `feedback_type`

## Legacy Tables

- `definition_extractions` - Earlier extraction implementation
- `extracted_definitions` - Definitions from legacy system
