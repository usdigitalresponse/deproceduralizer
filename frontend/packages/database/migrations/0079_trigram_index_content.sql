-- Enable pg_trgm extension for trigram-based regex indexing
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram index on regulatory_documents.content
-- Speeds up regex scans (content ~* 'pattern') from sequential scan to index scan
-- Used by: scan_compliance_issues.py, fines_scanner.py
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_regulatory_documents_content_trgm
ON regulatory_documents USING gin (content gin_trgm_ops);
