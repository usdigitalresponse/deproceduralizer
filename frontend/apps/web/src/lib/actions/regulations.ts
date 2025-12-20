'use server';

import { db, RegulatoryDocumentsRepository, type RegulationWithAnalysis } from '@deproceduralizer/database';
import { type ActionResult, success, failure, getErrorMessage } from './types';

const regulationsRepo = new RegulatoryDocumentsRepository(db);

/**
 * Fetches a regulation with its current analysis by ID.
 * @param id - The regulatory document ID
 * @returns The regulation with analysis data or null if not found
 */
export async function getRegulationById(
  id: number
): Promise<ActionResult<RegulationWithAnalysis | null>> {
  try {
    const result = await regulationsRepo.getByIdWithAnalysis(id);
    return success(result);
  } catch (error) {
    console.error('[getRegulationById]', error);
    return failure(getErrorMessage(error));
  }
}
