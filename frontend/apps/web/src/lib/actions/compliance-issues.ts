'use server';

import 'server-only';
import { updateTag } from 'next/cache';
import {
  db,
  ComplianceIssuesRepository,
  RegulatoryDocumentsRepository,
  REVIEW_STATUSES,
  IMPACT_TYPES,
  type JurisdictionCode,
  type ReviewStatus,
  type ImpactType,
  type IssueType,
  type ComplianceIssue,
  type ComplianceIssueWithAnalysisFields,
  type ComplianceIssueWithAnalysis,
  type PaginatedComplianceIssuesResult,
  type TierCompletionCounts,
  type SeverityDistribution,
} from '@deproceduralizer/database';

// PR 6.3: updateReview now returns ComplianceIssueWithAnalysisFields (review fields from analyses)
import { expandContext } from '@/lib/utils/expandContext';
import { type ActionResult, success, failure, getErrorMessage, runAction, runCachedAction } from './types';

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
): Promise<ActionResult<ComplianceIssueWithAnalysisFields>> {
  try {
    // Validate enum values before passing to repository
    if (!REVIEW_STATUSES.includes(input.reviewStatus as ReviewStatus)) {
      return failure(`Invalid review status: ${input.reviewStatus}`);
    }
    if (input.impactType && !IMPACT_TYPES.includes(input.impactType as ImpactType)) {
      return failure(`Invalid impact type: ${input.impactType}`);
    }

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

    // Revalidate the status counts cache but not the full pages.
    // Don't use revalidatePath - client manages queue state locally via optimistic updates.
    // Path revalidation would cause server to re-fetch with stale URL params,
    // breaking suggestion mode batch behavior.
    updateTag('compliance-issues');
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
  return runAction('getComplianceIssueById', async () => {
    const result = await complianceIssuesRepo.getById(id);
    return result ?? null;
  });
}

/**
 * Gets all compliance issues for a specific document.
 * @param documentId - The regulatory document ID
 * @returns Array of compliance issues for the document
 */
export async function getComplianceIssuesByDocumentId(
  documentId: number
): Promise<ActionResult<ComplianceIssueWithAnalysisFields[]>> {
  return runAction('getComplianceIssuesByDocumentId', () => complianceIssuesRepo.getByDocumentId(documentId));
}

/**
 * Gets all unique compliance issue types for a state.
 * Cached for 5 minutes to reduce database traffic.
 * @param state - The state code (e.g., 'NY', 'NJ')
 * @returns Array of unique issue type names (e.g., 'wet_signature', 'in_person')
 */
export async function getComplianceIssueTypes(
  state: JurisdictionCode
): Promise<ActionResult<string[]>> {
  return runCachedAction(
    'getComplianceIssueTypes',
    () => complianceIssuesRepo.getIssueTypes(state),
    [`compliance-issue-types-${state}`],
    { revalidate: 300 }
  );
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
 * Cached for 2 minutes to reduce database traffic.
 * @param state - The state code (e.g., 'NY', 'NJ')
 * @returns Object with counts per status and total
 */
export async function getComplianceIssueStatusCounts(
  state: JurisdictionCode
): Promise<ActionResult<ComplianceIssueStatusCounts>> {
  return runCachedAction(
    'getComplianceIssueStatusCounts',
    () => complianceIssuesRepo.getCountsByStatus(state),
    [`compliance-issue-status-counts-${state}`],
    { revalidate: 120, tags: ['compliance-issues'] }
  );
}

/**
 * Gets counts of compliance issues grouped by issue type for a state.
 * @param state - The state code (e.g., 'NY', 'NJ')
 * @returns Object mapping issue type to count
 */
export async function getComplianceIssueCountsByType(
  state: JurisdictionCode
): Promise<ActionResult<Record<string, number>>> {
  return runAction('getComplianceIssueCountsByType', () => complianceIssuesRepo.getCountsByType(state));
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
  state?: JurisdictionCode
): Promise<ActionResult<ComplianceIssueStats>> {
  return runAction('getComplianceIssueStats', () => complianceIssuesRepo.getStatsByJurisdiction(state));
}

/**
 * Gets paginated compliance issues with filtering and sorting options.
 * @param state - The state code (e.g., 'NY', 'NJ')
 * @param options - Pagination, sorting, and filter options
 * @returns Paginated result with compliance issues and metadata
 */
export async function getComplianceIssuesPaginated(
  state: JurisdictionCode,
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
      tierCompleted?: '0' | '1' | '2' | '3' | 'all';
      federalMandate?: boolean | 'all';
      hasAnalysis?: boolean | 'all';
    };
  }
): Promise<ActionResult<PaginatedComplianceIssuesResult>> {
  return runAction('getComplianceIssuesPaginated', () =>
    complianceIssuesRepo.getAllPaginated({
      jurisdiction: state,
      page: options.page,
      pageSize: options.pageSize,
      sortBy: options.sortBy,
      sortOrder: options.sortOrder,
      filters: options.filters ? {
        status: options.filters.status as ReviewStatus | 'all' | undefined,
        issueType: options.filters.issueType as IssueType | 'all' | undefined,
        severity: options.filters.severity,
        requiredByStatute: options.filters.requiredByStatute,
        requirementFound: options.filters.requirementFound,
        tierCompleted: options.filters.tierCompleted,
        federalMandate: options.filters.federalMandate,
        hasAnalysis: options.filters.hasAnalysis,
      } : undefined,
    })
  );
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
  return runAction('getExpandedContext', async () => {
    const doc = await regulatoryDocumentsRepo.getById(documentId);

    if (!doc?.content) {
      return { expandedText: context, couldExpand: false };
    }

    const result = expandContext(doc.content, context, charsBeforeAfter);
    return {
      expandedText: result.expandedText,
      couldExpand: result.couldExpand,
    };
  });
}

