'use server';

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
  type RedFlagWithContext,
  type ComplianceIssueWithContext,
} from '@deproceduralizer/database';

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
  reviewerNotes: string | null;
  priority: number | null;
  impactType: string | null;
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
  flags: { total: number; forReviewer: number };
  compliance: { total: number; forReviewer: number };
  combined: { total: number; forReviewer: number };
}

/**
 * Update developer status for a red flag or compliance issue
 */
export async function updateDeveloperStatus(input: UpdateDeveloperStatusInput) {
  // Validate developer status
  if (!DEVELOPER_STATUSES.includes(input.developerStatus as DeveloperStatus)) {
    throw new Error(`Invalid developer status: ${input.developerStatus}`);
  }

  // Validate developer assignment
  if (!DEVELOPERS.includes(input.developerAssigned as Developer)) {
    throw new Error(`Invalid developer: ${input.developerAssigned}`);
  }

  // Validate resolution type if provided
  if (input.resolutionType && !RESOLUTION_TYPES.includes(input.resolutionType as ResolutionType)) {
    throw new Error(`Invalid resolution type: ${input.resolutionType}`);
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
    throw new Error(`${input.type} with id ${input.id} not found`);
  }

  revalidatePath('/');
  return result;
}

/**
 * Get combined developer status counts from both tables
 */
export async function getCombinedDeveloperStatusCounts(state: StateCode): Promise<CombinedDeveloperStatusCounts> {
  const [flagCounts, issueCounts] = await Promise.all([
    redFlagsRepo.getDeveloperStatusCounts(state),
    complianceIssuesRepo.getDeveloperStatusCounts(state),
  ]);

  return {
    unresolved: flagCounts.unresolved + issueCounts.unresolved,
    resolved: flagCounts.resolved + issueCounts.resolved,
    pending: flagCounts.pending + issueCounts.pending,
    backlogged: flagCounts.backlogged + issueCounts.backlogged,
    need_more_info: flagCounts.need_more_info + issueCounts.need_more_info,
    total: flagCounts.total + issueCounts.total,
  };
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
): Promise<PaginatedDeveloperItemsResult> {
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
    reviewerNotes: flag.reviewerNotes,
    priority: flag.priority,
    impactType: flag.impactType,
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
    reviewerNotes: issue.reviewerNotes,
    priority: issue.priority,
    impactType: issue.impactType,
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

  // Combine and sort
  const combined = [...flagItems, ...issueItems];
  combined.sort((a, b) => {
    const aDate = sortBy === 'developerCheckedAt' ? a.developerCheckedAt : a.reviewedAt;
    const bDate = sortBy === 'developerCheckedAt' ? b.developerCheckedAt : b.reviewedAt;

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

  return {
    data,
    total,
    page,
    pageSize,
    totalPages,
  };
}

/**
 * Get items needing more info from both tables
 */
export async function getNeedMoreInfoItems(
  state: StateCode,
  options: {
    page: number;
    pageSize: number;
    reviewerName?: string;
  }
): Promise<PaginatedDeveloperItemsResult> {
  const { page, pageSize, reviewerName } = options;

  // Fetch from both repositories
  const [flagsResult, issuesResult] = await Promise.all([
    redFlagsRepo.getNeedMoreInfoFlags(state, { page: 1, pageSize: 1000, reviewerName }),
    complianceIssuesRepo.getNeedMoreInfoIssues(state, { page: 1, pageSize: 1000, reviewerName }),
  ]);

  // Transform and combine
  const flagItems: DeveloperItem[] = flagsResult.data.map(flag => ({
    id: flag.id,
    type: 'red_flag' as const,
    reviewStatus: flag.reviewStatus,
    reviewedBy: flag.reviewedBy,
    reviewedAt: flag.reviewedAt,
    reviewerNotes: flag.reviewerNotes,
    priority: flag.priority,
    impactType: flag.impactType,
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
    reviewerNotes: issue.reviewerNotes,
    priority: issue.priority,
    impactType: issue.impactType,
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

  // Combine and sort - reviewer's items first, then by developerCheckedAt
  const combined = [...flagItems, ...issueItems];
  combined.sort((a, b) => {
    // Reviewer's items first
    if (reviewerName) {
      const aIsReviewer = a.reviewedBy === reviewerName;
      const bIsReviewer = b.reviewedBy === reviewerName;
      if (aIsReviewer && !bIsReviewer) return -1;
      if (!aIsReviewer && bIsReviewer) return 1;
    }

    // Then by developerCheckedAt desc
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

  return {
    data,
    total,
    page,
    pageSize,
    totalPages,
  };
}

/**
 * Get counts of items needing more info
 */
export async function getNeedMoreInfoCounts(
  state: StateCode,
  reviewerName?: string
): Promise<NeedMoreInfoCounts> {
  const [flagCounts, issueCounts] = await Promise.all([
    redFlagsRepo.getNeedMoreInfoCount(state, reviewerName),
    complianceIssuesRepo.getNeedMoreInfoCount(state, reviewerName),
  ]);

  return {
    flags: flagCounts,
    compliance: issueCounts,
    combined: {
      total: flagCounts.total + issueCounts.total,
      forReviewer: flagCounts.forReviewer + issueCounts.forReviewer,
    },
  };
}

/**
 * Get separate developer status counts for red flags
 */
export async function getRedFlagDeveloperStatusCounts(state: StateCode) {
  return redFlagsRepo.getDeveloperStatusCounts(state);
}

/**
 * Get separate developer status counts for compliance issues
 */
export async function getComplianceIssueDeveloperStatusCounts(state: StateCode) {
  return complianceIssuesRepo.getDeveloperStatusCounts(state);
}
