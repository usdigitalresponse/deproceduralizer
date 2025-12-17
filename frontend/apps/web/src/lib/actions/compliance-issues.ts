'use server';

import { revalidatePath } from 'next/cache';
import {
  db,
  ComplianceIssuesRepository,
  RegulatoryDocumentsRepository,
  REVIEW_STATUSES,
  IMPACT_TYPES,
  type StateCode,
  type ReviewStatus,
  type ImpactType,
} from '@deproceduralizer/database';
import { expandContext } from '@/lib/utils/expandContext';

const complianceIssuesRepo = new ComplianceIssuesRepository(db);
const regulatoryDocumentsRepo = new RegulatoryDocumentsRepository(db);

export interface UpdateComplianceIssueInput {
  id: number;
  reviewStatus: string;
  reviewedBy: string;
  reviewerNotes?: string;
  priority?: number;
  impactType?: string;
}

export async function updateComplianceIssueReview(input: UpdateComplianceIssueInput) {
  if (!REVIEW_STATUSES.includes(input.reviewStatus as ReviewStatus)) {
    throw new Error(`Invalid review status: ${input.reviewStatus}`);
  }

  if (input.impactType && !IMPACT_TYPES.includes(input.impactType as ImpactType)) {
    throw new Error(`Invalid impact type: ${input.impactType}`);
  }

  const result = await complianceIssuesRepo.updateReview(input.id, {
    reviewStatus: input.reviewStatus as ReviewStatus,
    reviewedBy: input.reviewedBy,
    reviewerNotes: input.reviewerNotes,
    priority: input.priority,
    impactType: input.impactType as ImpactType | undefined,
  });

  if (!result) {
    throw new Error(`Compliance issue with id ${input.id} not found`);
  }

  revalidatePath('/');
  return result;
}

export async function getComplianceIssueById(id: number) {
  return complianceIssuesRepo.getById(id);
}

export async function getComplianceIssuesByDocumentId(documentId: number) {
  return complianceIssuesRepo.getByDocumentId(documentId);
}

export async function getComplianceIssueTypes(state: StateCode) {
  return complianceIssuesRepo.getIssueTypes(state);
}

export async function getComplianceIssueStatusCounts(state: StateCode) {
  return complianceIssuesRepo.getCountsByStatus(state);
}

export async function getComplianceIssueCountsByType(state: StateCode) {
  return complianceIssuesRepo.getCountsByType(state);
}

export async function getComplianceIssueStats(state?: StateCode) {
  return complianceIssuesRepo.getStatsByState(state);
}

export async function getComplianceIssuesPaginated(
  state: StateCode,
  options: {
    page: number;
    pageSize: number;
    sortBy?: 'issueType' | 'createdAt' | 'reviewedAt';
    sortOrder?: 'asc' | 'desc';
    filters?: {
      status?: string;
      issueType?: string;
    };
  }
) {
  return complianceIssuesRepo.getAllPaginated({
    state,
    page: options.page,
    pageSize: options.pageSize,
    sortBy: options.sortBy,
    sortOrder: options.sortOrder,
    filters: options.filters ? {
      status: options.filters.status as ReviewStatus | 'all' | undefined,
      // Cast to any to bypass type mismatch with IssueType union
      issueType: options.filters.issueType as 'wet_signature' | 'in_person' | 'paper_form' | 'notarized' | 'certified' | 'other' | 'all' | undefined,
    } : undefined,
  });
}

/**
 * Get expanded context for a compliance issue by fetching the full regulation content
 * and extracting more text around the matched portion.
 */
export async function getExpandedContext(
  documentId: number,
  context: string,
  charsBeforeAfter: number = 800
): Promise<{
  expandedText: string;
  couldExpand: boolean;
}> {
  const doc = await regulatoryDocumentsRepo.getById(documentId);

  if (!doc?.content) {
    return { expandedText: context, couldExpand: false };
  }

  const result = expandContext(doc.content, context, charsBeforeAfter);
  return {
    expandedText: result.expandedText,
    couldExpand: result.couldExpand,
  };
}
