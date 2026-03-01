'use server';

import 'server-only';
import { revalidatePath, updateTag } from 'next/cache';
import {
  db,
  RedFlagsRepository,
  REVIEW_STATUSES,
  IMPACT_TYPES,
  type ReviewStatus,
  type ImpactType,
  type JurisdictionCode,
  type RedFlag,
  type PaginatedRedFlagsResult,
} from '@deproceduralizer/database';
import { type ActionResult, success, failure, getErrorMessage, runAction, runCachedAction } from './types';

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
    // Validate enum values before passing to repository
    if (!REVIEW_STATUSES.includes(input.reviewStatus as ReviewStatus)) {
      return failure(`Invalid review status: ${input.reviewStatus}`);
    }
    if (input.impactType && !IMPACT_TYPES.includes(input.impactType as ImpactType)) {
      return failure(`Invalid impact type: ${input.impactType}`);
    }

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
    updateTag('red-flags');
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
  return runAction('getRedFlagById', async () => {
    const result = await redFlagsRepo.getById(id);
    return result ?? null;
  });
}

/**
 * Gets all unique red flag categories for a state.
 * Cached for 5 minutes to reduce database traffic.
 * @param state - The state code (e.g., 'NY', 'NJ')
 * @returns Array of unique category names
 */
export async function getRedFlagCategories(
  state: JurisdictionCode
): Promise<ActionResult<string[]>> {
  return runCachedAction(
    'getRedFlagCategories',
    () => redFlagsRepo.getCategories(state),
    [`red-flag-categories-${state}`],
    { revalidate: 300 }
  );
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
 * Cached for 2 minutes to reduce database traffic.
 * @param state - The state code (e.g., 'NY', 'NJ')
 * @returns Object with counts per status and total
 */
export async function getRedFlagStatusCounts(
  state: JurisdictionCode
): Promise<ActionResult<ReviewStatusCounts>> {
  return runCachedAction(
    'getRedFlagStatusCounts',
    () => redFlagsRepo.getCountsByStatus(state),
    [`red-flag-status-counts-${state}`],
    { revalidate: 120, tags: ['red-flags'] }
  );
}

/**
 * Gets paginated red flags with filtering and sorting options.
 * @param state - The state code (e.g., 'NY', 'NJ')
 * @param options - Pagination, sorting, and filter options
 * @returns Paginated result with red flags and metadata
 */
export async function getRedFlagsPaginated(
  state: JurisdictionCode,
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
  return runAction('getRedFlagsPaginated', () =>
    redFlagsRepo.getAllPaginated({
      jurisdiction: state,
      ...options,
      filters: options.filters ? {
        status: options.filters.status as ReviewStatus | 'all' | undefined,
        severity: options.filters.severity,
        category: options.filters.category,
      } : undefined,
    })
  );
}
