'use server';

import 'server-only';
import { updateTag } from 'next/cache';
import {
  db,
  JenAIRepository,
  type JurisdictionCode,
  type JenAIIssue,
  type PaginatedJenAIResult,
  type JenAIReviewStatusCounts,
  type JenAIDeveloperStatusCounts,
  type SeverityDistribution,
  type PaginatedBurdenResult,
  type BurdenOverviewStats,
} from '@deproceduralizer/database';
import { type ActionResult, success, failure, getErrorMessage, runAction, runCachedAction } from './types';
import { parseCommaSeparated, parseSeverities } from '@/lib/url/filter-helpers';

const jenaiRepo = new JenAIRepository(db);

/**
 * Gets paginated JenAI issues with filtering and sorting options.
 */
export async function getJenAIIssuesPaginated(
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
): Promise<ActionResult<PaginatedJenAIResult>> {
  // Parse comma-separated multi-select filter values
  const categories = parseCommaSeparated(options.filters?.category ?? null);
  const severities = parseSeverities(options.filters?.severity);
  const parts = parseCommaSeparated(options.filters?.part ?? null);
  const sectionTypes = parseCommaSeparated(options.filters?.sectionType ?? null);
  const complexities = parseCommaSeparated(options.filters?.complexity ?? null);
  const isVerbatim = options.filters?.verbatim === 'true' ? true
    : options.filters?.verbatim === 'false' ? false
    : undefined;

  return runAction('getJenAIIssuesPaginated', () =>
    jenaiRepo.getAllPaginated({
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
 * Gets counts of JenAI issues grouped by review status.
 */
export async function getJenAIStatusCounts(
  state: JurisdictionCode
): Promise<ActionResult<JenAIReviewStatusCounts>> {
  return runCachedAction(
    'getJenAIStatusCounts',
    () => jenaiRepo.getCountsByStatus(state),
    [`jenai-status-counts-${state}`],
    { revalidate: 120, tags: ['jenai'] }
  );
}

/**
 * Gets counts of JenAI issues grouped by developer status.
 */
export async function getJenAIDeveloperStatusCounts(
  state: JurisdictionCode
): Promise<ActionResult<JenAIDeveloperStatusCounts>> {
  return runCachedAction(
    'getJenAIDeveloperStatusCounts',
    () => jenaiRepo.getDeveloperStatusCounts(state),
    [`jenai-developer-status-counts-${state}`],
    { revalidate: 120, tags: ['jenai'] }
  );
}

/**
 * Gets distinct part numbers with names and issue counts.
 */
export async function getJenAIParts(
  state: JurisdictionCode
): Promise<ActionResult<{ part: string; partName: string | null; count: number }[]>> {
  return runCachedAction(
    'getJenAIParts',
    () => jenaiRepo.getParts(state),
    [`jenai-parts-${state}`],
    { revalidate: 300 }
  );
}

/**
 * Gets distinct section types with issue counts.
 */
export async function getJenAISectionTypes(
  state: JurisdictionCode
): Promise<ActionResult<{ sectionType: string; count: number }[]>> {
  return runCachedAction(
    'getJenAISectionTypes',
    () => jenaiRepo.getSectionTypes(state),
    [`jenai-section-types-${state}`],
    { revalidate: 300 }
  );
}

/**
 * Gets unique categories with counts for a given state.
 */
export async function getJenAICategories(
  state: JurisdictionCode
): Promise<ActionResult<{ category: string; count: number }[]>> {
  return runCachedAction(
    'getJenAICategories',
    () => jenaiRepo.getCategories(state),
    [`jenai-categories-${state}`],
    { revalidate: 300 }
  );
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
    severity?: number;
    impactType?: string;
  }
): Promise<ActionResult<JenAIIssue>> {
  try {
    const result = await jenaiRepo.updateReview(input.id, {
      reviewStatus: input.reviewStatus,
      reviewedBy: input.reviewedBy,
      justificationNotes: input.justificationNotes,
      teamNotes: input.teamNotes,
      severity: input.severity,
      impactType: input.impactType,
    });

    if (!result) {
      return failure(`JenAI issue with id ${input.id} not found`);
    }

    // Don't use revalidatePath - client manages queue state locally via optimistic updates.
    // Path revalidation would cause server to re-fetch, breaking local state.
    updateTag('jenai');
    return success(result);
  } catch (error) {
    console.error('[updateJenAIReview]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Resets a JenAI issue back to unreviewed state.
 * Clears all review and developer fields but preserves LLM-assigned severity.
 */
export async function resetJenAIIssue(
  id: number
): Promise<ActionResult<JenAIIssue>> {
  try {
    const result = await jenaiRepo.resetIssue(id);

    if (!result) {
      return failure(`JenAI issue with id ${id} not found`);
    }

    updateTag('jenai');
    return success(result);
  } catch (error) {
    console.error('[resetJenAIIssue]', error);
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

    // Don't use revalidatePath - client manages queue state locally via optimistic updates.
    // Path revalidation would cause server to re-fetch, breaking local state.
    updateTag('jenai');
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
): Promise<ActionResult<PaginatedJenAIResult>> {
  // Parse comma-separated multi-select filter values
  const categories = parseCommaSeparated(options.category ?? null);
  const severities = parseSeverities(options.severity);
  const parts = parseCommaSeparated(options.part ?? null);
  const sectionTypes = parseCommaSeparated(options.sectionType ?? null);
  const complexities = parseCommaSeparated(options.complexity ?? null);
  const isVerbatim = options.verbatim === 'true' ? true
    : options.verbatim === 'false' ? false
    : undefined;

  return runAction('getJenAIDeveloperItems', () =>
    jenaiRepo.getReviewedPaginated({
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

export async function getJenAISeverityDistribution(
  state: JurisdictionCode
): Promise<ActionResult<SeverityDistribution>> {
  return runCachedAction(
    'getJenAISeverityDistribution',
    () => jenaiRepo.getSeverityDistribution(state),
    [`jenai-severity-dist-${state}`],
    { revalidate: 3600, tags: ['jenai-analytics'] }
  );
}

/**
 * Gets individual JenAI issues for a specific document.
 */
export async function getJenAIIssuesForDocument(
  documentId: number,
  type: 'regulation' | 'guidance'
): Promise<ActionResult<JenAIIssue[]>> {
  return runCachedAction(
    'getJenAIIssuesForDocument',
    () => jenaiRepo.getByDocumentId(documentId, type),
    [`jenai-doc-issues-${type}-${documentId}`],
    { revalidate: 300, tags: ['jenai'] }
  );
}

/**
 * Gets paginated burden ranking with filters.
 * Accepts raw comma-separated filter strings from URL params and parses them.
 */
export async function getJenAIBurdenRanking(
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

  return runAction('getJenAIBurdenRanking', () =>
    jenaiRepo.getBurdenRanking({
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
export async function getJenAIBurdenStats(
  jurisdiction: JurisdictionCode
): Promise<ActionResult<BurdenOverviewStats>> {
  return runCachedAction(
    'getJenAIBurdenStats',
    () => jenaiRepo.getBurdenOverviewStats(jurisdiction),
    [`burden-stats-${jurisdiction}`],
    { revalidate: 60, tags: ['burden', 'jenai'] }
  );
}
