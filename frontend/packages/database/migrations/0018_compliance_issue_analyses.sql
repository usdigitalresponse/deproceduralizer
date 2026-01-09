-- Migration: Create compliance_issue_analyses table
-- Purpose: Document-level analysis results for the 4-tier research pipeline
-- One row per (document_id, issue_type) pair

CREATE TABLE IF NOT EXISTS compliance_issue_analyses (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT NOT NULL REFERENCES regulatory_documents(id) ON DELETE CASCADE,
    issue_type VARCHAR(50) NOT NULL,
    state VARCHAR(2) NOT NULL CHECK (state IN ('NY', 'NJ')),

    -- ═══════════════════════════════════════════════════════════════════
    -- Match Grouping
    -- ═══════════════════════════════════════════════════════════════════
    grouped_match_count INTEGER NOT NULL,
    -- Number of regex matches evaluated together

    -- ═══════════════════════════════════════════════════════════════════
    -- Tier 1: Match Filtering
    -- ═══════════════════════════════════════════════════════════════════
    tier1_relevant_match_ids INTEGER[],
    -- IDs from compliance_issues that passed filtering

    tier1_dismissed_match_ids INTEGER[],
    -- IDs from compliance_issues that were filtered out

    tier1_dismissed_reasons JSONB,
    -- Array of {match_id, text, reason}

    tier1_classification VARCHAR(30),
    -- 'all_false_positives' | 'needs_research'

    tier1_confidence REAL,
    -- 0.0-1.0

    tier1_reasoning TEXT,
    -- Explanation of filtering decisions

    tier1_context_requests JSONB,
    -- Array of ContextRequest objects for Tier 2:
    -- [{context_type, identifier, need_level: 'summary', reason}]

    tier1_batch_id VARCHAR(100),
    tier1_completed_at TIMESTAMP,

    -- ═══════════════════════════════════════════════════════════════════
    -- Tier 2: Summary-Based Research
    -- ═══════════════════════════════════════════════════════════════════
    tier2_classification VARCHAR(30),
    -- 'unrelated' | 'justified' | 'burdensome' | 'needs_full_context'

    tier2_confidence REAL,
    tier2_reasoning TEXT,

    verbatim_requirements TEXT[],
    -- Extracted requirement text (document-level, not per-match)

    severity INTEGER CHECK (severity >= 1 AND severity <= 10),
    severity_baseline INTEGER,
    severity_calculation TEXT,
    -- e.g., "Base 5 + no alternative (+2) - professional licensee (-1) = 6"

    argument_for_regulation TEXT,
    argument_against_regulation TEXT,

    context_used JSONB,
    -- Unified array of all context sources used in analysis

    tier2_full_text_requests JSONB,
    -- Array of ContextRequest objects for Tier 3

    needs_web_search BOOLEAN DEFAULT FALSE,
    web_search_topics TEXT[],

    -- Escalation flags for web search
    potentially_controversial BOOLEAN DEFAULT FALSE,
    -- True if affects vulnerable populations, civil rights, etc.

    federal_mandate_suspected BOOLEAN DEFAULT FALSE,
    -- True if federal statute cited but state discretion unclear

    ambiguity_type VARCHAR(20),
    -- 'internal' | 'external' | 'both' | NULL
    -- Routing hint for needs_full_context cases

    tier2_batch_id VARCHAR(100),
    tier2_completed_at TIMESTAMP,

    -- ═══════════════════════════════════════════════════════════════════
    -- Tier 3: Full Context Deep Dive
    -- ═══════════════════════════════════════════════════════════════════
    tier3_classification VARCHAR(30),
    -- 'burdensome' | 'justified' | 'unrelated'

    tier3_confidence REAL,
    tier3_reasoning TEXT,

    tier3_severity_adjustment INTEGER CHECK (tier3_severity_adjustment >= -3 AND tier3_severity_adjustment <= 3),
    -- Adjustment after seeing full context (delta from Tier 2)

    tier3_severity_adjustment_reasoning TEXT,
    -- Explanation of the adjustment calculation

    tier3_batch_id VARCHAR(100),
    tier3_completed_at TIMESTAMP,

    -- ═══════════════════════════════════════════════════════════════════
    -- Tier 4: Web Search Validation
    -- ═══════════════════════════════════════════════════════════════════
    tier4_classification VARCHAR(30),
    -- 'burdensome' | 'justified' | 'unrelated'

    tier4_severity_adjustment INTEGER CHECK (tier4_severity_adjustment >= -3 AND tier4_severity_adjustment <= 3),
    tier4_reasoning TEXT,
    web_search_summary TEXT,

    tier4_completed_at TIMESTAMP,
    -- No batch_id - Tier 4 uses real-time API

    -- ═══════════════════════════════════════════════════════════════════
    -- Final Derived Fields
    -- ═══════════════════════════════════════════════════════════════════
    requirement_found BOOLEAN,
    -- Derived: true for burdensome OR justified, false for unrelated

    is_justified BOOLEAN DEFAULT FALSE,
    -- Derived: true when classification is 'justified'

    is_verbatim BOOLEAN,
    -- Derived: all verbatim_requirements found in source document

    final_severity INTEGER,
    -- Derived: severity + tier3_adjustment + tier4_adjustment

    -- ═══════════════════════════════════════════════════════════════════
    -- Pipeline Tracking
    -- ═══════════════════════════════════════════════════════════════════
    pipeline_version VARCHAR(20) DEFAULT 'v4',
    highest_tier_completed INTEGER DEFAULT 0 CHECK (highest_tier_completed >= 0 AND highest_tier_completed <= 4),
    classification_tier INTEGER,
    -- Which tier made the final classification (1, 2, 3, or 4)

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(document_id, issue_type)
);

-- Comment on table
COMMENT ON TABLE compliance_issue_analyses IS 'Document-level analysis results for the 4-tier research pipeline. One row per (document_id, issue_type) pair.';

-- Comments on key columns
COMMENT ON COLUMN compliance_issue_analyses.grouped_match_count IS 'Number of regex matches from compliance_issues table that were grouped and analyzed together';
COMMENT ON COLUMN compliance_issue_analyses.tier1_classification IS 'all_false_positives = all matches were false positives, needs_research = at least one match needs research';
COMMENT ON COLUMN compliance_issue_analyses.tier2_classification IS 'unrelated, justified, burdensome, or needs_full_context (requires Tier 3)';
COMMENT ON COLUMN compliance_issue_analyses.ambiguity_type IS 'internal = need more state context (Tier 3), external = need federal verification (Tier 4), both = need both';
COMMENT ON COLUMN compliance_issue_analyses.context_used IS 'JSONB array of context sources used: [{type, identifier, quote, relevance, source_id, ...}]';
COMMENT ON COLUMN compliance_issue_analyses.classification_tier IS 'Which tier made the final classification (1=all_false_positives, 2-4=terminal classification)';
