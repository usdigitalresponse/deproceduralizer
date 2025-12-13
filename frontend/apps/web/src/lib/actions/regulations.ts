'use server';

import { db, RegulatoryDocumentsRepository } from '@deproceduralizer/database';

const regulationsRepo = new RegulatoryDocumentsRepository(db);

export async function getRegulationById(id: number) {
  return regulationsRepo.getByIdWithAnalysis(id);
}
