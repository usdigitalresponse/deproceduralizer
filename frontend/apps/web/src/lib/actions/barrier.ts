'use server';

import 'server-only';
import { updateTag } from 'next/cache';
import {
  db,
  BarrierRepository,
  type JurisdictionCode,
  type BarrierIssue,
  type PaginatedBarrierResult,
  type BarrierReviewStatusCounts,
  type BarrierDeveloperStatusCounts,
  type SeverityDistribution,
  type PaginatedBurdenResult,
  type BurdenOverviewStats,
} from '@deproceduralizer/database';
import { type ActionResult, success, failure, getErrorMessage, runAction, runCachedAction } from './types';
import { parseCommaSeparated, parseSeverities } from '@/lib/url/filter-helpers';

const barrierRepo = new BarrierRepository(db);

/**
 * Gets paginated Barrier issues with filtering and sorting options.
 */
export async function getBarrierIssuesPaginated(
  state: JurisdictionCode,
  options: {
    page: number;
    pageSize: number;
    sortBy?: 'severity' | 'category' | 'reviewedAt' | 'confidence' | 'developerCheckedAt';
    sortOrder?: 'asc' | 'desc';
    filters?: {
      status?: string;
      severity?: string;
      category?: string;
      source?: 'regulation' | 'guidance' | 'all';
      part?: string;
      sectionType?: string;
      search?: string;
      complexity?: string;
      verbatim?: string;
    };
  }
): Promise<ActionResult<PaginatedBarrierResult>> {
  // Parse comma-separated multi-select filter values
  const categories = parseCommaSeparated(options.filters?.category ?? null);
  const severities = parseSeverities(options.filters?.severity);
  const parts = parseCommaSeparated(options.filters?.part ?? null);
  const sectionTypes = parseCommaSeparated(options.filters?.sectionType ?? null);
  const complexities = parseCommaSeparated(options.filters?.complexity ?? null);
  const isVerbatim = options.filters?.verbatim === 'true' ? true
    : options.filters?.verbatim === 'false' ? false
    : undefined;

  return runAction('getBarrierIssuesPaginated', () =>
    barrierRepo.getAllPaginated({
      jurisdiction: state,
      ...options,
      filters: options.filters ? {
        status: options.filters.status,
        severities: severities.length > 0 ? severities : undefined,
        category: categories.length === 1 ? categories[0] : undefined,
        categories: categories.length > 1 ? categories : undefined,
        source: options.filters.source,
        parts: parts.length > 0 ? parts : undefined,
        sectionTypes: sectionTypes.length > 0 ? sectionTypes : undefined,
        search: options.filters.search || undefined,
        complexities: complexities.length > 0 ? complexities : undefined,
        isVerbatim,
      } : undefined,
    })
  );
}

/**
 * Gets counts of Barrier issues grouped by review status.
 */
export async function getBarrierStatusCounts(
  state: JurisdictionCode
): Promise<ActionResult<BarrierReviewStatusCounts>> {
  return runCachedAction(
    'getBarrierStatusCounts',
    () => barrierRepo.getCountsByStatus(state),
    [`barrier-status-counts-${state}`],
    { revalidate: 120, tags: ['barriers'] }
  );
}

/**
 * Gets counts of Barrier issues grouped by developer status.
 */
export async function getBarrierDeveloperStatusCounts(
  state: JurisdictionCode
): Promise<ActionResult<BarrierDeveloperStatusCounts>> {
  return runCachedAction(
    'getBarrierDeveloperStatusCounts',
    () => barrierRepo.getDeveloperStatusCounts(state),
    [`barrier-developer-status-counts-${state}`],
    { revalidate: 120, tags: ['barriers'] }
  );
}

/**
 * Gets distinct part numbers with names and issue counts.
 */
export async function getBarrierParts(
  state: JurisdictionCode
): Promise<ActionResult<{ part: string; partName: string | null; count: number }[]>> {
  return runCachedAction(
    'getBarrierParts',
    () => barrierRepo.getParts(state),
    [`barrier-parts-${state}`],
    { revalidate: 300 }
  );
}

/**
 * Gets distinct section types with issue counts.
 */
export async function getBarrierSectionTypes(
  state: JurisdictionCode
): Promise<ActionResult<{ sectionType: string; count: number }[]>> {
  return runCachedAction(
    'getBarrierSectionTypes',
    () => barrierRepo.getSectionTypes(state),
    [`barrier-section-types-${state}`],
    { revalidate: 300 }
  );
}

/**
 * Gets unique categories with counts for a given state.
 */
export async function getBarrierCategories(
  state: JurisdictionCode
): Promise<ActionResult<{ category: string; count: number }[]>> {
  return runCachedAction(
    'getBarrierCategories',
    () => barrierRepo.getCategories(state),
    [`barrier-categories-${state}`],
    { revalidate: 300 }
  );
}

/**
 * Updates the review status and notes for a Barrier issue.
 */
