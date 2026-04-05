-- Add category column to marker_groups for distinguishing triage vs regular markers
ALTER TABLE marker_groups ADD COLUMN IF NOT EXISTS category VARCHAR(30);

-- Update existing "Needs Review" to be a triage marker with amber color (if it exists)
UPDATE marker_groups SET category = 'triage', color = '#d97706', sort_order = 101
  WHERE LOWER(name) = 'needs review' AND COALESCE(jurisdiction, '__global__') = '__global__';

-- Insert "Needs Review" as triage if it doesn't already exist
INSERT INTO marker_groups (name, color, sort_order, is_custom, category)
  SELECT 'Needs Review', '#d97706', 101, false, 'triage'
  WHERE NOT EXISTS (
    SELECT 1 FROM marker_groups
    WHERE LOWER(name) = 'needs review' AND COALESCE(jurisdiction, '__global__') = '__global__'
  );

-- Insert the other two triage markers with conflict handling
-- Uses the case-insensitive unique index from migration 0089
INSERT INTO marker_groups (name, color, sort_order, is_custom, category) VALUES
  ('Confirmed', '#16a34a', 100, false, 'triage')
ON CONFLICT (LOWER(name), COALESCE(jurisdiction, '__global__'))
  DO UPDATE SET category = 'triage', is_custom = false;

INSERT INTO marker_groups (name, color, sort_order, is_custom, category) VALUES
  ('Incorrect', '#dc2626', 102, false, 'triage')
ON CONFLICT (LOWER(name), COALESCE(jurisdiction, '__global__'))
  DO UPDATE SET category = 'triage', is_custom = false;
