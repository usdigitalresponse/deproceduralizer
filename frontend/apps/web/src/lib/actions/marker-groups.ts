'use server';

import 'server-only';
import { revalidatePath, updateTag } from 'next/cache';
import {
  db,
  MarkerGroupsRepository,
  type MarkerGroup,
} from '@deproceduralizer/database';
import { type ActionResult, success, failure, getErrorMessage, runAction } from './types';

const markerGroupsRepo = new MarkerGroupsRepository(db);

function refreshMarkerGroupCache() {
  updateTag('bookmarks');
  updateTag('marker-groups');
  revalidatePath('/[state]/markers', 'page');
  revalidatePath('/[state]/pipeline', 'page');
  revalidatePath('/[state]/fines', 'page');
  revalidatePath('/[state]/guidance', 'page');
}

/**
 * Get all marker groups, optionally filtered by jurisdiction.
 */
export async function getMarkerGroups(
  jurisdiction?: string
): Promise<ActionResult<MarkerGroup[]>> {
  return runAction('getMarkerGroups', () => markerGroupsRepo.getAll(jurisdiction));
}

/**
 * Create a new marker group.
 */
export async function createMarkerGroup(input: {
  name: string;
  color: string;
  icon?: string;
  jurisdiction?: string;
  isCustom?: boolean;
  createdBy?: string;
}): Promise<ActionResult<MarkerGroup>> {
  try {
    const group = await markerGroupsRepo.create(input);
    refreshMarkerGroupCache();
    return success(group);
  } catch (error) {
    console.error('[createMarkerGroup]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Update a marker group.
 */
export async function updateMarkerGroup(
  id: number,
  input: { name?: string; color?: string; icon?: string; sortOrder?: number }
): Promise<ActionResult<MarkerGroup>> {
  try {
    const group = await markerGroupsRepo.update(id, input);
    if (!group) {
      return failure(`Marker group with id ${id} not found`);
    }
    refreshMarkerGroupCache();
    return success(group);
  } catch (error) {
    console.error('[updateMarkerGroup]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Delete a marker group.
 */
export async function deleteMarkerGroup(
  id: number
): Promise<ActionResult<boolean>> {
  try {
    const deleted = await markerGroupsRepo.delete(id);
    if (!deleted) {
      return failure(`Marker group with id ${id} not found`);
    }
    refreshMarkerGroupCache();
    return success(true);
  } catch (error) {
    console.error('[deleteMarkerGroup]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Delete a marker group AND remove all bookmarks that had this marker.
 * Use this when the user wants to completely unmark all items in a category.
 */
export async function deleteMarkerGroupAndUnmarkAll(
  id: number
): Promise<ActionResult<boolean>> {
  try {
    // Atomically delete the group and all its associated bookmarks in a single transaction
    const deleted = await markerGroupsRepo.deleteGroupWithBookmarks(id);
    if (!deleted) {
      return failure(`Marker group with id ${id} not found`);
    }
    refreshMarkerGroupCache();
    return success(true);
  } catch (error) {
    console.error('[deleteMarkerGroupAndUnmarkAll]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Get the count of bookmarks associated with a marker group.
 */
export async function getMarkerGroupBookmarkCount(
  id: number
): Promise<ActionResult<number>> {
  return runAction('getMarkerGroupBookmarkCount', () => markerGroupsRepo.getBookmarkCount(id));
}

/**
 * Reorder marker groups.
 */
export async function reorderMarkerGroups(
  ids: number[]
): Promise<ActionResult<boolean>> {
  try {
    await markerGroupsRepo.reorder(ids);
    refreshMarkerGroupCache();
    return success(true);
  } catch (error) {
    console.error('[reorderMarkerGroups]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Find-or-create a custom (freeform) marker group by name.
 */
export async function getOrCreateCustomMarkerGroup(
  name: string,
  jurisdiction?: string
): Promise<ActionResult<MarkerGroup>> {
  try {
    const group = await markerGroupsRepo.getOrCreateCustom(name, jurisdiction);
    refreshMarkerGroupCache();
    return success(group);
  } catch (error) {
    console.error('[getOrCreateCustomMarkerGroup]', error);
    return failure(getErrorMessage(error));
  }
}
