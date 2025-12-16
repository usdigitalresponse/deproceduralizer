-- Create compliance_issues table for tracking specific compliance requirements
-- (wet signatures, in-person, paper forms, etc.)

CREATE TABLE IF NOT EXISTS compliance_issues (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES regulatory_documents(id) ON DELETE CASCADE,
  issue_type VARCHAR(50) NOT NULL,                    -- 'wet_signature', 'in_person', 'paper_form', etc.
  term_matched VARCHAR(255),                          -- The term/phrase that triggered the match
  context TEXT NOT NULL,                              -- Full context snippet from regulation
  requirement_quote TEXT NOT NULL,                    -- The requirement text
  from_statute BOOLEAN,                               -- Whether it's from statute vs regulation
  statute_citation VARCHAR(255),                      -- Citation to statute if applicable
  llm_confirmed BOOLEAN DEFAULT FALSE,                -- Whether LLM analysis confirmed it

  -- Review fields
  review_status VARCHAR(50) DEFAULT 'unreviewed',     -- 'unreviewed', 'confirmed', 'false_positive', etc.
  reviewed_by VARCHAR(255),                           -- Who reviewed it
  reviewed_at TIMESTAMP,                              -- When it was reviewed
  reviewer_notes TEXT,                                -- Notes from reviewer
  priority INTEGER,                                   -- Priority ranking
  impact_type VARCHAR(100),                           -- Type of impact

  -- Metadata
  state VARCHAR(2) NOT NULL,                          -- 'NY' or 'NJ'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX idx_compliance_issues_document ON compliance_issues(document_id);
CREATE INDEX idx_compliance_issues_state ON compliance_issues(state);
CREATE INDEX idx_compliance_issues_issue_type ON compliance_issues(issue_type);
CREATE INDEX idx_compliance_issues_review_status ON compliance_issues(review_status);
CREATE INDEX idx_compliance_issues_state_issue ON compliance_issues(state, issue_type);