export async function updateBarrierReview(
  input: {
    id: number;
    reviewStatus: string;
    reviewedBy: string;
    justificationNotes?: string;
    teamNotes?: string;
    severity?: number;
    impactType?: string;
  }
): Promise<ActionResult<BarrierIssue>> {
  try {
    const result = await barrierRepo.updateReview(input.id, {
      reviewStatus: input.reviewStatus,
      reviewedBy: input.reviewedBy,
      justificationNotes: input.justificationNotes,
      teamNotes: input.teamNotes,
      severity: input.severity,
      impactType: input.impactType,
    });

    if (!result) {
      return failure(`Barrier issue with id ${input.id} not found`);
    }

    // Don't use revalidatePath - client manages queue state locally via optimistic updates.
    // Path revalidation would cause server to re-fetch, breaking local state.
    updateTag('barriers');
    return success(result);
  } catch (error) {
    console.error('[updateBarrierReview]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Resets a Barrier issue back to unreviewed state.
 * Clears all review and developer fields but preserves LLM-assigned severity.
 */
export async function resetBarrierIssue(
  id: number
): Promise<ActionResult<BarrierIssue>> {
  try {
    const result = await barrierRepo.resetIssue(id);

    if (!result) {
      return failure(`Barrier issue with id ${id} not found`);
    }

    updateTag('barriers');
    return success(result);
  } catch (error) {
    console.error('[resetBarrierIssue]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Updates the developer tracking fields for a Barrier issue.
 */
export async function updateBarrierDeveloper(
  input: {
    id: number;
    developerStatus: string;
    developerAssigned: string;
    developerNotes?: string;
    resolutionType?: string;
    resolutionComments?: string;
    developerQuestion?: string;
  }
): Promise<ActionResult<BarrierIssue>> {
  try {
    const result = await barrierRepo.updateDeveloperStatus(input.id, {
      developerStatus: input.developerStatus,
      developerAssigned: input.developerAssigned,
      developerNotes: input.developerNotes,
      resolutionType: input.resolutionType,
      resolutionComments: input.resolutionComments,
      developerQuestion: input.developerQuestion,
    });

    if (!result) {
      return failure(`Barrier issue with id ${input.id} not found`);
    }

    // Don't use revalidatePath - client manages queue state locally via optimistic updates.
    // Path revalidation would cause server to re-fetch, breaking local state.
    updateTag('barriers');
    return success(result);
  } catch (error) {
    console.error('[updateBarrierDeveloper]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Gets paginated reviewed Barrier issues for developer mode.
 */
export async function getBarrierDeveloperItems(
  state: JurisdictionCode,
  options: {
    page: number;
    pageSize: number;
    sortBy?: 'severity' | 'category' | 'reviewedAt' | 'developerCheckedAt' | 'confidence';
    sortOrder?: 'asc' | 'desc';
    developerStatus?: string;
    developerAssigned?: string;
    severity?: string;
    reviewStatus?: string;
    category?: string;
    source?: 'regulation' | 'guidance' | 'all';
    part?: string;
    sectionType?: string;
    search?: string;
    complexity?: string;
    verbatim?: string;
  }
): Promise<ActionResult<PaginatedBarrierResult>> {
  // Parse comma-separated multi-select filter values
  const categories = parseCommaSeparated(options.category ?? null);
  const severities = parseSeverities(options.severity);
  const parts = parseCommaSeparated(options.part ?? null);
  const sectionTypes = parseCommaSeparated(options.sectionType ?? null);
  const complexities = parseCommaSeparated(options.complexity ?? null);
  const isVerbatim = options.verbatim === 'true' ? true
    : options.verbatim === 'false' ? false
    : undefined;

  return runAction('getBarrierDeveloperItems', () =>
    barrierRepo.getReviewedPaginated({
      jurisdiction: state,
      page: options.page,
      pageSize: options.pageSize,
      sortBy: options.sortBy,
      sortOrder: options.sortOrder,
      developerStatus: options.developerStatus,
      developerAssigned: options.developerAssigned,
      filters: {
        status: options.reviewStatus,
        severities: severities.length > 0 ? severities : undefined,
        category: categories.length === 1 ? categories[0] : undefined,
        categories: categories.length > 1 ? categories : undefined,
        source: options.source,
        parts: parts.length > 0 ? parts : undefined,
        sectionTypes: sectionTypes.length > 0 ? sectionTypes : undefined,
        search: options.search || undefined,
        complexities: complexities.length > 0 ? complexities : undefined,
        isVerbatim,
      },
    })
  );
}

/**
 * Gets complexity distribution (HIGH/MEDIUM/LOW counts).
 */
export async function getBarrierComplexityDistribution(
  state: JurisdictionCode
): Promise<ActionResult<{ complexity: string; count: number }[]>> {
  return runCachedAction(
    'getBarrierComplexityDistribution',
    () => barrierRepo.getComplexityDistribution(state),
    [`barrier-complexity-dist-${state}`],
    { revalidate: 300, tags: ['barrier-analytics'] }
  );
}

/**
 * Gets category × severity matrix for heatmap.
 */
export async function getBarrierCategorySeverityMatrix(
  state: JurisdictionCode
): Promise<ActionResult<{ category: string; severityBucket: string; count: number }[]>> {
  return runCachedAction(
    'getBarrierCategorySeverityMatrix',
    () => barrierRepo.getCategorySeverityMatrix(state),
    [`barrier-cat-severity-matrix-${state}`],
    { revalidate: 300, tags: ['barrier-analytics'] }
  );
}

/**
 * Gets source type breakdown (regulation vs guidance counts).
 */
export async function getBarrierSourceTypeBreakdown(
  state: JurisdictionCode
): Promise<ActionResult<{ regulation: number; guidance: number }>> {
  return runCachedAction(
    'getBarrierSourceTypeBreakdown',
    () => barrierRepo.getSourceTypeBreakdown(state),
    [`barrier-source-type-${state}`],
    { revalidate: 300, tags: ['barrier-analytics'] }
  );
}

/**
 * Gets review progress grouped by category.
 */
export async function getBarrierReviewProgressByCategory(
  state: JurisdictionCode
): Promise<ActionResult<{ category: string; reviewStatus: string; count: number }[]>> {
  return runCachedAction(
    'getBarrierReviewProgressByCategory',
    () => barrierRepo.getReviewProgressByCategory(state),
    [`barrier-review-by-cat-${state}`],
    { revalidate: 300, tags: ['barrier-analytics'] }
  );
}

/**
 * Gets burden score distribution as histogram buckets.
 */
export async function getBarrierBurdenScoreDistribution(
  state: JurisdictionCode
): Promise<ActionResult<{ bucket: string; count: number }[]>> {
  return runCachedAction(
    'getBarrierBurdenScoreDistribution',
    () => barrierRepo.getBurdenScoreDistribution(state),
    [`barrier-burden-dist-${state}`],
    { revalidate: 300, tags: ['barrier-analytics'] }
  );
}

export async function getBarrierSeverityDistribution(
  state: JurisdictionCode
): Promise<ActionResult<SeverityDistribution>> {
  return runCachedAction(
    'getBarrierSeverityDistribution',
    () => barrierRepo.getSeverityDistribution(state),
    [`barrier-severity-dist-${state}`],
    { revalidate: 3600, tags: ['barrier-analytics'] }
  );
}

/**
 * Gets individual Barrier issues for a specific document.
 */
export async function getBarrierIssuesForDocument(
  documentId: number,
  type: 'regulation' | 'guidance'
): Promise<ActionResult<BarrierIssue[]>> {
  return runCachedAction(
    'getBarrierIssuesForDocument',
    () => barrierRepo.getByDocumentId(documentId, type),
    [`barrier-doc-issues-${type}-${documentId}`],
    { revalidate: 300, tags: ['barriers'] }
  );
}

/**
 * Gets paginated burden ranking with filters.
 * Accepts raw comma-separated filter strings from URL params and parses them.
 */
export async function getBarrierBurdenRanking(
  jurisdiction: JurisdictionCode,
  options: {
    page: number;
    pageSize: number;
    sortBy?: 'adjustedBurden' | 'compositeBurden' | 'maxSeverity' | 'issueCount';
    sortOrder?: 'asc' | 'desc';
    source?: 'regulation' | 'guidance' | 'all';
    severity?: string;
    category?: string;
    part?: string;
    sectionType?: string;
    search?: string;
  }
): Promise<ActionResult<PaginatedBurdenResult>> {
  const severities = parseSeverities(options.severity);
  const categories = parseCommaSeparated(options.category ?? null);
  const parts = parseCommaSeparated(options.part ?? null);
  const sectionTypes = parseCommaSeparated(options.sectionType ?? null);

  return runAction('getBarrierBurdenRanking', () =>
    barrierRepo.getBurdenRanking({
      jurisdiction,
      page: options.page,
      pageSize: options.pageSize,
      sortBy: options.sortBy,
      sortOrder: options.sortOrder,
      source: options.source,
      severities: severities.length > 0 ? severities : undefined,
      categories: categories.length > 0 ? categories : undefined,
      parts: parts.length > 0 ? parts : undefined,
      sectionTypes: sectionTypes.length > 0 ? sectionTypes : undefined,
      search: options.search || undefined,
    })
  );
}

/**
 * Gets aggregate overview stats for the burden index.
 */
export async function getBarrierBurdenStats(
  jurisdiction: JurisdictionCode
): Promise<ActionResult<BurdenOverviewStats>> {
  return runCachedAction(
    'getBarrierBurdenStats',
    () => barrierRepo.getBurdenOverviewStats(jurisdiction),
    [`burden-stats-${jurisdiction}`],
    { revalidate: 60, tags: ['burden', 'barriers'] }
  );
}
