'use server';

import {
  db,
  RegulatoryDocumentsRepository,
  type HierarchyNode,
  type HierarchyFilterOptions,
  type StateCode,
} from '@deproceduralizer/database';

const repo = new RegulatoryDocumentsRepository(db);

/**
 * Get children of a specific document in the hierarchy
 * Used by BrowseClient for filtered tree expansion
 */
export async function getHierarchyChildren(
  parentId: number,
  state: StateCode,
  filters?: Omit<HierarchyFilterOptions, 'state'>
): Promise<HierarchyNode[]> {
  return repo.getHierarchyChildren(parentId, { ...filters, state });
}

/**
 * Get a single document with full analysis for the detail panel
 * Used by DetailPanel to fetch document details
 */
export async function getDocumentForPanel(id: number) {
  return repo.getByIdWithAnalysis(id);
}

/**
 * Get the ancestor chain (breadcrumb path) for a document
 * Returns documents from root to immediate parent, ordered from root to current
 * Used by HierarchyBreadcrumbs for navigation
 */
export async function getAncestorChain(documentId: number): Promise<{
  id: number;
  title: string;
  hierarchyLevel: string | null;
}[]> {
  return repo.getAncestorChain(documentId);
}

/**
 * Get children using precomputed stats (fast)
 * Uses precomputed descendant stats - no LATERAL joins needed
 * Used by BrowseClient for unfiltered tree expansion
 */
export async function getHierarchyChildrenFast(
  parentId: number
): Promise<HierarchyNode[]> {
  return repo.getHierarchyChildrenFast(parentId);
}
