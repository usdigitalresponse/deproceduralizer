# Schema Reference

## regulatory_documents

Main table with hierarchy. **50 columns** - use `./scripts/db-query.sh describe regulatory_documents` for full list.

**Core columns:**

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigserial | Primary key |
| `source_index` | integer | Index from source data |
| `type` | varchar(50) | TITLE, PART, SECTION, etc. |
| `state` | varchar(2) | NY, NJ (CHECK constraint) |
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

**Regulatory status (for reserved/repealed/recodified sections):**

| Column | Type | Description |
|--------|------|-------------|
| `regulatory_status` | varchar(20) | 'active' (default), 'reserved', 'repealed', 'recodified', or 'expired' |
| `recodified_to` | varchar(100) | Target citation where content moved (e.g., "16:44-3.2") |

**Indexes**: `idx_documents_regulatory_status`, `idx_documents_regulatory_status_state`

**Detection**: Run `python backend/scripts/detect_regulatory_status.py` to populate from title patterns.

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
| `review_status` | varchar(50) | unreviewed, confirmed, rejected_clear_fp, rejected_not_obvious_bad, needs_context, deferred |
| `justification_notes` | text | Justification and analysis for the model |
| `team_notes` | text | Notes for development team |
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
| `justification_notes` | text | Justification and analysis for the model (required if correcting) |
| `team_notes` | text | Notes for development team |
| `original_values` | jsonb | Original LLM values when corrections are made |

**Review Status Values (Definitions):**
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

Tracks compliance issues found in regulations (wet signatures, mail-only submission, etc.). Each (document_id, issue_type) pair is analyzed once - records are created for ALL analyzed documents (not just confirmed issues) to track what's been scanned.

**From regex scan:**

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigserial | Primary key |
| `document_id` | bigint | FK to regulatory_documents |
| `issue_type` | varchar(50) | `wet_signature`, `mail_only`, `fax`, etc. |
| `matched_pattern` | varchar(255) | Regex pattern that triggered scan (e.g., `"bear.{0,10}signature"`) |
| `matched_context` | text | ~600 char text window around the regex match |
| `url` | text | Link to the regulation |

**From LLM analysis:**

| Column | Type | Description |
|--------|------|-------------|
| `requirement_found` | boolean | Did LLM find an actual requirement? (not a false positive from regex) |
| `requirement_text` | text | The specific text creating the requirement |
| `required_by_statute` | boolean | `true` = statute mandates, `false` = agency added, `null` = unknown |
| `severity` | integer (1-10) | How problematic is this requirement |
| `impact_assessment` | text | LLM explanation of why this is/isn't problematic |

**Human review:**

| Column | Type | Description |
|--------|------|-------------|
| `review_status` | varchar(50) | `unreviewed`, `confirmed`, `rejected_false_positive` |
| `reviewer_notes` | text | Human explanation of review decision |

**Metadata:**

| Column | Type | Description |
|--------|------|-------------|
| `state` | varchar(2) | NY or NJ |
| `created_at` | timestamp | When record was created |

**Unique Constraint**: `(document_id, issue_type)` - one record per document per issue type

**Issue Types** (40 types defined in `compliance_issues.yaml`):
- Communication: `wet_signature`, `mail_only`, `certified_mail`, `fax`, `landline`, `obsolete_comm`
- Payment: `check_payment`, `cash_only`, `no_credit_cards`, `in_person_payment`
- Signatures: `notarization`, `witness`, `embossed_seal`, `original_document`
- Physical presence: `in_person_submission`, `in_person_pickup`, `in_person_hearing`, `physical_forms`
- Technology: `obsolete_media`, `obsolete_software`, `pdf_only`, `microfiche`, `typewriter`
- And more...

## incorporations_by_reference

