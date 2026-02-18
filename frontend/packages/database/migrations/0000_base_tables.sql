-- Migration: Bootstrap base tables for fresh database setup
-- Run with: psql $DATABASE_URL -f migrations/0000_base_tables.sql
--
-- These 4 tables were originally created by a now-deleted schema.sql.
-- This migration recreates them using the live DB schema as ground truth.
-- All statements use IF NOT EXISTS for idempotency on existing databases.

-- ==========================================================================
-- Extensions
-- ==========================================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ==========================================================================
-- Table: regulatory_documents
-- ==========================================================================
CREATE TABLE IF NOT EXISTS regulatory_documents (
    id BIGSERIAL PRIMARY KEY,
    source_index INTEGER,
    type VARCHAR(50) NOT NULL,
    state VARCHAR(3),
    title TEXT NOT NULL,
    url TEXT,
    url_type VARCHAR(50),
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    parent_id BIGINT,
    hierarchy_level VARCHAR(50),
    hierarchy_path TEXT,

    -- NYCRR (New York Codes, Rules and Regulations) columns
    nycrr_title INTEGER,
    nycrr_title_name TEXT,
    nycrr_subtitle VARCHAR(50),
    nycrr_subtitle_name TEXT,
    nycrr_chapter VARCHAR(50),
    nycrr_chapter_name TEXT,
    nycrr_subchapter VARCHAR(50),
    nycrr_subchapter_name TEXT,
    nycrr_article VARCHAR(50),
    nycrr_article_name TEXT,
    nycrr_part VARCHAR(50),
    nycrr_part_name TEXT,
    nycrr_subpart VARCHAR(50),
    nycrr_subpart_name TEXT,
    nycrr_section VARCHAR(50),
    nycrr_section_name TEXT,

    -- NJAC (New Jersey Administrative Code) columns
    njac_title VARCHAR(50),
    njac_title_name TEXT,
    njac_subtitle VARCHAR(50),
    njac_subtitle_name TEXT,
    njac_chapter VARCHAR(50),
    njac_chapter_name TEXT,
    njac_subchapter VARCHAR(50),
    njac_subchapter_name TEXT,
    njac_article VARCHAR(50),
    njac_article_name TEXT,
    njac_part VARCHAR(50),
    njac_part_name TEXT,
    njac_subpart VARCHAR(50),
    njac_subpart_name TEXT,
    njac_section VARCHAR(50),
    njac_section_name TEXT,

    -- NJSA (New Jersey Statutes) columns
    njsa_title VARCHAR(10),
    njsa_title_name TEXT,
    njsa_chapter VARCHAR(20),
    njsa_section VARCHAR(20),
    njsa_section_name TEXT,
    njsa_citation VARCHAR(50),

    -- Scraped URL tracking
    scraped_from_url TEXT,

    -- Precomputed hierarchy stats
    direct_child_count INTEGER DEFAULT 0,
    descendant_count INTEGER DEFAULT 0,
    descendant_flag_count INTEGER DEFAULT 0,
    descendant_max_severity INTEGER,
    has_descendant_analysis BOOLEAN DEFAULT FALSE,
    compliance_issue_count INTEGER DEFAULT 0,
    descendant_compliance_issue_count INTEGER DEFAULT 0,

    -- Regulatory status
    regulatory_status VARCHAR(20) DEFAULT 'active',
    recodified_to VARCHAR(100)
);

-- Self-referencing FK for hierarchy
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'regulatory_documents_parent_id_fkey'
    ) THEN
        ALTER TABLE regulatory_documents
            ADD CONSTRAINT regulatory_documents_parent_id_fkey
            FOREIGN KEY (parent_id) REFERENCES regulatory_documents(id)
            ON DELETE SET NULL;
    END IF;
END $$;

-- Unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS unique_per_url
    ON regulatory_documents(url);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rd_state_source_type
    ON regulatory_documents(state, source_index, type);

