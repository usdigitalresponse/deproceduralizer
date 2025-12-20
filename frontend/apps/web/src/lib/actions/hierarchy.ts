'use server';

import {
  db,
  RegulatoryDocumentsRepository,
  type HierarchyNode,
  type HierarchyFilterOptions,
  type StateCode,
  type RegulationWithAnalysis,
} from '@deproceduralizer/database';
import { type ActionResult, success, failure, getErrorMessage } from './types';

const repo = new RegulatoryDocumentsRepository(db);

/**
 * Get children of a specific document in the hierarchy
 * Used by BrowseClient for filtered tree expansion
 */
export async function getHierarchyChildren(
  parentId: number,
  state: StateCode,
  filters?: Omit<HierarchyFilterOptions, 'state'>
): Promise<ActionResult<HierarchyNode[]>> {
  try {
    const result = await repo.getHierarchyChildren(parentId, { ...filters, state });
    return success(result);
  } catch (error) {
    console.error('[getHierarchyChildren]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Get a single document with full analysis for the detail panel
 * Used by DetailPanel to fetch document details
 */
export async function getDocumentForPanel(
  id: number
): Promise<ActionResult<RegulationWithAnalysis | null>> {
  try {
    const result = await repo.getByIdWithAnalysis(id);
    return success(result);
  } catch (error) {
    console.error('[getDocumentForPanel]', error);
    return failure(getErrorMessage(error));
  }
}

interface AncestorNode {
  id: number;
  title: string;
  hierarchyLevel: string | null;
}

/**
 * Get the ancestor chain (breadcrumb path) for a document
 * Returns documents from root to immediate parent, ordered from root to current
 * Used by HierarchyBreadcrumbs for navigation
 */
export async function getAncestorChain(
  documentId: number
): Promise<ActionResult<AncestorNode[]>> {
  try {
    const result = await repo.getAncestorChain(documentId);
    return success(result);
  } catch (error) {
    console.error('[getAncestorChain]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Get children using precomputed stats (fast)
 * Uses precomputed descendant stats - no LATERAL joins needed
 * Used by BrowseClient for unfiltered tree expansion
 */
export async function getHierarchyChildrenFast(
  parentId: number
): Promise<ActionResult<HierarchyNode[]>> {
  try {
    const result = await repo.getHierarchyChildrenFast(parentId);
    return success(result);
  } catch (error) {
    console.error('[getHierarchyChildrenFast]', error);
    return failure(getErrorMessage(error));
  }
}
