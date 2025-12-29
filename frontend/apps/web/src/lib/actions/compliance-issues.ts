'use server';

import 'server-only';
import { unstable_cache } from 'next/cache';
import {
  db,
  ComplianceIssuesRepository,
  RegulatoryDocumentsRepository,
  type StateCode,
  type ReviewStatus,
  type ImpactType,
  type ComplianceIssue,
  type ComplianceIssueWithContext,
  type PaginatedComplianceIssuesResult,
} from '@deproceduralizer/database';
import { expandContext } from '@/lib/utils/expandContext';
import { type ActionResult, success, failure, getErrorMessage } from './types';

const complianceIssuesRepo = new ComplianceIssuesRepository(db);
const regulatoryDocumentsRepo = new RegulatoryDocumentsRepository(db);

/**
 * Input for updating a compliance issue review.
 * Note: reviewStatus and impactType accept strings for form compatibility,
 * but must be valid ReviewStatus/ImpactType values.
 */
export interface UpdateComplianceIssueInput {
  id: number;
  /** Must be a valid ReviewStatus value */
  reviewStatus: string;
  reviewedBy?: string;
  justificationNotes?: string;
  teamNotes?: string;
  severity?: number;
  /** Must be a valid ImpactType value if provided */
  impactType?: string;
}

/**
 * Updates the review status and notes for a compliance issue.
 * @param input - The update input including id, review status, and notes
 * @returns The updated compliance issue or an error
 */
