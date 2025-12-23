'use client';

import type { RegulationWithAnalysis } from '@deproceduralizer/database';
import { updateRedFlagReview } from '@/lib/actions/red-flags';
import { ReviewForm } from '@/components/review';
import type { ReviewFormCallbackData } from '@/hooks';

// Extract the red flag type from RegulationWithAnalysis
type RedFlag = RegulationWithAnalysis['redFlags'][number];

interface RedFlagReviewFormProps {
  flag: RedFlag;
  onUpdated: (updatedFlag: ReviewFormCallbackData) => void;
}

/**
 * Review form for red flags.
 * Uses the shared ReviewForm component with red flag-specific styling and API.
 */
export default function RedFlagReviewForm({ flag, onUpdated }: RedFlagReviewFormProps) {
  if (!flag.id) return null;

  return (
    <ReviewForm
      itemType="red_flag"
      item={flag}
      onUpdated={onUpdated}
      onSubmit={async (data) => {
        return updateRedFlagReview({
          id: data.id,
          reviewStatus: data.reviewStatus,
          reviewedBy: data.reviewedBy,
          justificationNotes: data.justificationNotes,
          teamNotes: data.teamNotes,
          priority: data.priority,
          impactType: data.impactType,
        });
      }}
    />
  );
}
