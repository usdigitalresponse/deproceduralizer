'use server';

import 'server-only';
import {
  db,
  ComplianceIssuesRepository,
  type JurisdictionCode,
  type TierCompletionCounts,
  type ClassificationBreakdown,
  type FullAnalysisRecord,
  type FullGuidanceAnalysisRecord,
  type AnalysisListItem,
  type GuidanceAnalysisListItem,
  type ComplianceIssue,
  type AnalysisExportRow,
  type ComprehensiveAnalysisExportRow,
  type AnalysisListFilters,
  type AnalysisFilterStats,
} from '@deproceduralizer/database';
import { type ActionResult, success, failure, getErrorMessage, runAction, runCachedAction } from './types';
import { generateCsv } from '@/lib/utils/csv';
import { getDepartmentName } from '@/lib/constants/departments';
import { ISSUE_TYPE_LABELS } from '@/types/regulation';

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
  state: JurisdictionCode
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

// Re-export for use by components
export type { AnalysisFilterStats };

/**
 * Gets filter dimension counts for the 5 key pipeline filter dropdowns.
 * Returns counts by classification, severity, tier, issue type, and federal mandate.
 * Cached for 2 minutes to reduce database traffic.
 *
 * @param state - The state code (e.g., 'NY', 'NJ')
 * @returns Filter stats broken down by each dimension
 */
