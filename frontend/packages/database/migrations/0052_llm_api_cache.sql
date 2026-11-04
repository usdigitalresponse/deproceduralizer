-- Migration: Create LLM API response cache table
-- Stores API responses keyed by SHA-256 hash of the request body.
-- Used for: dev iteration replay, disaster recovery, deduplication within runs.

CREATE TABLE llm_api_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_hash TEXT NOT NULL UNIQUE,
    pipeline TEXT,              -- 'research', 'barrier', 'summarization', etc.
    tier INTEGER,               -- 1, 2, 3, or NULL
    document_id BIGINT,         -- FK to regulatory_documents (nullable)
    model TEXT NOT NULL,
    request_body JSONB NOT NULL,
    response_body JSONB NOT NULL,
    input_tokens INTEGER,
    output_tokens INTEGER,
    cache_read_tokens INTEGER,
    cache_write_tokens INTEGER,
    stale_after TIMESTAMPTZ,    -- NULL = never stale
    created_at TIMESTAMPTZ DEFAULT NOW(),
    prompt_hash TEXT             -- hash of just the prompt template
);

CREATE INDEX idx_cache_request_hash ON llm_api_cache(request_hash);
CREATE INDEX idx_cache_semantic ON llm_api_cache(pipeline, tier);
CREATE INDEX idx_cache_document ON llm_api_cache(document_id);
CREATE INDEX idx_cache_stale ON llm_api_cache(stale_after) WHERE stale_after IS NOT NULL;
