'use server';

import 'server-only';
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
import { type ActionResult, success, failure, getErrorMessage, runAction, runCachedAction } from './types';

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
  return runCachedAction(
    'getAnalysisTierStats',
    async () => {
      const [tierCounts, classificationBreakdown] = await Promise.all([
        complianceIssuesRepo.getAnalysisTierCounts(state),
        complianceIssuesRepo.getClassificationBreakdown(state),
      ]);

      const total = tierCounts.tier0 + tierCounts.tier1 + tierCounts.tier2 +
                    tierCounts.tier3;

      return { tierCounts, classificationBreakdown, total };
    },
    [`analysis-tier-stats-${state}`],
    { revalidate: 120 }
  );
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
  return runAction('getFullAnalysisRecord', () => complianceIssuesRepo.getFullAnalysis(documentId, issueType));
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
  return runCachedAction(
    'getClassificationBreakdown',
    () => complianceIssuesRepo.getClassificationBreakdown(state),
    [`classification-breakdown-${state}`],
    { revalidate: 120 }
  );
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
  supersededByLaw?: 'true' | 'false' | 'no_tier3';       // Has a new law replaced this requirement?
  advocacyForChange?: 'true' | 'false' | 'no_tier3';     // Is there journalism/advocacy calling for change?
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
  return runAction('getAnalysisListPaginated', () => complianceIssuesRepo.getAnalysisListPaginated(state, options));
}

/**
 * Priority items for the pipeline dashboard banner.
 */
export interface PriorityPicksResult {
  items: AnalysisListItem[];
  totalQuickWins: number;
  isQuickWinMode: boolean;
}

/**
 * Gets priority items for the pipeline dashboard banner.
 * Prioritizes bookmarked issues at matching severity, then fills remaining
 * slots with non-bookmarked items. First tries high-severity + easy cleanup
 * (quick wins), falls back to top highest-severity burdensome items.
 *
 * @param state - The state code (e.g., 'NY', 'NJ')
 * @returns Priority items for the banner
 */
export async function getPriorityPicks(
  state: StateCode
): Promise<ActionResult<PriorityPicksResult>> {
  try {
    const PAGE_SIZE = 5;

    // Try quick wins first: high severity + easy cleanup
    const [bookmarkedQuickWins, allQuickWins] = await Promise.all([
      complianceIssuesRepo.getAnalysisListPaginated(state, {
        page: 1,
        pageSize: PAGE_SIZE,
        sortBy: 'severity',
        sortOrder: 'desc',
        filters: { severity: 'high', easyCleanup: 'any', bookmarkedOnly: true },
      }),
      complianceIssuesRepo.getAnalysisListPaginated(state, {
        page: 1,
        pageSize: PAGE_SIZE,
        sortBy: 'severity',
        sortOrder: 'desc',
        filters: { severity: 'high', easyCleanup: 'any' },
      }),
    ]);

    if (allQuickWins.data.length > 0) {
      const items = mergeBookmarkedFirst(bookmarkedQuickWins.data, allQuickWins.data, PAGE_SIZE);
      return success({
        items,
        totalQuickWins: allQuickWins.total,
        isQuickWinMode: true,
      });
    }

    // Fallback: top highest-severity items, bookmarked first
    const FALLBACK_SIZE = 3;
    const [bookmarkedHigh, allHigh] = await Promise.all([
      complianceIssuesRepo.getAnalysisListPaginated(state, {
        page: 1,
        pageSize: FALLBACK_SIZE,
        sortBy: 'severity',
        sortOrder: 'desc',
        filters: { severity: 'high', bookmarkedOnly: true },
      }),
      complianceIssuesRepo.getAnalysisListPaginated(state, {
        page: 1,
        pageSize: FALLBACK_SIZE,
        sortBy: 'severity',
        sortOrder: 'desc',
        filters: { severity: 'high' },
      }),
    ]);

    const items = mergeBookmarkedFirst(bookmarkedHigh.data, allHigh.data, FALLBACK_SIZE);
    return success({
      items,
      totalQuickWins: 0,
      isQuickWinMode: false,
    });
  } catch (error) {
    console.error('[getPriorityPicks]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Merge bookmarked items first, then fill remaining slots with non-duplicates
 * from the full list, up to `limit`.
 */
function mergeBookmarkedFirst(
  bookmarked: AnalysisListItem[],
  all: AnalysisListItem[],
  limit: number
): AnalysisListItem[] {
  const result = [...bookmarked];
  const seen = new Set(bookmarked.map(i => `${i.documentId}:${i.issueType}`));
  for (const item of all) {
    if (result.length >= limit) break;
    const key = `${item.documentId}:${item.issueType}`;
    if (!seen.has(key)) {
      result.push(item);
      seen.add(key);
    }
  }
  return result;
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
  return runAction('getRegexMatchesForAnalysis', () => complianceIssuesRepo.getByDocumentIdAndIssueType(documentId, issueType));
}
