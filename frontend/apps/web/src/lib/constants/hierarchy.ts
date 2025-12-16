/**
 * Hierarchy level labels for display purposes.
 * Maps internal hierarchy_level values to user-friendly labels.
 */
export const HIERARCHY_LEVEL_LABELS: Record<string, string> = {
  title: 'Title',
  subtitle: 'Subtitle',
  chapter: 'Chapter',
  subchapter: 'Subchapter',
  article: 'Article',
  part: 'Part',
  subpart: 'Subpart',
  section: 'Section',
};

/**
 * Get the display label for a hierarchy level.
 * Falls back to the raw level value with capitalization if not found.
 */
export function getHierarchyLevelLabel(level: string | null | undefined): string {
  if (!level) return 'Document';
  return HIERARCHY_LEVEL_LABELS[level] || level.charAt(0).toUpperCase() + level.slice(1);
}

/**
 * Valid hierarchy level keys
 */
export type HierarchyLevel = keyof typeof HIERARCHY_LEVEL_LABELS;
