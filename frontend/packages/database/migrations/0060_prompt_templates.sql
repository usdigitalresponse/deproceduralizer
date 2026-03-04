-- Migration 0060: Prompt Templates
-- Store deduplicated prompt templates and link them to compliance_issue_analyses rows
-- for frontend prompt observability.

-- ═══════════════════════════════════════════════════════════════════
-- New table: prompt_templates
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE prompt_templates (
    id BIGSERIAL PRIMARY KEY,
    content_hash TEXT NOT NULL UNIQUE,          -- SHA-256 of canonical request params
    pipeline TEXT NOT NULL,                     -- 'research', 'jenai', 'summarization'
    tier INTEGER,                               -- 1, 2, 3 (NULL for single-pass pipelines)
    model TEXT NOT NULL,
    system_prompt TEXT,                          -- extracted system prompt text
    user_message TEXT,                           -- extracted user message text (all parts concatenated)
    tools_schema JSONB,                          -- tool definitions
    full_request JSONB,                          -- complete request params for exact reproduction
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_prompt_templates_pipeline_tier ON prompt_templates(pipeline, tier);

-- ═══════════════════════════════════════════════════════════════════
-- New FK columns on compliance_issue_analyses
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE compliance_issue_analyses
    ADD COLUMN tier1_prompt_id BIGINT REFERENCES prompt_templates(id),
    ADD COLUMN tier2_prompt_id BIGINT REFERENCES prompt_templates(id),
    ADD COLUMN tier3_prompt_id BIGINT REFERENCES prompt_templates(id);
