'use server';

import 'server-only';
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
  shortTitle: string | null;
  summary: string | null;
  levelIdentifier: string | null;
  citation: string | null;
  nycrrTitle: number | null;
  nycrrPart: string | null;
  nycrrChapter: string | null;
  njacTitle: string | null;
  njacChapter: string | null;
  njacSubchapter: string | null;
  state: string | null;
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

// ============================================
// Browse Page Data
// ============================================

export interface HierarchyBrowseData {
  roots: HierarchyNode[];
  orphans: HierarchyNode[];
  stats: {
    level: string;
    count: number;
    analyzedCount: number;
    flaggedCount: number;
  }[];
}

/**
 * Get all data needed for the browse page
 * Uses fast queries when no filters are active
 */
export async function getHierarchyBrowseData(
  stateCode: StateCode,
  filters: HierarchyFilterOptions,
  hasActiveFilters: boolean
): Promise<ActionResult<HierarchyBrowseData>> {
  try {
    const [roots, orphans, stats] = await Promise.all([
      hasActiveFilters
        ? repo.getHierarchyRoots(filters)
        : repo.getHierarchyRootsFast(stateCode),
      repo.getOrphanDocuments(filters),
      repo.getHierarchyStats(filters),
    ]);

    return success({ roots, orphans, stats });
  } catch (error) {
    console.error('[getHierarchyBrowseData]', error);
    return failure(getErrorMessage(error));
  }
}

// ============================================
// Server Component Helpers
// ============================================

interface DirectChild {
  id: number;
  title: string;
  hierarchyLevel: string | null;
  shortTitle: string | null;
  summary: string | null;
  levelIdentifier: string | null;
  citation: string | null;
  nycrrTitle: number | null;
  nycrrPart: string | null;
  nycrrChapter: string | null;
  njacTitle: string | null;
  njacChapter: string | null;
  njacSubchapter: string | null;
  state: string | null;
  hasAnalysis: boolean;
  maxSeverity: number | null;
  numFlags: number;
}

/**
 * Get direct children of a document
 * Used by ChildrenListServer for showing child documents
 */
export async function getDirectChildren(
  documentId: number
): Promise<ActionResult<DirectChild[]>> {
  try {
    const result = await repo.getDirectChildren(documentId);
    return success(result);
  } catch (error) {
    console.error('[getDirectChildren]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Get sibling documents (other children of the same parent)
 * Used by SiblingSectionsView to show neighboring sections for reviewer context
 * Composes getAncestorChain (to find parent) + getDirectChildren (to get siblings)
 */
export async function getSiblingDocuments(
  documentId: number
): Promise<ActionResult<DirectChild[]>> {
  try {
    const ancestors = await repo.getAncestorChain(documentId);
    if (!ancestors || ancestors.length === 0) {
      return success([]);
    }

    const parentId = ancestors[ancestors.length - 1].id;
    const children = await repo.getDirectChildren(parentId);
    const siblings = children.filter(child => child.id !== documentId);

    return success(siblings);
  } catch (error) {
    console.error('[getSiblingDocuments]', error);
    return failure(getErrorMessage(error));
  }
}
