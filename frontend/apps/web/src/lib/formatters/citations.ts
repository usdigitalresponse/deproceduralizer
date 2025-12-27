import { formatNycrrCitation } from './nycrr';
import { formatNjacCitation } from './njac';

/**
 * Regulation citation fields common to both states.
 * Components can pass their regulation object directly.
 */
export interface CitationFields {
  nycrrTitle?: number | null;
  nycrrPart?: string | null;
  nycrrSection?: string | null;
  njacTitle?: string | null;
  njacChapter?: string | null;
  njacSubchapter?: string | null;
}

/**
 * Format a state-specific citation from a regulation object.
 * Automatically selects the appropriate formatter based on state.
 *
 * @param state - State code ('ny' or 'nj', case-insensitive)
 * @param fields - Object containing citation fields (can be a full regulation object)
 * @returns Formatted citation string or null if insufficient data
 *
 * @example
 * // With a regulation object
 * formatStateCitation('NJ', regulation)
 * // Returns: "N.J.A.C. 7:26-1.4"
 *
 * @example
 * // With a regulation object
 * formatStateCitation('NY', regulation)
 * // Returns: "18 NYCRR 505.14"
 */
export function formatStateCitation(
  state: string | null | undefined,
  fields: CitationFields
): string | null {
  const normalizedState = state?.toLowerCase();

  if (normalizedState === 'nj') {
    return formatNjacCitation(
      fields.njacTitle ?? null,
      fields.njacChapter ?? null,
      fields.njacSubchapter ?? null
    );
  }

  // Default to NY for backwards compatibility
  return formatNycrrCitation(
    fields.nycrrTitle ?? null,
    fields.nycrrPart ?? null,
    fields.nycrrSection ?? null
  );
}
