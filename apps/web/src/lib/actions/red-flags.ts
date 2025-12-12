'use server';

import { revalidatePath } from 'next/cache';
import {
  db,
  RedFlagsRepository,
  ReviewStatus,
  ImpactType,
  REVIEW_STATUSES,
  IMPACT_TYPES
} from '@deproceduralizer/database';

const redFlagsRepo = new RedFlagsRepository(db);

export interface UpdateRedFlagInput {
  id: number;
  reviewStatus: string;
  reviewedBy: string;
  reviewerNotes?: string;
  priority?: number;
  impactType?: string;
}

export async function updateRedFlagReview(input: UpdateRedFlagInput) {
  if (!REVIEW_STATUSES.includes(input.reviewStatus as ReviewStatus)) {
    throw new Error(`Invalid review status: ${input.reviewStatus}`);
  }

  if (input.impactType && !IMPACT_TYPES.includes(input.impactType as ImpactType)) {
    throw new Error(`Invalid impact type: ${input.impactType}`);
  }

  const result = await redFlagsRepo.updateReview(input.id, {
    reviewStatus: input.reviewStatus as ReviewStatus,
    reviewedBy: input.reviewedBy,
    reviewerNotes: input.reviewerNotes,
    priority: input.priority,
    impactType: input.impactType as ImpactType | undefined,
  });

  if (!result) {
    throw new Error(`Red flag with id ${input.id} not found`);
  }

  revalidatePath('/');
  return result;
}

export async function getRedFlagById(id: number) {
  return redFlagsRepo.getById(id);
}
