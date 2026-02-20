'use server';

import 'server-only';
import { revalidatePath, unstable_cache } from 'next/cache';
import {
  db,
  JenAIRepository,
  type StateCode,
  type JenAIIssue,
  type PaginatedJenAIResult,
  type JenAIReviewStatusCounts,
  type JenAIDeveloperStatusCounts,
  type SeverityDistribution,
} from '@deproceduralizer/database';
import { type ActionResult, success, failure, getErrorMessage } from './types';

const jenaiRepo = new JenAIRepository(db);

/**
 * Gets paginated JenAI issues with filtering and sorting options.
 */
export async function getJenAIIssuesPaginated(
  state: StateCode,
  options: {
    page: number;
    pageSize: number;
    sortBy?: 'severity' | 'category' | 'reviewedAt' | 'confidence';
    sortOrder?: 'asc' | 'desc';
    filters?: {
      status?: string;
      severity?: 'high' | 'medium' | 'low';
      category?: string;
    };
  }
): Promise<ActionResult<PaginatedJenAIResult>> {
  try {
    const result = await jenaiRepo.getAllPaginated({
      state,
      ...options,
      filters: options.filters ? {
        status: options.filters.status,
        severity: options.filters.severity,
        category: options.filters.category,
      } : undefined,
    });
    return success(result);
  } catch (error) {
    console.error('[getJenAIIssuesPaginated]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Gets counts of JenAI issues grouped by review status.
 */
export async function getJenAIStatusCounts(
  state: StateCode
): Promise<ActionResult<JenAIReviewStatusCounts>> {
  try {
    const cachedGetStatusCounts = unstable_cache(
      () => jenaiRepo.getCountsByStatus(state),
      [`jenai-status-counts-${state}`],
      { revalidate: 120, tags: ['jenai'] }
    );
    const result = await cachedGetStatusCounts();
    return success(result);
  } catch (error) {
    console.error('[getJenAIStatusCounts]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Gets counts of JenAI issues grouped by developer status.
 */
export async function getJenAIDeveloperStatusCounts(
  state: StateCode
): Promise<ActionResult<JenAIDeveloperStatusCounts>> {
  try {
    const cachedGetDevCounts = unstable_cache(
      () => jenaiRepo.getDeveloperStatusCounts(state),
      [`jenai-developer-status-counts-${state}`],
      { revalidate: 120, tags: ['jenai'] }
    );
    const result = await cachedGetDevCounts();
    return success(result);
  } catch (error) {
    console.error('[getJenAIDeveloperStatusCounts]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Gets unique categories with counts for a given state.
 */
export async function getJenAICategories(
  state: StateCode
): Promise<ActionResult<{ category: string; count: number }[]>> {
  try {
    const cachedGetCategories = unstable_cache(
      () => jenaiRepo.getCategories(state),
      [`jenai-categories-${state}`],
      { revalidate: 300 }
    );
    const result = await cachedGetCategories();
    return success(result);
  } catch (error) {
    console.error('[getJenAICategories]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Updates the review status and notes for a JenAI issue.
 */
export async function updateJenAIReview(
  input: {
    id: number;
    reviewStatus: string;
    reviewedBy: string;
    justificationNotes?: string;
    teamNotes?: string;
    priority?: number;
    impactType?: string;
  }
): Promise<ActionResult<JenAIIssue>> {
  try {
    const result = await jenaiRepo.updateReview(input.id, {
      reviewStatus: input.reviewStatus,
      reviewedBy: input.reviewedBy,
      justificationNotes: input.justificationNotes,
      teamNotes: input.teamNotes,
      priority: input.priority,
      impactType: input.impactType,
    });

    if (!result) {
      return failure(`JenAI issue with id ${input.id} not found`);
    }

    revalidatePath('/[state]/review', 'page');
    return success(result);
  } catch (error) {
    console.error('[updateJenAIReview]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Updates the developer tracking fields for a JenAI issue.
 */
export async function updateJenAIDeveloper(
  input: {
    id: number;
    developerStatus: string;
    developerAssigned: string;
    developerNotes?: string;
    resolutionType?: string;
    resolutionComments?: string;
    developerQuestion?: string;
  }
): Promise<ActionResult<JenAIIssue>> {
  try {
    const result = await jenaiRepo.updateDeveloperStatus(input.id, {
      developerStatus: input.developerStatus,
      developerAssigned: input.developerAssigned,
      developerNotes: input.developerNotes,
      resolutionType: input.resolutionType,
      resolutionComments: input.resolutionComments,
      developerQuestion: input.developerQuestion,
    });

    if (!result) {
      return failure(`JenAI issue with id ${input.id} not found`);
    }

    revalidatePath('/[state]/review', 'page');
    return success(result);
  } catch (error) {
    console.error('[updateJenAIDeveloper]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Gets paginated reviewed JenAI issues for developer mode.
 */
export async function getJenAIDeveloperItems(
  state: StateCode,
  options: {
    page: number;
    pageSize: number;
    sortBy?: 'severity' | 'category' | 'reviewedAt' | 'developerCheckedAt';
    sortOrder?: 'asc' | 'desc';
    developerStatus?: string;
    developerAssigned?: string;
    severity?: 'high' | 'medium' | 'low' | 'all';
    reviewStatus?: string;
    category?: string;
  }
): Promise<ActionResult<PaginatedJenAIResult>> {
  try {
    const result = await jenaiRepo.getReviewedPaginated({
      state,
      page: options.page,
      pageSize: options.pageSize,
      sortBy: options.sortBy,
      sortOrder: options.sortOrder,
      developerStatus: options.developerStatus,
      developerAssigned: options.developerAssigned,
      filters: {
        status: options.reviewStatus,
        severity: options.severity === 'all' ? undefined : options.severity,
        category: options.category,
      },
    });
    return success(result);
  } catch (error) {
    console.error('[getJenAIDeveloperItems]', error);
    return failure(getErrorMessage(error));
  }
}

export async function getJenAISeverityDistribution(
  state: StateCode
): Promise<ActionResult<SeverityDistribution>> {
  try {
    const cachedFn = unstable_cache(
      () => jenaiRepo.getSeverityDistribution(state),
      [`jenai-severity-dist-${state}`],
      { revalidate: 3600, tags: ['jenai-analytics'] }
    );
    const data = await cachedFn();
    return success(data);
  } catch (error) {
    console.error('[getJenAISeverityDistribution]', error);
    return failure(getErrorMessage(error));
  }
}
