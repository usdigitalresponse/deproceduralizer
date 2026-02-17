'use client';

import { updateRedFlagReview } from '@/lib/actions/red-flags';
import { Select } from '@/components/ui';
import { PRIORITY_OPTIONS } from '@/types/regulation';
import { QueueReviewFormBase } from '../QueueReviewFormBase';
import type { ReviewFormProps } from './types';

export function ReviewForm({ flag, onUpdated }: ReviewFormProps) {
  const priorityOptions = [{ value: 'none', label: '--' }, ...PRIORITY_OPTIONS];

  return (
    <QueueReviewFormBase
      initialData={flag}
      onSubmit={async (data) => updateRedFlagReview({
        id: data.id,
        reviewStatus: data.reviewStatus,
        reviewedBy: data.reviewedBy,
        justificationNotes: data.justificationNotes,
        teamNotes: data.teamNotes,
        priority: data.priority,
        impactType: data.impactType,
      })}
      onUpdated={(data) => {
        onUpdated({
          ...flag,
          reviewStatus: data.reviewStatus ?? null,
          reviewedBy: data.reviewedBy ?? null,
          reviewedAt: data.reviewedAt ? new Date(data.reviewedAt) : null,
          justificationNotes: data.justificationNotes ?? null,
          teamNotes: data.teamNotes ?? null,
          priority: data.priority ?? null,
          impactType: data.impactType ?? null,
        });
      }}
      secondFieldSlot={({ formData, updateField, isPending }) => (
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
            Priority
          </label>
          <Select
            value={formData.priority?.toString() ?? 'none'}
            onValueChange={(value) => updateField('priority', value === 'none' ? undefined : parseInt(value))}
            options={priorityOptions}
            disabled={isPending}
            data-testid="red-flag-priority-select"
          />
        </div>
      )}
      testIdPrefix="red-flag"
    />
  );
}
