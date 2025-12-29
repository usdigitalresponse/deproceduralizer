'use server';

import 'server-only';
import {
  db,
  CrossReferencesRepository,
  type CrossReferenceWithTarget,
  type CrossReferenceWithSource,
  type HighlightRef,
  type CrossRefStats,
  type StateCode,
} from '@deproceduralizer/database';
import { type ActionResult, success, failure, getErrorMessage } from './types';

const crossRefsRepo = new CrossReferencesRepository(db);

/**
 * Get all cross-references FROM a document (outgoing references).
 * Returns refs with target document info for display.
 */
export async function getCrossReferencesForDocument(
  documentId: number
): Promise<ActionResult<CrossReferenceWithTarget[]>> {
  try {
    const refs = await crossRefsRepo.getBySourceDocumentId(documentId);
    return success(refs);
  } catch (error) {
    console.error('[getCrossReferencesForDocument]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Get all cross-references TO a document (incoming references).
 * Returns refs with source document info for display.
 */
export async function getIncomingReferences(
  documentId: number
): Promise<ActionResult<CrossReferenceWithSource[]>> {
  try {
    const refs = await crossRefsRepo.getByTargetDocumentId(documentId);
    return success(refs);
  } catch (error) {
    console.error('[getIncomingReferences]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Get minimal cross-reference data for inline text highlighting.
 * Returns refs with offsets for highlighting citations in document text.
 */
export async function getCrossReferencesForHighlighting(
  documentId: number
): Promise<ActionResult<HighlightRef[]>> {
  try {
    const refs = await crossRefsRepo.getForHighlighting(documentId);
    return success(refs);
  } catch (error) {
    console.error('[getCrossReferencesForHighlighting]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Get cross-reference stats for dashboard display.
 */
export async function getCrossReferenceStats(
  state: StateCode
): Promise<ActionResult<CrossRefStats>> {
  try {
    const stats = await crossRefsRepo.getStatsByState(state);
    return success(stats);
  } catch (error) {
    console.error('[getCrossReferenceStats]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Get count of cross-references from a document.
 */
export async function getCrossReferenceCount(
  documentId: number
): Promise<ActionResult<number>> {
  try {
    const count = await crossRefsRepo.getCountBySourceDocumentId(documentId);
    return success(count);
  } catch (error) {
    console.error('[getCrossReferenceCount]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Get count of incoming cross-references to a document.
 */
export async function getIncomingReferenceCount(
  documentId: number
): Promise<ActionResult<number>> {
  try {
    const count = await crossRefsRepo.getCountByTargetDocumentId(documentId);
    return success(count);
  } catch (error) {
    console.error('[getIncomingReferenceCount]', error);
    return failure(getErrorMessage(error));
  }
}
