-- Migration: Add developer tracking fields to definitions table
-- Matches the pattern used in red_flags and compliance_issues tables

ALTER TABLE definitions
ADD COLUMN IF NOT EXISTS developer_status VARCHAR(50) DEFAULT 'unresolved',
ADD COLUMN IF NOT EXISTS developer_assigned VARCHAR(50),
ADD COLUMN IF NOT EXISTS developer_notes TEXT,
ADD COLUMN IF NOT EXISTS resolution_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS resolution_comments TEXT,
ADD COLUMN IF NOT EXISTS developer_question TEXT,
ADD COLUMN IF NOT EXISTS developer_checked_at TIMESTAMP;

-- Index for filtering by developer status (for developer mode queries)
CREATE INDEX IF NOT EXISTS idx_definitions_developer_status ON definitions(developer_status);

-- Composite index for developer filters (status + assigned)
CREATE INDEX IF NOT EXISTS idx_definitions_developer_filters ON definitions(developer_status, developer_assigned);

COMMENT ON COLUMN definitions.developer_status IS 'Developer tracking status: unresolved, resolved, pending, backlogged, need_more_info';
COMMENT ON COLUMN definitions.developer_assigned IS 'Developer assigned to this definition';
COMMENT ON COLUMN definitions.developer_notes IS 'Internal notes from developer';
COMMENT ON COLUMN definitions.resolution_type IS 'How the definition was resolved: implemented, not_implemented';
COMMENT ON COLUMN definitions.resolution_comments IS 'Details about the resolution';
COMMENT ON COLUMN definitions.developer_question IS 'Question for reviewer when status is need_more_info';
COMMENT ON COLUMN definitions.developer_checked_at IS 'When developer last updated this record';
