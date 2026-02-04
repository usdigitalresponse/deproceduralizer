'use server';

import 'server-only';
import { revalidatePath } from 'next/cache';
import {
  db,
  RedFlagsRepository,
  ComplianceIssuesRepository,
  DeveloperStatus,
  ResolutionType,
  Developer,
  DEVELOPER_STATUSES,
  RESOLUTION_TYPES,
  DEVELOPERS,
  type StateCode,
  type RedFlag,
  type ComplianceIssueWithAnalysisFields,
  type RedFlagWithContext,
  type ComplianceIssueWithContext,
  type IssueType,
} from '@deproceduralizer/database';
import { type ActionResult, success, failure, getErrorMessage } from './types';

const redFlagsRepo = new RedFlagsRepository(db);
const complianceIssuesRepo = new ComplianceIssuesRepository(db);

// Input types
export interface UpdateDeveloperStatusInput {
  type: 'red_flag' | 'compliance_issue';
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
  type: 'red_flag' | 'compliance_issue';
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
  // Type-specific data
  redFlagData?: RedFlagWithContext;
  complianceIssueData?: ComplianceIssueWithContext;
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
  flags: { total: number };
  compliance: { total: number };
  combined: { total: number };
}

/**
 * Update developer status for a red flag or compliance issue
 * Returns the base type (without regulation context) since update doesn't re-fetch relations
 */
