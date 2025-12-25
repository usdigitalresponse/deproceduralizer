'use server';

import 'server-only';
import { revalidatePath } from 'next/cache';
import { db, RegulatoryDocumentsRepository, regulatoryDocuments, eq, and, desc, type RegulationWithAnalysis, type PaginationOptions, type FilterOptions, type StateCode, type PaginatedResult } from '@deproceduralizer/database';
import { type ActionResult, success, failure, getErrorMessage } from './types';

const regulationsRepo = new RegulatoryDocumentsRepository(db);

/**
 * Fetches a regulation with its current analysis by ID.
 * @param id - The regulatory document ID
 * @returns The regulation with analysis data or null if not found
 */
export async function getRegulationById(
  id: number
): Promise<ActionResult<RegulationWithAnalysis | null>> {
  try {
    const result = await regulationsRepo.getByIdWithAnalysis(id);
    return success(result);
  } catch (error) {
    console.error('[getRegulationById]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Fetches paginated regulations with analysis data.
 * @param options - Pagination and filter options including state
 * @returns Paginated result with regulations
 */
export async function getRegulationsPaginated(
  options: PaginationOptions & { state: StateCode; filters?: FilterOptions }
): Promise<ActionResult<PaginatedResult<RegulationWithAnalysis>>> {
  try {
    const result = await regulationsRepo.getAllWithAnalysisPaginated(options);
    return success(result);
  } catch (error) {
    console.error('[getRegulationsPaginated]', error);
    return failure(getErrorMessage(error));
  }
}

// ============================================================================
// Analysis Exclusion Actions
// ============================================================================

export interface SetExclusionInput {
  documentId: number;
  exclude: boolean;
  excludedBy: string;
  reason?: string;
}

export interface ExcludedDocument {
  id: number;
  title: string;
  hierarchyLevel: string | null;
  excludedAt: Date | null;
  excludedBy: string | null;
  excludedReason: string | null;
  state: string | null;
}

/**
 * Sets or removes the exclude_from_analysis flag for a document.
 */
export async function setDocumentExclusion(
  input: SetExclusionInput
): Promise<ActionResult<{ id: number; excludeFromAnalysis: boolean }>> {
  try {
    const now = input.exclude ? new Date() : null;

    await db
      .update(regulatoryDocuments)
      .set({
        excludeFromAnalysis: input.exclude,
        excludedAt: now,
        excludedBy: input.exclude ? input.excludedBy : null,
        excludedReason: input.exclude ? (input.reason || null) : null,
      })
      .where(eq(regulatoryDocuments.id, input.documentId));

    // Revalidate the detail page for this document
    revalidatePath(`/`);

    return success({
      id: input.documentId,
      excludeFromAnalysis: input.exclude,
    });
  } catch (error) {
    console.error('[setDocumentExclusion]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Fetches all documents marked as excluded from analysis for a given state.
 */
export async function getExcludedDocuments(
  state: string
): Promise<ActionResult<ExcludedDocument[]>> {
  try {
    const excluded = await db
      .select({
        id: regulatoryDocuments.id,
        title: regulatoryDocuments.title,
        hierarchyLevel: regulatoryDocuments.hierarchyLevel,
        excludedAt: regulatoryDocuments.excludedAt,
        excludedBy: regulatoryDocuments.excludedBy,
        excludedReason: regulatoryDocuments.excludedReason,
        state: regulatoryDocuments.state,
      })
      .from(regulatoryDocuments)
      .where(
        and(
          eq(regulatoryDocuments.state, state.toUpperCase()),
          eq(regulatoryDocuments.excludeFromAnalysis, true)
        )
      )
      .orderBy(desc(regulatoryDocuments.excludedAt));

    return success(excluded);
  } catch (error) {
    console.error('[getExcludedDocuments]', error);
    return failure(getErrorMessage(error));
  }
}
