-- Migration: Create fines_fees_penalties table
-- Structured extraction of monetary charges (fines, fees, penalties, surcharges)
-- from both regulations and guidance documents.
-- Follows the IBR pattern: dedicated table with domain-specific columns.

CREATE TABLE fines_fees_penalties (
    id bigserial PRIMARY KEY,

    -- Exactly one source document (regulation OR guidance)
    document_id bigint REFERENCES regulatory_documents(id) ON DELETE CASCADE,
    guidance_document_id bigint REFERENCES guidance_documents(id) ON DELETE CASCADE,

    CONSTRAINT fines_one_source_check CHECK (
        (document_id IS NOT NULL AND guidance_document_id IS NULL)
        OR (document_id IS NULL AND guidance_document_id IS NOT NULL)
    ),

    -- Structured fine/fee/penalty data
    penalty_type varchar(50) NOT NULL,        -- 'fine', 'fee', 'penalty', 'surcharge', 'forfeiture', 'other'
    amount text,                               -- Display string: "$500", "$1,000 per day", "up to $10,000"
    amount_min numeric(12,2),                  -- Parsed minimum (nullable if unparseable)
    amount_max numeric(12,2),                  -- Parsed maximum (nullable if unparseable)
    per_unit varchar(100),                     -- "per violation", "per day", "per occurrence", etc.
    who_pays varchar(255),                     -- "licensee", "applicant", "employer", "any person", etc.
    responsible_agency varchar(255),           -- Agency that administers or collects
    violation_description text,                -- What triggers the fine/fee
    requirement_quote text,                    -- Exact quote from source document
    context text NOT NULL,                     -- Broader snippet for context
    term_matched varchar(255),                 -- Which regex pattern triggered the match
    llm_confirmed boolean DEFAULT false,       -- LLM verified this as a real fine/fee/penalty

    -- Metadata
    jurisdiction varchar(3) NOT NULL,
    url text,

    CONSTRAINT chk_fines_jurisdiction CHECK (jurisdiction IN ('NY', 'NJ', 'NYC')),

    -- Review workflow (matching IBR/compliance pattern)
    review_status varchar(50) DEFAULT 'unreviewed',
    reviewed_by varchar(255),
    reviewed_at timestamp,
    team_notes text,
    priority integer,

    -- Developer tracking
    developer_status varchar(50) DEFAULT 'unresolved',
    developer_assigned varchar(50),
    developer_notes text,
    resolution_type varchar(50),
    resolution_comments text,
    developer_question text,
    developer_checked_at timestamp,

    created_at timestamp DEFAULT now()
);

-- Indexes
CREATE INDEX idx_fines_jurisdiction ON fines_fees_penalties(jurisdiction);
CREATE INDEX idx_fines_document_id ON fines_fees_penalties(document_id) WHERE document_id IS NOT NULL;
CREATE INDEX idx_fines_guidance_document_id ON fines_fees_penalties(guidance_document_id) WHERE guidance_document_id IS NOT NULL;
CREATE INDEX idx_fines_penalty_type ON fines_fees_penalties(penalty_type);
CREATE INDEX idx_fines_responsible_agency ON fines_fees_penalties(responsible_agency);
CREATE INDEX idx_fines_llm_confirmed ON fines_fees_penalties(llm_confirmed);
