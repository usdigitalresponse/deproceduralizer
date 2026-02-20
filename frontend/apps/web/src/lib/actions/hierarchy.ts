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
import { type ActionResult, success, failure, getErrorMessage, runAction } from './types';

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
  return runAction('getHierarchyChildren', () => repo.getHierarchyChildren(parentId, { ...filters, state }));
}

/**
 * Get a single document with full analysis for the detail panel
 * Used by DetailPanel to fetch document details
 */
export async function getDocumentForPanel(
  id: number
): Promise<ActionResult<RegulationWithAnalysis | null>> {
  return runAction('getDocumentForPanel', () => repo.getByIdWithAnalysis(id));
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
  return runAction('getAncestorChain', () => repo.getAncestorChain(documentId));
}

/**
 * Get children using precomputed stats (fast)
 * Uses precomputed descendant stats - no LATERAL joins needed
 * Used by BrowseClient for unfiltered tree expansion
 */
export async function getHierarchyChildrenFast(
  parentId: number
): Promise<ActionResult<HierarchyNode[]>> {
  return runAction('getHierarchyChildrenFast', () => repo.getHierarchyChildrenFast(parentId));
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
  return runAction('getHierarchyBrowseData', async () => {
    const [roots, orphans, stats] = await Promise.all([
      hasActiveFilters
        ? repo.getHierarchyRoots(filters)
        : repo.getHierarchyRootsFast(stateCode),
      repo.getOrphanDocuments(filters),
      repo.getHierarchyStats(filters),
    ]);

    return { roots, orphans, stats };
  });
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
  return runAction('getDirectChildren', () => repo.getDirectChildren(documentId));
}

/**
 * Get sibling documents (other children of the same parent)
 * Used by SiblingSectionsView to show neighboring sections for reviewer context
 * Composes getAncestorChain (to find parent) + getDirectChildren (to get siblings)
 */
export async function getSiblingDocuments(
  documentId: number
): Promise<ActionResult<DirectChild[]>> {
  return runAction('getSiblingDocuments', async () => {
    const ancestors = await repo.getAncestorChain(documentId);
    if (!ancestors || ancestors.length === 0) {
      return [];
    }

    const parentId = ancestors[ancestors.length - 1].id;
    const children = await repo.getDirectChildren(parentId);
    return children.filter(child => child.id !== documentId);
  });
}
