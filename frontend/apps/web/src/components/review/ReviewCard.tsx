'use client';

import { useState, useTransition, useEffect, forwardRef } from 'react';
import { updateRedFlagReview } from '@/lib/actions/red-flags';
import { useReviewerName } from '@/hooks/useReviewerName';
import { Button, Input, Textarea, Badge, SeverityBadge, Card, Select, Tag, CopyLinkButton } from '@/components/ui';
import { REVIEW_STATUSES, PRIORITY_OPTIONS, IMPACT_TYPES, getComplexityVariant } from '@/types/regulation';
import { formatNycrrCitation } from '@/lib/formatters/nycrr';
import { ExpandableRegulationQuote } from './ExpandableRegulationQuote';
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

          if (!result.success) {
            setError(result.error);
            return;
          }

          // Save reviewer name for next time
          saveReviewerName(formData.reviewedBy);

          // Update parent with new data
          onUpdated({
            ...flag,
            reviewStatus: result.data.reviewStatus ?? null,
            reviewedBy: result.data.reviewedBy ?? null,
            reviewedAt: result.data.reviewedAt ?? null,
            reviewerNotes: result.data.reviewerNotes ?? null,
            priority: result.data.priority ?? null,
            impactType: result.data.impactType ?? null,
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
        id={`flag-${flag.id}`}
        className={`
          transition-shadow duration-[var(--duration-fast)]
          ${isFocused ? 'ring-2 ring-[var(--color-focus)] ring-offset-2' : ''}
        `}
        tabIndex={0}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <CopyLinkButton anchor={`flag-${flag.id}`} />
            <span className="font-semibold text-[var(--color-text)]">{flag.category}</span>
          </div>
          <div className="flex items-center gap-2">
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

        {/* Explanation - expandable to show regulation context */}
        <ExpandableRegulationQuote
          text={flag.explanation}
          label="Why Flagged"
          documentId={flag.regulation.id}
          variant="default"
        />

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
