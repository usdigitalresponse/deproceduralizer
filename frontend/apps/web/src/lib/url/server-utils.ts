/**
 * Server-side URL utilities
 *
 * These utilities can be safely imported in server components (page.tsx files).
 * For client-side URL state management, use the parsers from ./parsers.ts with nuqs hooks.
 */

/**
 * Parse a boolean filter from a URL query parameter.
 * Returns true for 'true', false for 'false', and undefined otherwise.
 *
 * @example
 * const hasFlags = parseBooleanParam(queryParams.hasFlags);
 */
export function parseBooleanParam(value: string | undefined): boolean | undefined {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}
