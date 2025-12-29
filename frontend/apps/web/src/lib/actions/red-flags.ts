'use server';

import 'server-only';
import { revalidatePath, unstable_cache } from 'next/cache';
import {
  db,
  RedFlagsRepository,
  type ReviewStatus,
  type ImpactType,
  type StateCode,
  type RedFlag,
  type RedFlagWithContext,
  type PaginatedRedFlagsResult,
} from '@deproceduralizer/database';
import { type ActionResult, success, failure, getErrorMessage } from './types';

const redFlagsRepo = new RedFlagsRepository(db);

/**
 * Input for updating a red flag review.
 * Note: reviewStatus and impactType accept strings for form compatibility,
 * but must be valid ReviewStatus/ImpactType values.
 */
export interface UpdateRedFlagInput {
  id: number;
  /** Must be a valid ReviewStatus value */
  reviewStatus: string;
  reviewedBy: string;
  justificationNotes?: string;
  teamNotes?: string;
  priority?: number;
  /** Must be a valid ImpactType value if provided */
  impactType?: string;
}

/**
 * Updates the review status and notes for a red flag.
 * @param input - The update input including id, review status, reviewer info, and optional priority/impact
 * @returns The updated red flag or an error
 */
export async function updateRedFlagReview(
  input: UpdateRedFlagInput
): Promise<ActionResult<RedFlag>> {
  try {
    // Cast to proper types - forms pass strings, but these must be valid enum values
    const result = await redFlagsRepo.updateReview(input.id, {
      reviewStatus: input.reviewStatus as ReviewStatus,
      reviewedBy: input.reviewedBy,
      justificationNotes: input.justificationNotes,
      teamNotes: input.teamNotes,
      priority: input.priority,
      impactType: input.impactType as ImpactType | undefined,
    });

    if (!result) {
      return failure(`Red flag with id ${input.id} not found`);
    }

    // Targeted invalidation: only review pages need updating after red flag review
    revalidatePath('/[state]/review', 'page');
    return success(result);
  } catch (error) {
    console.error('[updateRedFlagReview]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Fetches a red flag by its ID.
 * @param id - The red flag ID
 * @returns The red flag or null if not found
 */
export async function getRedFlagById(
  id: number
): Promise<ActionResult<RedFlag | null>> {
  try {
    const result = await redFlagsRepo.getById(id);
    return success(result ?? null);
  } catch (error) {
    console.error('[getRedFlagById]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Gets all unique red flag categories for a state.
 * Cached for 5 minutes to reduce database traffic.
 * @param state - The state code (e.g., 'NY', 'NJ')
 * @returns Array of unique category names
 */
export async function getRedFlagCategories(
  state: StateCode
): Promise<ActionResult<string[]>> {
  try {
    const cachedGetCategories = unstable_cache(
      () => redFlagsRepo.getCategories(state),
      [`red-flag-categories-${state}`],
      { revalidate: 300 } // 5 minutes
    );
    const result = await cachedGetCategories();
    return success(result);
  } catch (error) {
    console.error('[getRedFlagCategories]', error);
    return failure(getErrorMessage(error));
  }
}

// Status counts interface matching repository output
export interface ReviewStatusCounts {
  unreviewed: number;
  confirmed: number;
  rejected_clear_fp: number;
  rejected_not_obvious_bad: number;
  needs_context: number;
  deferred: number;
  total: number;
}

/**
 * Gets counts of red flags grouped by review status for a state.
 * @param state - The state code (e.g., 'NY', 'NJ')
 * @returns Object with counts per status and total
 */
export async function getRedFlagStatusCounts(
  state: StateCode
): Promise<ActionResult<ReviewStatusCounts>> {
  try {
    const result = await redFlagsRepo.getCountsByStatus(state);
    return success(result);
  } catch (error) {
    console.error('[getRedFlagStatusCounts]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Gets paginated red flags with filtering and sorting options.
 * @param state - The state code (e.g., 'NY', 'NJ')
 * @param options - Pagination, sorting, and filter options
 * @returns Paginated result with red flags and metadata
 */
export async function getRedFlagsPaginated(
  state: StateCode,
  options: {
    page: number;
    pageSize: number;
    sortBy?: 'severity' | 'category' | 'reviewedAt';
    sortOrder?: 'asc' | 'desc';
    filters?: {
      status?: string;
      severity?: 'high' | 'medium' | 'low';
      category?: string;
    };
  }
): Promise<ActionResult<PaginatedRedFlagsResult>> {
  try {
    const result = await redFlagsRepo.getAllPaginated({
      state,
      ...options,
      filters: options.filters ? {
        status: options.filters.status as ReviewStatus | 'all' | undefined,
        severity: options.filters.severity,
        category: options.filters.category,
      } : undefined,
    });
    return success(result);
  } catch (error) {
    console.error('[getRedFlagsPaginated]', error);
    return failure(getErrorMessage(error));
  }
}