export async function getAnalysisFilterStats(
  state: JurisdictionCode
): Promise<ActionResult<AnalysisFilterStats>> {
  return runCachedAction(
    'getAnalysisFilterStats',
    () => complianceIssuesRepo.getAnalysisFilterStats(state),
    [`analysis-filter-stats-${state}`],
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
  state: JurisdictionCode
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
 * Gets paginated analysis list for table view.
 *
 * @param state - The state code (e.g., 'NY', 'NJ')
 * @param options - Pagination, sorting, and filter options
 * @returns Paginated analysis list
 */
export async function getAnalysisListPaginated(
  state: JurisdictionCode,
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
  state: JurisdictionCode
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

/**
 * Exports filtered analysis data as a CSV string.
 * Uses the same filter infrastructure as the pipeline table but selects
 * export-specific columns. Capped at 5000 rows.
 */
export async function exportAnalysisCsv(
  state: JurisdictionCode,
  baseUrl: string,
  filters: AnalysisListFilters,
  sortBy?: string,
  sortOrder?: string,
): Promise<ActionResult<string>> {
  return runAction('exportAnalysisCsv', async () => {
    const rows = await complianceIssuesRepo.getAnalysisExportData(state, {
      sortBy,
      sortOrder,
      filters,
    });

    const headers = [
      'Title',
      'Reg Citation',
      'Issue Type',
      'Department',
      "What's Burdensome",
      'Bad Regulation Text',
      'Severity',
      'Easy Fix Type',
      'Effort',
      'Source URL',
      'Link',
    ];

    const csvRows = rows.map((row: AnalysisExportRow) => [
      row.documentTitle ?? '',
      row.citation ?? '',
      ISSUE_TYPE_LABELS[row.issueType] ?? row.issueType,
      getDepartmentName(row.nycrrTitle, row.njacTitle),
      row.argumentAgainstRegulation ?? '',
      (row.verbatimRequirements ?? []).join('; '),
      row.finalSeverity?.toString() ?? '',
      row.cleanupType ?? '',
      row.cleanupEffort ?? '',
      row.url ?? '',
      `${baseUrl}/${state.toLowerCase()}/pipeline/${row.documentId}/${row.issueType}`,
    ]);

    return generateCsv(headers, csvRows);
  });
}

// ============================================
// Comprehensive Export (Full CSV + By Agency ZIP)
// ============================================

const COMPREHENSIVE_HEADERS = [
  'Document Title', 'Citation', 'URL', 'Issue Type', 'Issue Type Label',
  'Department', 'Responsible Agency', 'Match Count', 'Highest Tier',
  'Tier 1 Classification', 'Tier 2 Classification', 'Tier 3 Classification',
  'Final Classification', 'Severity', 'Severity Baseline', 'Tier 3 Severity Adjustment',
  'Requirement Found', 'Is Justified',
  "What's Burdensome", 'Argument For Regulation', 'Bad Regulation Text',
  'Web Search Summary', 'Federal Mandate Found', 'State Has Discretion',
  'Evidence Gap', 'Cites Federal Statute', 'Federal Citation', 'Tier 3 Trigger',
  'Easy Cleanup', 'Cleanup Type', 'Cleanup Effort', 'Cleanup Recommendation',
  'Pipeline Version', 'Review Status', 'Reviewed By',
  'Justification Notes', 'Team Notes', 'Impact Type',
  'Developer Status', 'Developer Assigned', 'Developer Notes', 'Resolution Type',
  'Link',
];

function boolLabel(v: boolean | null | undefined): string {
  return v === true ? 'yes' : v === false ? 'no' : '';
}

function buildComprehensiveCsvRow(
  row: ComprehensiveAnalysisExportRow,
  baseUrl: string,
  state: string,
): string[] {
  const classification = row.tier3Classification ?? row.tier2Classification ?? row.tier1Classification ?? '';
  return [
    row.documentTitle ?? '',
    row.citation ?? '',
    row.url ?? '',
    row.issueType,
    ISSUE_TYPE_LABELS[row.issueType] ?? row.issueType,
    getDepartmentName(row.nycrrTitle, row.njacTitle),
    row.responsibleAgency ?? '',
    row.groupedMatchCount?.toString() ?? '',
    row.highestTierCompleted?.toString() ?? '',
    row.tier1Classification ?? '',
    row.tier2Classification ?? '',
    row.tier3Classification ?? '',
    classification,
    row.finalSeverity?.toString() ?? '',
    row.severityBaseline?.toString() ?? '',
    row.tier3SeverityAdjustment?.toString() ?? '',
    boolLabel(row.requirementFound),
    boolLabel(row.isJustified),
    row.argumentAgainstRegulation ?? '',
    row.argumentForRegulation ?? '',
    (row.verbatimRequirements ?? []).join('; '),
    row.webSearchSummary ?? '',
    boolLabel(row.federalMandateFound),
    boolLabel(row.stateHasDiscretion),
    boolLabel(row.tier3EvidenceGap),
    boolLabel(row.citesFederalStatute),
    row.federalCitation ?? '',
    row.tier3TriggerReason ?? '',
    boolLabel(row.easyCleanupCandidate),
    row.cleanupType ?? '',
    row.cleanupEffort ?? '',
    row.cleanupRecommendation ?? '',
    row.pipelineVersion ?? '',
    row.reviewStatus ?? '',
    row.reviewedBy ?? '',
    row.justificationNotes ?? '',
    row.teamNotes ?? '',
    row.impactType ?? '',
    row.developerStatus ?? '',
    row.developerAssigned ?? '',
    row.developerNotes ?? '',
    row.resolutionType ?? '',
    `${baseUrl}/${state.toLowerCase()}/pipeline/${row.documentId}/${row.issueType}`,
  ];
}

/**
 * Exports comprehensive analysis data as a CSV string with all analysis fields.
 * Respects active filters. Capped at 10000 rows.
 */
export async function exportComprehensiveAnalysisCsv(
  state: JurisdictionCode,
  baseUrl: string,
  filters: AnalysisListFilters,
  sortBy?: string,
  sortOrder?: string,
): Promise<ActionResult<string>> {
  return runAction('exportComprehensiveAnalysisCsv', async () => {
    const rows = await complianceIssuesRepo.getComprehensiveExportData(state, {
      sortBy,
      sortOrder,
      filters,
    });
    const csvRows = rows.map((row) => buildComprehensiveCsvRow(row, baseUrl, state));
    return generateCsv(COMPREHENSIVE_HEADERS, csvRows);
  });
}

/**
 * Exports comprehensive analysis data as a ZIP file with one CSV per responsible agency.
 * Respects active filters. Returns base64-encoded ZIP.
 */
export async function exportAnalysisZipByAgency(
  state: JurisdictionCode,
  baseUrl: string,
  filters: AnalysisListFilters,
  sortBy?: string,
  sortOrder?: string,
): Promise<ActionResult<string>> {
  return runAction('exportAnalysisZipByAgency', async () => {
    const { default: JSZip } = await import('jszip');
    const grouped = await complianceIssuesRepo.getComprehensiveExportDataGroupedByAgency(state, {
      sortBy,
      sortOrder,
      filters,
    });
    const zip = new JSZip();

    for (const [agency, rows] of grouped) {
      const safeName = agency.replace(/[^a-zA-Z0-9 _-]/g, '').replace(/\s+/g, '-');
      const csvRows = rows.map((row) => buildComprehensiveCsvRow(row, baseUrl, state));
      zip.file(`${safeName}.csv`, generateCsv(COMPREHENSIVE_HEADERS, csvRows));
    }

    const buffer = await zip.generateAsync({ type: 'base64' });
    return buffer;
  });
}

// ============================================
// Guidance Analysis Actions
// ============================================

export async function getGuidanceAnalysisTierStats(
  state: JurisdictionCode
): Promise<ActionResult<AnalysisTierStats>> {
  return runCachedAction(
    'getGuidanceAnalysisTierStats',
    async () => {
      const [tierCounts, classificationBreakdown] = await Promise.all([
        complianceIssuesRepo.getGuidanceAnalysisTierCounts(state),
        complianceIssuesRepo.getGuidanceClassificationBreakdown(state),
      ]);
      const total = tierCounts.tier0 + tierCounts.tier1 + tierCounts.tier2 + tierCounts.tier3;
      return { tierCounts, classificationBreakdown, total };
    },
    [`guidance-analysis-tier-stats-${state}`],
    { revalidate: 120 }
  );
}

export interface PaginatedGuidanceAnalysisResult {
  data: GuidanceAnalysisListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function getGuidanceAnalysisListPaginated(
  state: JurisdictionCode,
  options: {
    page: number;
    pageSize: number;
    sortBy?: 'issueType' | 'severity' | 'highestTier' | 'createdAt';
    sortOrder?: 'asc' | 'desc';
    filters?: AnalysisListFilters;
  }
): Promise<ActionResult<PaginatedGuidanceAnalysisResult>> {
  return runAction('getGuidanceAnalysisListPaginated', () =>
    complianceIssuesRepo.getGuidanceAnalysisListPaginated(state, options)
  );
}

export async function getFullGuidanceAnalysisRecord(
  guidanceDocumentId: number,
  issueType: string
): Promise<ActionResult<FullGuidanceAnalysisRecord | null>> {
  return runAction('getFullGuidanceAnalysisRecord', () =>
    complianceIssuesRepo.getFullGuidanceAnalysis(guidanceDocumentId, issueType)
  );
}

export async function getGuidanceRegexMatchesForAnalysis(
  guidanceDocumentId: number,
  issueType: string
): Promise<ActionResult<ComplianceIssue[]>> {
  return runAction('getGuidanceRegexMatchesForAnalysis', () =>
    complianceIssuesRepo.getGuidanceRegexMatches(guidanceDocumentId, issueType)
  );
}
