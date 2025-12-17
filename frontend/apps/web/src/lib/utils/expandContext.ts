/**
 * Extracts expanded context around a snippet within full content.
 *
 * @param fullContent - The full regulation text
 * @param snippet - The short context snippet to find
 * @param charsBeforeAfter - Number of characters to include before and after the snippet
 * @returns Object with expanded text, start/end markers, and whether expansion was possible
 */
export function expandContext(
  fullContent: string,
  snippet: string,
  charsBeforeAfter: number = 500
): {
  expandedText: string;
  snippetStart: number;
  snippetEnd: number;
  hasMore: boolean;
  couldExpand: boolean;
} {
  if (!fullContent || !snippet) {
    return {
      expandedText: snippet || '',
      snippetStart: 0,
      snippetEnd: snippet?.length || 0,
      hasMore: false,
      couldExpand: false,
    };
  }

  // Normalize whitespace for matching (content may have different whitespace formatting)
  const normalizedContent = fullContent.replace(/\s+/g, ' ');
  const normalizedSnippet = snippet.replace(/\s+/g, ' ').trim();

  // Try to find the snippet in the content
  let snippetIndex = normalizedContent.indexOf(normalizedSnippet);

  // If exact match fails, try fuzzy matching with first 50 chars
  if (snippetIndex === -1 && normalizedSnippet.length > 50) {
    const shortSnippet = normalizedSnippet.slice(0, 50);
    snippetIndex = normalizedContent.indexOf(shortSnippet);
  }

  // If still no match, return original snippet
  if (snippetIndex === -1) {
    return {
      expandedText: snippet,
      snippetStart: 0,
      snippetEnd: snippet.length,
      hasMore: false,
      couldExpand: false,
    };
  }

  // Calculate expanded range
  const expandStart = Math.max(0, snippetIndex - charsBeforeAfter);
  const expandEnd = Math.min(
    normalizedContent.length,
    snippetIndex + normalizedSnippet.length + charsBeforeAfter
  );

  // Extract expanded text
  let expandedText = normalizedContent.slice(expandStart, expandEnd);

  // Add ellipsis if truncated
  const hasMoreBefore = expandStart > 0;
  const hasMoreAfter = expandEnd < normalizedContent.length;

  if (hasMoreBefore) {
    // Find first word boundary after start
    const firstSpace = expandedText.indexOf(' ');
    if (firstSpace > 0 && firstSpace < 50) {
      expandedText = expandedText.slice(firstSpace + 1);
    }
    expandedText = '...' + expandedText;
  }

  if (hasMoreAfter) {
    // Find last word boundary before end
    const lastSpace = expandedText.lastIndexOf(' ');
    if (lastSpace > expandedText.length - 50) {
      expandedText = expandedText.slice(0, lastSpace);
    }
    expandedText = expandedText + '...';
  }

  // Calculate where the original snippet is within the expanded text
  const adjustedStart = hasMoreBefore ? 3 : 0; // Account for "..."
  const snippetStartInExpanded = expandedText.indexOf(normalizedSnippet, adjustedStart);

  return {
    expandedText,
    snippetStart: snippetStartInExpanded >= 0 ? snippetStartInExpanded : 0,
    snippetEnd: snippetStartInExpanded >= 0 ? snippetStartInExpanded + normalizedSnippet.length : expandedText.length,
    hasMore: hasMoreBefore || hasMoreAfter,
    couldExpand: true,
  };
}

/**
 * Splits text into parts for highlighting
 */
export function splitForHighlight(
  text: string,
  highlightStart: number,
  highlightEnd: number
): { before: string; highlight: string; after: string } {
  return {
    before: text.slice(0, highlightStart),
    highlight: text.slice(highlightStart, highlightEnd),
    after: text.slice(highlightEnd),
  };
}
