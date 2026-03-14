-- Add normalized who_pays classification to fines_fees_penalties
-- See: https://github.com/michaeleboyce/deproceduralizer/issues/285

ALTER TABLE fines_fees_penalties
  ADD COLUMN IF NOT EXISTS who_pays_normalized varchar(40);

-- Constrain to known categories
ALTER TABLE fines_fees_penalties
  ADD CONSTRAINT chk_fines_who_pays_normalized
  CHECK (who_pays_normalized IS NULL OR who_pays_normalized IN (
    'licensed_or_permitted',
    'applicant',
    'individual_or_household',
    'vehicle_or_vessel_operator',
    'business_or_corporation',
    'insurance_or_financial',
    'service_provider_or_operator',
    'healthcare_or_care_facility',
    'violator_or_respondent',
    'property_owner',
    'government_entity',
    'employer_or_employee',
    'student_or_educational',
    'taxpayer',
    'other'
  ));

-- Index for filtering
CREATE INDEX IF NOT EXISTS idx_fines_who_pays_normalized
  ON fines_fees_penalties (who_pays_normalized)
  WHERE who_pays_normalized IS NOT NULL;
