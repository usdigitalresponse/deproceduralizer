'use server';
import 'server-only';

import { db, CrossReferencesRepository } from '@deproceduralizer/database';
import type { CrossReferenceWithTarget, CrossReferenceWithSource, HighlightRef, CrossRefStats } from '@deproceduralizer/database';
import type { StateCode } from '@/types/state';
import { success, failure, type ActionResult } from './types';

const crossRefsRepo = new CrossReferencesRepository(db);

/**
 * Get all cross-references FROM a document (outgoing).
 */
export async function getCrossReferencesForDocument(
  documentId: number
): Promise<ActionResult<CrossReferenceWithTarget[]>> {
  try {
    const result = await crossRefsRepo.getBySourceDocumentId(documentId);
    return success(result);
  } catch (error) {
    console.error('[getCrossReferencesForDocument]', error);
    return failure('Failed to load cross-references');
  }
}

/**
 * Get all cross-references TO a document (incoming - who cites this doc).
 */
export async function getIncomingReferences(
  documentId: number
): Promise<ActionResult<CrossReferenceWithSource[]>> {
  try {
    const result = await crossRefsRepo.getByTargetDocumentId(documentId);
    return success(result);
  } catch (error) {
    console.error('[getIncomingReferences]', error);
    return failure('Failed to load incoming references');
  }
}

/**
 * Get cross-references for inline highlighting.
 */
export async function getCrossReferencesForHighlighting(
  documentId: number
): Promise<ActionResult<HighlightRef[]>> {
  try {
    const result = await crossRefsRepo.getForHighlighting(documentId);
    return success(result);
  } catch (error) {
    console.error('[getCrossReferencesForHighlighting]', error);
    return failure('Failed to load cross-references for highlighting');
  }
}

/**
 * Get cross-reference stats by state.
 */
export async function getCrossReferenceStats(
  state: StateCode
): Promise<ActionResult<CrossRefStats>> {
  try {
    const result = await crossRefsRepo.getStatsByState(state);
    return success(result);
  } catch (error) {
    console.error('[getCrossReferenceStats]', error);
    return failure('Failed to load cross-reference stats');
  }
}

/**
 * Get count of outgoing cross-references for a document.
 */
export async function getCrossReferenceCount(
  documentId: number
): Promise<ActionResult<number>> {
  try {
    const result = await crossRefsRepo.getCountBySourceDocumentId(documentId);
    return success(result);
  } catch (error) {
    console.error('[getCrossReferenceCount]', error);
    return failure('Failed to get cross-reference count');
  }
}

/**
 * Get count of incoming references for a document.
 */
export async function getIncomingReferenceCount(
  documentId: number
): Promise<ActionResult<number>> {
  try {
    const result = await crossRefsRepo.getCountByTargetDocumentId(documentId);
    return success(result);
  } catch (error) {
    console.error('[getIncomingReferenceCount]', error);
    return failure('Failed to get incoming reference count');
  }
}
