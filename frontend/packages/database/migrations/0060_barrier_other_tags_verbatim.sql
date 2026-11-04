-- Rename WORST_THING → OTHER, remove multi-document categories, add new per-section categories
-- Issues #196 and #234

-- 1. Rename existing WORST_THING category values to OTHER
UPDATE barrier_issues SET category = 'OTHER' WHERE category = 'WORST_THING';

-- 2. Reclassify removed multi-document categories to OTHER
-- These can't work in a per-section pipeline (need cross-document context)
UPDATE barrier_issues SET category = 'OTHER' WHERE category IN (
    'STATE_EXCEEDS_FEDERAL',
    'DUPLICATIVE_REQUIREMENTS',
    'INTERAGENCY_FRAGMENTATION'
);

-- 3. Drop the worst_thing column from barrier_analyses
ALTER TABLE barrier_analyses DROP COLUMN IF EXISTS worst_thing;

-- 4. Add tags column (kebab-case labels per finding)
ALTER TABLE barrier_issues ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- 5. Add is_verbatim column (whether matched_phrases are verbatim from source)
ALTER TABLE barrier_issues ADD COLUMN IF NOT EXISTS is_verbatim boolean;

-- 6. Update CHECK constraint: 18 categories (remove 3 multi-doc, add 2 per-section, rename 1)
ALTER TABLE barrier_issues DROP CONSTRAINT IF EXISTS barrier_issues_category_check;

ALTER TABLE barrier_issues ADD CONSTRAINT barrier_issues_category_check CHECK (
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
        'OTHER',
        'MISSING_OUTCOMES',
        'UNCLEAR_DELEGATION',
        'ACCESS_ASSUMPTION_BARRIERS',
        'FEE_COST_BURDENS',
        'DEAD_SUPERSEDED_REFERENCES',
        'MISSING_DIGITAL_AUTHORIZATION',
        'ONE_SIZE_FITS_ALL',
        'UNFUNDED_MANDATE'
    )
);
