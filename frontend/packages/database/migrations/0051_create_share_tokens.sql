-- Create share_tokens table for one-time authentication links
-- Part of password protection system implementation

CREATE TABLE share_tokens (
  id SERIAL PRIMARY KEY,
  token TEXT UNIQUE NOT NULL,
  used BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  used_at TIMESTAMP
);

-- Index for fast token lookup
CREATE INDEX idx_share_tokens_token ON share_tokens(token);

-- Index for querying used/unused tokens
CREATE INDEX idx_share_tokens_used ON share_tokens(used);

COMMENT ON TABLE share_tokens IS 'One-time shareable authentication tokens for granting temporary site access';
COMMENT ON COLUMN share_tokens.token IS 'Cryptographically random 64-character hex string';
COMMENT ON COLUMN share_tokens.used IS 'Whether this token has been consumed';
COMMENT ON COLUMN share_tokens.used_at IS 'Timestamp when token was first used';
