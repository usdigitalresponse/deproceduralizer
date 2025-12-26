-- New York & New Jersey Regulatory Analysis Database Schema
-- Stores regulations from Cornell Law and LLM-generated red flag analysis results.
-- Hierarchy: Title -> Subtitle -> Chapter -> Subchapter -> Article -> Part -> Subpart -> Section
--
-- IMPORTANT: This schema reflects the actual production database state.
-- Run ./scripts/db-query.sh profile to verify against live database.

CREATE TABLE regulatory_documents (
  id BIGSERIAL PRIMARY KEY,
  source_index INTEGER,                -- Index from scraping process, used for ordering and deduplication
  type VARCHAR(50) NOT NULL,           -- 'regulation' or 'policy_document'
  state VARCHAR(2),                    -- Two-letter state code (e.g., 'NY', 'NJ')
  title TEXT NOT NULL,                 -- Human-readable title of the regulation
  url TEXT,                            -- Source URL from Cornell Law
  url_type VARCHAR(50),                -- 'regulation' (section) or 'title' (container)
  content TEXT NOT NULL,               -- Full text content
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Hierarchy fields
  parent_id BIGINT REFERENCES regulatory_documents(id) ON DELETE SET NULL,  -- FK to parent document
  hierarchy_level VARCHAR(50),         -- Position in tree: title/subtitle/chapter/subchapter/article/part/subpart/section
  hierarchy_path TEXT,                 -- Full path for hierarchy URLs (e.g., "title-18/part-433")

  -- Parsed NYCRR citation components (extracted from page breadcrumbs) - New York
  nycrr_title INTEGER,                 -- Title number (1-23)
  nycrr_part VARCHAR(50),              -- Part number
  nycrr_section VARCHAR(50),           -- Section number
  nycrr_subpart VARCHAR(50),           -- Subpart number
  nycrr_title_name TEXT,               -- Title name (e.g., "SOCIAL SERVICES")
  nycrr_subtitle VARCHAR(50),          -- Subtitle identifier (e.g., "A")
  nycrr_subtitle_name TEXT,            -- Subtitle name
  nycrr_chapter VARCHAR(50),           -- Chapter identifier (e.g., "II")
  nycrr_chapter_name TEXT,             -- Chapter name (e.g., "Medical Assistance")
  nycrr_subchapter VARCHAR(50),        -- Subchapter identifier (e.g., "C")
  nycrr_subchapter_name TEXT,          -- Subchapter name
  nycrr_article VARCHAR(50),           -- Article identifier (e.g., "2")
  nycrr_article_name TEXT,             -- Article name
  nycrr_part_name TEXT,                -- Part name
  nycrr_subpart_name TEXT,             -- Subpart name
  nycrr_section_name TEXT,             -- Section name
  scraped_from_url TEXT,               -- Original URL the content was scraped from

  -- Parsed NJAC citation components - New Jersey
  njac_title VARCHAR(50),              -- Title number
  njac_title_name TEXT,                -- Title name
  njac_subtitle VARCHAR(50),           -- Subtitle identifier
  njac_subtitle_name TEXT,             -- Subtitle name
  njac_chapter VARCHAR(50),            -- Chapter identifier
  njac_chapter_name TEXT,              -- Chapter name
  njac_subchapter VARCHAR(50),         -- Subchapter identifier
  njac_subchapter_name TEXT,           -- Subchapter name
  njac_article VARCHAR(50),            -- Article identifier
  njac_article_name TEXT,              -- Article name
  njac_part VARCHAR(50),               -- Part number
  njac_part_name TEXT,                 -- Part name
  njac_subpart VARCHAR(50),            -- Subpart number
  njac_subpart_name TEXT,              -- Subpart name
  njac_section VARCHAR(50),            -- Section number
  njac_section_name TEXT,              -- Section name

  -- Precomputed hierarchy statistics (for performance)
  -- IMPORTANT: These fields are denormalized for query performance and must be
  -- recomputed after data imports or when parent_id relationships change.
  -- See "Recomputing Hierarchy Stats" section at the end of this file for SQL.
  direct_child_count INTEGER DEFAULT 0,        -- Count of direct children
  descendant_count INTEGER DEFAULT 0,          -- Count of all descendants
  descendant_flag_count INTEGER DEFAULT 0,     -- Sum of red flags in subtree
  descendant_max_severity INTEGER,             -- Max severity in subtree
  has_descendant_analysis BOOLEAN DEFAULT FALSE, -- Whether any descendant has analysis
  compliance_issue_count INTEGER DEFAULT 0,    -- Count of compliance issues for this document
  descendant_compliance_issue_count INTEGER DEFAULT 0,  -- Sum of compliance issues in subtree

  -- Parsed NJSA citation components - New Jersey Statutes (when document references statutes)
  njsa_title VARCHAR(50),              -- Title number
  njsa_title_name TEXT,                -- Title name
  njsa_chapter VARCHAR(50),            -- Chapter identifier
  njsa_section VARCHAR(50),            -- Section number
  njsa_section_name TEXT,              -- Section name
  njsa_citation VARCHAR(50),           -- Full citation (e.g., "52:27D-119")

  -- Display helpers
  short_title TEXT,                    -- Abbreviated title for display
  level_identifier TEXT,               -- Identifier at current level (e.g., "3A:52-1.1")
  citation TEXT,                       -- Full citation string for display

  -- Regulatory status (for reserved/repealed/recodified/expired sections)
  regulatory_status VARCHAR(50) DEFAULT 'active',  -- 'active', 'reserved', 'repealed', 'recodified', 'expired'
  recodified_to VARCHAR(100),                      -- Where content moved (e.g., "N.J.A.C. 16:44-3.2")

  -- Exclusion from analysis
  exclude_from_analysis BOOLEAN DEFAULT FALSE,     -- Whether to exclude from red flag/compliance analysis
  excluded_at TIMESTAMP,                           -- When it was excluded
  excluded_by VARCHAR(255),                        -- Who excluded it
  excluded_reason TEXT,                            -- Why it was excluded

  CONSTRAINT unique_per_url UNIQUE(url)
);

