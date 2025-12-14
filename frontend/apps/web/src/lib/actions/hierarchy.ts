'use server';

import {
  db,
  RegulatoryDocumentsRepository,
  type HierarchyNode,
  type HierarchyFilterOptions,
} from '@deproceduralizer/database';

const repo = new RegulatoryDocumentsRepository(db);

/**
 * Get root-level documents (titles) for the hierarchy tree
 */
export async function getHierarchyRoots(
  filters?: HierarchyFilterOptions
): Promise<HierarchyNode[]> {
  return repo.getHierarchyRoots(filters);
}

/**
 * Get children of a specific document in the hierarchy
 */
export async function getHierarchyChildren(
  parentId: number,
  filters?: HierarchyFilterOptions
): Promise<HierarchyNode[]> {
  return repo.getHierarchyChildren(parentId, filters);
}

/**
 * Get orphan documents (no parent linkage or null hierarchy level)
 */
export async function getOrphanDocuments(
  filters?: HierarchyFilterOptions
): Promise<HierarchyNode[]> {
  return repo.getOrphanDocuments(filters);
}

/**
 * Get hierarchy statistics by level
 */
export async function getHierarchyStats(filters?: HierarchyFilterOptions): Promise<{
  level: string;
  count: number;
  analyzedCount: number;
  flaggedCount: number;
}[]> {
  return repo.getHierarchyStats(filters);
}

/**
 * Get a single document with full analysis for the detail panel
 */
export async function getDocumentForPanel(id: number) {
  return repo.getByIdWithAnalysis(id);
}
