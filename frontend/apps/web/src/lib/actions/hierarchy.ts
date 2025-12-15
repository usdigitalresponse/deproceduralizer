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
 * Get root-level documents (titles) for the hierarchy tree
 */
export async function getHierarchyRoots(
  state: StateCode,
  filters?: Omit<HierarchyFilterOptions, 'state'>
): Promise<HierarchyNode[]> {
  return repo.getHierarchyRoots({ ...filters, state });
}

/**
 * Get children of a specific document in the hierarchy
 */
export async function getHierarchyChildren(
  parentId: number,
  state: StateCode,
  filters?: Omit<HierarchyFilterOptions, 'state'>
): Promise<HierarchyNode[]> {
  return repo.getHierarchyChildren(parentId, { ...filters, state });
}

/**
 * Get orphan documents (no parent linkage or null hierarchy level)
 */
export async function getOrphanDocuments(
  state: StateCode,
  filters?: Omit<HierarchyFilterOptions, 'state'>
): Promise<HierarchyNode[]> {
  return repo.getOrphanDocuments({ ...filters, state });
}

/**
 * Get hierarchy statistics by level
 */
export async function getHierarchyStats(
  state: StateCode,
  filters?: Omit<HierarchyFilterOptions, 'state'>
): Promise<{
  level: string;
  count: number;
  analyzedCount: number;
  flaggedCount: number;
}[]> {
  return repo.getHierarchyStats({ ...filters, state });
}

/**
 * Get a single document with full analysis for the detail panel
 */
export async function getDocumentForPanel(id: number) {
  return repo.getByIdWithAnalysis(id);
}

/**
 * Get the ancestor chain (breadcrumb path) for a document
 * Returns documents from root to immediate parent, ordered from root to current
 */
export async function getAncestorChain(documentId: number): Promise<{
  id: number;
  title: string;
  hierarchyLevel: string | null;
}[]> {
  return repo.getAncestorChain(documentId);
}

// ========================================
// Fast hierarchy methods (using precomputed stats)
// ========================================

/**
 * Get root-level titles using precomputed stats (fast)
 * Only returns true root titles (parent_id IS NULL)
 * For NJ, this is much faster than the filtered version
 */
export async function getHierarchyRootsFast(
  state: StateCode
): Promise<HierarchyNode[]> {
  return repo.getHierarchyRootsFast(state);
}

/**
 * Get children using precomputed stats (fast)
 * Uses precomputed descendant stats - no LATERAL joins needed
 */
export async function getHierarchyChildrenFast(
  parentId: number
): Promise<HierarchyNode[]> {
  return repo.getHierarchyChildrenFast(parentId);
}