export async function updateDeveloperStatus(
  input: UpdateDeveloperStatusInput
): Promise<ActionResult<RedFlag | ComplianceIssueWithAnalysisFields>> {
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

    let result;
    if (input.type === 'red_flag') {
      result = await redFlagsRepo.updateDeveloperStatus(input.id, data);
    } else {
      result = await complianceIssuesRepo.updateDeveloperStatus(input.id, data);
    }

    if (!result) {
      return failure(`${input.type} with id ${input.id} not found`);
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
  type: 'red_flag' | 'compliance_issue';
  id: number;
}

/**
 * Clear all review and developer fields, returning item to unreviewed queue.
 * For compliance issues, also restores severity to original if it was changed.
 */
export async function clearEntryForReview(
  input: ClearEntryForReviewInput
): Promise<ActionResult<RedFlag | ComplianceIssueWithAnalysisFields>> {
  try {
    let result;
    if (input.type === 'red_flag') {
      result = await redFlagsRepo.clearForReview(input.id);
    } else {
      result = await complianceIssuesRepo.clearForReview(input.id);
    }

    if (!result) {
      return failure(`${input.type} with id ${input.id} not found`);
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
 * Get combined developer status counts from both tables
 */
export async function getCombinedDeveloperStatusCounts(
  state: StateCode
): Promise<ActionResult<CombinedDeveloperStatusCounts>> {
  try {
    const [flagCounts, issueCounts] = await Promise.all([
      redFlagsRepo.getDeveloperStatusCounts(state),
      complianceIssuesRepo.getDeveloperStatusCounts(state),
    ]);

    return success({
      unresolved: flagCounts.unresolved + issueCounts.unresolved,
      resolved: flagCounts.resolved + issueCounts.resolved,
      pending: flagCounts.pending + issueCounts.pending,
      backlogged: flagCounts.backlogged + issueCounts.backlogged,
      need_more_info: flagCounts.need_more_info + issueCounts.need_more_info,
      total: flagCounts.total + issueCounts.total,
    });
  } catch (error) {
    console.error('[getCombinedDeveloperStatusCounts]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Get combined reviewed items from both tables for developer mode
 */
export async function getCombinedReviewedItems(
  state: StateCode,
  options: {
    page: number;
    pageSize: number;
    developerStatus?: string;
    developerAssigned?: string;
    sortBy?: 'reviewedAt' | 'developerCheckedAt';
    sortOrder?: 'asc' | 'desc';
  }
): Promise<ActionResult<PaginatedDeveloperItemsResult>> {
  try {
    const { page, pageSize, developerStatus, developerAssigned, sortBy = 'reviewedAt', sortOrder = 'desc' } = options;

    // Fetch from both repositories
    const [flagsResult, issuesResult] = await Promise.all([
      redFlagsRepo.getReviewedPaginated({
        state,
        page: 1,
        pageSize: 1000, // Get all for merging
        developerStatus: developerStatus as DeveloperStatus | 'all' | undefined,
        developerAssigned: developerAssigned as Developer | undefined,
        sortBy: sortBy as 'reviewedAt' | 'severity' | 'category',
        sortOrder,
      }),
      complianceIssuesRepo.getReviewedPaginated({
        state,
        page: 1,
        pageSize: 1000, // Get all for merging
        developerStatus: developerStatus as DeveloperStatus | 'all' | undefined,
        developerAssigned: developerAssigned as Developer | undefined,
        sortBy: sortBy as 'reviewedAt' | 'issueType' | 'createdAt',
        sortOrder,
      }),
    ]);

    // Transform and combine
    const flagItems: DeveloperItem[] = flagsResult.data.map(flag => ({
      id: flag.id,
      type: 'red_flag' as const,
      reviewStatus: flag.reviewStatus,
      reviewedBy: flag.reviewedBy,
      reviewedAt: flag.reviewedAt,
      justificationNotes: flag.justificationNotes,
      teamNotes: flag.teamNotes,
      developerStatus: flag.developerStatus,
      developerAssigned: flag.developerAssigned,
      developerNotes: flag.developerNotes,
      resolutionType: flag.resolutionType,
      resolutionComments: flag.resolutionComments,
      developerQuestion: flag.developerQuestion,
      developerCheckedAt: flag.developerCheckedAt,
      regulation: {
        id: flag.regulation.id,
        title: flag.regulation.title,
        url: flag.regulation.url,
      },
      redFlagData: flag,
    }));

    const issueItems: DeveloperItem[] = issuesResult.data.map(issue => ({
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
      complianceIssueData: issue,
    }));

    // Combine and sort by developerCheckedAt
    const combined = [...flagItems, ...issueItems];
    combined.sort((a, b) => {
      const aDate = a.developerCheckedAt;
      const bDate = b.developerCheckedAt;

      if (!aDate && !bDate) return 0;
      if (!aDate) return sortOrder === 'desc' ? 1 : -1;
      if (!bDate) return sortOrder === 'desc' ? -1 : 1;

      const diff = new Date(bDate).getTime() - new Date(aDate).getTime();
      return sortOrder === 'desc' ? diff : -diff;
    });

    // Paginate
    const total = combined.length;
    const totalPages = Math.ceil(total / pageSize);
    const offset = (page - 1) * pageSize;
    const data = combined.slice(offset, offset + pageSize);

    return success({
      data,
      total,
      page,
      pageSize,
      totalPages,
    });
  } catch (error) {
    console.error('[getCombinedReviewedItems]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Get items needing more info from both tables
 */
export async function getNeedMoreInfoItems(
  state: StateCode,
  options: {
    page: number;
    pageSize: number;
  }
): Promise<ActionResult<PaginatedDeveloperItemsResult>> {
  try {
    const { page, pageSize } = options;

    // Fetch from both repositories
    const [flagsResult, issuesResult] = await Promise.all([
      redFlagsRepo.getNeedMoreInfoFlags(state, { page: 1, pageSize: 1000 }),
      complianceIssuesRepo.getNeedMoreInfoIssues(state, { page: 1, pageSize: 1000 }),
    ]);

    // Transform and combine
    const flagItems: DeveloperItem[] = flagsResult.data.map(flag => ({
      id: flag.id,
      type: 'red_flag' as const,
      reviewStatus: flag.reviewStatus,
      reviewedBy: flag.reviewedBy,
      reviewedAt: flag.reviewedAt,
      justificationNotes: flag.justificationNotes,
      teamNotes: flag.teamNotes,
      developerStatus: flag.developerStatus,
      developerAssigned: flag.developerAssigned,
      developerNotes: flag.developerNotes,
      resolutionType: flag.resolutionType,
      resolutionComments: flag.resolutionComments,
      developerQuestion: flag.developerQuestion,
      developerCheckedAt: flag.developerCheckedAt,
      regulation: {
        id: flag.regulation.id,
        title: flag.regulation.title,
        url: flag.regulation.url,
      },
      redFlagData: flag,
    }));

    const issueItems: DeveloperItem[] = issuesResult.data.map(issue => ({
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
      complianceIssueData: issue,
    }));

    // Combine and sort by developerCheckedAt desc
    const combined = [...flagItems, ...issueItems];
    combined.sort((a, b) => {
      const aDate = a.developerCheckedAt;
      const bDate = b.developerCheckedAt;
      if (!aDate && !bDate) return 0;
      if (!aDate) return 1;
      if (!bDate) return -1;
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    });

    // Paginate
    const total = combined.length;
    const totalPages = Math.ceil(total / pageSize);
    const offset = (page - 1) * pageSize;
    const data = combined.slice(offset, offset + pageSize);

    return success({
      data,
      total,
      page,
      pageSize,
      totalPages,
    });
  } catch (error) {
    console.error('[getNeedMoreInfoItems]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Get counts of items needing more info
 */
export async function getNeedMoreInfoCounts(
  state: StateCode
): Promise<ActionResult<NeedMoreInfoCounts>> {
  try {
    const [flagCounts, issueCounts] = await Promise.all([
      redFlagsRepo.getNeedMoreInfoCount(state),
      complianceIssuesRepo.getNeedMoreInfoCount(state),
    ]);

    return success({
      flags: { total: flagCounts.total },
      compliance: { total: issueCounts.total },
      combined: {
        total: flagCounts.total + issueCounts.total,
      },
    });
  } catch (error) {
    console.error('[getNeedMoreInfoCounts]', error);
    return failure(getErrorMessage(error));
  }
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
 * Get separate developer status counts for red flags
 */
export async function getRedFlagDeveloperStatusCounts(
  state: StateCode
): Promise<ActionResult<DeveloperStatusCounts>> {
  try {
    const result = await redFlagsRepo.getDeveloperStatusCounts(state);
    return success(result);
  } catch (error) {
    console.error('[getRedFlagDeveloperStatusCounts]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Get separate developer status counts for compliance issues
 */
export async function getComplianceIssueDeveloperStatusCounts(
  state: StateCode
): Promise<ActionResult<DeveloperStatusCounts>> {
  try {
    const result = await complianceIssuesRepo.getDeveloperStatusCounts(state);
    return success(result);
  } catch (error) {
    console.error('[getComplianceIssueDeveloperStatusCounts]', error);
    return failure(getErrorMessage(error));
  }
}

// ============================================
// Separate Red Flag and Compliance Issue Developer Queues
// ============================================

export interface RedFlagDeveloperQueueParams {
  page: number;
  pageSize: number;
  developerStatus?: string;
  developerAssigned?: string;
  severity?: 'high' | 'medium' | 'low' | 'all';
  reviewStatus?: string;
  category?: string;
  sortBy?: 'severity' | 'category' | 'reviewedAt' | 'developerCheckedAt';
  sortOrder?: 'asc' | 'desc';
}

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
 * Get paginated red flags for developer mode with full filtering support
 */
export async function getRedFlagDeveloperItems(
  state: StateCode,
  params: RedFlagDeveloperQueueParams
): Promise<ActionResult<{ data: RedFlagWithContext[]; total: number; page: number; pageSize: number; totalPages: number }>> {
  try {
    const { page, pageSize, developerStatus, developerAssigned, severity, reviewStatus, category, sortBy = 'reviewedAt', sortOrder = 'desc' } = params;

    // Build filters - typed to match repository expectations
    type FilterType = {
      status?: 'unreviewed' | 'confirmed' | 'rejected_clear_fp' | 'rejected_not_obvious_bad' | 'needs_context' | 'deferred' | 'all';
      severity?: 'high' | 'medium' | 'low';
      category?: string;
    };
    const filters: FilterType = {};

    if (reviewStatus && reviewStatus !== 'all') {
      filters.status = reviewStatus as FilterType['status'];
    }
    if (severity && severity !== 'all') {
      filters.severity = severity as 'high' | 'medium' | 'low';
    }
    if (category) {
      filters.category = category;
    }

    const result = await redFlagsRepo.getReviewedPaginated({
      state,
      page,
      pageSize,
      developerStatus: developerStatus as DeveloperStatus | 'all' | undefined,
      developerAssigned: developerAssigned as Developer | undefined,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      sortBy: sortBy as 'severity' | 'category' | 'reviewedAt' | 'developerCheckedAt',
      sortOrder,
    });

    return success(result);
  } catch (error) {
    console.error('[getRedFlagDeveloperItems]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Get paginated compliance issues for developer mode with full filtering support
 */
export async function getComplianceIssueDeveloperItems(
  state: StateCode,
  params: ComplianceDeveloperQueueParams
): Promise<ActionResult<{ data: ComplianceIssueWithContext[]; total: number; page: number; pageSize: number; totalPages: number }>> {
  try {
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

    const result = await complianceIssuesRepo.getReviewedPaginated({
      state,
      page,
      pageSize,
      developerStatus: developerStatus as DeveloperStatus | 'all' | undefined,
      developerAssigned: developerAssigned as Developer | undefined,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      sortBy: sortBy as 'severity' | 'issueType' | 'reviewedAt' | 'createdAt' | 'developerCheckedAt',
      sortOrder,
    });

    return success(result);
  } catch (error) {
    console.error('[getComplianceIssueDeveloperItems]', error);
    return failure(getErrorMessage(error));
  }
}