/**
 * Result type for suggestion batch queries
 */
export interface SuggestionBatchResult {
  data: ComplianceIssueWithAnalysis[];
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
  state: JurisdictionCode,
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
  return runAction('getComplianceSuggestionBatch', () =>
    complianceIssuesRepo.getSuggestionBatch({
      jurisdiction: state,
      batchSize: options.batchSize,
      excludeIds: options.excludeIds,
      groupingMode: options.groupingMode,
      focus: options.focus,
      recentIssueTypes: options.recentIssueTypes,
    })
  );
}

/**
 * Gets counts of compliance issues by analysis tier completion.
 * Useful for showing pipeline progress statistics.
 * @param state - The state code (e.g., 'NY', 'NJ')
 * @returns Object with counts per tier level (0 = not analyzed)
 */
export async function getAnalysisTierCounts(
  state: JurisdictionCode
): Promise<ActionResult<TierCompletionCounts>> {
  return runAction('getAnalysisTierCounts', () => complianceIssuesRepo.getAnalysisTierCounts(state));
}

export async function getComplianceSeverityDistribution(
  state: JurisdictionCode
): Promise<ActionResult<SeverityDistribution>> {
  return runCachedAction(
    'getComplianceSeverityDistribution',
    () => complianceIssuesRepo.getSeverityDistribution(state),
    [`compliance-severity-dist-${state}`],
    { revalidate: 3600, tags: ['compliance-analytics'] }
  );
}

export interface GuidanceStatusCounts {
  total: number;
  unreviewed: number;
  reviewed: number;
  dismissed: number;
}

export async function getGuidanceComplianceIssueStatusCounts(
  state: JurisdictionCode
): Promise<ActionResult<GuidanceStatusCounts>> {
  return runCachedAction(
    'getGuidanceComplianceIssueStatusCounts',
    () => complianceIssuesRepo.getGuidanceComplianceIssueStatusCounts(state),
    [`guidance-compliance-status-counts-${state}`],
    { revalidate: 120, tags: ['compliance-issues'] }
  );
}
