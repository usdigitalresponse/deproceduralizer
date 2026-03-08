'use server';

import 'server-only';
import { revalidatePath } from 'next/cache';
import {
  db,
  ComplianceIssuesRepository,
  DeveloperStatus,
  ResolutionType,
  Developer,
  DEVELOPER_STATUSES,
  RESOLUTION_TYPES,
  DEVELOPERS,
  type JurisdictionCode,
  type ComplianceIssueWithAnalysisFields,
  type ComplianceIssueWithAnalysis,
  type IssueType,
} from '@deproceduralizer/database';
import { type ActionResult, success, failure, getErrorMessage, runAction } from './types';

const complianceIssuesRepo = new ComplianceIssuesRepository(db);

// Input types
export interface UpdateDeveloperStatusInput {
  type: 'compliance_issue';
  id: number;
  developerStatus: string;
  developerAssigned: string;
  developerNotes?: string;
  resolutionType?: string;
  resolutionComments?: string;
  developerQuestion?: string;
}

// Combined item type for the developer queue
export interface DeveloperItem {
  id: number;
  type: 'compliance_issue';
  // Common review fields
  reviewStatus: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  justificationNotes: string | null;
  teamNotes: string | null;
  // Developer fields
  developerStatus: string | null;
  developerAssigned: string | null;
  developerNotes: string | null;
  resolutionType: string | null;
  resolutionComments: string | null;
  developerQuestion: string | null;
  developerCheckedAt: Date | null;
  // Regulation context
  regulation: {
    id: number;
    title: string | null;
    url: string | null;
  };
  // Guidance document context (for guidance-sourced compliance issues)
  guidance?: {
    id: number;
    title: string | null;
    url: string | null;
    agency: string | null;
    docType: string | null;
    year: number | null;
  };
  // Type-specific data
  complianceIssueData?: ComplianceIssueWithAnalysis;
}

