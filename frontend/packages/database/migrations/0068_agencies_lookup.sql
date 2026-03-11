-- Agency lookup tables for deduplication of responsible_agency across fines, compliance, and JenAI
-- Phase 1: fines_fees_penalties only; other tables get FKs in a follow-up

CREATE TABLE agencies (
    id bigserial PRIMARY KEY,
    jurisdiction varchar(3) NOT NULL,
    canonical_name text NOT NULL,
    abbreviation varchar(50),
    created_at timestamp DEFAULT now(),
    CONSTRAINT chk_agencies_jurisdiction CHECK (jurisdiction IN ('NY', 'NJ', 'NYC')),
    CONSTRAINT uq_agencies_jurisdiction_name UNIQUE (jurisdiction, canonical_name)
);
CREATE INDEX idx_agencies_jurisdiction ON agencies(jurisdiction);

CREATE TABLE agency_aliases (
    id bigserial PRIMARY KEY,
    agency_id bigint NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    alias text NOT NULL,
    source varchar(50) DEFAULT 'manual',  -- 'canonical', 'title_map', 'llm', 'guidance', 'manual'
    created_at timestamp DEFAULT now(),
    CONSTRAINT uq_agency_aliases UNIQUE (agency_id, alias)
);
CREATE INDEX idx_agency_aliases_agency_id ON agency_aliases(agency_id);
CREATE INDEX idx_agency_aliases_alias ON agency_aliases(alias);

ALTER TABLE fines_fees_penalties
  ADD COLUMN IF NOT EXISTS agency_id bigint REFERENCES agencies(id) ON DELETE SET NULL;
CREATE INDEX idx_fines_agency_id ON fines_fees_penalties(agency_id) WHERE agency_id IS NOT NULL;
