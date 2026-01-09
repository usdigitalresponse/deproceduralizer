-- Migration: Drop unused legacy definition tables
-- These tables are not used by the frontend and contain minimal/stale data

-- extracted_definitions: Legacy table from earlier implementation (17 rows)
-- Superseded by the 'definitions' table
-- Must be dropped first due to FK to definition_extractions
DROP TABLE IF EXISTS extracted_definitions;

-- definition_extractions: Legacy table from earlier implementation (5 rows)
-- Superseded by the 'definitions' table
DROP TABLE IF EXISTS definition_extractions;

-- definition_extraction_log: Backend tracking for definition extraction runs (1,025 rows)
-- Not referenced by frontend, only used during batch processing
DROP TABLE IF EXISTS definition_extraction_log;
