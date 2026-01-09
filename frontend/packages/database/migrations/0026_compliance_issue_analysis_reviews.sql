-- Migration 0026: compliance_issue_analysis_reviews
-- Reviews for 3-tier pipeline analyses with optional per-tier granularity

CREATE TABLE compliance_issue_analysis_reviews (
    id BIGSERIAL PRIMARY KEY,

    -- Link to analysis
    analysis_id BIGINT NOT NULL
        REFERENCES compliance_issue_analyses(id) ON DELETE CASCADE,

    -- Tier scope (NULL = whole analysis, 1/2/3 = specific tier)
    tier INTEGER CHECK (tier IS NULL OR tier BETWEEN 1 AND 3),

    -- Review fields (consistent with existing pattern)
    review_status VARCHAR(50) NOT NULL DEFAULT 'unreviewed',
    reviewed_by VARCHAR(255),
    reviewed_at TIMESTAMP,
    justification_notes TEXT,
    team_notes TEXT,

    -- Override fields (reviewer can override LLM conclusions)
    override_classification VARCHAR(30),
    override_severity INTEGER CHECK (override_severity IS NULL OR override_severity BETWEEN 1 AND 10),
    override_reasoning TEXT,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraint: one review per analysis+tier combination
    UNIQUE(analysis_id, tier)
);

-- Indexes
CREATE INDEX idx_analysis_reviews_analysis ON compliance_issue_analysis_reviews(analysis_id);
CREATE INDEX idx_analysis_reviews_status ON compliance_issue_analysis_reviews(review_status);
CREATE INDEX idx_analysis_reviews_tier ON compliance_issue_analysis_reviews(tier) WHERE tier IS NOT NULL;

-- Comments
COMMENT ON TABLE compliance_issue_analysis_reviews IS
    'Reviews for compliance_issue_analyses. tier=NULL is per-analysis review, tier=1/2/3 is per-tier review.';
COMMENT ON COLUMN compliance_issue_analysis_reviews.tier IS
    'NULL = review applies to whole analysis. 1/2/3 = review applies to specific tier output.';
COMMENT ON COLUMN compliance_issue_analysis_reviews.override_classification IS
    'Reviewer override of LLM classification (unrelated/justified/burdensome)';