export async function updateComplianceIssueReview(
  input: UpdateComplianceIssueInput
): Promise<ActionResult<ComplianceIssue>> {
  try {
    // Cast to proper types - forms pass strings, but these must be valid enum values
    const result = await complianceIssuesRepo.updateReview(input.id, {
      reviewStatus: input.reviewStatus as ReviewStatus,
      reviewedBy: input.reviewedBy,
      justificationNotes: input.justificationNotes,
      teamNotes: input.teamNotes,
      severity: input.severity,
      impactType: input.impactType as ImpactType | undefined,
    });

    if (!result) {
      return failure(`Compliance issue with id ${input.id} not found`);
    }

    // Don't revalidate - client manages queue state locally via optimistic updates.
    // Revalidation would cause server to re-fetch with stale URL params,
    // breaking suggestion mode batch behavior.
    return success(result);
  } catch (error) {
    console.error('[updateComplianceIssueReview]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Fetches a compliance issue by its ID.
 * @param id - The compliance issue ID
 * @returns The compliance issue or null if not found
 */
export async function getComplianceIssueById(
  id: number
): Promise<ActionResult<ComplianceIssue | null>> {
  try {
    const result = await complianceIssuesRepo.getById(id);
    return success(result ?? null);
  } catch (error) {
    console.error('[getComplianceIssueById]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Gets all compliance issues for a specific document.
 * @param documentId - The regulatory document ID
 * @returns Array of compliance issues for the document
 */
export async function getComplianceIssuesByDocumentId(
  documentId: number
): Promise<ActionResult<ComplianceIssue[]>> {
  try {
    const result = await complianceIssuesRepo.getByDocumentId(documentId);
    return success(result);
  } catch (error) {
    console.error('[getComplianceIssuesByDocumentId]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Gets all unique compliance issue types for a state.
 * Cached for 5 minutes to reduce database traffic.
 * @param state - The state code (e.g., 'NY', 'NJ')
 * @returns Array of unique issue type names (e.g., 'wet_signature', 'in_person')
 */
export async function getComplianceIssueTypes(
  state: StateCode
): Promise<ActionResult<string[]>> {
  try {
    const cachedGetIssueTypes = unstable_cache(
      () => complianceIssuesRepo.getIssueTypes(state),
      [`compliance-issue-types-${state}`],
      { revalidate: 300 } // 5 minutes
    );
    const result = await cachedGetIssueTypes();
    return success(result);
  } catch (error) {
    console.error('[getComplianceIssueTypes]', error);
    return failure(getErrorMessage(error));
  }
}

// Status counts interface matching repository output
export interface ComplianceIssueStatusCounts {
  unreviewed: number;
  confirmed: number;
  rejected_clear_fp: number;
  rejected_not_obvious_bad: number;
  needs_context: number;
  deferred: number;
  total: number;
}

/**
 * Gets counts of compliance issues grouped by review status for a state.
 * @param state - The state code (e.g., 'NY', 'NJ')
 * @returns Object with counts per status and total
 */
export async function getComplianceIssueStatusCounts(
  state: StateCode
): Promise<ActionResult<ComplianceIssueStatusCounts>> {
  try {
    const result = await complianceIssuesRepo.getCountsByStatus(state);
    return success(result);
  } catch (error) {
    console.error('[getComplianceIssueStatusCounts]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Gets counts of compliance issues grouped by issue type for a state.
 * @param state - The state code (e.g., 'NY', 'NJ')
 * @returns Object mapping issue type to count
 */
export async function getComplianceIssueCountsByType(
  state: StateCode
): Promise<ActionResult<Record<string, number>>> {
  try {
    const result = await complianceIssuesRepo.getCountsByType(state);
    return success(result);
  } catch (error) {
    console.error('[getComplianceIssueCountsByType]', error);
    return failure(getErrorMessage(error));
  }
}

export interface ComplianceIssueStats {
  total: number;
  byType: Record<string, number>;
}

/**
 * Gets aggregate statistics for compliance issues.
 * @param state - Optional state code to filter by (returns all states if omitted)
 * @returns Total count and counts by issue type
 */
export async function getComplianceIssueStats(
  state?: StateCode
): Promise<ActionResult<ComplianceIssueStats>> {
  try {
    const result = await complianceIssuesRepo.getStatsByState(state);
    return success(result);
  } catch (error) {
    console.error('[getComplianceIssueStats]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Gets paginated compliance issues with filtering and sorting options.
 * @param state - The state code (e.g., 'NY', 'NJ')
 * @param options - Pagination, sorting, and filter options
 * @returns Paginated result with compliance issues and metadata
 */
export async function getComplianceIssuesPaginated(
  state: StateCode,
  options: {
    page: number;
    pageSize: number;
    sortBy?: 'issueType' | 'createdAt' | 'reviewedAt' | 'severity';
    sortOrder?: 'asc' | 'desc';
    filters?: {
      status?: string;
      issueType?: string;
      severity?: 'high' | 'medium' | 'low' | 'all';
      requiredByStatute?: boolean | 'all';
      requirementFound?: boolean | 'all';
    };
  }
): Promise<ActionResult<PaginatedComplianceIssuesResult>> {
  try {
    const result = await complianceIssuesRepo.getAllPaginated({
      state,
      page: options.page,
      pageSize: options.pageSize,
      sortBy: options.sortBy,
      sortOrder: options.sortOrder,
      filters: options.filters ? {
        status: options.filters.status as ReviewStatus | 'all' | undefined,
        issueType: options.filters.issueType as 'wet_signature' | 'in_person' | 'paper_form' | 'notarized' | 'certified' | 'other' | 'all' | undefined,
        severity: options.filters.severity,
        requiredByStatute: options.filters.requiredByStatute,
        requirementFound: options.filters.requirementFound,
      } : undefined,
    });
    return success(result);
  } catch (error) {
    console.error('[getComplianceIssuesPaginated]', error);
    return failure(getErrorMessage(error));
  }
}

interface ExpandedContextResult {
  expandedText: string;
  couldExpand: boolean;
}

/**
 * Get expanded context for a compliance issue by fetching the full regulation content
 * and extracting more text around the matched portion.
 */
export async function getExpandedContext(
  documentId: number,
  context: string,
  charsBeforeAfter: number = 800
): Promise<ActionResult<ExpandedContextResult>> {
  try {
    const doc = await regulatoryDocumentsRepo.getById(documentId);

    if (!doc?.content) {
      return success({ expandedText: context, couldExpand: false });
    }

    const result = expandContext(doc.content, context, charsBeforeAfter);
    return success({
      expandedText: result.expandedText,
      couldExpand: result.couldExpand,
    });
  } catch (error) {
    console.error('[getExpandedContext]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Result type for suggestion batch queries
 */
export interface SuggestionBatchResult {
  data: ComplianceIssueWithContext[];
  groupingMode: 'issue_type' | 'section' | 'combined';
  focus: { issueType?: string; section?: string; pattern?: string };
  remainingInFocus: number;
  nextGroupingMode: 'issue_type' | 'section' | 'combined';
  totalUnreviewed: number;
}

/**
 * Get a smart batch of compliance issues for suggestion mode.
 * Groups items by the specified grouping mode and returns a batch with metadata.
 *
 * @param state - The state code (e.g., 'NY', 'NJ')
 * @param options - Batch options including size, excluded IDs, and grouping mode
 * @returns Batch of compliance issues with grouping metadata
 */
export async function getComplianceSuggestionBatch(
  state: StateCode,
  options: {
    batchSize: number;
    excludeIds: number[];
    groupingMode: 'issue_type' | 'section' | 'combined';
    focus?: {
      issueType?: string;
      section?: string;
      pattern?: string;
    };
    /** Issue types to avoid when selecting a new group (for diversity) */
    recentIssueTypes?: string[];
  }
): Promise<ActionResult<SuggestionBatchResult>> {
  try {
    const result = await complianceIssuesRepo.getSuggestionBatch({
      state,
      batchSize: options.batchSize,
      excludeIds: options.excludeIds,
      groupingMode: options.groupingMode,
      focus: options.focus,
      recentIssueTypes: options.recentIssueTypes,
    });
    return success(result);
  } catch (error) {
    console.error('[getComplianceSuggestionBatch]', error);
    return failure(getErrorMessage(error));
  }
}
