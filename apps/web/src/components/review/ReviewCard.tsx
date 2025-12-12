'use client';

import { useState, useTransition, useEffect, forwardRef } from 'react';
import { updateRedFlagReview } from '@/lib/actions/red-flags';
import { useReviewerName } from '@/hooks/useReviewerName';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Badge, SeverityBadge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import type { RedFlagWithContext } from '@deproceduralizer/database';

// Form constants
const REVIEW_STATUSES = [
  { value: 'unreviewed', label: 'Unreviewed' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'false_positive', label: 'False Positive' },
  { value: 'needs_context', label: 'Needs Context' },
  { value: 'deferred', label: 'Deferred' },
];

const PRIORITY_OPTIONS = [
  { value: 1, label: '1 - Highest' },
  { value: 2, label: '2 - High' },
  { value: 3, label: '3 - Medium' },
  { value: 4, label: '4 - Low' },
  { value: 5, label: '5 - Lowest' },
];

const IMPACT_TYPES = [
  { value: 'cost_savings', label: 'Cost Savings' },
  { value: 'time_savings', label: 'Time Savings' },
  { value: 'accessibility', label: 'Accessibility' },
  { value: 'compliance_risk', label: 'Compliance Risk' },
  { value: 'operational_efficiency', label: 'Operational Efficiency' },
  { value: 'citizen_experience', label: 'Citizen Experience' },
  { value: 'other', label: 'Other' },
];

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

    // Format NYCRR citation
    const nycrrCitation = flag.regulation.nycrrTitle
      ? `${flag.regulation.nycrrTitle} NYCRR ${flag.regulation.nycrrPart || ''}${flag.regulation.nycrrSection ? '.' + flag.regulation.nycrrSection : ''}`
      : null;

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

    const selectClass = `
      w-full px-3 py-2 text-sm
      bg-[var(--color-surface)]
      border border-[var(--color-neutral-300)]
      rounded-[var(--radius-md)]
      text-[var(--color-text)]
      transition-colors duration-[var(--transition-fast)]
      hover:border-[var(--color-neutral-400)]
      focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] focus:ring-offset-2
      disabled:opacity-50 disabled:cursor-not-allowed
    `;

    return (
      <Card
        ref={ref}
        className={`
          transition-shadow duration-[var(--transition-fast)]
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
                <span
                  key={i}
                  className="text-xs bg-[var(--color-primary-weaker)] text-[var(--color-primary)] px-2 py-0.5 rounded-[var(--radius-sm)]"
                >
                  {phrase}
                </span>
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
              <select
                value={formData.reviewStatus}
                onChange={(e) => setFormData((prev) => ({ ...prev, reviewStatus: e.target.value }))}
                className={selectClass}
                disabled={isPending}
              >
                {REVIEW_STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                Priority
              </label>
              <select
                value={formData.priority || ''}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    priority: e.target.value ? parseInt(e.target.value) : undefined,
                  }))
                }
                className={selectClass}
                disabled={isPending}
              >
                <option value="">--</option>
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Impact Type */}
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                Impact
              </label>
              <select
                value={formData.impactType}
                onChange={(e) => setFormData((prev) => ({ ...prev, impactType: e.target.value }))}
                className={selectClass}
                disabled={isPending}
              >
                <option value="">--</option>
                {IMPACT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
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
