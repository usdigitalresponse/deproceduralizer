# Deproceduralizer Database Skill

This skill provides instructions for connecting to and querying the Deproceduralizer Neon PostgreSQL database.

## Maintenance

**When `schema.sql` changes, update this file to reflect the new schema.**

To check what tables/views currently exist in the database:
```bash
./scripts/db-query.sh list-tables
```

## Quick Access

Run database queries using the helper script:

```bash
# Full profile
./scripts/db-query.sh profile

# Table counts
./scripts/db-query.sh tables

# Schema info (all tables)
./scripts/db-query.sh schema

# Key stats
./scripts/db-query.sh stats

# List all tables and views
./scripts/db-query.sh list-tables

# Describe a specific table (columns, constraints, row count)
./scripts/db-query.sh describe regulatory_documents

# Show indexes on a table
./scripts/db-query.sh indexes regulatory_documents

# Show sample rows from a table
./scripts/db-query.sh sample red_flags

# Show all foreign key relationships
./scripts/db-query.sh fkeys

# Custom query
./scripts/db-query.sh "SELECT * FROM regulatory_documents LIMIT 5"
```

## Database Connection

- **Type**: Neon PostgreSQL (serverless)
- **Host**: `ep-REDACTED-pooler.c-3.us-east-1.aws.neon.tech`
- **Database**: `neondb`
- **Connection**: Via `DATABASE_URL` in `.env`

## Schema Reference

### regulatory_documents

Main table storing regulatory document data with hierarchy information. **50 columns total** - use `./scripts/db-query.sh describe regulatory_documents` to see all.

**Core columns:**

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigserial | Primary key |
| `source_index` | integer | Index from source data |
| `type` | varchar(50) | Document type (e.g., TITLE, PART, SECTION) |
| `state` | varchar(2) | State code (NY, NJ) |
| `title` | text | Document title |
| `url` | text | Source URL |
| `url_type` | varchar(50) | Type of URL |
| `content` | text | Full document content |
| `created_at` | timestamp | Creation timestamp |
| `parent_id` | bigint | FK to parent document |
| `hierarchy_level` | varchar(50) | Level in hierarchy |
| `hierarchy_path` | text | Full path in hierarchy |
| `scraped_from_url` | text | Original URL scraped from |

**NYCRR columns (New York):** `nycrr_title`, `nycrr_title_name`, `nycrr_subtitle`, `nycrr_subtitle_name`, `nycrr_chapter`, `nycrr_chapter_name`, `nycrr_subchapter`, `nycrr_subchapter_name`, `nycrr_article`, `nycrr_article_name`, `nycrr_part`, `nycrr_part_name`, `nycrr_subpart`, `nycrr_subpart_name`, `nycrr_section`, `nycrr_section_name`

**NJAC columns (New Jersey):** `njac_title`, `njac_title_name`, `njac_subtitle`, `njac_subtitle_name`, `njac_chapter`, `njac_chapter_name`, `njac_subchapter`, `njac_subchapter_name`, `njac_article`, `njac_article_name`, `njac_part`, `njac_part_name`, `njac_subpart`, `njac_subpart_name`, `njac_section`, `njac_section_name`

**Precomputed stats (for hierarchy performance):**

| Column | Type | Description |
|--------|------|-------------|
| `direct_child_count` | integer | Count of direct children |
| `descendant_count` | integer | Count of all descendants |
| `descendant_flag_count` | integer | Sum of red flags in subtree |
| `descendant_max_severity` | integer | Max severity in subtree |
| `has_descendant_analysis` | boolean | Whether any descendant has analysis |

