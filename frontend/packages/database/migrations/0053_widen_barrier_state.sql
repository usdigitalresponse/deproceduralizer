-- Widen barrier_analyses.state from VARCHAR(2) to VARCHAR(3) to support NYC jurisdiction
ALTER TABLE barrier_analyses ALTER COLUMN state TYPE VARCHAR(3);
