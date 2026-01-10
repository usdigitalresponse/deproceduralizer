'use server';

import 'server-only';
import { unstable_cache } from 'next/cache';
import {
  db,
  ComplianceIssuesRepository,
  type StateCode,
  type TierCompletionCounts,
  type ClassificationBreakdown,
  type FullAnalysisRecord,
  type AnalysisListItem,
  type ComplianceIssue,
} from '@deproceduralizer/database';
import { type ActionResult, success, failure, getErrorMessage } from './types';

const complianceIssuesRepo = new ComplianceIssuesRepository(db);

/**
 * Combined analysis stats for dashboard.
 */
export interface AnalysisTierStats {
  tierCounts: TierCompletionCounts;
  classificationBreakdown: ClassificationBreakdown;
  total: number;
}

/**
 * Gets comprehensive analysis statistics for the dashboard.
 * Combines tier counts and classification breakdown.
 * Cached for 2 minutes to reduce database traffic.
 *
 * @param state - The state code (e.g., 'NY', 'NJ')
 * @returns Tier counts and classification breakdown
 */
export async function getAnalysisTierStats(
  state: StateCode
): Promise<ActionResult<AnalysisTierStats>> {
  try {
    const cachedGetStats = unstable_cache(
      async () => {
        const [tierCounts, classificationBreakdown] = await Promise.all([
          complianceIssuesRepo.getAnalysisTierCounts(state),
          complianceIssuesRepo.getClassificationBreakdown(state),
        ]);

        const total = tierCounts.tier0 + tierCounts.tier1 + tierCounts.tier2 +
                      tierCounts.tier3 + tierCounts.tier4;

        return { tierCounts, classificationBreakdown, total };
      },
      [`analysis-tier-stats-${state}`],
      { revalidate: 120 } // 2 minutes
    );

    const result = await cachedGetStats();
    return success(result);
  } catch (error) {
    console.error('[getAnalysisTierStats]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Gets the full analysis record for a specific document and issue type.
 * Used for the dedicated analysis detail page.
 *
 * @param documentId - The regulatory document ID
 * @param issueType - The issue type (e.g., 'wet_signature', 'in_person')
 * @returns Full analysis record with all tier data
 */
export async function getFullAnalysisRecord(
  documentId: number,
  issueType: string
): Promise<ActionResult<FullAnalysisRecord | null>> {
  try {
    const result = await complianceIssuesRepo.getFullAnalysis(documentId, issueType);
    return success(result);
  } catch (error) {
    console.error('[getFullAnalysisRecord]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Gets classification breakdown by tier for charts.
 *
 * @param state - The state code (e.g., 'NY', 'NJ')
 * @returns Classification counts per tier
 */
export async function getClassificationBreakdown(
  state: StateCode
): Promise<ActionResult<ClassificationBreakdown>> {
  try {
    const cachedGetBreakdown = unstable_cache(
      () => complianceIssuesRepo.getClassificationBreakdown(state),
      [`classification-breakdown-${state}`],
      { revalidate: 120 } // 2 minutes
    );

    const result = await cachedGetBreakdown();
    return success(result);
  } catch (error) {
    console.error('[getClassificationBreakdown]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Paginated analysis list result.
 */
export interface PaginatedAnalysisResult {
  data: AnalysisListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Filter options for analysis list.
 */
export interface AnalysisListFilters {
  tierCompleted?: number;
  classification?: string;
  federalMandate?: boolean;
  pipelineRun?: boolean;
  issueType?: string;
  // V5 Tier 3 filters
  severity?: 'high' | 'medium' | 'low' | 'none';
  severityChanged?: 'increased' | 'decreased' | 'unchanged' | 'no_tier3';
  federalMandateConfirmed?: 'true' | 'false' | 'no_tier3';
  stateDiscretion?: 'true' | 'false' | 'no_tier3';
  alternativeFound?: 'true' | 'false' | 'no_tier3';
  evidenceGap?: 'true' | 'false' | 'no_tier3';
  tier3Trigger?: string;
  // V5.1 Easy Cleanup filter
  easyCleanup?: 'any' | 'trivial' | 'easy' | 'medium';
  // Bookmarks filter
  bookmarkedOnly?: boolean;
}

/**
 * Gets paginated analysis list for table view.
 *
 * @param state - The state code (e.g., 'NY', 'NJ')
 * @param options - Pagination, sorting, and filter options
 * @returns Paginated analysis list
 */
export async function getAnalysisListPaginated(
  state: StateCode,
  options: {
    page: number;
    pageSize: number;
    sortBy?: 'issueType' | 'severity' | 'highestTier' | 'createdAt';
    sortOrder?: 'asc' | 'desc';
    filters?: AnalysisListFilters;
  }
): Promise<ActionResult<PaginatedAnalysisResult>> {
  try {
    const result = await complianceIssuesRepo.getAnalysisListPaginated(state, options);
    return success(result);
  } catch (error) {
    console.error('[getAnalysisListPaginated]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Gets all regex matches (compliance issues) for a specific document and issue type.
 * Used in print mode to display the original regex match contexts.
 *
 * @param documentId - The regulatory document ID
 * @param issueType - The issue type (e.g., 'wet_signature', 'in_person')
 * @returns Array of compliance issues with regex match context
 */
export async function getRegexMatchesForAnalysis(
  documentId: number,
  issueType: string
): Promise<ActionResult<ComplianceIssue[]>> {
  try {
    const result = await complianceIssuesRepo.getByDocumentIdAndIssueType(documentId, issueType);
    return success(result);
  } catch (error) {
    console.error('[getRegexMatchesForAnalysis]', error);
    return failure(getErrorMessage(error));
  }
}
