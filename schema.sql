-- =============================================================================
-- Deproceduralizer Database Schema
-- =============================================================================
-- Regulatory analysis database for NY & NJ regulations.
-- Stores regulations, definitions, compliance issues, and LLM analysis results.
--
-- Hierarchy: Title -> Subtitle -> Chapter -> Subchapter -> Article -> Part -> Subpart -> Section
-- =============================================================================

-- =============================================================================
-- ENUM TYPES
-- =============================================================================

CREATE TYPE note_type AS ENUM ('anchored', 'document');
CREATE TYPE feedback_type AS ENUM ('suggestion', 'bug', 'question', 'other');

-- =============================================================================
-- CORE TABLES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Regulatory Documents: Main table for regulations (74 columns)
-- -----------------------------------------------------------------------------
CREATE TABLE regulatory_documents (
  id BIGSERIAL PRIMARY KEY,
  source_index INTEGER,                -- Index from scraping process, used for ordering and deduplication
  type VARCHAR(50) NOT NULL,           -- 'regulation' or 'policy_document'
  state VARCHAR(2),                    -- Two-letter state code
  title TEXT NOT NULL,                 -- Human-readable title of the regulation
  url TEXT,                            -- Source URL from Cornell Law
  url_type VARCHAR(50),                -- 'regulation' (section) or 'title' (container)
  content TEXT NOT NULL,               -- Full text content
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Hierarchy fields
  parent_id BIGINT REFERENCES regulatory_documents(id) ON DELETE SET NULL,
  hierarchy_level VARCHAR(50),         -- Position in tree: title/subtitle/chapter/subchapter/article/part/subpart/section
  hierarchy_path TEXT,                 -- Full path for hierarchy URLs (e.g., "title-18/part-433")

  -- Display helpers
  short_title TEXT,                    -- Abbreviated title for display
  level_identifier TEXT,               -- E.g., "1.1" or "A" for hierarchy level
  citation TEXT,                       -- Formatted citation string

  -- Parsed NYCRR citation components (New York)
  nycrr_title INTEGER,
  nycrr_title_name TEXT,
  nycrr_subtitle VARCHAR(50),
  nycrr_subtitle_name TEXT,
  nycrr_chapter VARCHAR(50),
  nycrr_chapter_name TEXT,
  nycrr_subchapter VARCHAR(50),
  nycrr_subchapter_name TEXT,
  nycrr_article VARCHAR(50),
  nycrr_article_name TEXT,
  nycrr_part VARCHAR(50),
  nycrr_part_name TEXT,
  nycrr_subpart VARCHAR(50),
  nycrr_subpart_name TEXT,
  nycrr_section VARCHAR(50),
  nycrr_section_name TEXT,

  -- Parsed NJAC citation components (New Jersey)
  njac_title VARCHAR(50),
  njac_title_name TEXT,
  njac_subtitle VARCHAR(50),
  njac_subtitle_name TEXT,
  njac_chapter VARCHAR(50),
  njac_chapter_name TEXT,
  njac_subchapter VARCHAR(50),
  njac_subchapter_name TEXT,
  njac_article VARCHAR(50),
  njac_article_name TEXT,
  njac_part VARCHAR(50),
  njac_part_name TEXT,
  njac_subpart VARCHAR(50),
  njac_subpart_name TEXT,
  njac_section VARCHAR(50),
  njac_section_name TEXT,

  -- Parsed NJSA citation components (New Jersey Statutes)
  njsa_title VARCHAR(10),
  njsa_title_name TEXT,
  njsa_chapter VARCHAR(20),
  njsa_section VARCHAR(20),
  njsa_section_name TEXT,
  njsa_citation VARCHAR(50),

  -- Source metadata
  scraped_from_url TEXT,

  -- Precomputed hierarchy statistics (denormalized for performance)
  direct_child_count INTEGER DEFAULT 0,
  descendant_count INTEGER DEFAULT 0,
  descendant_flag_count INTEGER DEFAULT 0,
  descendant_max_severity INTEGER,
  has_descendant_analysis BOOLEAN DEFAULT FALSE,

  -- Compliance issue statistics (denormalized)
  compliance_issue_count INTEGER DEFAULT 0,
  descendant_compliance_issue_count INTEGER DEFAULT 0,

  -- Cross-reference statistics
  cross_reference_count INTEGER DEFAULT 0,

  -- AI-generated summary metadata (from batch summarization pipeline)
  summary TEXT,
  section_type VARCHAR(50),              -- definitions, requirements, procedures, etc.
  keywords TEXT[] DEFAULT '{}',
  applies_to TEXT[] DEFAULT '{}',
  has_form BOOLEAN DEFAULT FALSE,
  has_ibr BOOLEAN DEFAULT FALSE,

  -- Regulatory status
  regulatory_status VARCHAR(20) DEFAULT 'active',  -- 'active', 'reserved', 'repealed', 'recodified', 'expired'
  recodified_to VARCHAR(100),

  -- Exclusion from analysis
  exclude_from_analysis BOOLEAN DEFAULT FALSE,
  excluded_at TIMESTAMP,
  excluded_by VARCHAR(255),
  excluded_reason TEXT,

  CONSTRAINT chk_rd_state CHECK (state IN ('NY', 'NJ')),
  CONSTRAINT unique_per_url UNIQUE(url)
);

