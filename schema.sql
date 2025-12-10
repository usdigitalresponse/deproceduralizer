-- New York Regulatory Analysis Database Schema
-- Stores regulations from Cornell Law and LLM-generated red flag analysis results.
-- Hierarchy: Title → Subtitle → Chapter → Subchapter → Article → Part → Subpart → Section

CREATE TABLE regulatory_documents (
  id BIGSERIAL PRIMARY KEY,
  source_index INTEGER,                -- Index from scraping process, used for ordering and deduplication
  type VARCHAR(50) NOT NULL,           -- 'regulation' or 'policy_document'
  state VARCHAR(2),                    -- Two-letter state code (e.g., 'NY')
  title TEXT NOT NULL,                 -- Human-readable title of the regulation
  url TEXT,                            -- Source URL from Cornell Law
  url_type VARCHAR(50),                -- 'regulation' (section) or 'title' (container)
  content TEXT NOT NULL,               -- Full text content
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Hierarchy fields
  parent_id BIGINT REFERENCES regulatory_documents(id) ON DELETE SET NULL,  -- FK to parent document
  hierarchy_level VARCHAR(50),         -- Position in tree: title/subtitle/chapter/subchapter/article/part/subpart/section
  hierarchy_path TEXT,                 -- Full path for hierarchy URLs (e.g., "title-18/part-433")

  -- Parsed NYCRR citation components (from URLs like "18-NYCRR-433.8")
  nycrr_title INTEGER,                 -- Title number (1-23)
  nycrr_part VARCHAR(50),              -- Part number
  nycrr_section VARCHAR(50),           -- Section number

  CONSTRAINT unique_per_pull UNIQUE(state, source_index, type)
);

CREATE TABLE analyses (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES regulatory_documents(id) ON DELETE CASCADE,
  analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  model_version VARCHAR(100),          -- LLM model used for analysis
  has_implementation_issues BOOLEAN DEFAULT FALSE,  -- TRUE if any red flags found
  overall_complexity VARCHAR(10),      -- HIGH/MEDIUM/LOW
  summary TEXT,                        -- LLM-generated summary of findings
  requires_technical_review BOOLEAN DEFAULT FALSE,  -- TRUE if needs technical review
  has_reporting_requirement BOOLEAN DEFAULT FALSE,  -- TRUE if creates reporting requirements
  max_severity INTEGER,                -- Highest severity among red flags (1-10)
  num_flags INTEGER DEFAULT 0,         -- Count of red flags
  is_current BOOLEAN DEFAULT TRUE      -- TRUE for most recent analysis per document
);

CREATE TABLE red_flags (
  id BIGSERIAL PRIMARY KEY,
  analysis_id BIGINT NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  category VARCHAR(100) NOT NULL,      -- Type of implementation concern
  explanation TEXT NOT NULL,           -- Why this is flagged
  severity INTEGER NOT NULL CHECK (severity >= 1 AND severity <= 10),  -- Impact severity (1-10)
  complexity VARCHAR(10) NOT NULL,     -- HIGH/MEDIUM/LOW for this specific issue
  matched_phrases TEXT[] DEFAULT '{}', -- Key phrases from regulation that triggered flag
  implementation_approach TEXT NOT NULL,  -- Suggested approach to address
  effort_estimate VARCHAR(255),        -- Estimated effort to implement
  text_examples TEXT[] DEFAULT '{}'    -- Direct quotes as evidence
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

-- Indexes
CREATE INDEX idx_documents_state ON regulatory_documents(state);
CREATE INDEX idx_documents_type ON regulatory_documents(type);
CREATE INDEX idx_documents_state_type ON regulatory_documents(state, type);
CREATE INDEX idx_documents_parent ON regulatory_documents(parent_id);
CREATE INDEX idx_documents_hierarchy_level ON regulatory_documents(hierarchy_level);
CREATE INDEX idx_documents_nycrr_title ON regulatory_documents(nycrr_title);
CREATE INDEX idx_documents_nycrr_part ON regulatory_documents(nycrr_part);
CREATE INDEX idx_documents_nycrr_title_part ON regulatory_documents(nycrr_title, nycrr_part);
CREATE INDEX idx_analyses_document ON analyses(document_id);
CREATE INDEX idx_analyses_is_current ON analyses(is_current) WHERE is_current = TRUE;
CREATE INDEX idx_red_flags_analysis ON red_flags(analysis_id);
CREATE INDEX idx_red_flags_severity ON red_flags(severity);
CREATE INDEX idx_statute_references_document ON statute_references(document_id);

-- View: Latest analysis for each document
CREATE VIEW latest_analyses AS
SELECT d.*, a.id as analysis_id, a.analyzed_at, a.has_implementation_issues,
       a.overall_complexity, a.requires_technical_review, a.has_reporting_requirement,
       a.num_flags, a.max_severity, a.summary
FROM regulatory_documents d
LEFT JOIN analyses a ON d.id = a.document_id AND a.is_current = TRUE;

-- View: Parent-child relationships
CREATE VIEW document_hierarchy AS
SELECT p.id as parent_id, p.title as parent_title, p.hierarchy_level as parent_level,
       c.id as child_id, c.title as child_title, c.hierarchy_level as child_level
FROM regulatory_documents p
JOIN regulatory_documents c ON c.parent_id = p.id;
