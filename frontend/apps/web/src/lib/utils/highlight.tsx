import { ReactNode } from 'react';

/**
 * Escapes special regex characters in a string.
 */
export function escapeRegexChars(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Highlights occurrences of a term in text with a styled mark element.
 *
 * @param text - The text to search within
 * @param term - The term to highlight (case-insensitive)
 * @param className - Optional custom className for the mark element
 * @returns ReactNode with highlighted text
 *
 * @example
 * // Basic usage
 * highlightTerm("The quick brown fox", "quick")
 * // Returns: ["The ", <mark>quick</mark>, " brown fox"]
 */
export function highlightTerm(
  text: string,
  term: string | null | undefined,
  className = 'bg-[var(--color-warning-bg)] px-0.5 rounded font-medium'
): ReactNode {
  if (!term) return text;

  const regex = new RegExp(`(${escapeRegexChars(term)})`, 'gi');
  const parts = text.split(regex);

  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className={className}>
        {part}
      </mark>
    ) : (
      part
    )
  );
}

/**
 * Highlights context within expanded text, showing the original context
 * with a distinctive style and optional term highlighting.
 *
 * @param expandedText - The full expanded text
 * @param originalContext - The original context snippet to highlight
 * @param highlightedTerm - Optional term to highlight within the context
 * @returns ReactNode with styled expanded text
 *
 * @example
 * // When expanding "quick brown" within longer text
 * highlightContext(
 *   "The quick brown fox jumps over the lazy dog",
 *   "quick brown",
 *   "brown"
 * )
 */
export function highlightContext(
  expandedText: string,
  originalContext: string,
  highlightedTerm: string | null | undefined
): ReactNode {
  // Normalize whitespace for matching
  const normalizedContext = originalContext.replace(/\s+/g, ' ').trim();
  const normalizedExpanded = expandedText.replace(/\s+/g, ' ');
  const contextIndex = normalizedExpanded.indexOf(normalizedContext);

  // If we can't find the original context, just highlight the term
  if (contextIndex === -1) {
    return highlightTerm(expandedText, highlightedTerm);
  }

  // Split the expanded text into before/context/after
  const beforeContext = expandedText.slice(0, contextIndex);
  const contextPortion = expandedText.slice(contextIndex, contextIndex + normalizedContext.length);
  const afterContext = expandedText.slice(contextIndex + normalizedContext.length);

  return (
    <>
      <span className="text-[var(--color-text-muted)]">{beforeContext}</span>
      <span className="bg-[var(--color-warning-bg)]/50 px-1 py-0.5 rounded">
        {highlightTerm(contextPortion, highlightedTerm)}
      </span>
      <span className="text-[var(--color-text-muted)]">{afterContext}</span>
    </>
  );
}
