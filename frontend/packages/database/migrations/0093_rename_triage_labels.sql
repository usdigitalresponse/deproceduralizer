-- Rename triage marker groups to clearer labels
-- "Confirmed" -> "Confirmed/Quick Win"
-- "Needs Review" stays the same
-- "Incorrect" -> "Incorrect/Not Burdensome"
-- Add new "Out of Scope" triage label

UPDATE marker_groups SET name = 'Confirmed/Quick Win'
  WHERE LOWER(name) = 'confirmed' AND category = 'triage';

UPDATE marker_groups SET name = 'Incorrect/Not Burdensome'
  WHERE LOWER(name) = 'incorrect' AND category = 'triage';

INSERT INTO marker_groups (name, color, sort_order, is_custom, category) VALUES
  ('Out of Scope', '#6366f1', 103, false, 'triage')
ON CONFLICT (LOWER(name), COALESCE(jurisdiction, '__global__'))
  DO UPDATE SET category = 'triage', is_custom = false, sort_order = 103;

-- Alphabetical sort order for triage labels
UPDATE marker_groups SET sort_order = 100 WHERE LOWER(name) = 'confirmed/quick win' AND category = 'triage';
UPDATE marker_groups SET sort_order = 101 WHERE LOWER(name) = 'incorrect/not burdensome' AND category = 'triage';
UPDATE marker_groups SET sort_order = 102 WHERE LOWER(name) = 'needs review' AND category = 'triage';
UPDATE marker_groups SET sort_order = 103 WHERE LOWER(name) = 'out of scope' AND category = 'triage';

-- Alphabetical sort order for preset labels
UPDATE marker_groups SET sort_order = 0 WHERE LOWER(name) = 'legal question' AND category IS NULL AND is_custom = false;
UPDATE marker_groups SET sort_order = 1 WHERE LOWER(name) = 'priority' AND category IS NULL AND is_custom = false;
UPDATE marker_groups SET sort_order = 2 WHERE LOWER(name) = 'report draft' AND category IS NULL AND is_custom = false;
