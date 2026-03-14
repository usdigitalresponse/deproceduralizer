-- Add activity enrichment columns to fines_fees_penalties

ALTER TABLE fines_fees_penalties
  ADD COLUMN IF NOT EXISTS activity_category varchar(40),
  ADD COLUMN IF NOT EXISTS estimated_annual_payers varchar(30),
  ADD COLUMN IF NOT EXISTS justification text;

ALTER TABLE fines_fees_penalties
  ADD CONSTRAINT chk_fines_activity_category
  CHECK (activity_category IS NULL OR activity_category IN (
    'hunting_fishing_wildlife', 'business_licensing', 'manufacturing_industrial',
    'healthcare_facility', 'childcare_provider', 'professional_licensing',
    'environmental_permit', 'construction_building', 'food_service',
    'transportation', 'cannabis_alcohol', 'real_estate_housing',
    'education', 'financial_services', 'social_services',
    'utilities_telecom', 'other'
  ));

ALTER TABLE fines_fees_penalties
  ADD CONSTRAINT chk_fines_estimated_annual_payers
  CHECK (estimated_annual_payers IS NULL OR estimated_annual_payers IN (
    'tens', 'hundreds', 'thousands', 'ten_thousands', 'hundred_thousands'
  ));

CREATE INDEX IF NOT EXISTS idx_fines_activity_category
  ON fines_fees_penalties (activity_category)
  WHERE activity_category IS NOT NULL;
