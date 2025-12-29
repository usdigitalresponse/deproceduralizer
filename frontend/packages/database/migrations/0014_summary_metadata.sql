-- Migration: Add summary metadata columns to regulatory_documents
-- These columns store AI-generated summaries and metadata for ~58K NJ regulatory documents

-- Add summary metadata columns
ALTER TABLE regulatory_documents
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS section_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS keywords TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS applies_to TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS has_form BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_ibr BOOLEAN DEFAULT FALSE;

-- Create GIN indexes for array columns (enables fast array containment queries)
CREATE INDEX IF NOT EXISTS idx_rd_keywords ON regulatory_documents USING GIN(keywords);
CREATE INDEX IF NOT EXISTS idx_rd_applies_to ON regulatory_documents USING GIN(applies_to);

-- Create index for section_type filtering (partial index since many may be NULL initially)
CREATE INDEX IF NOT EXISTS idx_rd_section_type ON regulatory_documents(section_type) WHERE section_type IS NOT NULL;

-- Create partial indexes for boolean flags (only index TRUE values for efficient filtering)
CREATE INDEX IF NOT EXISTS idx_rd_has_form ON regulatory_documents(has_form) WHERE has_form = TRUE;
CREATE INDEX IF NOT EXISTS idx_rd_has_ibr ON regulatory_documents(has_ibr) WHERE has_ibr = TRUE;

-- Create composite index for common filter pattern: state + section_type
CREATE INDEX IF NOT EXISTS idx_rd_state_section_type ON regulatory_documents(state, section_type) WHERE section_type IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN regulatory_documents.summary IS 'AI-generated 1-2 sentence summary of the section content';
COMMENT ON COLUMN regulatory_documents.section_type IS 'Category: definitions, requirements, procedures, prohibitions, standards, eligibility, penalties, fees, forms, reporting, scope, exemptions, reserved';
COMMENT ON COLUMN regulatory_documents.keywords IS 'Array of 3-5 searchable keywords extracted by AI';
COMMENT ON COLUMN regulatory_documents.applies_to IS 'Array of entities that must comply (e.g., licensees, employers, applicants)';
COMMENT ON COLUMN regulatory_documents.has_form IS 'True if section references a specific form';
COMMENT ON COLUMN regulatory_documents.has_ibr IS 'True if section incorporates external standards by reference (ASTM, NFPA, ISO, etc.)';
