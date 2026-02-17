-- Document tags for flexible scan scoping
-- See: https://github.com/michaeleboyce/deproceduralizer/issues/161

CREATE TABLE document_tags (
  id bigserial PRIMARY KEY,
  document_id bigint NOT NULL REFERENCES regulatory_documents(id) ON DELETE CASCADE,
  tag varchar(100) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by varchar(100),
  UNIQUE(document_id, tag)
);

CREATE INDEX idx_document_tags_tag ON document_tags(tag);
CREATE INDEX idx_document_tags_document_id ON document_tags(document_id);
