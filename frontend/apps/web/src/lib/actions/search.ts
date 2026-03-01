'use server';

import 'server-only';
import { db, SearchRepository } from '@deproceduralizer/database';
import type { SearchResults, SearchOptions, SearchFilterOptions } from '@deproceduralizer/database';
import type { JurisdictionCode } from '@deproceduralizer/database';
import { type ActionResult, failure, runCachedAction } from './types';

const searchRepo = new SearchRepository(db);

export async function searchRegulations(
  options: SearchOptions
): Promise<ActionResult<SearchResults>> {
  // Input validation
  const query = options.query?.trim();
  if (!query || query.length < 2) {
    return failure('Search query must be at least 2 characters');
  }
  if (query.length > 200) {
    return failure('Search query must be 200 characters or less');
  }

  return runCachedAction(
    'searchRegulations',
    () => searchRepo.search({ ...options, query }),
    [`search-${options.jurisdiction}-${query}-${options.page || 1}-${options.docType || ''}-${options.sectionType || ''}-${options.hierarchyLevel || ''}-${options.parentPath || ''}-${options.hasAnalysis || ''}-${options.classification || ''}`],
    { revalidate: 30 }
  );
}

/**
 * Returns the available hierarchy levels and section types for a state,
 * for populating dynamic search filter dropdowns.
 */
export async function getSearchFilterOptions(
  state: JurisdictionCode
): Promise<ActionResult<SearchFilterOptions>> {
  return runCachedAction(
    'getSearchFilterOptions',
    () => searchRepo.getFilterOptions(state),
    [`search-filter-options-${state}`],
    { revalidate: 3600 }
  );
}
