-- Align fines enrichment column widths with Drizzle schema.
-- Migration 0083 created these at varchar(100/50), later migrations used
-- ADD COLUMN IF NOT EXISTS with narrower widths (no-op on existing DBs).
-- This migration ensures all databases match the Drizzle model.

ALTER TABLE fines_fees_penalties
  ALTER COLUMN activity_category TYPE varchar(40),
  ALTER COLUMN estimated_annual_payers TYPE varchar(30),
  ALTER COLUMN who_pays_normalized TYPE varchar(40);
