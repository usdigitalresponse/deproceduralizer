ALTER TABLE guidance_documents ADD COLUMN jurisdiction VARCHAR(3);
UPDATE guidance_documents SET jurisdiction = 'NY' WHERE jurisdiction IS NULL;
ALTER TABLE guidance_documents ALTER COLUMN jurisdiction SET NOT NULL;
ALTER TABLE guidance_documents ADD CONSTRAINT chk_gd_jurisdiction
  CHECK (jurisdiction IN ('NY', 'NJ', 'NYC'));
CREATE INDEX idx_gd_jurisdiction ON guidance_documents(jurisdiction);
