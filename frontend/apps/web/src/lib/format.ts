/**
 * Shared formatting utilities for regulatory document display
 */

/**
 * Clean up title display by removing common prefixes
 * Used in breadcrumbs, tree nodes, and modals
 */
export function cleanTitle(title: string): string {
  return title
    .replace(/^N\.Y\. Comp\. Codes R\. & Regs\.?\s*/i, '')
    .replace(/^N\.J\. Admin\. Code\s*§?\s*/i, '')
    .replace(/^Title \d+ - /, '')
    .trim() || title;
}

/**
 * Truncate title for display with ellipsis
 * @param title - The title to truncate
 * @param maxLength - Maximum length before truncation (default: 40)
 */
export function truncateTitle(title: string, maxLength: number = 40): string {
  if (title.length <= maxLength) return title;
  return title.substring(0, maxLength) + '...';
}

/**
 * Document fields used for display title formatting
 */
export interface DisplayTitleDocument {
  shortTitle?: string | null;
  levelIdentifier?: string | null;
  citation?: string | null;
  hierarchyLevel?: string | null;
  // NYCRR fields for containers
  nycrrTitle?: number | null;
  nycrrPart?: string | null;
  nycrrChapter?: string | null;
  nycrrSubpart?: string | null;
  // NJAC fields for containers
  njacTitle?: string | null;
  njacChapter?: string | null;
  njacSubchapter?: string | null;
  // Fallback
  title?: string;
  jurisdiction?: string | null;
}

/**
 * Capitalize first letter of a string
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convert ALL CAPS text to Title Case
 * "STORMWATER MANAGEMENT" -> "Stormwater Management"
 */
function toTitleCase(str: string): string {
  // If not all caps, return as-is
  if (str !== str.toUpperCase()) {
    return str;
  }

  return str
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Get the container number for hierarchy nodes without level_identifier
 * Returns the appropriate state-specific number based on hierarchy level
 */
function getContainerNumber(doc: DisplayTitleDocument): string | null {
  const level = doc.hierarchyLevel?.toLowerCase();
  const jurisdiction = doc.jurisdiction?.toUpperCase();

  if (jurisdiction === 'NY') {
    switch (level) {
      case 'title':
        return doc.nycrrTitle?.toString() ?? null;
      case 'chapter':
        return doc.nycrrChapter ?? null;
      case 'part':
        return doc.nycrrPart ?? null;
      case 'subpart':
        return doc.nycrrSubpart ?? null;
      default:
        return null;
    }
  } else if (jurisdiction === 'NJ') {
    switch (level) {
      case 'title':
        return doc.njacTitle ?? null;
      case 'chapter':
        return doc.njacChapter ?? null;
      case 'subchapter':
        return doc.njacSubchapter ?? null;
      default:
        return null;
    }
  }
  return null;
}

/**
 * Format a document for display using level + identifier + short_title
 *
 * Format: "Level Identifier - Title" (e.g., "Section 4A:2-2.5 - Definitions")
 *
 * Priority:
 * 1. For sections with level_identifier: "Section 9A:17-1.4 - Administration of Prior MAC Program"
 * 2. For containers (chapters, parts): "Chapter 42 - Pinelands Development Credit Bank"
 * 3. Fallback: short_title or cleaned title
 *
 * @param doc - Document with display fields
 * @returns Formatted display title
 */
export function formatDisplayTitle(doc: DisplayTitleDocument): string {
  const levelName = doc.hierarchyLevel ? capitalize(doc.hierarchyLevel) : null;

  // Case 1: Has level_identifier (sections and some chapters/parts)
  if (doc.levelIdentifier) {
    const title = doc.shortTitle ? toTitleCase(doc.shortTitle) : null;
    const prefix = levelName
      ? `${levelName} ${doc.levelIdentifier}`
      : doc.levelIdentifier;
    return title ? `${prefix} - ${title}` : prefix;
  }

  // Case 2: Container nodes - construct from hierarchy level + state-specific number
  if (levelName) {
    const number = getContainerNumber(doc);
    const title = doc.shortTitle ? toTitleCase(doc.shortTitle) : null;

    if (number && title) {
      return `${levelName} ${number} - ${title}`;
    }
    if (number) {
      return `${levelName} ${number}`;
    }
    if (title) {
      return `${levelName} - ${title}`;
    }
  }

  // Case 3: Fallback to short_title if available
  if (doc.shortTitle) {
    return toTitleCase(doc.shortTitle);
  }

  // Case 4: Final fallback to cleaned title
  return cleanTitle(doc.title || '');
}
