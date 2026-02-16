import { formatNycrrCitation } from './nycrr';
import { formatNjacCitation } from './njac';
import { formatRcnyCitation } from './rcny';

/**
 * Regulation citation fields for all states.
 * Components can pass their regulation object directly.
 */
export interface CitationFields {
  nycrrTitle?: number | null;
  nycrrPart?: string | null;
  nycrrSection?: string | null;
  njacTitle?: string | null;
  njacChapter?: string | null;
  njacSubchapter?: string | null;
  rcnyTitle?: string | null;
  rcnySection?: string | null;
}

/**
 * Format a state-specific citation from a regulation object.
 * Automatically selects the appropriate formatter based on state.
 *
 * @param state - State code ('ny', 'nj', or 'nyc', case-insensitive)
 * @param fields - Object containing citation fields (can be a full regulation object)
 * @returns Formatted citation string or null if insufficient data
 *
 * @example
 * formatStateCitation('NJ', regulation) // "N.J.A.C. 7:26-1.4"
 * formatStateCitation('NY', regulation) // "18 NYCRR 505.14"
 * formatStateCitation('NYC', regulation) // "RCNY § 3-01"
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

  if (normalizedState === 'nyc') {
    return formatRcnyCitation(
      fields.rcnyTitle ?? null,
      fields.rcnySection ?? null
    );
  }

  // Default to NY for backwards compatibility
  return formatNycrrCitation(
    fields.nycrrTitle ?? null,
    fields.nycrrPart ?? null,
    fields.nycrrSection ?? null
  );
}