-- -----------------------------------------------------------------------------
-- Analyses: LLM analysis results per document
-- -----------------------------------------------------------------------------
CREATE TABLE analyses (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT REFERENCES regulatory_documents(id) ON DELETE CASCADE,
  url TEXT NOT NULL,                   -- Source URL (for legacy linking when document_id is null)
  analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  model_version VARCHAR(100),
  has_implementation_issues BOOLEAN DEFAULT FALSE,
  overall_complexity VARCHAR(10),      -- HIGH/MEDIUM/LOW
  summary TEXT,
  requires_technical_review BOOLEAN DEFAULT FALSE,
  has_reporting_requirement BOOLEAN DEFAULT FALSE,
  max_severity INTEGER,
  num_flags INTEGER DEFAULT 0,
  is_current BOOLEAN DEFAULT TRUE
);

-- -----------------------------------------------------------------------------
-- Red Flags: Implementation concerns from analysis
-- -----------------------------------------------------------------------------
CREATE TABLE red_flags (
  id BIGSERIAL PRIMARY KEY,
  analysis_id BIGINT NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  category VARCHAR(100) NOT NULL,
  explanation TEXT NOT NULL,
  severity INTEGER NOT NULL,
  complexity VARCHAR(20) NOT NULL,     -- HIGH/MEDIUM/LOW/MEDIUM-HIGH
  matched_phrases TEXT[] DEFAULT '{}',
  implementation_approach TEXT NOT NULL,
  effort_estimate VARCHAR(255),
  text_examples TEXT[] DEFAULT '{}',

  -- Review fields
  review_status VARCHAR(50) DEFAULT 'unreviewed',
  reviewed_by VARCHAR(255),
  reviewed_at TIMESTAMP,
  justification_notes TEXT,            -- Justification and analysis for the model
  team_notes TEXT,                     -- Notes for development team
  priority INTEGER,
  impact_type VARCHAR(100),

  -- Developer tracking
  developer_status VARCHAR(50) DEFAULT 'unresolved',
  developer_assigned VARCHAR(50),
  developer_notes TEXT,
  resolution_type VARCHAR(50),
  resolution_comments TEXT,
  developer_question TEXT,
  developer_checked_at TIMESTAMP,

  CONSTRAINT red_flags_severity_check CHECK (severity >= 1 AND severity <= 10),
  CONSTRAINT valid_category CHECK (category IN (
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
  CONSTRAINT chk_rf_resolution_type CHECK (resolution_type IN ('implemented', 'not_implemented'))
);

-- =============================================================================
-- DEFINITIONS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Definitions: Extracted terms and definitions from regulations
-- -----------------------------------------------------------------------------
-- Definition text fields:
-- - verbatim_text: Exact text from regulation (always populated)
-- - is_verbatim_text_complete: True if verbatim_text is complete and usable
-- - rephrased_definition: Plain-language version when verbatim is insufficient
--
-- Cross-reference categorization:
-- - reference_completeness: 'pure_pointer' or 'hybrid'
-- - reference_target: 'same_corpus', 'federal', 'external_standard', 'other'
-- -----------------------------------------------------------------------------
CREATE TABLE definitions (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT REFERENCES regulatory_documents(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  term TEXT NOT NULL,
  verbatim_text TEXT NOT NULL,
  is_verbatim_text_complete BOOLEAN DEFAULT TRUE,
  rephrased_definition TEXT,
  scope TEXT,
  definition_overlap REAL DEFAULT 0.0,
  source_location TEXT,
  model_version VARCHAR(100),
  extracted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,

  -- Scope tracking
  scope_level VARCHAR(20),
  scope_document_id BIGINT REFERENCES regulatory_documents(id) ON DELETE SET NULL,
  definition_type VARCHAR(20) DEFAULT 'formal',
  normalized_term TEXT,                -- Lowercase trimmed term (computed in app layer)
  is_cross_reference BOOLEAN DEFAULT FALSE,

  -- Cross-reference categorization
  reference_completeness VARCHAR(20),
  reference_target VARCHAR(30),

  -- Review workflow
  review_status VARCHAR(50) DEFAULT 'unreviewed',
  reviewed_at TIMESTAMP,
  reviewer_name VARCHAR(255),
  justification_notes TEXT,
  team_notes TEXT,
  original_values JSONB,

  -- Developer tracking
  developer_status VARCHAR(50) DEFAULT 'unresolved',
  developer_assigned VARCHAR(50),
  developer_notes TEXT,
  resolution_type VARCHAR(50),
  resolution_comments TEXT,
  developer_question TEXT,
  developer_checked_at TIMESTAMP,

  CONSTRAINT definitions_review_status_check CHECK (review_status IN ('unreviewed', 'confirmed', 'corrected', 'false_positive')),
  CONSTRAINT chk_reference_completeness CHECK (reference_completeness IS NULL OR reference_completeness IN ('pure_pointer', 'hybrid')),
  CONSTRAINT chk_reference_target CHECK (reference_target IS NULL OR reference_target IN ('same_corpus', 'federal', 'external_standard', 'other'))
);

-- -----------------------------------------------------------------------------
-- Definition-Document Occurrences: Where terms appear in documents
-- -----------------------------------------------------------------------------
CREATE TABLE definition_document_occurrences (
  definition_id BIGINT NOT NULL REFERENCES definitions(id) ON DELETE CASCADE,
  document_id BIGINT NOT NULL REFERENCES regulatory_documents(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (definition_id, document_id)
);

-- =============================================================================
-- COMPLIANCE & ISSUES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Compliance Issues: Specific compliance requirements found in regulations
-- -----------------------------------------------------------------------------
CREATE TABLE compliance_issues (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES regulatory_documents(id) ON DELETE CASCADE,

  -- Issue identification
  issue_type VARCHAR(50) NOT NULL,
  occurrence_number INTEGER NOT NULL DEFAULT 1,
  matched_pattern VARCHAR(255),
  matched_context TEXT NOT NULL,
  url TEXT,

  -- LLM analysis results
  requirement_found BOOLEAN DEFAULT FALSE,
  requirement_text TEXT,
  is_verbatim BOOLEAN,                    -- True if requirement_text is verbatim from regulation
  required_by_statute BOOLEAN,
  statute_citation VARCHAR(255),
  severity INTEGER,
  original_severity INTEGER,              -- LLM's original severity (preserved on first review)
  impact_assessment TEXT,

  -- Review fields
  review_status VARCHAR(50) DEFAULT 'unreviewed',
  reviewed_by VARCHAR(255),
  reviewed_at TIMESTAMP,
  justification_notes TEXT,
  team_notes TEXT,
  impact_type VARCHAR(100),

  -- Developer tracking
  developer_status VARCHAR(50) DEFAULT 'unresolved',
  developer_assigned VARCHAR(50),
  developer_notes TEXT,
  resolution_type VARCHAR(50),
  resolution_comments TEXT,
  developer_question TEXT,
  developer_checked_at TIMESTAMP,

  -- Metadata
  state VARCHAR(2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT compliance_issues_severity_check CHECK (severity >= 1 AND severity <= 10),
  CONSTRAINT compliance_issues_state_check CHECK (state IN ('NY', 'NJ')),
  CONSTRAINT unique_document_issue_occurrence UNIQUE (document_id, issue_type, occurrence_number)
);

-- -----------------------------------------------------------------------------
-- Incorporations by Reference: External standards incorporated into regulations
-- -----------------------------------------------------------------------------
CREATE TABLE incorporations_by_reference (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES regulatory_documents(id) ON DELETE CASCADE,

  -- Core IBR data
  incorporated_document TEXT,
  source_organization VARCHAR(100),
  version TEXT,
  requirement_quote TEXT,
  term_matched VARCHAR(255),
  context TEXT NOT NULL,
  llm_confirmed BOOLEAN DEFAULT FALSE,
  state VARCHAR(2) NOT NULL,
  url TEXT NOT NULL,

  -- Review workflow
  review_status VARCHAR(50) DEFAULT 'unreviewed',
  reviewed_by VARCHAR(255),
  reviewed_at TIMESTAMP,
  justification_notes TEXT,
  team_notes TEXT,
  priority INTEGER,

  -- Developer tracking
  developer_status VARCHAR(50) DEFAULT 'unresolved',
  developer_assigned VARCHAR(50),
  developer_notes TEXT,
  resolution_type VARCHAR(50),
  resolution_comments TEXT,
  developer_question TEXT,
  developer_checked_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT chk_ibr_state CHECK (state IN ('NY', 'NJ')),
  CONSTRAINT chk_ibr_resolution_type CHECK (resolution_type IN ('implemented', 'not_implemented'))
);

-- =============================================================================
-- STATUTES & REFERENCES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Statutes: Statute content (N.J.S.A., N.Y. State laws)
-- -----------------------------------------------------------------------------
CREATE TABLE statutes (
  id BIGSERIAL PRIMARY KEY,
  citation VARCHAR(50) NOT NULL,
  state VARCHAR(2) NOT NULL DEFAULT 'NJ',
  title TEXT NOT NULL,
  content TEXT NOT NULL,

  -- NJ-specific fields (NJSA)
  njsa_title VARCHAR(10),
  njsa_title_name TEXT,
  njsa_chapter VARCHAR(20),
  njsa_section VARCHAR(20),
  njsa_section_name TEXT,

  -- Hierarchy
  parent_id BIGINT REFERENCES statutes(id) ON DELETE SET NULL,
  hierarchy_level VARCHAR(50),
  hierarchy_path TEXT,

  -- Metadata
  source_index INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT chk_statutes_state CHECK (state IN ('NY', 'NJ')),
  CONSTRAINT statutes_state_citation_key UNIQUE(state, citation)
);

-- -----------------------------------------------------------------------------
-- Statute References: Federal/state law citations in documents
-- -----------------------------------------------------------------------------
CREATE TABLE statute_references (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES regulatory_documents(id) ON DELETE CASCADE,
  usc_citations TEXT,
  cfr_citations TEXT,
  public_laws TEXT,
  acts TEXT,
  state_title VARCHAR(100),
  state_section VARCHAR(100)
);

-- -----------------------------------------------------------------------------
-- Regulation-Statute Links: Many-to-many between regulations and statutes
-- -----------------------------------------------------------------------------
CREATE TABLE regulation_statute_links (
  id BIGSERIAL PRIMARY KEY,
  regulation_id BIGINT NOT NULL REFERENCES regulatory_documents(id) ON DELETE CASCADE,
  statute_id BIGINT REFERENCES statutes(id) ON DELETE CASCADE,
  citation VARCHAR(50) NOT NULL,
  context TEXT,
  link_type VARCHAR(50) DEFAULT 'reference',
  match_status VARCHAR(50) DEFAULT 'matched',
  original_citation VARCHAR(50),
  correction_notes TEXT,
  reviewed_at TIMESTAMP,
  reviewed_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT unique_regulation_statute_link UNIQUE(regulation_id, citation)
);

-- -----------------------------------------------------------------------------
-- Cross References: Internal citations between regulatory documents
-- -----------------------------------------------------------------------------
-- Reference types:
-- - nycrr: Full-form NY references (e.g., "18 NYCRR 505.14")
-- - njac: Full-form NJ references (e.g., "N.J.A.C. 8:43-1.2")
-- - ny_short_form: Context-dependent NY refs (e.g., "section 624.8 of this Part")
-- - same_section: Internal refs (e.g., "paragraph (a) of this section")
-- -----------------------------------------------------------------------------
CREATE TABLE cross_references (
  id BIGSERIAL PRIMARY KEY,
  source_document_id BIGINT NOT NULL REFERENCES regulatory_documents(id) ON DELETE CASCADE,
  ref_type VARCHAR(50) NOT NULL,          -- nycrr, njac, ny_short_form, same_section
  raw_text TEXT NOT NULL,                 -- Exact matched text from regulation
  normalized_citation TEXT NOT NULL,      -- Cleaned citation for lookup
  start_offset INTEGER,                   -- Character offset where match starts
  end_offset INTEGER,                     -- Character offset where match ends
  context_before TEXT,                    -- ~50 chars before match for display
  context_after TEXT,                     -- ~50 chars after match for display
  components JSONB,                       -- Parsed components (title, section, scope, etc.)
  target_document_id BIGINT REFERENCES regulatory_documents(id) ON DELETE SET NULL,
  is_resolved BOOLEAN DEFAULT FALSE,      -- Whether citation was resolved to a target doc
  resolution_notes TEXT,                  -- Why resolution failed (for unresolved refs)
  state VARCHAR(2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT cross_references_state_check CHECK (state IN ('NY', 'NJ')),
  CONSTRAINT cross_references_source_document_id_raw_text_offset_key UNIQUE(source_document_id, raw_text, start_offset)
);

-- Index for efficient lookups by normalized_citation during resolution
CREATE INDEX idx_cross_references_normalized_citation ON cross_references(normalized_citation);

-- =============================================================================
-- NOTES & FEEDBACK
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Document Notes: User annotations on regulations
-- -----------------------------------------------------------------------------
CREATE TABLE document_notes (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES regulatory_documents(id) ON DELETE CASCADE,
  note_type note_type NOT NULL DEFAULT 'general',
  anchor_start_offset INTEGER,
  anchor_end_offset INTEGER,
  anchor_text TEXT,
  content TEXT NOT NULL,
  author_name VARCHAR(255),
  state VARCHAR(2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Prompt Feedback: Feedback on LLM prompts
-- -----------------------------------------------------------------------------
CREATE TABLE prompt_feedback (
  id BIGSERIAL PRIMARY KEY,
  prompt_name VARCHAR(100) NOT NULL,
  feedback_type feedback_type NOT NULL,
  content TEXT NOT NULL,
  highlighted_text TEXT,
  author_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Regulatory Documents
CREATE INDEX idx_documents_state ON regulatory_documents(state);
CREATE INDEX idx_documents_type ON regulatory_documents(type);
CREATE INDEX idx_documents_state_type ON regulatory_documents(state, type);
CREATE INDEX idx_documents_parent ON regulatory_documents(parent_id);
CREATE INDEX idx_documents_hierarchy_level ON regulatory_documents(hierarchy_level);
CREATE INDEX idx_documents_regulatory_status ON regulatory_documents(regulatory_status);
CREATE INDEX idx_documents_regulatory_status_state ON regulatory_documents(state, regulatory_status);
CREATE INDEX idx_documents_url ON regulatory_documents(url);
CREATE INDEX idx_documents_short_title ON regulatory_documents(short_title);
CREATE INDEX idx_documents_exclude_from_analysis ON regulatory_documents(exclude_from_analysis) WHERE exclude_from_analysis = TRUE;

-- AI metadata indexes (GIN for array columns)
CREATE INDEX idx_rd_keywords ON regulatory_documents USING GIN (keywords);
CREATE INDEX idx_rd_applies_to ON regulatory_documents USING GIN (applies_to);
CREATE INDEX idx_rd_section_type ON regulatory_documents(section_type) WHERE section_type IS NOT NULL;
CREATE INDEX idx_rd_has_form ON regulatory_documents(has_form) WHERE has_form = TRUE;
CREATE INDEX idx_rd_has_ibr ON regulatory_documents(has_ibr) WHERE has_ibr = TRUE;

-- NYCRR indexes
CREATE INDEX idx_documents_nycrr_title ON regulatory_documents(nycrr_title);
CREATE INDEX idx_documents_nycrr_part ON regulatory_documents(nycrr_part);
CREATE INDEX idx_documents_nycrr_title_part ON regulatory_documents(nycrr_title, nycrr_part);
CREATE INDEX idx_documents_nycrr_subpart ON regulatory_documents(nycrr_subpart);
CREATE INDEX idx_documents_nycrr_title_part_subpart ON regulatory_documents(nycrr_title, nycrr_part, nycrr_subpart);

-- Analyses
CREATE INDEX idx_analyses_url ON analyses(url);
CREATE UNIQUE INDEX idx_analyses_one_current_per_document ON analyses(document_id) WHERE is_current = TRUE;

-- Red Flags
CREATE INDEX idx_red_flags_analysis ON red_flags(analysis_id);
CREATE INDEX idx_red_flags_severity ON red_flags(severity);
CREATE INDEX idx_red_flags_review_status ON red_flags(review_status);
CREATE INDEX idx_red_flags_priority ON red_flags(priority) WHERE priority IS NOT NULL;
CREATE INDEX idx_red_flags_developer_status ON red_flags(developer_status);
CREATE INDEX idx_red_flags_developer_assigned ON red_flags(developer_assigned);

-- Definitions
CREATE INDEX idx_definitions_url ON definitions(url);
CREATE INDEX idx_definitions_term ON definitions(term);
CREATE INDEX idx_definitions_overlap ON definitions(definition_overlap);
CREATE INDEX idx_definitions_scope_document ON definitions(scope_document_id);
CREATE INDEX idx_definitions_scope_level ON definitions(scope_level);
CREATE INDEX idx_definitions_normalized_term ON definitions(normalized_term);
CREATE INDEX idx_definitions_type ON definitions(definition_type);
CREATE INDEX idx_definitions_review_status ON definitions(review_status);
CREATE INDEX idx_definitions_developer_status ON definitions(developer_status);
CREATE INDEX idx_definitions_developer_filters ON definitions(developer_status, developer_assigned);
CREATE INDEX idx_definitions_term_trgm ON definitions USING GIN (term gin_trgm_ops);
CREATE INDEX idx_definitions_normalized_term_trgm ON definitions USING GIN (normalized_term gin_trgm_ops);

-- Definition Occurrences
CREATE INDEX idx_def_doc_occurrences_definition ON definition_document_occurrences(definition_id);
CREATE INDEX idx_def_doc_occurrences_document ON definition_document_occurrences(document_id);

-- Compliance Issues (indexes)
CREATE INDEX idx_compliance_issues_document ON compliance_issues(document_id);
CREATE INDEX idx_compliance_issues_state ON compliance_issues(state);
CREATE INDEX idx_compliance_issues_issue_type ON compliance_issues(issue_type);
CREATE INDEX idx_compliance_issues_review_status ON compliance_issues(review_status);
CREATE INDEX idx_compliance_issues_state_issue ON compliance_issues(state, issue_type);
CREATE INDEX idx_compliance_issues_requirement_found ON compliance_issues(requirement_found);
CREATE INDEX idx_compliance_issues_severity ON compliance_issues(severity) WHERE severity IS NOT NULL;
CREATE INDEX idx_compliance_issues_developer_status ON compliance_issues(developer_status);
CREATE INDEX idx_compliance_issues_developer_assigned ON compliance_issues(developer_assigned);

-- Incorporations by Reference
CREATE INDEX idx_ibr_document ON incorporations_by_reference(document_id);
CREATE INDEX idx_ibr_organization ON incorporations_by_reference(source_organization);
CREATE INDEX idx_ibr_llm_confirmed ON incorporations_by_reference(llm_confirmed);
CREATE INDEX idx_ibr_review_status ON incorporations_by_reference(review_status);
CREATE INDEX idx_ibr_state ON incorporations_by_reference(state);
CREATE INDEX idx_ibr_developer_status ON incorporations_by_reference(developer_status);

-- Statutes
CREATE INDEX idx_statutes_state ON statutes(state);
CREATE INDEX idx_statutes_citation ON statutes(citation);
CREATE INDEX idx_statutes_parent_id ON statutes(parent_id);
CREATE INDEX idx_statutes_hierarchy_level ON statutes(hierarchy_level);
CREATE INDEX idx_statutes_njsa_title ON statutes(njsa_title);

-- Statute References & Links
CREATE INDEX idx_statute_references_document ON statute_references(document_id);
CREATE INDEX idx_reg_statute_links_reg ON regulation_statute_links(regulation_id);
CREATE INDEX idx_reg_statute_links_statute ON regulation_statute_links(statute_id);

-- Cross References
CREATE INDEX idx_crossrefs_source_doc ON cross_references(source_document_id);
CREATE INDEX idx_crossrefs_target_doc ON cross_references(target_document_id);
CREATE INDEX idx_crossrefs_state ON cross_references(state);
CREATE INDEX idx_crossrefs_ref_type ON cross_references(ref_type);
CREATE INDEX idx_crossrefs_unresolved ON cross_references(is_resolved) WHERE is_resolved = FALSE;

-- Document Notes
CREATE INDEX idx_document_notes_document_id ON document_notes(document_id);

-- Prompt Feedback
CREATE INDEX idx_prompt_feedback_prompt_name ON prompt_feedback(prompt_name);
CREATE INDEX idx_prompt_feedback_created_at ON prompt_feedback(created_at DESC);
CREATE INDEX idx_prompt_feedback_feedback_type ON prompt_feedback(feedback_type);

-- =============================================================================
-- VIEWS
-- =============================================================================

CREATE VIEW latest_analyses AS
SELECT d.*, a.id as analysis_id, a.analyzed_at, a.has_implementation_issues,
       a.overall_complexity, a.requires_technical_review, a.has_reporting_requirement,
       a.num_flags, a.max_severity, a.summary
FROM regulatory_documents d
LEFT JOIN analyses a ON d.id = a.document_id AND a.is_current = TRUE;

CREATE VIEW document_hierarchy AS
SELECT p.id as parent_id, p.title as parent_title, p.hierarchy_level as parent_level,
       c.id as child_id, c.title as child_title, c.hierarchy_level as child_level
FROM regulatory_documents p
JOIN regulatory_documents c ON c.parent_id = p.id;

-- =============================================================================
-- MAINTENANCE: Recomputing Hierarchy Stats
-- =============================================================================
-- Run these after data imports or when parent_id relationships change.
-- See .claude/skills/database/maintenance.md for full SQL.
-- =============================================================================
