'use server';

import { revalidatePath } from 'next/cache';
import {
  db,
  RedFlagsRepository,
  ReviewStatus,
  ImpactType,
  REVIEW_STATUSES,
  IMPACT_TYPES,
  type StateCode,
  type RedFlag,
  type RedFlagWithContext,
  type PaginatedRedFlagsResult,
} from '@deproceduralizer/database';
import { type ActionResult, success, failure, getErrorMessage } from './types';

const redFlagsRepo = new RedFlagsRepository(db);

export interface UpdateRedFlagInput {
  id: number;
  reviewStatus: string;
  reviewedBy: string;
  reviewerNotes?: string;
  priority?: number;
  impactType?: string;
}

export async function updateRedFlagReview(
  input: UpdateRedFlagInput
): Promise<ActionResult<RedFlag>> {
  try {
    if (!REVIEW_STATUSES.includes(input.reviewStatus as ReviewStatus)) {
      return failure(`Invalid review status: ${input.reviewStatus}`);
    }

    if (input.impactType && !IMPACT_TYPES.includes(input.impactType as ImpactType)) {
      return failure(`Invalid impact type: ${input.impactType}`);
    }

    const result = await redFlagsRepo.updateReview(input.id, {
      reviewStatus: input.reviewStatus as ReviewStatus,
      reviewedBy: input.reviewedBy,
      reviewerNotes: input.reviewerNotes,
      priority: input.priority,
      impactType: input.impactType as ImpactType | undefined,
    });

    if (!result) {
      return failure(`Red flag with id ${input.id} not found`);
    }

    revalidatePath('/');
    return success(result);
  } catch (error) {
    console.error('[updateRedFlagReview]', error);
    return failure(getErrorMessage(error));
  }
}

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

export async function getRedFlagCategories(
  state: StateCode
): Promise<ActionResult<string[]>> {
  try {
    const result = await redFlagsRepo.getCategories(state);
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
  false_positive: number;
  needs_context: number;
  deferred: number;
  total: number;
}

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
