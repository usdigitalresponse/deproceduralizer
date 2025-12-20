'use server';

import { db, RegulatoryDocumentsRepository, type RegulationWithAnalysis } from '@deproceduralizer/database';
import { type ActionResult, success, failure, getErrorMessage } from './types';

const regulationsRepo = new RegulatoryDocumentsRepository(db);

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
