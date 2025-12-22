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
  state?: string | null;
}

/**
 * Capitalize first letter of a string
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Get the container number for hierarchy nodes without level_identifier
 * Returns the appropriate state-specific number based on hierarchy level
 */
function getContainerNumber(doc: DisplayTitleDocument): string | null {
  const level = doc.hierarchyLevel?.toLowerCase();
  const state = doc.state?.toUpperCase();

  if (state === 'NY') {
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
  } else if (state === 'NJ') {
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
 * Format a document for display using short_title + level_identifier/citation
 *
 * Priority:
 * 1. For sections with level_identifier: "9A:17-1.4 Administration of prior MAC program"
 * 2. For containers (chapters, parts): "Chapter 42 PINELANDS DEVELOPMENT CREDIT BANK"
 * 3. Fallback: short_title or cleaned title
 *
 * @param doc - Document with display fields
 * @returns Formatted display title
 */
export function formatDisplayTitle(doc: DisplayTitleDocument): string {
  // Case 1: Has level_identifier (sections and some subsections)
  if (doc.levelIdentifier && doc.shortTitle) {
    return `${doc.levelIdentifier} ${doc.shortTitle}`;
  }

  // Case 2: Container nodes - construct from hierarchy level + state-specific number
  if (doc.hierarchyLevel && !doc.levelIdentifier) {
    const levelName = capitalize(doc.hierarchyLevel);
    const number = getContainerNumber(doc);

    if (number && doc.shortTitle) {
      return `${levelName} ${number} ${doc.shortTitle}`;
    }

    // If we have a number but no shortTitle, just use level + number
    if (number) {
      return `${levelName} ${number}`;
    }
  }

  // Case 3: Fallback to short_title if available
  if (doc.shortTitle) {
    return doc.shortTitle;
  }

  // Case 4: Final fallback to cleaned title
  return cleanTitle(doc.title || '');
}