-- Key indexes
CREATE INDEX IF NOT EXISTS idx_documents_state ON regulatory_documents(state);
CREATE INDEX IF NOT EXISTS idx_documents_parent ON regulatory_documents(parent_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON regulatory_documents(type);
CREATE INDEX IF NOT EXISTS idx_documents_url ON regulatory_documents(url);
CREATE INDEX IF NOT EXISTS idx_documents_state_type ON regulatory_documents(state, type);
CREATE INDEX IF NOT EXISTS idx_documents_hierarchy_level ON regulatory_documents(hierarchy_level);
CREATE INDEX IF NOT EXISTS idx_documents_regulatory_status ON regulatory_documents(regulatory_status);
CREATE INDEX IF NOT EXISTS idx_documents_regulatory_status_state ON regulatory_documents(state, regulatory_status);

-- NYCRR composite indexes
CREATE INDEX IF NOT EXISTS idx_documents_nycrr_title ON regulatory_documents(nycrr_title);
CREATE INDEX IF NOT EXISTS idx_documents_nycrr_part ON regulatory_documents(nycrr_part);
CREATE INDEX IF NOT EXISTS idx_documents_nycrr_subpart ON regulatory_documents(nycrr_subpart);
CREATE INDEX IF NOT EXISTS idx_documents_nycrr_title_part ON regulatory_documents(nycrr_title, nycrr_part);
CREATE INDEX IF NOT EXISTS idx_documents_nycrr_title_part_subpart ON regulatory_documents(nycrr_title, nycrr_part, nycrr_subpart);

-- ==========================================================================
-- Table: analyses
-- ==========================================================================
CREATE TABLE IF NOT EXISTS analyses (
    id BIGSERIAL PRIMARY KEY,
    analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    model_version VARCHAR(100),
    has_implementation_issues BOOLEAN DEFAULT FALSE,
    overall_complexity VARCHAR(10),
    summary TEXT,
    requires_technical_review BOOLEAN DEFAULT FALSE,
    has_reporting_requirement BOOLEAN DEFAULT FALSE,
    max_severity INTEGER,
    num_flags INTEGER DEFAULT 0,
    is_current BOOLEAN DEFAULT TRUE,
    url TEXT NOT NULL,
    document_id BIGINT,
    run_id VARCHAR(32)
);

CREATE INDEX IF NOT EXISTS idx_analyses_url ON analyses(url);
CREATE INDEX IF NOT EXISTS idx_analyses_run_id ON analyses(run_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_analyses_one_current_per_document
    ON analyses(document_id) WHERE is_current = TRUE;

-- ==========================================================================
-- Table: red_flags
-- ==========================================================================
CREATE TABLE IF NOT EXISTS red_flags (
    id BIGSERIAL PRIMARY KEY,
    analysis_id BIGINT NOT NULL,
    category VARCHAR(100) NOT NULL,
    explanation TEXT NOT NULL,
    severity INTEGER NOT NULL,
    complexity VARCHAR(20) NOT NULL,
    matched_phrases TEXT[] DEFAULT '{}',
    implementation_approach TEXT NOT NULL,
    effort_estimate VARCHAR(255),
    text_examples TEXT[] DEFAULT '{}',

    -- Review fields
    review_status VARCHAR(50) DEFAULT 'unreviewed',
    reviewed_by VARCHAR(255),
    reviewed_at TIMESTAMP,
    justification_notes TEXT,
    team_notes TEXT,
    priority INTEGER,
    impact_type VARCHAR(100),

    -- Developer tracking
    developer_status VARCHAR(50) DEFAULT 'unresolved',
    developer_assigned VARCHAR(50),
    developer_notes TEXT,
    resolution_type VARCHAR(50),
    resolution_comments TEXT,
    developer_question TEXT,
    developer_checked_at TIMESTAMP
);

-- FK to analyses
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'red_flags_analysis_id_fkey'
    ) THEN
        ALTER TABLE red_flags
            ADD CONSTRAINT red_flags_analysis_id_fkey
            FOREIGN KEY (analysis_id) REFERENCES analyses(id)
            ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_red_flags_analysis ON red_flags(analysis_id);
CREATE INDEX IF NOT EXISTS idx_red_flags_severity ON red_flags(severity);
CREATE INDEX IF NOT EXISTS idx_red_flags_review_status ON red_flags(review_status);
CREATE INDEX IF NOT EXISTS idx_red_flags_developer_status ON red_flags(developer_status);
CREATE INDEX IF NOT EXISTS idx_red_flags_developer_assigned ON red_flags(developer_assigned);
CREATE INDEX IF NOT EXISTS idx_red_flags_priority ON red_flags(priority) WHERE priority IS NOT NULL;

-- ==========================================================================
-- Table: definitions
-- ==========================================================================
CREATE TABLE IF NOT EXISTS definitions (
    id BIGSERIAL PRIMARY KEY,
    term TEXT NOT NULL,
    verbatim_text TEXT NOT NULL,
    scope TEXT,
    definition_overlap DOUBLE PRECISION DEFAULT 0.0,
    source_location TEXT,
    model_version VARCHAR(100),
    extracted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    url TEXT NOT NULL,
    document_id BIGINT,

    -- Enhanced scope tracking
    scope_level VARCHAR(20),
    scope_document_id BIGINT,
    definition_type VARCHAR(20) DEFAULT 'formal',
    normalized_term TEXT,
    is_cross_reference BOOLEAN DEFAULT FALSE,
    is_verbatim_text_complete BOOLEAN DEFAULT TRUE,
    rephrased_definition TEXT,

    -- Cross-reference categorization
    reference_completeness VARCHAR(20),
    reference_target VARCHAR(30),

    -- Review workflow
    review_status VARCHAR(50) DEFAULT 'unreviewed',
    reviewed_at TIMESTAMP,
    reviewer_name VARCHAR(255),
    justification_notes TEXT,
    team_notes TEXT,
    original_values JSONB,

    -- Developer tracking
    developer_status VARCHAR(50) DEFAULT 'unresolved',
    developer_assigned VARCHAR(50),
    developer_notes TEXT,
    resolution_type VARCHAR(50),
    resolution_comments TEXT,
    developer_question TEXT,
    developer_checked_at TIMESTAMP
);

-- FK: scope_document_id -> regulatory_documents
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'definitions_scope_document_id_fkey'
    ) THEN
        ALTER TABLE definitions
            ADD CONSTRAINT definitions_scope_document_id_fkey
            FOREIGN KEY (scope_document_id) REFERENCES regulatory_documents(id)
            ON DELETE SET NULL;
    END IF;
