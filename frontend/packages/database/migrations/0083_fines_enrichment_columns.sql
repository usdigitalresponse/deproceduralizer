-- Enrichment columns for fines_fees_penalties (added by Abigail, already present in live DB)
-- This migration documents their addition for migration tracking purposes.

ALTER TABLE fines_fees_penalties ADD COLUMN IF NOT EXISTS activity_category varchar(100);
ALTER TABLE fines_fees_penalties ADD COLUMN IF NOT EXISTS estimated_annual_payers varchar(50);
ALTER TABLE fines_fees_penalties ADD COLUMN IF NOT EXISTS justification text;
ALTER TABLE fines_fees_penalties ADD COLUMN IF NOT EXISTS who_pays_normalized varchar(100);
