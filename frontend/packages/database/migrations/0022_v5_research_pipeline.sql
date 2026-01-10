-- Migration: V5 Research Pipeline Schema Updates
-- Purpose: Support 3-tier architecture with argument framing, re-runs, and structured flags
-- Changes:
--   - Add Tier 1 argument framing and recommendations
--   - Add Tier 2 re-run tracking
--   - Add Tier 3 structured flags (V5 Tier 3 = web verification, was V4 Tier 4)
-- Backward compatibility: tier4_* columns kept for V4 data

-- ═══════════════════════════════════════════════════════════════════════════
-- Tier 1: Argument Framing & Recommendations
-- ═══════════════════════════════════════════════════════════════════════════

-- Argument framing (only populated if tier1_classification = 'needs_research')
ALTER TABLE compliance_issue_analyses
ADD COLUMN tier1_argument_framing JSONB;

COMMENT ON COLUMN compliance_issue_analyses.tier1_argument_framing IS
    'V5: Argument framing from Tier 1. Contains best_argument_burdensome, best_argument_justified, best_argument_unrelated. Only populated if classification=needs_research.';

-- Recommendations for Tier 2
ALTER TABLE compliance_issue_analyses
ADD COLUMN tier1_recommendations JSONB;

COMMENT ON COLUMN compliance_issue_analyses.tier1_recommendations IS
    'V5: Tier 1 context requests for Tier 2 to fetch. Contains context_requests array [{context_type, identifier, need_level, reason}, ...].';

-- ═══════════════════════════════════════════════════════════════════════════
-- Tier 2: Re-run Tracking
-- ═══════════════════════════════════════════════════════════════════════════

-- Count of re-runs (0 = no re-runs, max = 2)
ALTER TABLE compliance_issue_analyses
ADD COLUMN tier2_rerun_count INTEGER DEFAULT 0 CHECK (tier2_rerun_count >= 0 AND tier2_rerun_count <= 2);

COMMENT ON COLUMN compliance_issue_analyses.tier2_rerun_count IS
    'V5: Number of times Tier 2 was re-run with additional context. Max 2.';

-- Log of context requests made during re-runs
ALTER TABLE compliance_issue_analyses
ADD COLUMN tier2_context_requests_made JSONB;

COMMENT ON COLUMN compliance_issue_analyses.tier2_context_requests_made IS
    'V5: Array of context requests made during re-runs. Each entry: {context_type, identifier, need_level, reason, timestamp}.';

-- Flag for forced classification when max re-runs exceeded
ALTER TABLE compliance_issue_analyses
ADD COLUMN tier2_forced_classification BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN compliance_issue_analyses.tier2_forced_classification IS
    'V5: True if classification was forced after exceeding max re-runs (2). Indicates lower confidence.';

-- ═══════════════════════════════════════════════════════════════════════════
-- Tier 3: Structured Flags (V5 Tier 3 = Web Verification)
-- ═══════════════════════════════════════════════════════════════════════════

-- Structured flags with evidence (V5 Tier 3 output)
-- Note: In V5, Tier 3 = web verification. This is stored separately from tier4_*
-- columns which are kept for V4 backward compatibility.
ALTER TABLE compliance_issue_analyses
ADD COLUMN tier3_flags JSONB;

COMMENT ON COLUMN compliance_issue_analyses.tier3_flags IS
    'V5: Structured verification flags with evidence. Contains superseded_by_law, federal_mandate_confirmed, state_discretion_found, modernized_alternative_found. Each is an EvidencedFlag with value, scope, reason, and evidence array.';

-- Evidence gap flag (true if web search found nothing relevant)
ALTER TABLE compliance_issue_analyses
ADD COLUMN tier3_evidence_gap BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN compliance_issue_analyses.tier3_evidence_gap IS
    'V5: True if Tier 3 web search found no relevant evidence. Indicates lower confidence in external verification.';

-- ═══════════════════════════════════════════════════════════════════════════
-- Tier 2: Add missing columns for V5 claims tracking
-- ═══════════════════════════════════════════════════════════════════════════

-- Whether Tier 2 claims no alternative exists (trigger for Tier 3)
ALTER TABLE compliance_issue_analyses
ADD COLUMN claims_no_alternative BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN compliance_issue_analyses.claims_no_alternative IS
    'V5: True if Tier 2 claims there is no electronic/remote alternative. Triggers Tier 3 if severity >= 7.';

-- Federal statute citation found in document
ALTER TABLE compliance_issue_analyses
ADD COLUMN cites_federal_statute BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN compliance_issue_analyses.cites_federal_statute IS
    'V5: True if document cites a federal statute. Triggers Tier 3 for verification.';

-- The actual federal citation if present
ALTER TABLE compliance_issue_analyses
ADD COLUMN federal_citation TEXT;

COMMENT ON COLUMN compliance_issue_analyses.federal_citation IS
    'V5: The federal citation found (e.g., "42 CFR 483.24"). NULL if cites_federal_statute is false.';

-- ═══════════════════════════════════════════════════════════════════════════
-- Create index for V5 pipeline queries
-- ═══════════════════════════════════════════════════════════════════════════

-- Index for finding items that need Tier 3 in V5
CREATE INDEX idx_compliance_issue_analyses_v5_tier3_triggers
ON compliance_issue_analyses (issue_type, cites_federal_statute, claims_no_alternative, severity)
WHERE pipeline_version = 'v5';

-- ═══════════════════════════════════════════════════════════════════════════
-- Update table comment
-- ═══════════════════════════════════════════════════════════════════════════

COMMENT ON TABLE compliance_issue_analyses IS
    'Document-level analysis results for research pipeline. V4 uses 4-tier architecture (columns tier1-tier4). V5 uses 3-tier architecture with proactive context, argument framing, and re-runs. Use pipeline_version column to distinguish.';
