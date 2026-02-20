'use server';

import 'server-only';
import {
  db,
  StatutesRepository,
  type StatuteHierarchyNode,
  type StatuteWithLinks,
  type RegulationStatuteLinkWithStatute,
  type StatuteLinkStats,
  type StatuteAncestor,
} from '@deproceduralizer/database';
import { type ActionResult, runAction } from './types';

const statutesRepo = new StatutesRepository(db);

/**
 * Get root-level statutes for the hierarchy tree.
 */
export async function getStatuteHierarchyRoots(
  state: string
): Promise<ActionResult<StatuteHierarchyNode[]>> {
  return runAction('getStatuteHierarchyRoots', () => statutesRepo.getHierarchyRoots(state));
}

/**
 * Get children of a statute node in the hierarchy tree.
 */
export async function getStatuteHierarchyChildren(
  parentId: number
): Promise<ActionResult<StatuteHierarchyNode[]>> {
  return runAction('getStatuteHierarchyChildren', () => statutesRepo.getHierarchyChildren(parentId));
}

/**
 * Get a statute by ID with its regulation links.
 */
export async function getStatuteWithLinks(
  id: number
): Promise<ActionResult<StatuteWithLinks | null>> {
  return runAction('getStatuteWithLinks', () => statutesRepo.getByIdWithLinks(id));
}

/**
 * Get statute links for a regulation (for regulation detail page).
 */
export async function getStatuteLinksForRegulation(
  regulationId: number
): Promise<ActionResult<RegulationStatuteLinkWithStatute[]>> {
  return runAction('getStatuteLinksForRegulation', () => statutesRepo.getLinksForRegulation(regulationId));
}

/**
 * Get enabling authority statute links for a regulation.
 */
export async function getEnablingAuthorityForRegulation(
  regulationId: number
): Promise<ActionResult<RegulationStatuteLinkWithStatute[]>> {
  return runAction('getEnablingAuthorityForRegulation', () => statutesRepo.getEnablingAuthority(regulationId));
}

/**
 * Get statute stats for analytics dashboard.
 */
export async function getStatuteStats(
  state: string
): Promise<ActionResult<StatuteLinkStats>> {
  return runAction('getStatuteStats', () => statutesRepo.getStatsByState(state));
}

/**
 * Search statutes by citation or title.
 */
export async function searchStatutes(
  state: string,
  query: string,
  limit = 50
): Promise<ActionResult<StatuteHierarchyNode[]>> {
  return runAction('searchStatutes', () => statutesRepo.searchStatutes(state, query, limit));
}

/**
 * Get ancestor chain for breadcrumbs.
 */
export async function getStatuteAncestorChain(
  statuteId: number
): Promise<ActionResult<StatuteAncestor[]>> {
  return runAction('getStatuteAncestorChain', () => statutesRepo.getAncestorChain(statuteId));
}
