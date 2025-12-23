'use client';

import { useState, useCallback } from 'react';
import { Card } from '@/components/ui';
import { RedFlagCard } from './RedFlagCard';
import RedFlagReviewForm from './RedFlagReviewForm';

interface RedFlag {
  id: number;
  category: string;
  explanation: string;
  severity: number;
  complexity: string;
  matchedPhrases: string[] | null;
  implementationApproach: string;
  effortEstimate: string | null;
  textExamples: string[] | null;
  reviewStatus: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  justificationNotes: string | null;
  teamNotes: string | null;
  priority: number | null;
  impactType: string | null;
}

interface RedFlagsListProps {
  initialFlags: RedFlag[];
}

export function RedFlagsList({ initialFlags }: RedFlagsListProps) {
  const [flags, setFlags] = useState(initialFlags);

  const handleFlagUpdated = useCallback((updatedFlag: {
    id: number;
    reviewStatus?: string;
    reviewedBy?: string;
    reviewedAt?: string;
    justificationNotes?: string;
    teamNotes?: string;
    priority?: number;
    impactType?: string;
  }) => {
    setFlags((prev) =>
      prev.map((flag) =>
        flag.id === updatedFlag.id
          ? {
              ...flag,
              reviewStatus: updatedFlag.reviewStatus ?? flag.reviewStatus,
              reviewedBy: updatedFlag.reviewedBy ?? flag.reviewedBy,
              reviewedAt: updatedFlag.reviewedAt ? new Date(updatedFlag.reviewedAt) : flag.reviewedAt,
              justificationNotes: updatedFlag.justificationNotes ?? flag.justificationNotes,
              teamNotes: updatedFlag.teamNotes ?? flag.teamNotes,
              priority: updatedFlag.priority ?? flag.priority,
              impactType: updatedFlag.impactType ?? flag.impactType,
            }
          : flag
      )
    );
  }, []);

  if (flags.length === 0) {
    return null;
  }

  return (
    <Card>
      <h2 className="font-semibold text-[var(--color-text)] mb-3">Red Flags ({flags.length})</h2>
      <div className="space-y-4">
        {flags.map((flag) => (
          <RedFlagCard key={flag.id} flag={flag}>
            <RedFlagReviewForm
              flag={flag}
              onUpdated={handleFlagUpdated}
            />
          </RedFlagCard>
        ))}
      </div>
    </Card>
  );
}

export default RedFlagsList;
