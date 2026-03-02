-- Add classification columns to guidance_documents for pipeline feasibility analysis.
-- is_attachment: flags documents whose titles indicate they are attachments/appendices
-- policy_category: rule-based classification by doc_type

ALTER TABLE guidance_documents
    ADD COLUMN IF NOT EXISTS is_attachment BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS policy_category TEXT;

CREATE INDEX idx_gd_policy_category ON guidance_documents(policy_category) WHERE policy_category IS NOT NULL;

COMMENT ON COLUMN guidance_documents.is_attachment IS 'True if title matches attachment/enclosure/appendix patterns';
COMMENT ON COLUMN guidance_documents.policy_category IS 'Rule-based category: policy_directive, legal_interpretation, tax_guidance, informational, reference_material, non_policy, data_dump, unclassified';
