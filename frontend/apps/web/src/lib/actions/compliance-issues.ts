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
  type ComplianceIssue,
  type ComplianceIssueWithContext,
  type PaginatedComplianceIssuesResult,
} from '@deproceduralizer/database';
import { expandContext } from '@/lib/utils/expandContext';
import { type ActionResult, success, failure, getErrorMessage } from './types';

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

export async function updateComplianceIssueReview(
  input: UpdateComplianceIssueInput
): Promise<ActionResult<ComplianceIssue>> {
  try {
    if (!REVIEW_STATUSES.includes(input.reviewStatus as ReviewStatus)) {
      return failure(`Invalid review status: ${input.reviewStatus}`);
    }

    if (input.impactType && !IMPACT_TYPES.includes(input.impactType as ImpactType)) {
      return failure(`Invalid impact type: ${input.impactType}`);
    }

    const result = await complianceIssuesRepo.updateReview(input.id, {
      reviewStatus: input.reviewStatus as ReviewStatus,
      reviewedBy: input.reviewedBy,
      reviewerNotes: input.reviewerNotes,
      priority: input.priority,
      impactType: input.impactType as ImpactType | undefined,
    });

    if (!result) {
      return failure(`Compliance issue with id ${input.id} not found`);
    }

    revalidatePath('/');
    return success(result);
  } catch (error) {
    console.error('[updateComplianceIssueReview]', error);
    return failure(getErrorMessage(error));
  }
}

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

export async function getComplianceIssueTypes(
  state: StateCode
): Promise<ActionResult<string[]>> {
  try {
    const result = await complianceIssuesRepo.getIssueTypes(state);
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
  false_positive: number;
  needs_context: number;
  deferred: number;
  total: number;
}

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
