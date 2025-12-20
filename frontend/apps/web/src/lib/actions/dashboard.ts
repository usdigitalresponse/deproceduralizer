'use server';

import { db, RegulatoryDocumentsRepository } from '@deproceduralizer/database';
import type { StateCode, DashboardStats } from '@deproceduralizer/database';
import { type ActionResult, success, failure, getErrorMessage } from './types';

const regulationsRepo = new RegulatoryDocumentsRepository(db);

/**
 * Get dashboard statistics for a specific state or all states combined
 */
export async function getDashboardStats(
  state?: StateCode
): Promise<ActionResult<DashboardStats>> {
  try {
    const result = await regulationsRepo.getDashboardStats(state);
    return success(result);
  } catch (error) {
    console.error('[getDashboardStats]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Get dashboard statistics for each state separately
 */
export async function getAllStateStats(): Promise<ActionResult<Record<StateCode, DashboardStats>>> {
  try {
    const result = await regulationsRepo.getAllStateStats();
    return success(result);
  } catch (error) {
    console.error('[getAllStateStats]', error);
    return failure(getErrorMessage(error));
  }
}