export interface PaginatedDeveloperItemsResult {
  data: DeveloperItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CombinedDeveloperStatusCounts {
  unresolved: number;
  resolved: number;
  pending: number;
  backlogged: number;
  need_more_info: number;
  total: number;
}

export interface NeedMoreInfoCounts {
  compliance: { total: number };
  combined: { total: number };
}

/**
 * Update developer status for a compliance issue
 * Returns the base type (without regulation context) since update doesn't re-fetch relations
 */
export async function updateDeveloperStatus(
  input: UpdateDeveloperStatusInput
): Promise<ActionResult<ComplianceIssueWithAnalysisFields>> {
  try {
    // Validate developer status
    if (!DEVELOPER_STATUSES.includes(input.developerStatus as DeveloperStatus)) {
      return failure(`Invalid developer status: ${input.developerStatus}`);
    }

    // Validate developer assignment
    if (!DEVELOPERS.includes(input.developerAssigned as Developer)) {
      return failure(`Invalid developer: ${input.developerAssigned}`);
    }

    // Validate resolution type if provided
    if (input.resolutionType && !RESOLUTION_TYPES.includes(input.resolutionType as ResolutionType)) {
      return failure(`Invalid resolution type: ${input.resolutionType}`);
    }

    const data = {
      developerStatus: input.developerStatus as DeveloperStatus,
      developerAssigned: input.developerAssigned as Developer,
      developerNotes: input.developerNotes,
      resolutionType: input.resolutionType as ResolutionType | undefined,
      resolutionComments: input.resolutionComments,
      developerQuestion: input.developerQuestion,
    };

    const result = await complianceIssuesRepo.updateDeveloperStatus(input.id, data);

    if (!result) {
      return failure(`compliance_issue with id ${input.id} not found`);
    }

    // Targeted invalidation: only review pages need updating after developer status change
    revalidatePath('/[state]/review', 'page');
    return success(result);
  } catch (error) {
    console.error('[updateDeveloperStatus]', error);
    return failure(getErrorMessage(error));
  }
}

export interface ClearEntryForReviewInput {
  type: 'compliance_issue';
  id: number;
}

/**
 * Clear all review and developer fields, returning item to unreviewed queue.
 * For compliance issues, also restores severity to original if it was changed.
 */
export async function clearEntryForReview(
  input: ClearEntryForReviewInput
): Promise<ActionResult<ComplianceIssueWithAnalysisFields>> {
  try {
    const result = await complianceIssuesRepo.clearForReview(input.id);

    if (!result) {
      return failure(`compliance_issue with id ${input.id} not found`);
    }

    // Invalidate review pages so the item appears in unreviewed queue
    revalidatePath('/[state]/review', 'page');
    return success(result);
  } catch (error) {
    console.error('[clearEntryForReview]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Get developer status counts for compliance issues
 */
export async function getCombinedDeveloperStatusCounts(
  state: JurisdictionCode
): Promise<ActionResult<CombinedDeveloperStatusCounts>> {
  return runAction('getCombinedDeveloperStatusCounts', async () => {
    const issueCounts = await complianceIssuesRepo.getDeveloperStatusCounts(state);

    return {
      unresolved: issueCounts.unresolved,
      resolved: issueCounts.resolved,
      pending: issueCounts.pending,
      backlogged: issueCounts.backlogged,
      need_more_info: issueCounts.need_more_info,
      total: issueCounts.total,
    };
  });
}

/**
 * Get reviewed compliance issues for developer mode
 */
export async function getCombinedReviewedItems(
  state: JurisdictionCode,
  options: {
    page: number;
    pageSize: number;
    developerStatus?: string;
    developerAssigned?: string;
    sortBy?: 'reviewedAt' | 'developerCheckedAt';
    sortOrder?: 'asc' | 'desc';
  }
): Promise<ActionResult<PaginatedDeveloperItemsResult>> {
  return runAction('getCombinedReviewedItems', async () => {
    const { page, pageSize, developerStatus, developerAssigned, sortBy = 'reviewedAt', sortOrder = 'desc' } = options;

    const issuesResult = await complianceIssuesRepo.getReviewedPaginated({
      jurisdiction: state,
      page,
      pageSize,
      developerStatus: developerStatus as DeveloperStatus | 'all' | undefined,
      developerAssigned: developerAssigned as Developer | undefined,
      sortBy: sortBy as 'reviewedAt' | 'issueType' | 'createdAt',
      sortOrder,
    });

    const data: DeveloperItem[] = issuesResult.data.map(issue => ({
      id: issue.id,
      type: 'compliance_issue' as const,
      reviewStatus: issue.reviewStatus,
      reviewedBy: issue.reviewedBy,
      reviewedAt: issue.reviewedAt,
      justificationNotes: issue.justificationNotes,
      teamNotes: issue.teamNotes,
      developerStatus: issue.developerStatus,
      developerAssigned: issue.developerAssigned,
      developerNotes: issue.developerNotes,
      resolutionType: issue.resolutionType,
      resolutionComments: issue.resolutionComments,
      developerQuestion: issue.developerQuestion,
      developerCheckedAt: issue.developerCheckedAt,
      regulation: {
        id: issue.regulation.id,
        title: issue.regulation.title,
        url: issue.regulation.url,
      },
      guidance: issue.guidance ?? undefined,
      complianceIssueData: issue,
    }));

    return {
      data,
      total: issuesResult.total,
      page: issuesResult.page,
      pageSize: issuesResult.pageSize,
      totalPages: issuesResult.totalPages,
    };
  });
}

/**
 * Get compliance issues needing more info
 */
export async function getNeedMoreInfoItems(
  state: JurisdictionCode,
  options: {
    page: number;
    pageSize: number;
  }
): Promise<ActionResult<PaginatedDeveloperItemsResult>> {
  return runAction('getNeedMoreInfoItems', async () => {
    const { page, pageSize } = options;

    const issuesResult = await complianceIssuesRepo.getNeedMoreInfoIssues(state, { page, pageSize });

    const data: DeveloperItem[] = issuesResult.data.map(issue => ({
      id: issue.id,
      type: 'compliance_issue' as const,
      reviewStatus: issue.reviewStatus,
      reviewedBy: issue.reviewedBy,
      reviewedAt: issue.reviewedAt,
      justificationNotes: issue.justificationNotes,
      teamNotes: issue.teamNotes,
      developerStatus: issue.developerStatus,
      developerAssigned: issue.developerAssigned,
      developerNotes: issue.developerNotes,
      resolutionType: issue.resolutionType,
      resolutionComments: issue.resolutionComments,
      developerQuestion: issue.developerQuestion,
      developerCheckedAt: issue.developerCheckedAt,
      regulation: {
        id: issue.regulation.id,
        title: issue.regulation.title,
        url: issue.regulation.url,
      },
      guidance: issue.guidance ?? undefined,
      complianceIssueData: issue,
    }));

    return {
      data,
      total: issuesResult.total,
      page: issuesResult.page,
      pageSize: issuesResult.pageSize,
      totalPages: issuesResult.totalPages,
    };
  });
}

/**
 * Get counts of items needing more info
 */
export async function getNeedMoreInfoCounts(
  state: JurisdictionCode
): Promise<ActionResult<NeedMoreInfoCounts>> {
  return runAction('getNeedMoreInfoCounts', async () => {
    const issueCounts = await complianceIssuesRepo.getNeedMoreInfoCount(state);

    return {
      compliance: { total: issueCounts.total },
      combined: {
        total: issueCounts.total,
      },
    };
  });
}

interface DeveloperStatusCounts {
  unresolved: number;
  resolved: number;
  pending: number;
  backlogged: number;
  need_more_info: number;
  total: number;
}

/**
 * Get separate developer status counts for compliance issues
 */
export async function getComplianceIssueDeveloperStatusCounts(
  state: JurisdictionCode
): Promise<ActionResult<DeveloperStatusCounts>> {
  return runAction('getComplianceIssueDeveloperStatusCounts', () => complianceIssuesRepo.getDeveloperStatusCounts(state));
}

// ============================================
// Compliance Issue Developer Queue
// ============================================

export interface ComplianceDeveloperQueueParams {
  page: number;
  pageSize: number;
  developerStatus?: string;
  developerAssigned?: string;
  severity?: 'high' | 'medium' | 'low' | 'all';
  reviewStatus?: string;
  issueType?: string;
  sortBy?: 'severity' | 'issueType' | 'reviewedAt' | 'developerCheckedAt';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Get paginated compliance issues for developer mode with full filtering support
 */
export async function getComplianceIssueDeveloperItems(
  state: JurisdictionCode,
  params: ComplianceDeveloperQueueParams
): Promise<ActionResult<{ data: ComplianceIssueWithAnalysis[]; total: number; page: number; pageSize: number; totalPages: number }>> {
  return runAction('getComplianceIssueDeveloperItems', () => {
    const { page, pageSize, developerStatus, developerAssigned, severity, reviewStatus, issueType, sortBy = 'reviewedAt', sortOrder = 'desc' } = params;

    // Build filters - typed to match repository expectations
    type FilterType = {
      status?: 'unreviewed' | 'confirmed' | 'rejected_clear_fp' | 'rejected_not_obvious_bad' | 'needs_context' | 'deferred' | 'all';
      severity?: 'high' | 'medium' | 'low' | 'all';
      issueType?: IssueType | 'all';
    };
    const filters: FilterType = {};

    if (reviewStatus && reviewStatus !== 'all') {
      filters.status = reviewStatus as FilterType['status'];
    }
    if (severity && severity !== 'all') {
      filters.severity = severity as 'high' | 'medium' | 'low';
    }
    if (issueType) {
      filters.issueType = issueType as IssueType;
    }

    return complianceIssuesRepo.getReviewedPaginated({
      jurisdiction: state,
      page,
      pageSize,
      developerStatus: developerStatus as DeveloperStatus | 'all' | undefined,
      developerAssigned: developerAssigned as Developer | undefined,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      sortBy: sortBy as 'severity' | 'issueType' | 'reviewedAt' | 'createdAt' | 'developerCheckedAt',
      sortOrder,
    });
  });
}
