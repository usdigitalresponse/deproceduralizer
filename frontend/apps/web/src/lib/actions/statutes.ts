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
import { type ActionResult, success, failure, getErrorMessage } from './types';

const statutesRepo = new StatutesRepository(db);

/**
 * Get root-level statutes for the hierarchy tree.
 */
export async function getStatuteHierarchyRoots(
  state: string
): Promise<ActionResult<StatuteHierarchyNode[]>> {
  try {
    const roots = await statutesRepo.getHierarchyRoots(state);
    return success(roots);
  } catch (error) {
    console.error('[getStatuteHierarchyRoots]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Get children of a statute node in the hierarchy tree.
 */
export async function getStatuteHierarchyChildren(
  parentId: number
): Promise<ActionResult<StatuteHierarchyNode[]>> {
  try {
    const children = await statutesRepo.getHierarchyChildren(parentId);
    return success(children);
  } catch (error) {
    console.error('[getStatuteHierarchyChildren]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Get a statute by ID with its regulation links.
 */
export async function getStatuteWithLinks(
  id: number
): Promise<ActionResult<StatuteWithLinks | null>> {
  try {
    const statute = await statutesRepo.getByIdWithLinks(id);
    return success(statute);
  } catch (error) {
    console.error('[getStatuteWithLinks]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Get statute links for a regulation (for regulation detail page).
 */
export async function getStatuteLinksForRegulation(
  regulationId: number
): Promise<ActionResult<RegulationStatuteLinkWithStatute[]>> {
  try {
    const links = await statutesRepo.getLinksForRegulation(regulationId);
    return success(links);
  } catch (error) {
    console.error('[getStatuteLinksForRegulation]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Get enabling authority statute links for a regulation.
 */
export async function getEnablingAuthorityForRegulation(
  regulationId: number
): Promise<ActionResult<RegulationStatuteLinkWithStatute[]>> {
  try {
    const links = await statutesRepo.getEnablingAuthority(regulationId);
    return success(links);
  } catch (error) {
    console.error('[getEnablingAuthorityForRegulation]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Get statute stats for analytics dashboard.
 */
export async function getStatuteStats(
  state: string
): Promise<ActionResult<StatuteLinkStats>> {
  try {
    const stats = await statutesRepo.getStatsByState(state);
    return success(stats);
  } catch (error) {
    console.error('[getStatuteStats]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Search statutes by citation or title.
 */
export async function searchStatutes(
  state: string,
  query: string,
  limit = 50
): Promise<ActionResult<StatuteHierarchyNode[]>> {
  try {
    const results = await statutesRepo.searchStatutes(state, query, limit);
    return success(results);
  } catch (error) {
    console.error('[searchStatutes]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Get ancestor chain for breadcrumbs.
 */
export async function getStatuteAncestorChain(
  statuteId: number
): Promise<ActionResult<StatuteAncestor[]>> {
  try {
    const chain = await statutesRepo.getAncestorChain(statuteId);
    return success(chain);
  } catch (error) {
    console.error('[getStatuteAncestorChain]', error);
    return failure(getErrorMessage(error));
  }
}
