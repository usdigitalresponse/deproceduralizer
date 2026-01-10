-- Migration: Add indexes for compliance_issue_analyses table
-- Purpose: Optimize queries for pipeline workflow and analytics

-- ═══════════════════════════════════════════════════════════════════
-- Classification filtering (for UI and analytics)
-- ═══════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_cia_tier1_classification
    ON compliance_issue_analyses(tier1_classification);

CREATE INDEX IF NOT EXISTS idx_cia_tier2_classification
    ON compliance_issue_analyses(tier2_classification);

CREATE INDEX IF NOT EXISTS idx_cia_tier3_classification
    ON compliance_issue_analyses(tier3_classification);

CREATE INDEX IF NOT EXISTS idx_cia_tier4_classification
    ON compliance_issue_analyses(tier4_classification);

-- ═══════════════════════════════════════════════════════════════════
-- Pipeline progression (partial indexes for queue processing)
-- ═══════════════════════════════════════════════════════════════════

-- Items that passed Tier 1 and need Tier 2 processing
CREATE INDEX IF NOT EXISTS idx_cia_needs_tier2
    ON compliance_issue_analyses(id)
    WHERE tier1_classification = 'needs_research'
      AND tier2_classification IS NULL;

-- Items that need Tier 3 (needs_full_context from Tier 2)
CREATE INDEX IF NOT EXISTS idx_cia_needs_tier3
    ON compliance_issue_analyses(id)
    WHERE tier2_classification = 'needs_full_context'
      AND tier3_classification IS NULL;

-- Items that need Tier 4 (web search requested)
CREATE INDEX IF NOT EXISTS idx_cia_needs_tier4
    ON compliance_issue_analyses(id)
    WHERE needs_web_search = true
      AND tier4_completed_at IS NULL;

-- JUSTIFIED items that are controversial (need web search validation)
CREATE INDEX IF NOT EXISTS idx_cia_justified_controversial
    ON compliance_issue_analyses(id)
    WHERE tier2_classification = 'justified'
      AND potentially_controversial = true
      AND tier4_completed_at IS NULL;

-- ═══════════════════════════════════════════════════════════════════
-- Common lookups
-- ═══════════════════════════════════════════════════════════════════

-- State and issue type filtering (for dashboard and reports)
CREATE INDEX IF NOT EXISTS idx_cia_state_issue
    ON compliance_issue_analyses(state, issue_type);

-- Document lookup (join to regulatory_documents)
CREATE INDEX IF NOT EXISTS idx_cia_document
    ON compliance_issue_analyses(document_id);

-- Pipeline version (for filtering legacy vs v4 results)
CREATE INDEX IF NOT EXISTS idx_cia_pipeline_version
    ON compliance_issue_analyses(pipeline_version);

-- ═══════════════════════════════════════════════════════════════════
-- JSONB indexes
-- ═══════════════════════════════════════════════════════════════════

-- GIN index for context_used queries (e.g., finding all items that used a specific source)
CREATE INDEX IF NOT EXISTS idx_cia_context_used
    ON compliance_issue_analyses USING GIN (context_used);

-- ═══════════════════════════════════════════════════════════════════
-- Severity filtering (for prioritization)
-- ═══════════════════════════════════════════════════════════════════

-- High-severity items (for priority review)
CREATE INDEX IF NOT EXISTS idx_cia_high_severity
    ON compliance_issue_analyses(id)
    WHERE final_severity >= 7;

-- Severity with state (for state-specific high-priority items)
CREATE INDEX IF NOT EXISTS idx_cia_state_severity
    ON compliance_issue_analyses(state, final_severity)
    WHERE final_severity IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════
-- Results filtering (for UI)
-- ═══════════════════════════════════════════════════════════════════

-- Burdensome items (main results)
CREATE INDEX IF NOT EXISTS idx_cia_burdensome
    ON compliance_issue_analyses(id)
    WHERE requirement_found = true
      AND is_justified = false;

-- Justified items (for review)
CREATE INDEX IF NOT EXISTS idx_cia_justified
    ON compliance_issue_analyses(id)
    WHERE is_justified = true;
