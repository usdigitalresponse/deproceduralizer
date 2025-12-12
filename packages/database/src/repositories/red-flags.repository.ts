import { eq } from 'drizzle-orm';
import { BaseRepository } from './base.repository';
import { redFlags, RedFlag, ReviewStatus, ImpactType } from '../schema/red-flags';

export interface UpdateRedFlagReviewInput {
  reviewStatus: ReviewStatus;
  reviewedBy: string;
  reviewerNotes?: string;
  priority?: number;
  impactType?: ImpactType;
}

export class RedFlagsRepository extends BaseRepository {
  async getById(id: number): Promise<RedFlag | undefined> {
    const result = await this.db
      .select()
      .from(redFlags)
      .where(eq(redFlags.id, id))
      .limit(1);

    return result[0];
  }

  async getByAnalysisId(analysisId: number): Promise<RedFlag[]> {
    return this.db
      .select()
      .from(redFlags)
      .where(eq(redFlags.analysisId, analysisId));
  }

  async updateReview(id: number, data: UpdateRedFlagReviewInput): Promise<RedFlag | undefined> {
    const result = await this.db
      .update(redFlags)
      .set({
        reviewStatus: data.reviewStatus,
        reviewedBy: data.reviewedBy,
        reviewedAt: new Date(),
        reviewerNotes: data.reviewerNotes ?? null,
        priority: data.priority ?? null,
        impactType: data.impactType ?? null,
      })
      .where(eq(redFlags.id, id))
      .returning();

    return result[0];
  }

  async getUnreviewedFlags(): Promise<RedFlag[]> {
    return this.db
      .select()
      .from(redFlags)
      .where(eq(redFlags.reviewStatus, 'unreviewed'));
  }

  async getFlagsByStatus(status: ReviewStatus): Promise<RedFlag[]> {
    return this.db
      .select()
      .from(redFlags)
      .where(eq(redFlags.reviewStatus, status));
  }
}
