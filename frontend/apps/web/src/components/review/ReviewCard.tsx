'use client';

import { useState, useTransition, useEffect, forwardRef } from 'react';
import { updateRedFlagReview } from '@/lib/actions/red-flags';
import { useReviewerName } from '@/hooks/useReviewerName';
import { Button, Input, Textarea, Badge, SeverityBadge, Card, Select, Tag } from '@/components/ui';
import { REVIEW_STATUSES, PRIORITY_OPTIONS, IMPACT_TYPES } from '@/types/regulation';
import { formatNycrrCitation } from '@/lib/formatters/nycrr';
import type { RedFlagWithContext } from '@deproceduralizer/database';

interface ReviewCardProps {
  flag: RedFlagWithContext;
  onUpdated: (updatedFlag: RedFlagWithContext) => void;
  onViewRegulation: (regulationId: number) => void;
  isFocused?: boolean;
}

export const ReviewCard = forwardRef<HTMLDivElement, ReviewCardProps>(
  ({ flag, onUpdated, onViewRegulation, isFocused = false }, ref) => {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const { reviewerName: storedName, saveReviewerName, isLoaded } = useReviewerName();

    const [formData, setFormData] = useState({
      reviewStatus: flag.reviewStatus || 'unreviewed',
      reviewedBy: flag.reviewedBy || '',
      reviewerNotes: flag.reviewerNotes || '',
      priority: flag.priority || undefined,
      impactType: flag.impactType || '',
    });

    // Pre-fill reviewer name from localStorage
    useEffect(() => {
      if (isLoaded && storedName && !formData.reviewedBy) {
        setFormData((prev) => ({ ...prev, reviewedBy: storedName }));
      }
    }, [isLoaded, storedName, formData.reviewedBy]);

    const nycrrCitation = formatNycrrCitation(
      flag.regulation.nycrrTitle,
      flag.regulation.nycrrPart,
      flag.regulation.nycrrSection
    );

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (!formData.reviewedBy.trim()) {
        setError('Reviewer name is required');
        return;
      }

      startTransition(async () => {
        try {
          const result = await updateRedFlagReview({
            id: flag.id,
            reviewStatus: formData.reviewStatus,
            reviewedBy: formData.reviewedBy,
            reviewerNotes: formData.reviewerNotes || undefined,
            priority: formData.priority,
            impactType: formData.impactType || undefined,
          });

          // Save reviewer name for next time
          saveReviewerName(formData.reviewedBy);

          // Update parent with new data
          onUpdated({
            ...flag,
            reviewStatus: result.reviewStatus ?? null,
            reviewedBy: result.reviewedBy ?? null,
            reviewedAt: result.reviewedAt ?? null,
            reviewerNotes: result.reviewerNotes ?? null,
            priority: result.priority ?? null,
            impactType: result.impactType ?? null,
          });
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to update review');
        }
      });
    };

    // Convert options to Select format with explicit "none" sentinel
    const priorityOptions = [{ value: 'none', label: '--' }, ...PRIORITY_OPTIONS];
    const impactOptions = [{ value: 'none', label: '--' }, ...IMPACT_TYPES];

    return (
      <Card
        ref={ref}
        className={`
          transition-shadow duration-[var(--duration-fast)]
          ${isFocused ? 'ring-2 ring-[var(--color-focus)] ring-offset-2' : ''}
        `}
        tabIndex={0}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-[var(--color-text)]">{flag.category}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="text-xs text-[var(--color-text-muted)]">Severity:</span>
              <SeverityBadge severity={flag.severity} />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-[var(--color-text-muted)]">Complexity:</span>
              <Badge
                variant={
                  flag.complexity === 'HIGH'
                    ? 'danger'
                    : flag.complexity === 'MEDIUM' || flag.complexity === 'MEDIUM-HIGH'
                    ? 'warning'
                    : 'success'
                }
              >
                {flag.complexity}
              </Badge>
            </div>
          </div>
        </div>

        {/* Regulation context */}
        <div className="mb-4 text-sm">
          <span className="text-[var(--color-text-muted)]">
            {nycrrCitation && <span className="font-mono">{nycrrCitation}</span>}
            {nycrrCitation && flag.regulation.title && ' - '}
          </span>
          <span className="text-[var(--color-text-secondary)]">{flag.regulation.title}</span>
        </div>

        {/* Explanation */}
        <div className="mb-4 p-3 bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] border-l-4 border-[var(--color-neutral-300)]">
          <p className="text-sm text-[var(--color-text)]">{flag.explanation}</p>
        </div>

        {/* Matched phrases */}
        {flag.matchedPhrases && flag.matchedPhrases.length > 0 && (
          <div className="mb-4">
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">Matched phrases:</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {flag.matchedPhrases.map((phrase, i) => (
                <Tag key={i} variant="primary" size="sm">
                  {phrase}
                </Tag>
              ))}
            </div>
          </div>
        )}

        {/* Implementation approach */}
        {flag.implementationApproach && (
          <div className="mb-4 text-sm">
            <span className="font-medium text-[var(--color-text-secondary)]">Implementation:</span>
            <span className="ml-2 text-[var(--color-text)]">{flag.implementationApproach}</span>
          </div>
        )}

        {/* Review form */}
        <form onSubmit={handleSubmit} className="mt-4 pt-4 border-t border-[var(--color-neutral-200)]">
          {error && (
            <div className="mb-3 p-3 bg-[var(--color-danger-bg)] border border-[var(--color-danger)]/30 text-[var(--color-danger)] text-sm rounded-[var(--radius-md)]">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            {/* Status */}
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                Status *
              </label>
              <Select
                value={formData.reviewStatus}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, reviewStatus: value }))}
                options={[...REVIEW_STATUSES]}
                disabled={isPending}
              />
            </div>

            {/* Priority */}
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                Priority
              </label>
              <Select
                value={formData.priority?.toString() ?? 'none'}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    priority: value === 'none' ? undefined : parseInt(value),
                  }))
                }
                options={priorityOptions}
                disabled={isPending}
              />
            </div>

            {/* Impact Type */}
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                Impact
              </label>
              <Select
                value={formData.impactType || 'none'}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    impactType: value === 'none' ? '' : value,
                  }))
                }
                options={impactOptions}
                disabled={isPending}
              />
            </div>

            {/* Reviewer */}
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                Reviewer *
              </label>
              <Input
                value={formData.reviewedBy}
                onChange={(e) => setFormData((prev) => ({ ...prev, reviewedBy: e.target.value }))}
                placeholder="Your name"
                disabled={isPending}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="mb-3">
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              Notes
            </label>
            <Textarea
              value={formData.reviewerNotes}
              onChange={(e) => setFormData((prev) => ({ ...prev, reviewerNotes: e.target.value }))}
              rows={2}
              placeholder="Add any notes about this flag..."
              disabled={isPending}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onViewRegulation(flag.regulation.id)}
            >
              View Regulation
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isPending}>
              {isPending ? 'Saving...' : 'Save Review'}
            </Button>
          </div>
        </form>
      </Card>
    );
  }
);

ReviewCard.displayName = 'ReviewCard';

export default ReviewCard;
