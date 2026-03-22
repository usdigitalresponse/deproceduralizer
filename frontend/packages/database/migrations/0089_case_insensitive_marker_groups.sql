-- Replace the case-sensitive unique index with case-insensitive
DROP INDEX IF EXISTS idx_marker_groups_name_jurisdiction;
CREATE UNIQUE INDEX idx_marker_groups_name_jurisdiction
  ON marker_groups (LOWER(name), COALESCE(jurisdiction, '__global__'));
