-- Add unique constraint to prevent duplicate fines entries
CREATE UNIQUE INDEX IF NOT EXISTS fines_fees_penalties_unique_entry
ON fines_fees_penalties (
  COALESCE(document_id, -1),
  COALESCE(guidance_document_id, -1),
  penalty_type,
  md5(COALESCE(requirement_quote, ''))
);
