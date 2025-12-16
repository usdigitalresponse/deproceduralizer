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
