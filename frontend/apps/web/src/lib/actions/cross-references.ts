'use server';

import 'server-only';
import {
  db,
  CrossReferencesRepository,
  type CrossReferenceWithTarget,
  type CrossReferenceWithSource,
  type HighlightRef,
  type CrossRefStats,
  type ReferenceEdge,
  type GraphLevel,
  type DocumentHub,
  type CircularReference,
  type DocumentNeighborhood,
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

// =============================================================================
// Analytics & Graph Data
// =============================================================================

/**
 * Get reference graph for network visualization.
 * Aggregates cross-references by hierarchy level (title, chapter, or part).
 * @param level - 'title' (~50 nodes), 'chapter' (~200), 'part' (~500)
 */
export async function getReferenceGraph(
  state: StateCode,
  level: GraphLevel = 'title'
): Promise<ActionResult<ReferenceEdge[]>> {
  try {
    const edges = await crossRefsRepo.getReferenceGraph(state, level);
    return success(edges);
  } catch (error) {
    console.error('[getReferenceGraph]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * @deprecated Use getReferenceGraph instead
 */
export async function getTitleLevelReferenceGraph(
  state: StateCode
): Promise<ActionResult<ReferenceEdge[]>> {
  return getReferenceGraph(state, 'title');
}

/**
 * Get top hub documents by reference degree.
 * Returns documents with highest in-degree, out-degree, or total degree.
 */
export async function getTopCitedDocuments(
  state: StateCode,
  limit: number = 20,
  sortBy: 'in' | 'out' | 'total' = 'total'
): Promise<ActionResult<DocumentHub[]>> {
  try {
    const hubs = await crossRefsRepo.getTopHubs(state, limit, sortBy);
    return success(hubs);
  } catch (error) {
    console.error('[getTopCitedDocuments]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Detect circular references in the corpus.
 * Returns cycles found within maxDepth hops.
 */
export async function getCircularReferences(
  state: StateCode,
  maxDepth: number = 4
): Promise<ActionResult<CircularReference[]>> {
  try {
    const cycles = await crossRefsRepo.detectCircularReferences(state, maxDepth);
    return success(cycles);
  } catch (error) {
    console.error('[getCircularReferences]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Get document reference neighborhood for tree highlighting.
 * Returns both outgoing and incoming reference document IDs.
 */
export async function getDocumentReferenceContext(
  documentId: number
): Promise<ActionResult<DocumentNeighborhood>> {
  try {
    const neighborhood = await crossRefsRepo.getDocumentNeighborhood(documentId);
    return success(neighborhood);
  } catch (error) {
    console.error('[getDocumentReferenceContext]', error);
    return failure(getErrorMessage(error));
  }
}
