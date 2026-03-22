-- Marker groups (predefined + user-created categories for bookmarks)
CREATE TABLE marker_groups (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) NOT NULL DEFAULT '#6b7280',
    icon VARCHAR(50),
    jurisdiction VARCHAR(3),  -- NULL = global
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_custom BOOLEAN NOT NULL DEFAULT false,  -- true = user-created freeform
    created_by VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique name per jurisdiction scope
CREATE UNIQUE INDEX idx_marker_groups_name_jurisdiction
  ON marker_groups (name, COALESCE(jurisdiction, '__global__'));

-- Junction: bookmarks ↔ marker groups (many-to-many)
CREATE TABLE bookmark_markers (
    id BIGSERIAL PRIMARY KEY,
    bookmark_id BIGINT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
    marker_group_id BIGINT NOT NULL REFERENCES marker_groups(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(bookmark_id, marker_group_id)
);

CREATE INDEX idx_bookmark_markers_bookmark ON bookmark_markers(bookmark_id);
CREATE INDEX idx_bookmark_markers_group ON bookmark_markers(marker_group_id);

-- Seed default groups
INSERT INTO marker_groups (name, color, sort_order) VALUES
  ('Easy Win',       '#22c55e', 0),
  ('Needs Review',   '#f97316', 1),
  ('Legal Question', '#ef4444', 2),
  ('Report Draft',   '#3b82f6', 3),
  ('Priority',       '#8b5cf6', 4);
