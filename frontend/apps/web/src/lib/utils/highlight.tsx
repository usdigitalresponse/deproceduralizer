import { ReactNode } from 'react';

/**
 * Escapes special regex characters in a string.
 */
export function escapeRegexChars(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Cleans a regex pattern by stripping /pattern/flags format if present.
 * Useful for displaying regex patterns that come from backend in JS regex literal format.
 *
 * @param pattern - The pattern to clean (e.g., "/foo.*bar/gi" or "foo.*bar")
 * @returns The cleaned pattern without surrounding slashes and flags
 *
 * @example
 * cleanRegexPattern("/hello.*world/gi") // Returns: "hello.*world"
 * cleanRegexPattern("hello.*world")      // Returns: "hello.*world"
 */
export function cleanRegexPattern(pattern: string): string {
  if (!pattern.startsWith('/')) return pattern;
  const lastSlash = pattern.lastIndexOf('/');
  if (lastSlash <= 0) return pattern;
  return pattern.slice(1, lastSlash);
}

/**
 * Highlights matches of a regex pattern in text.
 * Unlike highlightTerm, this treats the pattern as an actual regex.
 * Returns plain text if the regex is invalid or no matches found.
 *
 * @param text - The text to search within
 * @param pattern - The regex pattern (can be in /pattern/flags format)
 * @param className - Optional custom className for the mark element
 * @returns ReactNode with highlighted matches, or plain text on error
 *
 * @example
 * highlightRegexPattern("The quick brown fox", "qu.*ck")
 * // Returns: ["The ", <mark>quick</mark>, " brown fox"]
 */
export function highlightRegexPattern(
  text: string,
  pattern: string | null | undefined,
  className = 'bg-yellow-200 px-0.5 rounded font-medium'
): ReactNode {
  if (!pattern || !text) return text;

  try {
    const cleanPattern = cleanRegexPattern(pattern);
    const regex = new RegExp(`(${cleanPattern})`, 'gi');
    const parts = text.split(regex);

    if (parts.length === 1) {
      return text;
    }

    return parts.map((part, i) => {
      if (regex.test(part)) {
        regex.lastIndex = 0; // Reset for next test
        return (
          <mark key={i} className={className}>
            {part}
          </mark>
        );
      }
      return part;
    });
  } catch {
    // If regex parsing fails, return plain text
    return text;
  }
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