END $$;

-- Check constraints for cross-reference categorization
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'chk_reference_completeness'
    ) THEN
        ALTER TABLE definitions ADD CONSTRAINT chk_reference_completeness
            CHECK (reference_completeness IS NULL OR reference_completeness IN ('pure_pointer', 'hybrid'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'chk_reference_target'
    ) THEN
        ALTER TABLE definitions ADD CONSTRAINT chk_reference_target
            CHECK (reference_target IS NULL OR reference_target IN ('same_corpus', 'federal', 'external_standard', 'other'));
    END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_definitions_url ON definitions(url);
CREATE INDEX IF NOT EXISTS idx_definitions_term ON definitions(term);
CREATE INDEX IF NOT EXISTS idx_definitions_overlap ON definitions(definition_overlap);
CREATE INDEX IF NOT EXISTS idx_definitions_normalized_term ON definitions(normalized_term);
CREATE INDEX IF NOT EXISTS idx_definitions_normalized_term_trgm ON definitions USING gin(normalized_term gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_definitions_term_trgm ON definitions USING gin(term gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_definitions_scope_document ON definitions(scope_document_id);
CREATE INDEX IF NOT EXISTS idx_definitions_scope_level ON definitions(scope_level);
CREATE INDEX IF NOT EXISTS idx_definitions_type ON definitions(definition_type);
CREATE INDEX IF NOT EXISTS idx_definitions_review_status ON definitions(review_status);
CREATE INDEX IF NOT EXISTS idx_definitions_developer_status ON definitions(developer_status);
CREATE INDEX IF NOT EXISTS idx_definitions_developer_filters ON definitions(developer_status, developer_assigned);
