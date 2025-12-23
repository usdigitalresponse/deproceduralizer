'use client';

import { useState, useCallback } from 'react';
import { Badge, SeverityBadge, ReviewStatusBadge, Card, Tag } from '@/components/ui';
import RedFlagReviewForm from './RedFlagReviewForm';
import { getComplexityVariant } from '@/types/regulation';

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
  reviewerNotes: string | null;
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
    reviewerNotes?: string;
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
              reviewerNotes: updatedFlag.reviewerNotes ?? flag.reviewerNotes,
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
          <div
            key={flag.id}
            className="bg-[var(--color-danger-bg)] border-l-4 border-[var(--color-danger)] p-4 rounded-[var(--radius-md)]"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-[var(--color-danger)]">{flag.category}</span>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <span className="text-xs text-[var(--color-text-muted)]">Severity:</span>
                  <SeverityBadge severity={flag.severity} />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-[var(--color-text-muted)]">Complexity:</span>
                  <Badge variant={getComplexityVariant(flag.complexity)}>
                    {flag.complexity}
                  </Badge>
                </div>
                {flag.reviewStatus && (
                  <ReviewStatusBadge status={flag.reviewStatus} />
                )}
              </div>
            </div>
            <p className="text-sm text-[var(--color-text-secondary)] mb-2">{flag.explanation}</p>

            {flag.implementationApproach && (
              <div className="mt-2 text-sm">
                <span className="font-medium text-[var(--color-text-secondary)]">Implementation:</span>
                <span className="ml-2">{flag.implementationApproach}</span>
              </div>
            )}

            {flag.effortEstimate && (
              <div className="mt-1 text-sm">
                <span className="font-medium text-[var(--color-text-secondary)]">Effort:</span>
                <span className="ml-2">{flag.effortEstimate}</span>
              </div>
            )}

            {flag.matchedPhrases && flag.matchedPhrases.length > 0 && (
              <div className="mt-3">
                <span className="text-xs font-medium text-[var(--color-text-secondary)]">Matched phrases:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {flag.matchedPhrases.map((phrase, i) => (
                    <Tag key={i} variant="danger" size="sm">
                      {phrase}
                    </Tag>
                  ))}
                </div>
              </div>
            )}

            {flag.textExamples && flag.textExamples.length > 0 && (
              <div className="mt-3">
                <span className="text-xs font-medium text-[var(--color-text-secondary)]">Examples from text:</span>
                <ul className="mt-1 text-xs text-[var(--color-text-muted)] list-disc list-inside">
                  {flag.textExamples.map((ex, i) => (
                    <li key={i} className="italic">&quot;{ex}&quot;</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Review Form */}
            <RedFlagReviewForm
              flag={flag}
              onUpdated={handleFlagUpdated}
            />
          </div>
        ))}
      </div>
    </Card>
  );
}

export default RedFlagsList;
