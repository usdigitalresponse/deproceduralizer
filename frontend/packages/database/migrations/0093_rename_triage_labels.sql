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
