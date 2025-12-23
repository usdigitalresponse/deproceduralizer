'use client';

import { ReactNode } from 'react';
import { Badge, SeverityBadge, ReviewStatusBadge, Tag } from '@/components/ui';
import { getComplexityVariant } from '@/types/regulation';

interface RedFlagCardProps {
  /** The red flag data to display */
  flag: {
    category: string;
    explanation: string;
    severity: number;
    complexity: string;
    matchedPhrases: string[] | null;
    implementationApproach: string | null;
    effortEstimate: string | null;
    textExamples: string[] | null;
    reviewStatus?: string | null;
  };
  /** Whether to show the review status badge in the header */
  showReviewStatus?: boolean;
  /** Optional content to render at the bottom (e.g., review form) */
  children?: ReactNode;
}

/**
 * Display component for a single red flag.
 * Used by RedFlagsList and DetailModal for consistent flag rendering.
 */
export function RedFlagCard({ flag, showReviewStatus = true, children }: RedFlagCardProps) {
  return (
    <div className="bg-[var(--color-danger-bg)] border-l-4 border-[var(--color-danger)] p-4 rounded-[var(--radius-md)]">
      {/* Header */}
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
          {showReviewStatus && flag.reviewStatus && (
            <ReviewStatusBadge status={flag.reviewStatus} />
          )}
        </div>
      </div>

      {/* Explanation */}
      <p className="text-sm text-[var(--color-text-secondary)] mb-2">{flag.explanation}</p>

      {/* Implementation Approach */}
      {flag.implementationApproach && (
        <div className="mt-2 text-sm">
          <span className="font-medium text-[var(--color-text-secondary)]">Implementation:</span>
          <span className="ml-2">{flag.implementationApproach}</span>
        </div>
      )}

      {/* Effort Estimate */}
      {flag.effortEstimate && (
        <div className="mt-1 text-sm">
          <span className="font-medium text-[var(--color-text-secondary)]">Effort:</span>
          <span className="ml-2">{flag.effortEstimate}</span>
        </div>
      )}

      {/* Matched Phrases */}
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

      {/* Text Examples */}
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

      {/* Children slot (typically review form) */}
      {children}
    </div>
  );
}

export default RedFlagCard;
