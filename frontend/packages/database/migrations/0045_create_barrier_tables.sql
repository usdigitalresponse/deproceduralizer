-- 0045_create_barrier_tables.sql
-- Barrier Pipeline: Two-tier regulatory implementation analysis

-- ═══════════════════════════════════════════════════════════════════
-- barrier_analyses: One row per document analyzed
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE barrier_analyses (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT NOT NULL REFERENCES regulatory_documents(id) ON DELETE CASCADE,
    state VARCHAR(2) NOT NULL,
    run_id VARCHAR(32),

    -- Tier 1: Catalog Context
    tier1_categories JSONB,
    tier1_has_issues BOOLEAN,
    tier1_classification VARCHAR(30),
    tier1_confidence REAL,
    tier1_context_requests JSONB,
    tier1_batch_id VARCHAR(100),
    tier1_completed_at TIMESTAMP,

    -- Tier 2: Full Context Confirmation
    tier2_categories JSONB,
    tier2_has_issues BOOLEAN,
    tier2_classification VARCHAR(30),
    tier2_confidence REAL,
    tier2_new_discoveries JSONB,
    tier2_context_used JSONB,
    tier2_batch_id VARCHAR(100),
    tier2_completed_at TIMESTAMP,

    -- Final Derived
    has_implementation_issues BOOLEAN,
    overall_complexity VARCHAR(10),
    summary TEXT,
    max_severity INTEGER,
    num_categories_found INTEGER,

    -- Pipeline Tracking
    highest_tier_completed INTEGER DEFAULT 0,
    pipeline_version VARCHAR(20),
    model_version VARCHAR(100),

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT barrier_analyses_document_unique UNIQUE (document_id)
);

CREATE INDEX idx_barrier_analyses_state ON barrier_analyses(state);
CREATE INDEX idx_barrier_analyses_run_id ON barrier_analyses(run_id);
CREATE INDEX idx_barrier_analyses_tier_completed ON barrier_analyses(highest_tier_completed);

-- ═══════════════════════════════════════════════════════════════════
-- barrier_issues: One row per category finding per document
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE barrier_issues (
    id BIGSERIAL PRIMARY KEY,
    analysis_id BIGINT NOT NULL REFERENCES barrier_analyses(id) ON DELETE CASCADE,
    document_id BIGINT NOT NULL REFERENCES regulatory_documents(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL CHECK (category IN (
        'REGULATORY_COMPLEXITY',
        'POLICY_IMPLEMENTATION_SEPARATION',
        'CASCADE_OF_RIGIDITY',
        'MANDATED_STEPS_NOT_OUTCOMES',
        'ADMINISTRATIVE_BURDENS',
        'NO_FEEDBACK_LOOPS',
        'PROCESS_WORSHIP_OVERSIGHT',
        'ZERO_RISK_LANGUAGE',
        'FROZEN_TECHNOLOGY',
        'IMPLEMENTATION_OPPORTUNITY',
        'MISSING_OUTCOMES',
        'UNCLEAR_DELEGATION',
        'ACCESS_ASSUMPTION_BARRIERS',
        'INTERAGENCY_FRAGMENTATION'
    )),

    -- Analysis
    explanation TEXT NOT NULL,
    severity INTEGER NOT NULL CHECK (severity >= 1 AND severity <= 10),
    complexity VARCHAR(20) NOT NULL,
    confidence REAL NOT NULL CHECK (confidence >= 0.0 AND confidence <= 1.0),
    matched_phrases TEXT[] DEFAULT '{}'::text[],
    implementation_approach TEXT,
    effort_estimate VARCHAR(255),
    text_examples TEXT[] DEFAULT '{}'::text[],

    -- Tier Tracking
    discovered_in_tier INTEGER NOT NULL CHECK (discovered_in_tier IN (1, 2)),
    confirmed_in_tier INTEGER,
    tier2_revised BOOLEAN DEFAULT FALSE,

    -- Human Review (same pattern as red_flags)
    review_status VARCHAR(50) DEFAULT 'unreviewed',
    reviewed_by VARCHAR(255),
    reviewed_at TIMESTAMP,
    justification_notes TEXT,
    team_notes TEXT,
    priority INTEGER,
    impact_type VARCHAR(100),

    -- Developer Tracking (same pattern as red_flags)
    developer_status VARCHAR(50) DEFAULT 'unresolved',
    developer_assigned VARCHAR(50),
    developer_notes TEXT,
    resolution_type VARCHAR(50),
    resolution_comments TEXT,
    developer_question TEXT,
    developer_checked_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT barrier_issues_analysis_category_unique UNIQUE (analysis_id, category)
);

CREATE INDEX idx_barrier_issues_document ON barrier_issues(document_id);
CREATE INDEX idx_barrier_issues_category ON barrier_issues(category);
CREATE INDEX idx_barrier_issues_review_status ON barrier_issues(review_status);
CREATE INDEX idx_barrier_issues_severity ON barrier_issues(severity);
