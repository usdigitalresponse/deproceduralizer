'use client';

import { updateComplianceIssueReview } from '@/lib/actions/compliance-issues';
import { useReviewForm } from '@/hooks';
import { Button, Input, Textarea, Select } from '@/components/ui';
import { UPDATED_SEVERITY_OPTIONS, IMPACT_TYPES } from '@/types/regulation';
import { REVIEW_STATUSES, REVIEW_STATUS_LABELS, REVIEW_STATUS_DESCRIPTIONS, type ReviewStatus } from '@deproceduralizer/database/schema';
import type { ReviewFormProps } from './types';

export function ReviewForm({ issue, onUpdated }: ReviewFormProps) {
  const {
    formData,
    updateField,
    isPending,
    error,
    handleSubmit,
  } = useReviewForm({
    initialData: issue,
    onSubmit: async (data) => updateComplianceIssueReview({
      id: data.id,
      reviewStatus: data.reviewStatus,
      reviewedBy: data.reviewedBy,
      justificationNotes: data.justificationNotes,
      teamNotes: data.teamNotes,
      severity: data.severity,
      impactType: data.impactType,
    }),
    onUpdated: (data) => {
      onUpdated({
        ...issue,
        reviewStatus: data.reviewStatus ?? null,
        reviewedBy: data.reviewedBy ?? null,
        reviewedAt: data.reviewedAt ? new Date(data.reviewedAt) : null,
        justificationNotes: data.justificationNotes ?? null,
        teamNotes: data.teamNotes ?? null,
        severity: data.severity ?? issue.severity,
        impactType: data.impactType ?? null,
      });
    },
  });

  // Convert options to Select format with explicit "none" sentinel
  const severityOptions = [{ value: 'none', label: '--' }, ...UPDATED_SEVERITY_OPTIONS];
  const impactOptions = [{ value: 'none', label: '--' }, ...IMPACT_TYPES];

  // Convert REVIEW_STATUSES to Select format with labels
  const statusOptions = REVIEW_STATUSES.map((status) => ({
    value: status,
    label: REVIEW_STATUS_LABELS[status],
  }));

  // Get current status description for helper text
  const currentStatusDescription = REVIEW_STATUS_DESCRIPTIONS[formData.reviewStatus as ReviewStatus] || '';

  return (
    <form onSubmit={handleSubmit} className="mt-4 pt-4 border-t border-[var(--color-neutral-200)]">
      {error && (
        <div className="mb-3 p-3 bg-[var(--color-danger-bg)] border border-[var(--color-danger)]/30 text-[var(--color-danger)] text-sm rounded-[var(--radius-md)]">
          {error}
        </div>
      )}

      {/* Status with description */}
      <div className="mb-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Status */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              Status *
            </label>
            <Select
              value={formData.reviewStatus}
              onValueChange={(value) => updateField('reviewStatus', value)}
              options={statusOptions}
              disabled={isPending}
              data-testid="compliance-status-select"
            />
          </div>

          {/* Severity */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              Severity
              {issue.originalSeverity !== null && issue.originalSeverity !== issue.severity && (
                <span className="ml-1 font-normal text-[var(--color-text-muted)]">
                  (Original: {issue.originalSeverity})
                </span>
              )}
            </label>
            <Select
              value={formData.severity?.toString() ?? 'none'}
              onValueChange={(value) => updateField('severity', value === 'none' ? undefined : parseInt(value))}
              options={severityOptions}
              disabled={isPending}
              data-testid="compliance-severity-select"
            />
            <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">
              Change if severity doesn&apos;t match your assessment
            </p>
          </div>

          {/* Impact Type */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              Impact
            </label>
            <Select
              value={formData.impactType || 'none'}
              onValueChange={(value) => updateField('impactType', value === 'none' ? undefined : value)}
              options={impactOptions}
              disabled={isPending}
              data-testid="compliance-impact-select"
            />
          </div>

          {/* Reviewer */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              Reviewer *
            </label>
            <Input
              value={formData.reviewedBy}
              onChange={(e) => updateField('reviewedBy', e.target.value)}
              placeholder="Your name"
              disabled={isPending}
              data-testid="compliance-reviewer-input"
            />
          </div>
        </div>
        {/* Status description helper text */}
        {currentStatusDescription && formData.reviewStatus !== 'unreviewed' && (
          <p className="mt-2 text-xs text-[var(--color-text-muted)] italic">
            {currentStatusDescription}
          </p>
        )}
      </div>

      {/* Justification Notes - for model training */}
      <div className="mb-3">
        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
          Justification for the model (will be shown with original text and your verdict)
        </label>
        <Textarea
          value={formData.justificationNotes ?? ''}
          onChange={(e) => updateField('justificationNotes', e.target.value || undefined)}
          rows={3}
          placeholder="e.g., 'This should not be flagged as severe - while it mentions in-person work, cardiovascular surgery must always be performed in person.' or 'Excellent example of outdated technology - requires CD-ROM submission with no alternative for a mandatory process.'"
          disabled={isPending}
          data-testid="compliance-justification-textarea"
        />
      </div>

      {/* Team Notes - for developers */}
      <div className="mb-3">
        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
          Notes for Development Team
        </label>
        <Textarea
          value={formData.teamNotes ?? ''}
          onChange={(e) => updateField('teamNotes', e.target.value || undefined)}
          rows={2}
          placeholder="Process notes, research tasks, questions..."
          disabled={isPending}
          data-testid="compliance-team-notes-textarea"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end">
        <Button
          type="submit"
          variant="primary"
          size="sm"
          isLoading={isPending}
          disabled={isPending || !formData.reviewedBy.trim()}
          data-testid="compliance-save-button"
        >
          {isPending ? 'Saving...' : 'Save Review'}
        </Button>
      </div>
    </form>
  );
}
