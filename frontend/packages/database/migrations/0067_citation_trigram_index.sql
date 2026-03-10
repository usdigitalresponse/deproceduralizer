-- Migration: Add trigram index on citation for ILIKE substring search
CREATE INDEX IF NOT EXISTS idx_regulatory_documents_citation_trgm
  ON regulatory_documents USING gin (citation gin_trgm_ops);