> **⚠️ Important:** These fields are denormalized for performance and must be recomputed after data imports or when parent_id relationships change. See [Recomputing Hierarchy Stats](#recomputing-hierarchy-stats) section below.

**Unique Constraint**: `(state, source_index, type)`

### analyses

Analysis results for regulatory documents.

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigserial | Primary key |
| `document_id` | bigint | FK to regulatory_documents |
| `analyzed_at` | timestamp | When analysis was performed |
| `model_version` | varchar(100) | LLM model used |
| `has_implementation_issues` | boolean | Flag for implementation issues |
| `overall_complexity` | varchar(10) | LOW, MEDIUM, MEDIUM-HIGH, HIGH |
| `summary` | text | Analysis summary |
| `requires_technical_review` | boolean | Needs technical review |
| `has_reporting_requirement` | boolean | Has reporting requirements |
| `max_severity` | integer | Highest red flag severity (1-10) |
| `num_flags` | integer | Number of red flags |
| `is_current` | boolean | True if latest analysis |

**Important**: Always filter by `is_current = true` for latest analysis.

### red_flags

Individual red flags identified during analysis.

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigserial | Primary key |
| `analysis_id` | bigint | FK to analyses |
| `category` | varchar(100) | Red flag category |
| `explanation` | text | Detailed explanation |
| `severity` | integer | Severity score (1-10) |
| `complexity` | varchar(20) | Complexity rating |
| `matched_phrases` | text[] | Phrases that triggered flag |
| `implementation_approach` | text | Suggested approach |
| `effort_estimate` | varchar(255) | Estimated effort |
| `text_examples` | text[] | Example text excerpts |
| `review_status` | varchar(50) | unreviewed, confirmed, false_positive, needs_context, deferred |
| `reviewed_by` | varchar(255) | Reviewer identifier |
| `reviewed_at` | timestamp | Review timestamp |
| `reviewer_notes` | text | Reviewer comments |
| `priority` | integer | Assigned priority |
| `impact_type` | varchar(100) | cost_savings, time_savings, accessibility, etc. |
| `developer_status` | varchar(50) | unresolved, resolved, pending, backlogged, need_more_info |
| `developer_assigned` | varchar(50) | Developer name (Michael or Abigail) |
| `developer_notes` | text | Notes from developer |
| `resolution_type` | varchar(50) | implemented or not_implemented (when resolved) |
| `resolution_comments` | text | Comments about the resolution |
| `developer_question` | text | Question for reviewer (when need_more_info) |
| `developer_checked_at` | timestamp | When developer last checked this item |

### statute_references

Statute citations for documents.

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigserial | Primary key |
| `document_id` | bigint | FK to regulatory_documents |
| `usc_citations` | text[] | US Code citations |
| `cfr_citations` | text[] | CFR citations |
| `public_laws` | text[] | Public law references |
| `acts` | text[] | Act references |
| `state_title` | text | State title |
| `state_section` | text | State section |

### definitions

Extracted terms and definitions from regulations.

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigserial | Primary key |
| `document_id` | bigint | FK to regulatory_documents |
| `term` | text | The term being defined |
| `definition` | text | The definition text |
| `scope` | text | Scope/applicability (e.g., "in this section") |
| `definition_overlap` | float | 0.0-1.0 overlap with regulation text |
| `source_location` | text | Where in the document it was found |
| `model_version` | varchar(100) | LLM model used for extraction |
| `extracted_at` | timestamp | When extracted |
| `notes` | text | Additional notes |

### definition_extraction_log

Tracks which regulations have been processed for definition extraction.

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigserial | Primary key |
| `source_index` | integer | Which regulation was processed |
| `processed_at` | timestamp | When processed |
| `model_version` | varchar(100) | Model used |
| `definitions_found` | integer | Count of definitions extracted |

**Unique Constraint**: `source_index`

### compliance_issues

Tracks specific compliance requirements (wet signatures, in-person, paper forms, etc.).

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigserial | Primary key |
| `document_id` | bigint | FK to regulatory_documents |
| `issue_type` | varchar(50) | 'wet_signature', 'in_person', 'paper_form', etc. |
| `term_matched` | varchar(255) | Term/phrase that triggered match |
| `context` | text | Full context snippet |
| `requirement_quote` | text | The requirement text |
| `from_statute` | boolean | Whether from statute vs regulation |
| `statute_citation` | varchar(255) | Citation if applicable |
| `llm_confirmed` | boolean | Whether LLM confirmed it |
| `review_status` | varchar(50) | unreviewed, confirmed, false_positive, etc. |
| `reviewed_by` | varchar(255) | Reviewer identifier |
| `reviewed_at` | timestamp | Review timestamp |
| `reviewer_notes` | text | Reviewer comments |
| `priority` | integer | Priority ranking |
| `impact_type` | varchar(100) | Type of impact |
| `developer_status` | varchar(50) | unresolved, resolved, pending, backlogged, need_more_info |
| `developer_assigned` | varchar(50) | Developer name (Michael or Abigail) |
| `developer_notes` | text | Notes from developer |
| `resolution_type` | varchar(50) | implemented or not_implemented (when resolved) |
| `resolution_comments` | text | Comments about the resolution |
| `developer_question` | text | Question for reviewer (when need_more_info) |
| `developer_checked_at` | timestamp | When developer last checked this item |
| `state` | varchar(2) | 'NY' or 'NJ' |
| `created_at` | timestamp | Creation timestamp |

### definition_extractions (Legacy)

Earlier definition extraction implementation. May be deprecated.

| Column | Type | Description |
|--------|------|-------------|
| `id` | serial | Primary key |
| `filename` | text | Source filename |
| `title` | text | Document title |
| `url` | text | Source URL |
| `nycrr_title` | integer | NYCRR title number |
| `nycrr_part` | text | NYCRR part |
| `nycrr_section` | text | NYCRR section |
| `topics` | text[] | Extracted topics |
| `extraction_count` | integer | Number of extractions |
| `raw_response` | jsonb | Raw LLM response |
| `created_at` | timestamp | Creation timestamp |

### extracted_definitions (Legacy)

Definitions from the legacy extraction system. May be deprecated.

| Column | Type | Description |
|--------|------|-------------|
| `id` | serial | Primary key |
| `extraction_id` | integer | FK to definition_extractions |
| `term` | text | The defined term |
| `definition` | text | The definition text |
| `created_at` | timestamp | Creation timestamp |

## Views

### latest_analyses

Joins documents with their current analysis (where `is_current = true`).

```sql
SELECT d.*, a.id as analysis_id, a.analyzed_at, a.has_implementation_issues,
       a.overall_complexity, a.requires_technical_review, a.has_reporting_requirement,
       a.num_flags, a.max_severity, a.summary
FROM regulatory_documents d
LEFT JOIN analyses a ON d.id = a.document_id AND a.is_current = TRUE;
```

### document_hierarchy

Parent-child relationships between documents.

```sql
SELECT p.id as parent_id, p.title as parent_title, p.hierarchy_level as parent_level,
       c.id as child_id, c.title as child_title, c.hierarchy_level as child_level
FROM regulatory_documents p
JOIN regulatory_documents c ON c.parent_id = p.id;
```

## Common Queries

### Document Statistics

```sql
-- Count by state
SELECT state, COUNT(*) FROM regulatory_documents GROUP BY state;

-- Count by hierarchy level
SELECT hierarchy_level, COUNT(*) FROM regulatory_documents GROUP BY hierarchy_level;

-- Documents without analysis
SELECT COUNT(*) FROM regulatory_documents rd
WHERE NOT EXISTS (SELECT 1 FROM analyses a WHERE a.document_id = rd.id);
```

### Analysis Queries

```sql
-- Analysis coverage
SELECT
    COUNT(*) as total,
    SUM(CASE WHEN a.id IS NOT NULL THEN 1 ELSE 0 END) as analyzed
FROM regulatory_documents rd
LEFT JOIN analyses a ON rd.id = a.document_id AND a.is_current = true;

-- High severity documents
SELECT rd.id, rd.title, a.max_severity, a.num_flags
FROM regulatory_documents rd
JOIN analyses a ON rd.id = a.document_id AND a.is_current = true
WHERE a.max_severity >= 7
ORDER BY a.max_severity DESC;

-- Complexity distribution
SELECT overall_complexity, COUNT(*)
FROM analyses WHERE is_current = true
GROUP BY overall_complexity;
```

### Red Flag Queries

```sql
-- By severity
SELECT severity, COUNT(*) FROM red_flags GROUP BY severity ORDER BY severity DESC;

-- By category
SELECT category, COUNT(*) FROM red_flags GROUP BY category ORDER BY COUNT(*) DESC;

-- Unreviewed high-severity flags
SELECT rf.*, a.document_id
FROM red_flags rf
JOIN analyses a ON rf.analysis_id = a.id
WHERE rf.review_status = 'unreviewed' AND rf.severity >= 7;

-- Review status breakdown
SELECT review_status, COUNT(*) FROM red_flags GROUP BY review_status;
```

### Hierarchy Queries

```sql
-- Root documents (titles)
SELECT * FROM regulatory_documents WHERE parent_id IS NULL AND state = 'NY';

-- Children of a document
SELECT * FROM regulatory_documents WHERE parent_id = 123;

-- Ancestor chain (breadcrumbs)
WITH RECURSIVE ancestors AS (
    SELECT * FROM regulatory_documents WHERE id = 456
    UNION ALL
    SELECT rd.* FROM regulatory_documents rd
    JOIN ancestors a ON rd.id = a.parent_id
)
SELECT * FROM ancestors ORDER BY id;
```

## ORM Access

The codebase uses Drizzle ORM. Access via:

```typescript
import { db, RegulatoryDocumentsRepository, RedFlagsRepository } from '@deproceduralizer/database';

// Using repositories
const docsRepo = new RegulatoryDocumentsRepository(db);
const flagsRepo = new RedFlagsRepository(db);

// Get document with analysis
const doc = await docsRepo.getByIdWithAnalysis(123);

// Get dashboard stats
const stats = await docsRepo.getDashboardStats('NY');
```

## Key Files

- Schema: `frontend/packages/database/src/schema/`
- Client: `frontend/packages/database/src/client.ts`
- Repositories: `frontend/packages/database/src/repositories/`
- Server Actions: `frontend/apps/web/src/lib/actions/`

## Recomputing Hierarchy Stats

The precomputed hierarchy statistics in `regulatory_documents` must be refreshed after:
- Data imports or scraping runs
- Changes to `parent_id` relationships
- New analyses are added

**When to recompute:** If the browse page shows titles without expand arrows that should have children, or flag counts seem wrong.

**How to check for issues:**
```sql
-- Check for mismatched child counts
SELECT state, COUNT(*) as mismatches
FROM (
  SELECT rd.id, rd.state, rd.direct_child_count,
    (SELECT COUNT(*) FROM regulatory_documents c WHERE c.parent_id = rd.id) as actual
  FROM regulatory_documents rd
) rd
WHERE rd.direct_child_count != rd.actual
GROUP BY state;
```

**Run these queries in order to recompute all stats:**

```bash
# Step 1: Update direct_child_count
./scripts/db-query.sh "UPDATE regulatory_documents rd SET direct_child_count = (SELECT COUNT(*) FROM regulatory_documents c WHERE c.parent_id = rd.id)"

# Step 2: Update descendant_count
./scripts/db-query.sh "WITH descendant_counts AS (
  SELECT rd.id, (
    WITH RECURSIVE descendants AS (
      SELECT id FROM regulatory_documents WHERE parent_id = rd.id
      UNION ALL
      SELECT c.id FROM regulatory_documents c JOIN descendants d ON c.parent_id = d.id
    ) SELECT COUNT(*) FROM descendants
  ) as cnt
  FROM regulatory_documents rd WHERE rd.direct_child_count > 0
)
UPDATE regulatory_documents rd SET descendant_count = dc.cnt FROM descendant_counts dc WHERE rd.id = dc.id"

# Step 3: Update flag stats for non-leaf nodes
./scripts/db-query.sh "WITH flag_stats AS (
  SELECT rd.id,
    (WITH RECURSIVE descendants AS (
      SELECT id FROM regulatory_documents WHERE id = rd.id UNION ALL
      SELECT c.id FROM regulatory_documents c JOIN descendants d ON c.parent_id = d.id
    ) SELECT COALESCE(SUM(a.num_flags), 0) FROM analyses a WHERE a.is_current = true AND a.document_id IN (SELECT id FROM descendants)) as total_flags,
    (WITH RECURSIVE descendants AS (
      SELECT id FROM regulatory_documents WHERE id = rd.id UNION ALL
      SELECT c.id FROM regulatory_documents c JOIN descendants d ON c.parent_id = d.id
    ) SELECT MAX(a.max_severity) FROM analyses a WHERE a.is_current = true AND a.document_id IN (SELECT id FROM descendants)) as max_sev,
    (WITH RECURSIVE descendants AS (
      SELECT id FROM regulatory_documents WHERE id = rd.id UNION ALL
      SELECT c.id FROM regulatory_documents c JOIN descendants d ON c.parent_id = d.id
    ) SELECT EXISTS(SELECT 1 FROM analyses a WHERE a.is_current = true AND a.document_id IN (SELECT id FROM descendants))) as has_analysis
  FROM regulatory_documents rd WHERE rd.direct_child_count > 0
)
UPDATE regulatory_documents rd SET descendant_flag_count = fs.total_flags, descendant_max_severity = fs.max_sev, has_descendant_analysis = fs.has_analysis FROM flag_stats fs WHERE rd.id = fs.id"

# Step 4: Update flag stats for leaf nodes
./scripts/db-query.sh "UPDATE regulatory_documents rd SET
  descendant_flag_count = COALESCE(a.num_flags, 0),
  descendant_max_severity = a.max_severity,
  has_descendant_analysis = (a.id IS NOT NULL)
FROM (
  SELECT rd2.id, a2.id, a2.num_flags, a2.max_severity
  FROM regulatory_documents rd2
  LEFT JOIN analyses a2 ON a2.document_id = rd2.id AND a2.is_current = true
  WHERE rd2.direct_child_count = 0
) a WHERE rd.id = a.id"
```

See also: `schema.sql` contains the full SQL queries with detailed comments.
