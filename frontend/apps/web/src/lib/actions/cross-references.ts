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
import { type ActionResult, runAction } from './types';

const crossRefsRepo = new CrossReferencesRepository(db);

/**
 * Get all cross-references FROM a document (outgoing references).
 * Returns refs with target document info for display.
 */
export async function getCrossReferencesForDocument(
  documentId: number
): Promise<ActionResult<CrossReferenceWithTarget[]>> {
  return runAction('getCrossReferencesForDocument', () => crossRefsRepo.getBySourceDocumentId(documentId));
}

/**
 * Get all cross-references TO a document (incoming references).
 * Returns refs with source document info for display.
 */
export async function getIncomingReferences(
  documentId: number
): Promise<ActionResult<CrossReferenceWithSource[]>> {
  return runAction('getIncomingReferences', () => crossRefsRepo.getByTargetDocumentId(documentId));
}

/**
 * Get minimal cross-reference data for inline text highlighting.
 * Returns refs with offsets for highlighting citations in document text.
 */
export async function getCrossReferencesForHighlighting(
  documentId: number
): Promise<ActionResult<HighlightRef[]>> {
  return runAction('getCrossReferencesForHighlighting', () => crossRefsRepo.getForHighlighting(documentId));
}

/**
 * Get cross-reference stats for dashboard display.
 */
export async function getCrossReferenceStats(
  state: StateCode
): Promise<ActionResult<CrossRefStats>> {
  return runAction('getCrossReferenceStats', () => crossRefsRepo.getStatsByState(state));
}

/**
 * Get count of cross-references from a document.
 */
export async function getCrossReferenceCount(
  documentId: number
): Promise<ActionResult<number>> {
  return runAction('getCrossReferenceCount', () => crossRefsRepo.getCountBySourceDocumentId(documentId));
}

/**
 * Get count of incoming cross-references to a document.
 */
export async function getIncomingReferenceCount(
  documentId: number
): Promise<ActionResult<number>> {
  return runAction('getIncomingReferenceCount', () => crossRefsRepo.getCountByTargetDocumentId(documentId));
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
  return runAction('getReferenceGraph', () => crossRefsRepo.getReferenceGraph(state, level));
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
  return runAction('getTopCitedDocuments', () => crossRefsRepo.getTopHubs(state, limit, sortBy));
}

/**
 * Detect circular references in the corpus.
 * Returns cycles found within maxDepth hops.
 */
export async function getCircularReferences(
  state: StateCode,
  maxDepth: number = 4
): Promise<ActionResult<CircularReference[]>> {
  return runAction('getCircularReferences', () => crossRefsRepo.detectCircularReferences(state, maxDepth));
}

/**
 * Get document reference neighborhood for tree highlighting.
 * Returns both outgoing and incoming reference document IDs.
 */
export async function getDocumentReferenceContext(
  documentId: number
): Promise<ActionResult<DocumentNeighborhood>> {
  return runAction('getDocumentReferenceContext', () => crossRefsRepo.getDocumentNeighborhood(documentId));
}
