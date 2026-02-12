-- Statute mandate checks: LLM analysis of whether cited statutes
-- actually mandate the flagged regulatory issue.
-- Post-pipeline step for NY regulations with statute links.

CREATE TABLE IF NOT EXISTS statute_mandate_checks (
    id BIGSERIAL PRIMARY KEY,
    analysis_id BIGINT NOT NULL REFERENCES compliance_issue_analyses(id) ON DELETE CASCADE,
    statute_id BIGINT NOT NULL REFERENCES statutes(id) ON DELETE CASCADE,
    link_id BIGINT REFERENCES regulation_statute_links(id) ON DELETE SET NULL,

    -- LLM output
    statute_mandated BOOLEAN NOT NULL,
    confidence REAL NOT NULL,
    reasoning TEXT NOT NULL,
    statute_text_excerpt TEXT,

    -- Metadata
    model VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(analysis_id, statute_id)
);

CREATE INDEX idx_statute_mandate_checks_analysis ON statute_mandate_checks(analysis_id);
CREATE INDEX idx_statute_mandate_checks_mandated ON statute_mandate_checks(statute_mandated);