CREATE TABLE analyses (
  id BIGSERIAL PRIMARY KEY,
  analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  model_version VARCHAR(100),          -- LLM model used for analysis
  has_implementation_issues BOOLEAN DEFAULT FALSE,  -- TRUE if any red flags found
  overall_complexity VARCHAR(10),      -- HIGH/MEDIUM/LOW
  summary TEXT,                        -- LLM-generated summary of findings
  requires_technical_review BOOLEAN DEFAULT FALSE,  -- TRUE if needs technical review
  has_reporting_requirement BOOLEAN DEFAULT FALSE,  -- TRUE if creates reporting requirements
  max_severity INTEGER,                -- Highest severity among red flags (1-10)
  num_flags INTEGER DEFAULT 0,         -- Count of red flags
  is_current BOOLEAN DEFAULT TRUE,     -- TRUE for most recent analysis per document
  url TEXT NOT NULL,                   -- Source URL (used for joining with regulatory_documents)
  document_id BIGINT REFERENCES regulatory_documents(id) ON DELETE CASCADE  -- FK to document (nullable, populated via URL matching)
);

CREATE TABLE red_flags (
  id BIGSERIAL PRIMARY KEY,
  analysis_id BIGINT NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  category VARCHAR(100) NOT NULL       -- Type of implementation concern (12 categories from Jennifer Pahlka's framework)
    CHECK (category IN (
      'administrative_burdens',
      'cascade_of_rigidity',
      'complexity_policy_debt',
      'frozen_technology',
      'implementation_opportunity',
      'mandated_steps_not_outcomes',
      'no_feedback_loops',
      'options_become_requirements',
      'overwrought_legalese',
      'policy_implementation_separation',
      'process_worship_oversight',
      'zero_risk_language'
    )),
  explanation TEXT NOT NULL,           -- Why this is flagged
  severity INTEGER NOT NULL CHECK (severity >= 1 AND severity <= 10),  -- Impact severity (1-10)
  complexity VARCHAR(20) NOT NULL,     -- HIGH/MEDIUM/LOW/MEDIUM-HIGH for this specific issue
  matched_phrases TEXT[] DEFAULT '{}', -- Key phrases from regulation that triggered flag
  implementation_approach TEXT NOT NULL,  -- Suggested approach to address
  effort_estimate VARCHAR(255),        -- Estimated effort to implement
  text_examples TEXT[] DEFAULT '{}',   -- Direct quotes as evidence

  -- Review fields
  review_status VARCHAR(50) DEFAULT 'unreviewed',  -- 'unreviewed', 'confirmed', 'false_positive', 'needs_context', 'deferred'
  reviewed_by VARCHAR(255),            -- Name/ID of reviewer
  reviewed_at TIMESTAMP,               -- When flag was reviewed
  team_notes TEXT,                     -- Notes for development team
  priority INTEGER,                    -- Priority ranking for announcing
  impact_type VARCHAR(100),            -- Type of impact: 'cost_savings', 'time_savings', 'accessibility', etc.

  -- Developer tracking fields
  developer_status VARCHAR(50) DEFAULT 'unresolved',  -- 'unresolved', 'resolved', 'pending', 'backlogged', 'need_more_info'
  developer_assigned VARCHAR(50),      -- 'Michael' or 'Abigail'
  developer_notes TEXT,                -- Notes from developer
  resolution_type VARCHAR(50),         -- 'implemented' or 'not_implemented' (when resolved)
  resolution_comments TEXT,            -- Comments about the resolution
  developer_question TEXT,             -- Question for reviewer (when need_more_info)
  developer_checked_at TIMESTAMP,      -- When developer last checked this item
  justification_notes TEXT             -- Justification and analysis for the model
);

CREATE TABLE statute_references (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES regulatory_documents(id) ON DELETE CASCADE,
  usc_citations TEXT,                  -- United States Code citations
  cfr_citations TEXT,                  -- Code of Federal Regulations citations
  public_laws TEXT,                    -- Public Law references
  acts TEXT,                           -- Named federal acts
  state_title VARCHAR(100),            -- NY State law title
  state_section VARCHAR(100)           -- Section within state law
);

-- Statutes: Stores statute content (N.J.S.A., N.Y. State laws, etc.)
-- Separate from regulatory_documents because statutes have different structure
-- Hierarchy: Title -> Chapter -> Section (for NJ statutes)
CREATE TABLE statutes (
  id BIGSERIAL PRIMARY KEY,
  citation VARCHAR(50) NOT NULL,       -- Full citation (e.g., "52:27D-119" for sections, "title:52" for titles)
  state VARCHAR(2) NOT NULL DEFAULT 'NJ',  -- Two-letter state code (e.g., 'NJ')
  title TEXT NOT NULL,                 -- Human-readable title/name
  content TEXT NOT NULL,               -- Full text content (for sections)

  -- NJ-specific fields (NJSA - New Jersey Statutes Annotated)
  njsa_title VARCHAR(50),              -- Title number (e.g., "52")
  njsa_title_name TEXT,                -- Title name (e.g., "STATE GOVERNMENT")
  njsa_chapter VARCHAR(50),            -- Chapter number (e.g., "27D")
  njsa_section VARCHAR(50),            -- Section number (e.g., "119")
  njsa_section_name TEXT,              -- Section name

  -- Hierarchy for tree navigation
  hierarchy_level VARCHAR(50),         -- 'title', 'chapter', 'section'
  hierarchy_path TEXT,                 -- Full path for display
  source_index INTEGER,                -- Index from parsing process
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  parent_id BIGINT REFERENCES statutes(id) ON DELETE SET NULL,

  -- Unique constraint on state + citation
  CONSTRAINT unique_state_citation UNIQUE(state, citation)
);

-- Regulation-Statute Links: Many-to-many relationship between regulations and statutes
-- Tracks all statute citations found in regulations, including unmatched/obsolete ones
CREATE TABLE regulation_statute_links (
  id BIGSERIAL PRIMARY KEY,
  regulation_id BIGINT NOT NULL REFERENCES regulatory_documents(id) ON DELETE CASCADE,
  statute_id BIGINT REFERENCES statutes(id) ON DELETE CASCADE,  -- Nullable for unmatched citations
  citation VARCHAR(50) NOT NULL,       -- The citation as found in text (e.g., "52:27D-119")
  context TEXT,                        -- Surrounding text where citation was found
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Match status tracking
  match_status VARCHAR(50) DEFAULT 'matched',  -- 'matched', 'corrected', 'unmatched', 'obsolete'
  original_citation VARCHAR(50),       -- If corrected, what was originally in the text
  correction_notes TEXT,               -- Why correction was made

  -- Review tracking
  reviewed_at TIMESTAMP,
  reviewed_by VARCHAR(255),

  -- Link classification (auto-detected via regex patterns)
  link_type VARCHAR(50) DEFAULT 'reference',  -- 'enabling_authority', 'definition', 'requirement', 'reference'

  CONSTRAINT unique_regulation_statute_link UNIQUE(regulation_id, citation)
);

-- Definitions table: Extracted terms and definitions from regulations
--
-- Definition text fields:
-- - verbatim_text: The exact text extracted from the regulation (always populated)
-- - is_verbatim_text_complete: True if verbatim_text is a complete, usable definition
-- - rephrased_definition: Plain-language definition when verbatim_text is insufficient
--
-- For display purposes, use verbatim_text when is_verbatim_text_complete=true, otherwise
-- use rephrased_definition (fallback to verbatim_text if null).
CREATE TABLE definitions (
  id BIGSERIAL PRIMARY KEY,
  term TEXT NOT NULL,                  -- The term being defined
  verbatim_text TEXT NOT NULL,         -- The definition text as extracted (exact text from regulation)
  scope TEXT,                          -- Scope/applicability (e.g., "in this section", "in this part")
  definition_overlap FLOAT DEFAULT 0.0,  -- Overlap metric (0.0-1.0) based on edit distance
  source_location TEXT,                -- Source location (e.g., "section 1.1", "definitions section")
  model_version VARCHAR(100),          -- LLM model used for extraction
  extracted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,                          -- Any additional notes about the definition
  url TEXT NOT NULL,                   -- Source URL for linking to regulatory_documents
  document_id BIGINT REFERENCES regulatory_documents(id) ON DELETE CASCADE,  -- FK to document (nullable)

  -- Structured scope level (enables percolation, filtering, conflict detection)
  scope_level VARCHAR(50),             -- section, subpart, part, subchapter, chapter, subtitle, title
  scope_document_id BIGINT REFERENCES regulatory_documents(id) ON DELETE SET NULL,  -- FK to document this definition applies to

  -- Definition classification
  definition_type VARCHAR(50) DEFAULT 'formal',  -- 'formal', 'abbreviation'

  -- Normalized term for aggregation and deduplication
  normalized_term TEXT,                -- LOWER(TRIM(term)) - generated by application

  -- Cross-reference tracking
  is_cross_reference BOOLEAN DEFAULT FALSE,      -- True if definition points to another source
  is_verbatim_text_complete BOOLEAN DEFAULT TRUE,  -- True if verbatim_text is complete and usable
  rephrased_definition TEXT,           -- Plain-language definition when verbatim_text is insufficient

  -- Cross-reference categorization (only set when is_cross_reference=true)
  reference_completeness VARCHAR(50),  -- 'pure_pointer', 'hybrid'
  reference_target VARCHAR(50),         -- 'same_corpus', 'federal', 'external_standard', 'other'

  -- Review workflow fields
  review_status VARCHAR(50) DEFAULT 'unreviewed',  -- 'unreviewed', 'confirmed', 'corrected', 'false_positive'
  reviewed_at TIMESTAMP,
  reviewer_name VARCHAR(255),
  justification_notes TEXT,            -- Justification and analysis for the model
  team_notes TEXT,                     -- Notes for development team
  original_values JSONB,               -- Stores original LLM values when corrections are made

  -- Developer tracking fields
  developer_status VARCHAR(50) DEFAULT 'unresolved',  -- 'unresolved', 'resolved', 'pending', 'backlogged', 'need_more_info'
  developer_assigned VARCHAR(50),      -- 'Michael' or 'Abigail'
  developer_notes TEXT,                -- Notes from developer
  resolution_type VARCHAR(50),         -- 'implemented' or 'not_implemented' (when resolved)
  resolution_comments TEXT,            -- Comments about the resolution
  developer_question TEXT,             -- Question for reviewer (when need_more_info)
  developer_checked_at TIMESTAMP      -- When developer last checked this item

);

-- Definition-Document Term Occurrences: Links definitions to documents where terms appear
-- This is a many-to-many relationship tracking term presence (not counts/positions)
-- Uses word-boundary matching: 'applicant' matches 'Applicant' but not 'reapplicant'
CREATE TABLE definition_document_occurrences (
  definition_id BIGINT NOT NULL REFERENCES definitions(id) ON DELETE CASCADE,
  document_id BIGINT NOT NULL REFERENCES regulatory_documents(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Composite primary key (no separate id column needed)
  PRIMARY KEY (definition_id, document_id)
);

-- Compliance Issues: Track specific compliance requirements
-- (wet signatures, in-person requirements, paper forms, etc.)
CREATE TABLE compliance_issues (
  id BIGSERIAL PRIMARY KEY,
  issue_type VARCHAR(50) NOT NULL,     -- 'wet_signature', 'in_person', 'paper_form', etc.
  term_matched VARCHAR(255),           -- The term/phrase that triggered the match
  context TEXT NOT NULL,               -- Full context snippet from regulation
  requirement_quote TEXT NOT NULL,     -- The requirement text
  from_statute BOOLEAN,                -- Whether it's from statute vs regulation
  statute_citation VARCHAR(255),       -- Citation to statute if applicable
  llm_confirmed BOOLEAN DEFAULT FALSE, -- Whether LLM analysis confirmed it

  -- Review fields
  review_status VARCHAR(50) DEFAULT 'unreviewed',  -- 'unreviewed', 'confirmed', 'false_positive', etc.
  reviewed_by VARCHAR(255),            -- Who reviewed it
  reviewed_at TIMESTAMP,               -- When it was reviewed
  team_notes TEXT,                     -- Notes for development team
  priority INTEGER,                    -- Priority ranking
  impact_type VARCHAR(100),            -- Type of impact

  -- Metadata
  state VARCHAR(2) NOT NULL,           -- 'NY' or 'NJ'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Developer tracking fields
  developer_status VARCHAR(50) DEFAULT 'unresolved',  -- 'unresolved', 'resolved', 'pending', 'backlogged', 'need_more_info'
  developer_assigned VARCHAR(50),      -- 'Michael' or 'Abigail'
  developer_notes TEXT,                -- Notes from developer
  resolution_type VARCHAR(50),         -- 'implemented' or 'not_implemented' (when resolved)
  resolution_comments TEXT,            -- Comments about the resolution
  developer_question TEXT,             -- Question for reviewer (when need_more_info)
  developer_checked_at TIMESTAMP,      -- When developer last checked this item

  url TEXT NOT NULL,                   -- Source URL
  document_id BIGINT REFERENCES regulatory_documents(id) ON DELETE CASCADE,  -- FK to document (nullable)
  justification_notes TEXT             -- Justification and analysis for the model
);

-- Incorporations by Reference: Track external standards incorporated into regulations
-- (NFPA codes, ICC codes, ASTM standards, CFR references, etc.)
CREATE TABLE incorporations_by_reference (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES regulatory_documents(id) ON DELETE CASCADE,

  -- Core IBR data
  incorporated_document TEXT,          -- e.g., "International Building Code/2021"
  source_organization VARCHAR(100),    -- e.g., "ICC", "NFPA", "CFR"
  version TEXT,                        -- e.g., "2021", "2020 edition"
  requirement_quote TEXT,              -- exact quote from regulation
  term_matched VARCHAR(255),           -- which pattern matched
  context TEXT NOT NULL,               -- full snippet for context
  llm_confirmed BOOLEAN DEFAULT FALSE, -- true = confirmed IBR
  state VARCHAR(2) NOT NULL,           -- 'NY' or 'NJ'
  url TEXT NOT NULL,                   -- source URL

  -- Review workflow (matching compliance_issues pattern)
  review_status VARCHAR(50) DEFAULT 'unreviewed',  -- 'unreviewed', 'confirmed', 'false_positive', etc.
  reviewed_by VARCHAR(255),            -- who reviewed it
  reviewed_at TIMESTAMP,               -- when it was reviewed
  justification_notes TEXT,            -- Justification and analysis for the model
  team_notes TEXT,                     -- Notes for development team
  priority INTEGER,                    -- priority ranking

  -- Developer tracking
  developer_status VARCHAR(50) DEFAULT 'unresolved',  -- 'unresolved', 'resolved', 'pending', 'backlogged', 'need_more_info'
  developer_assigned VARCHAR(50),      -- 'Michael' or 'Abigail'
  developer_notes TEXT,                -- notes from developer
  resolution_type VARCHAR(50),         -- 'implemented' or 'not_implemented' (when resolved)
  resolution_comments TEXT,            -- comments about the resolution
  developer_question TEXT,             -- question for reviewer (when need_more_info)
  developer_checked_at TIMESTAMP,      -- when developer last checked this item

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Document Notes: User-created annotations on regulatory documents
CREATE TYPE note_type AS ENUM ('anchored', 'document');

CREATE TABLE document_notes (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES regulatory_documents(id) ON DELETE CASCADE,
  note_type note_type NOT NULL,        -- 'anchored' (text selection) or 'document' (general note)
  anchor_start_offset INTEGER,         -- Start position for anchored notes
  anchor_end_offset INTEGER,           -- End position for anchored notes
  anchor_text TEXT,                    -- The selected text for anchored notes
  content TEXT NOT NULL,               -- Note content
  author_name VARCHAR(255),            -- Who created the note
  state VARCHAR(2) NOT NULL,           -- 'NY' or 'NJ'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Prompt Feedback: Track feedback on LLM prompts from prompts.yaml
CREATE TYPE feedback_type AS ENUM ('suggestion', 'bug', 'question', 'other');

CREATE TABLE prompt_feedback (
  id BIGSERIAL PRIMARY KEY,
  prompt_name VARCHAR(100) NOT NULL,   -- Key in prompts.yaml (e.g., 'red_flags_analysis')
  feedback_type feedback_type NOT NULL,  -- Type of feedback
  content TEXT NOT NULL,               -- Feedback content
  highlighted_text TEXT,               -- Optional: specific part of template
  author_name VARCHAR(255),            -- Who submitted the feedback
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Track which regulations have been processed for definition extraction
CREATE TABLE definition_extraction_log (
  id BIGSERIAL PRIMARY KEY,
  source_index INTEGER NOT NULL,       -- Which regulation was processed
  processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  model_version VARCHAR(100),          -- Model used for extraction
  definitions_found INTEGER DEFAULT 0, -- How many definitions were extracted
  CONSTRAINT unique_def_extraction_source UNIQUE(source_index)
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- regulatory_documents indexes
CREATE UNIQUE INDEX unique_per_url ON regulatory_documents(url);
CREATE INDEX idx_documents_exclude_from_analysis ON regulatory_documents(exclude_from_analysis) WHERE exclude_from_analysis = true;
CREATE INDEX idx_documents_hierarchy_level ON regulatory_documents(hierarchy_level);
CREATE INDEX idx_documents_nycrr_part ON regulatory_documents(nycrr_part);
CREATE INDEX idx_documents_nycrr_subpart ON regulatory_documents(nycrr_subpart);
CREATE INDEX idx_documents_nycrr_title ON regulatory_documents(nycrr_title);
CREATE INDEX idx_documents_nycrr_title_part ON regulatory_documents(nycrr_title, nycrr_part);
CREATE INDEX idx_documents_nycrr_title_part_subpart ON regulatory_documents(nycrr_title, nycrr_part, nycrr_subpart);
CREATE INDEX idx_documents_parent ON regulatory_documents(parent_id);
CREATE INDEX idx_documents_regulatory_status ON regulatory_documents(regulatory_status);
CREATE INDEX idx_documents_regulatory_status_state ON regulatory_documents(state, regulatory_status);
CREATE INDEX idx_documents_short_title ON regulatory_documents(short_title);
CREATE INDEX idx_documents_state ON regulatory_documents(state);
CREATE INDEX idx_documents_state_type ON regulatory_documents(state, type);
CREATE INDEX idx_documents_type ON regulatory_documents(type);
CREATE INDEX idx_documents_url ON regulatory_documents(url);

-- analyses indexes
CREATE UNIQUE INDEX idx_analyses_one_current_per_document ON analyses(document_id) WHERE is_current = true;
CREATE INDEX idx_analyses_url ON analyses(url);

-- red_flags indexes
CREATE INDEX idx_red_flags_analysis ON red_flags(analysis_id);
CREATE INDEX idx_red_flags_developer_assigned ON red_flags(developer_assigned);
CREATE INDEX idx_red_flags_developer_status ON red_flags(developer_status);
CREATE INDEX idx_red_flags_priority ON red_flags(priority) WHERE priority IS NOT NULL;
CREATE INDEX idx_red_flags_review_status ON red_flags(review_status);
CREATE INDEX idx_red_flags_severity ON red_flags(severity);

-- compliance_issues indexes
CREATE UNIQUE INDEX compliance_issues_document_issue_unique ON compliance_issues(document_id, issue_type);
CREATE INDEX idx_compliance_issues_developer_assigned ON compliance_issues(developer_assigned);
CREATE INDEX idx_compliance_issues_developer_status ON compliance_issues(developer_status);
CREATE INDEX idx_compliance_issues_issue_type ON compliance_issues(issue_type);
CREATE INDEX idx_compliance_issues_review_status ON compliance_issues(review_status);
CREATE INDEX idx_compliance_issues_state ON compliance_issues(state);
CREATE INDEX idx_compliance_issues_state_issue ON compliance_issues(state, issue_type);
CREATE INDEX idx_compliance_issues_url ON compliance_issues(url);

-- definitions indexes
CREATE INDEX idx_definitions_developer_filters ON definitions(developer_status, developer_assigned);
CREATE INDEX idx_definitions_developer_status ON definitions(developer_status);
CREATE INDEX idx_definitions_normalized_term ON definitions(normalized_term);
CREATE INDEX idx_definitions_normalized_term_trgm ON definitions USING GIN (normalized_term gin_trgm_ops);
CREATE INDEX idx_definitions_overlap ON definitions(definition_overlap);
CREATE INDEX idx_definitions_review_status ON definitions(review_status);
CREATE INDEX idx_definitions_scope_document ON definitions(scope_document_id);
CREATE INDEX idx_definitions_scope_level ON definitions(scope_level);
CREATE INDEX idx_definitions_term ON definitions(term);
CREATE INDEX idx_definitions_term_trgm ON definitions USING GIN (term gin_trgm_ops);
CREATE INDEX idx_definitions_type ON definitions(definition_type);
CREATE INDEX idx_definitions_url ON definitions(url);

-- definition_document_occurrences indexes
CREATE INDEX idx_def_doc_occurrences_definition ON definition_document_occurrences(definition_id);
CREATE INDEX idx_def_doc_occurrences_document ON definition_document_occurrences(document_id);

-- document_notes indexes
CREATE INDEX idx_document_notes_document_id ON document_notes(document_id);

-- incorporations_by_reference indexes
CREATE INDEX idx_ibr_developer_status ON incorporations_by_reference(developer_status);
CREATE INDEX idx_ibr_document ON incorporations_by_reference(document_id);
CREATE INDEX idx_ibr_llm_confirmed ON incorporations_by_reference(llm_confirmed);
CREATE INDEX idx_ibr_organization ON incorporations_by_reference(source_organization);
CREATE INDEX idx_ibr_review_status ON incorporations_by_reference(review_status);
CREATE INDEX idx_ibr_state ON incorporations_by_reference(state);

-- prompt_feedback indexes
CREATE INDEX idx_prompt_feedback_created_at ON prompt_feedback(created_at DESC);
CREATE INDEX idx_prompt_feedback_feedback_type ON prompt_feedback(feedback_type);
CREATE INDEX idx_prompt_feedback_prompt_name ON prompt_feedback(prompt_name);

-- regulation_statute_links indexes
CREATE INDEX idx_reg_statute_links_reg ON regulation_statute_links(regulation_id);
CREATE INDEX idx_reg_statute_links_statute ON regulation_statute_links(statute_id);
CREATE UNIQUE INDEX unique_regulation_statute_link ON regulation_statute_links(regulation_id, citation);

-- statute_references indexes
CREATE INDEX idx_statute_references_document ON statute_references(document_id);

-- statutes indexes
CREATE INDEX idx_statutes_citation ON statutes(citation);
CREATE INDEX idx_statutes_hierarchy_level ON statutes(hierarchy_level);
CREATE INDEX idx_statutes_njsa_title ON statutes(njsa_title);
CREATE INDEX idx_statutes_parent_id ON statutes(parent_id);
CREATE INDEX idx_statutes_state ON statutes(state);

-- definition_extraction_log indexes
CREATE INDEX idx_def_extraction_source ON definition_extraction_log(source_index);

-- =============================================================================
-- VIEWS
-- =============================================================================

-- View: Latest analysis for each document (joins via URL, not document_id for compatibility)
CREATE VIEW latest_analyses AS
SELECT d.*, a.id as analysis_id, a.analyzed_at, a.has_implementation_issues,
       a.overall_complexity, a.requires_technical_review, a.has_reporting_requirement,
       a.num_flags, a.max_severity, a.summary
FROM regulatory_documents d
LEFT JOIN analyses a ON d.url = a.url AND a.is_current = TRUE;

-- View: Parent-child relationships
CREATE VIEW document_hierarchy AS
SELECT p.id as parent_id, p.title as parent_title, p.hierarchy_level as parent_level,
       c.id as child_id, c.title as child_title, c.hierarchy_level as child_level
FROM regulatory_documents p
JOIN regulatory_documents c ON c.parent_id = p.id;

-- =============================================================================
-- Recomputing Hierarchy Stats
-- =============================================================================
-- The precomputed hierarchy statistics in regulatory_documents must be refreshed
-- after data imports, scraping runs, or when parent_id relationships change.
-- Run these queries in order to update all stats:

-- Step 1: Update direct_child_count (count of immediate children)
-- UPDATE regulatory_documents rd
-- SET direct_child_count = (
--   SELECT COUNT(*)
--   FROM regulatory_documents c
--   WHERE c.parent_id = rd.id
-- );

-- Step 2: Update descendant_count (total descendants in subtree)
-- WITH descendant_counts AS (
--   SELECT
--     rd.id,
--     (
--       WITH RECURSIVE descendants AS (
--         SELECT id FROM regulatory_documents WHERE parent_id = rd.id
--         UNION ALL
--         SELECT c.id FROM regulatory_documents c
--         JOIN descendants d ON c.parent_id = d.id
--       )
--       SELECT COUNT(*) FROM descendants
--     ) as cnt
--   FROM regulatory_documents rd
--   WHERE rd.direct_child_count > 0
-- )
-- UPDATE regulatory_documents rd
-- SET descendant_count = dc.cnt
-- FROM descendant_counts dc
-- WHERE rd.id = dc.id;

-- Step 3: Update flag stats for non-leaf nodes (documents with children)
-- WITH flag_stats AS (
--   SELECT
--     rd.id,
--     (
--       WITH RECURSIVE descendants AS (
--         SELECT id FROM regulatory_documents WHERE id = rd.id
--         UNION ALL
--         SELECT c.id FROM regulatory_documents c
--         JOIN descendants d ON c.parent_id = d.id
--       )
--       SELECT COALESCE(SUM(a.num_flags), 0)
--       FROM analyses a
--       WHERE a.is_current = true
--         AND a.document_id IN (SELECT id FROM descendants)
--     ) as total_flags,
--     (
--       WITH RECURSIVE descendants AS (
--         SELECT id FROM regulatory_documents WHERE id = rd.id
--         UNION ALL
--         SELECT c.id FROM regulatory_documents c
--         JOIN descendants d ON c.parent_id = d.id
--       )
--       SELECT MAX(a.max_severity)
--       FROM analyses a
--       WHERE a.is_current = true
--         AND a.document_id IN (SELECT id FROM descendants)
--     ) as max_sev,
--     (
--       WITH RECURSIVE descendants AS (
--         SELECT id FROM regulatory_documents WHERE id = rd.id
--         UNION ALL
--         SELECT c.id FROM regulatory_documents c
--         JOIN descendants d ON c.parent_id = d.id
--       )
--       SELECT EXISTS(
--         SELECT 1 FROM analyses a
--         WHERE a.is_current = true
--           AND a.document_id IN (SELECT id FROM descendants)
--       )
--     ) as has_analysis
--   FROM regulatory_documents rd
--   WHERE rd.direct_child_count > 0
-- )
-- UPDATE regulatory_documents rd
-- SET
--   descendant_flag_count = fs.total_flags,
--   descendant_max_severity = fs.max_sev,
--   has_descendant_analysis = fs.has_analysis
-- FROM flag_stats fs
-- WHERE rd.id = fs.id;

-- Step 4: Update flag stats for leaf nodes (documents without children)
-- UPDATE regulatory_documents rd
-- SET
--   descendant_flag_count = COALESCE(a.num_flags, 0),
--   descendant_max_severity = a.max_severity,
--   has_descendant_analysis = (a.id IS NOT NULL)
-- FROM (
--   SELECT rd2.id, a2.id as analysis_id, a2.num_flags, a2.max_severity
--   FROM regulatory_documents rd2
--   LEFT JOIN analyses a2 ON a2.document_id = rd2.id AND a2.is_current = true
--   WHERE rd2.direct_child_count = 0
-- ) a
-- WHERE rd.id = a.id;