Tracks external standards incorporated by reference (NFPA codes, ICC codes, ASTM standards, CFR references, etc.). Extracted from compliance_issues into dedicated table per GitHub issue #49.

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigserial | Primary key |
| `document_id` | bigint | FK to regulatory_documents |
| `incorporated_document` | text | Name of incorporated document (e.g., "International Building Code/2021") |
| `source_organization` | varchar(100) | Publisher (e.g., "ICC", "NFPA", "ANSI", "ASTM", "CFR") |
| `version` | varchar(50) | Version/edition (e.g., "2021", "2020 edition") |
| `requirement_quote` | text | Exact quote from regulation |
| `term_matched` | varchar(255) | Regex pattern that matched |
| `context` | text | Context snippet around match |
| `llm_confirmed` | boolean | Always true for saved records |
| `state` | varchar(2) | NY or NJ |
| `url` | text | Source URL (NOT NULL) |
| `review_status` | varchar(50) | unreviewed, confirmed, false_positive, etc. |
| `reviewed_by` | varchar(255) | Who reviewed |
| `reviewed_at` | timestamp | When reviewed |
| `justification_notes` | text | Reviewer notes |
| `team_notes` | text | Notes for development team |
| `priority` | integer | Priority level |
| `developer_status` | varchar(50) | unresolved, resolved, pending, backlogged, need_more_info |
| `developer_assigned` | varchar(50) | Michael or Abigail |
| `developer_notes` | text | Developer notes |
| `resolution_type` | varchar(50) | implemented or not_implemented (CHECK constraint) |
| `resolution_comments` | text | Resolution comments |
| `developer_question` | text | Question for reviewer |
| `developer_checked_at` | timestamp | When developer checked |
| `created_at` | timestamp | When record was created |

**Indexes:** `idx_ibr_document`, `idx_ibr_organization`, `idx_ibr_llm_confirmed`, `idx_ibr_review_status`, `idx_ibr_state`, `idx_ibr_developer_status`

**Detection:** Run `python backend/scripts/ibr_scanner.py --state nj` to scan and populate.

**Patterns detected:** "incorporated by reference", NFPA, ASTM, ANSI, IEEE, API, UL, International Building/Fire/Mechanical/Plumbing/Energy/Residential Code.

## statute_references

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigserial | Primary key |
| `document_id` | bigint | FK to regulatory_documents |
| `usc_citations` | text[] | US Code citations |
| `cfr_citations` | text[] | CFR citations |
| `public_laws` | text[] | Public law references |
| `acts` | text[] | Act references |

## statutes

Stores statute content (N.J.S.A., etc.) - separate from regulatory_documents.
Hierarchy: Title → Chapter → Section (for NJ statutes).

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigserial | Primary key |
| `citation` | varchar(50) | Full citation (e.g., "52:27D-119" for sections, "title:52" for titles, "52:27D" for chapters) |
| `state` | varchar(2) | NY, NJ (CHECK constraint) |
| `title` | text | Human-readable title/name |
| `content` | text | Full text content (for sections) |
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

**Unique Constraint**: `(state, citation)`

**Hierarchy:**
- **Titles** (68): `citation = "title:52"`, `hierarchy_level = "title"`, `parent_id = NULL`
- **Chapters** (1,891): `citation = "52:27D"`, `hierarchy_level = "chapter"`, `parent_id = title.id`
- **Sections** (54,800+): `citation = "52:27D-119"`, `hierarchy_level = "section"`, `parent_id = chapter.id`

**Population:** Run `python backend/scripts/nj_statutes.py` to parse and populate.

## regulation_statute_links

Many-to-many crosswalk between regulations and statutes. Tracks all citations including unmatched/obsolete ones.

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigserial | Primary key |
| `regulation_id` | bigint | FK to regulatory_documents |
| `statute_id` | bigint | FK to **statutes** (nullable for unmatched) |
| `citation` | varchar(50) | Citation as found in text (e.g., "52:27D-119") |
| `context` | text | Surrounding text where citation was found |
| `link_type` | varchar(50) | Auto-detected: `enabling_authority`, `definition`, `requirement`, `reference` |
| `match_status` | varchar(50) | `matched`, `corrected`, `unmatched`, `obsolete` |
| `original_citation` | varchar(50) | If corrected, what was originally in text |
| `correction_notes` | text | Why correction was made |
| `reviewed_at` | timestamp | When reviewed |
| `reviewed_by` | varchar(255) | Who reviewed |

**Unique Constraint**: `(regulation_id, citation)`

**Match Status Values:**
- `matched` - Citation found exact match in statutes table
- `corrected` - Subsection letter stripped (e.g., `52:14B-1e` → `52:14B-1`), `original_citation` has original text
- `obsolete` - Chapter exists but section not found (auto-detected likely repealed), `correction_notes` explains
- `unmatched` - No matching statute found and chapter doesn't exist (may be typo or different system)

**Link Type Detection (regex-based):**
- `enabling_authority` - "pursuant to", "CHAPTER AUTHORITY:", "established pursuant to"
- `definition` - "as defined in/by", "means ... N.J.S.A."
- `requirement` - "as required by", "in accordance with", "subject to"
- `reference` - default for general mentions

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
