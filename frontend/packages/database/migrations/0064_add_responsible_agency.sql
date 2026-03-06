-- Add responsible_agency column to jenai_analyses and compliance_issue_analyses
-- Derived from NYCRR title → agency mapping, populated at write time or via backfill

ALTER TABLE jenai_analyses
  ADD COLUMN IF NOT EXISTS responsible_agency text;

ALTER TABLE compliance_issue_analyses
  ADD COLUMN IF NOT EXISTS responsible_agency text;

-- Index for filtering/grouping by agency
CREATE INDEX IF NOT EXISTS idx_jenai_analyses_agency
  ON jenai_analyses (responsible_agency) WHERE responsible_agency IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cia_agency
  ON compliance_issue_analyses (responsible_agency) WHERE responsible_agency IS NOT NULL;
