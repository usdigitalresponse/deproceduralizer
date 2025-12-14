-- Migration: Add definitions table
-- Purpose: Store extracted definitions from regulations with source info and validation metrics
-- Date: 2025-12-12

CREATE TABLE definitions (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES regulatory_documents(id) ON DELETE CASCADE,

  -- The term being defined
  term TEXT NOT NULL,

  -- The definition text as extracted
  definition TEXT NOT NULL,

  -- Scope/applicability (e.g., "in this section", "in this part", "throughout this title")
  scope TEXT,

  -- Similarity/distance metric (0.0-1.0) indicating how close the definition appears in the regulation
  -- 1.0 = definition found verbatim in document, 0.0 = not found at all
  definition_confidence FLOAT DEFAULT 0.0,

  -- Source location (e.g., "section 1.1", "definitions section")
  source_location TEXT,

  -- Metadata about extraction
  model_version VARCHAR(100),  -- LLM model used for extraction
  extracted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Any additional notes about the definition
  notes TEXT
);

-- Indexes
CREATE INDEX idx_definitions_document ON definitions(document_id);
CREATE INDEX idx_definitions_term ON definitions(term);
CREATE INDEX idx_definitions_confidence ON definitions(definition_confidence);
CREATE INDEX idx_definitions_document_term ON definitions(document_id, term);
