'use client';

import type { ReactNode } from 'react';
import { useReviewForm } from '@/hooks';
import { Button, Input, Textarea, Select } from '@/components/ui';
import { IMPACT_TYPES } from '@/types/regulation';
import { REVIEW_STATUSES, REVIEW_STATUS_LABELS, REVIEW_STATUS_DESCRIPTIONS, type ReviewStatus } from '@deproceduralizer/database/schema';
import type { ReviewFormCallbackData } from '@/hooks';

interface SubmitData {
  id: number;
  reviewStatus: string;
  reviewedBy: string;
  justificationNotes: string | undefined;
  teamNotes: string | undefined;
  priority: number | undefined;
  severity: number | undefined;
  impactType: string | undefined;
}

type ActionResult =
  | { success: true; data: { reviewStatus?: string | null; reviewedBy?: string | null; reviewedAt?: Date | null; justificationNotes?: string | null; teamNotes?: string | null; priority?: number | null; severity?: number | null; impactType?: string | null } }
  | { success: false; error: string };

export interface QueueReviewFormBaseProps {
  initialData: {
    id: number;
    reviewStatus?: string | null;
    reviewedBy?: string | null;
    justificationNotes?: string | null;
    teamNotes?: string | null;
    priority?: number | null;
    severity?: number | null;
    originalSeverity?: number | null;
    impactType?: string | null;
  };
  onSubmit: (data: SubmitData) => Promise<ActionResult>;
  onUpdated: (data: ReviewFormCallbackData) => void;
  secondFieldSlot: (props: { formData: ReturnType<typeof useReviewForm>['formData']; updateField: ReturnType<typeof useReviewForm>['updateField']; isPending: boolean }) => ReactNode;
  justificationRows?: number;
  justificationPlaceholder?: string;
  testIdPrefix: string;
}

export function QueueReviewFormBase({
  initialData,
  onSubmit,
  onUpdated,
  secondFieldSlot,
  justificationRows = 2,
  justificationPlaceholder = 'Explain your reasoning for this classification...',
  testIdPrefix,
}: QueueReviewFormBaseProps) {
  const {
    formData,
    updateField,
    isPending,
    error,
    handleSubmit,
  } = useReviewForm({
    initialData,
    onSubmit: async (data) => onSubmit({
      id: data.id,
      reviewStatus: data.reviewStatus,
      reviewedBy: data.reviewedBy,
      justificationNotes: data.justificationNotes,
      teamNotes: data.teamNotes,
      priority: data.priority,
      severity: data.severity,
      impactType: data.impactType,
    }),
    onUpdated,
  });

  const impactOptions = [{ value: 'none', label: '--' }, ...IMPACT_TYPES];

  const statusOptions = REVIEW_STATUSES.map((status) => ({
    value: status,
    label: REVIEW_STATUS_LABELS[status],
  }));

  const currentStatusDescription = REVIEW_STATUS_DESCRIPTIONS[formData.reviewStatus as ReviewStatus] || '';

  return (
    <form onSubmit={handleSubmit} className="mt-4 pt-4 border-t border-[var(--color-neutral-200)]">
      {error && (
        <div className="mb-3 p-3 bg-[var(--color-danger-bg)] border border-[var(--color-danger)]/30 text-[var(--color-danger)] text-sm rounded-[var(--radius-md)]">
          {error}
        </div>
      )}

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
              data-testid={`${testIdPrefix}-status-select`}
            />
          </div>

          {/* Configurable second field (priority or severity) */}
          {secondFieldSlot({ formData, updateField, isPending })}

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
              data-testid={`${testIdPrefix}-impact-select`}
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
              data-testid={`${testIdPrefix}-reviewer-input`}
            />
          </div>
        </div>
        {currentStatusDescription && formData.reviewStatus !== 'unreviewed' && (
          <p className="mt-2 text-xs text-[var(--color-text-muted)] italic">
            {currentStatusDescription}
          </p>
        )}
      </div>

      {/* Justification Notes */}
      <div className="mb-3">
        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
          Justification and analysis for the model
        </label>
        <Textarea
          value={formData.justificationNotes ?? ''}
          onChange={(e) => updateField('justificationNotes', e.target.value || undefined)}
          rows={justificationRows}
          placeholder={justificationPlaceholder}
          disabled={isPending}
          data-testid={`${testIdPrefix}-justification-textarea`}
        />
      </div>

      {/* Team Notes */}
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
          data-testid={`${testIdPrefix}-team-notes-textarea`}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        {(!formData.reviewedBy.trim() || formData.reviewStatus === 'unreviewed') && (
          <p className="text-xs text-[var(--color-text-muted)]">
            {!formData.reviewedBy.trim() && formData.reviewStatus === 'unreviewed'
              ? 'Set a status and enter your name to save'
              : formData.reviewStatus === 'unreviewed'
                ? 'Select a review status to save'
                : 'Enter your name to save'}
          </p>
        )}
        <Button
          type="submit"
          variant="primary"
          size="sm"
          isLoading={isPending}
          disabled={isPending || !formData.reviewedBy.trim() || formData.reviewStatus === 'unreviewed'}
          data-testid={`${testIdPrefix}-save-button`}
        >
          {isPending ? 'Saving...' : 'Save Review'}
        </Button>
      </div>
    </form>
  );
}
