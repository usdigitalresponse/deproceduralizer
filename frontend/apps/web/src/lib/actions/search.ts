'use server';

import 'server-only';
import { unstable_cache } from 'next/cache';
import { db, SearchRepository } from '@deproceduralizer/database';
import type { SearchResults, SearchOptions, SearchFilterOptions } from '@deproceduralizer/database';
import type { StateCode } from '@deproceduralizer/database';
import { type ActionResult, success, failure, getErrorMessage } from './types';

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

  try {
    const cachedSearch = unstable_cache(
      () => searchRepo.search({ ...options, query }),
      [`search-${options.state}-${query}-${options.page || 1}-${options.docType || ''}-${options.sectionType || ''}-${options.hierarchyLevel || ''}-${options.parentPath || ''}-${options.hasAnalysis || ''}-${options.classification || ''}`],
      { revalidate: 30 }
    );
    const result = await cachedSearch();
    return success(result);
  } catch (error) {
    console.error('[searchRegulations]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Returns the available hierarchy levels and section types for a state,
 * for populating dynamic search filter dropdowns.
 */
export async function getSearchFilterOptions(
  state: StateCode
): Promise<ActionResult<SearchFilterOptions>> {
  try {
    const cachedOptions = unstable_cache(
      () => searchRepo.getFilterOptions(state),
      [`search-filter-options-${state}`],
      { revalidate: 3600 }
    );
    const result = await cachedOptions();
    return success(result);
  } catch (error) {
    console.error('[getSearchFilterOptions]', error);
    return failure(getErrorMessage(error));
  }
}
