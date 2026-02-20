-- Migration: Collapse JenAI pipeline from 2-tier to single enriched pass
-- Drops tier1/tier2 columns, adds single-pass columns, replaces IMPLEMENTATION_OPPORTUNITY with WORST_THING
-- Archive existing data FIRST: cd backend && python3 -m scripts.jenai_pipeline.archive_v1_results

-- ============================================================================
-- 1. Delete existing data (archived beforehand)
-- ============================================================================
DELETE FROM jenai_issues;
DELETE FROM jenai_analyses;

-- ============================================================================
-- 2. jenai_analyses: Drop tier-specific columns
-- ============================================================================
ALTER TABLE jenai_analyses
    DROP COLUMN IF EXISTS tier1_categories,
    DROP COLUMN IF EXISTS tier1_has_issues,
    DROP COLUMN IF EXISTS tier1_classification,
    DROP COLUMN IF EXISTS tier1_confidence,
    DROP COLUMN IF EXISTS tier1_context_requests,
    DROP COLUMN IF EXISTS tier1_batch_id,
    DROP COLUMN IF EXISTS tier1_completed_at,
    DROP COLUMN IF EXISTS tier2_categories,
    DROP COLUMN IF EXISTS tier2_has_issues,
    DROP COLUMN IF EXISTS tier2_classification,
    DROP COLUMN IF EXISTS tier2_confidence,
    DROP COLUMN IF EXISTS tier2_new_discoveries,
    DROP COLUMN IF EXISTS tier2_context_used,
    DROP COLUMN IF EXISTS tier2_batch_id,
    DROP COLUMN IF EXISTS tier2_completed_at,
    DROP COLUMN IF EXISTS highest_tier_completed;

-- ============================================================================
-- 3. jenai_analyses: Add single-pass columns
-- ============================================================================
ALTER TABLE jenai_analyses
    ADD COLUMN batch_id VARCHAR(100),
    ADD COLUMN completed_at TIMESTAMP,
    ADD COLUMN classification VARCHAR(30),
    ADD COLUMN confidence REAL,
    ADD COLUMN categories JSONB,
    ADD COLUMN worst_thing TEXT;

-- ============================================================================
-- 4. jenai_issues: Drop tier-tracking columns
-- ============================================================================
ALTER TABLE jenai_issues
    DROP COLUMN IF EXISTS discovered_in_tier,
    DROP COLUMN IF EXISTS confirmed_in_tier,
    DROP COLUMN IF EXISTS tier2_revised;

-- ============================================================================
-- 5. jenai_issues: Update category CHECK constraint
--    Replace IMPLEMENTATION_OPPORTUNITY with WORST_THING
-- ============================================================================
-- Drop old constraint if it exists (may have been defined at table creation)
ALTER TABLE jenai_issues DROP CONSTRAINT IF EXISTS jenai_issues_category_check;

-- Widen effort_estimate to text (LLM outputs can exceed 255 chars)
ALTER TABLE jenai_issues ALTER COLUMN effort_estimate TYPE text;

-- Add updated constraint
ALTER TABLE jenai_issues ADD CONSTRAINT jenai_issues_category_check CHECK (
    category IN (
        'REGULATORY_COMPLEXITY',
        'POLICY_IMPLEMENTATION_SEPARATION',
        'CASCADE_OF_RIGIDITY',
        'MANDATED_STEPS_NOT_OUTCOMES',
        'ADMINISTRATIVE_BURDENS',
        'NO_FEEDBACK_LOOPS',
        'PROCESS_WORSHIP_OVERSIGHT',
        'ZERO_RISK_LANGUAGE',
        'FROZEN_TECHNOLOGY',
        'WORST_THING',
        'MISSING_OUTCOMES',
        'UNCLEAR_DELEGATION',
        'ACCESS_ASSUMPTION_BARRIERS',
        'INTERAGENCY_FRAGMENTATION'
    )
);
