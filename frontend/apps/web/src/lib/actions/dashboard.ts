'use server';

import { db, RegulatoryDocumentsRepository } from '@deproceduralizer/database';
import type { StateCode, DashboardStats } from '@deproceduralizer/database';

const regulationsRepo = new RegulatoryDocumentsRepository(db);

/**
 * Get dashboard statistics for a specific state or all states combined
 */
export async function getDashboardStats(state?: StateCode): Promise<DashboardStats> {
  return regulationsRepo.getDashboardStats(state);
}

/**
 * Get dashboard statistics for each state separately
 */
export async function getAllStateStats(): Promise<Record<StateCode, DashboardStats>> {
  return regulationsRepo.getAllStateStats();
}
