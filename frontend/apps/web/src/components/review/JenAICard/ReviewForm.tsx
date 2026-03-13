'use client';

import { updateJenAIReview } from '@/lib/actions/jenai';
import { Select } from '@/components/ui';
import { UPDATED_SEVERITY_OPTIONS } from '@/types/regulation';
import { QueueReviewFormBase } from '../QueueReviewFormBase';
import type { ReviewFormProps } from './types';

export function ReviewForm({ issue, onUpdated }: ReviewFormProps) {
  const severityOptions = [{ value: 'none', label: '--' }, ...UPDATED_SEVERITY_OPTIONS];

  return (
    <QueueReviewFormBase
      initialData={issue}
      onSubmit={async (data) => updateJenAIReview({
        id: data.id,
        reviewStatus: data.reviewStatus,
        reviewedBy: data.reviewedBy,
        justificationNotes: data.justificationNotes,
        teamNotes: data.teamNotes,
        severity: data.severity,
        impactType: data.impactType,
      })}
      onUpdated={(data) => {
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
      }}
      secondFieldSlot={({ formData, updateField, isPending }) => (
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
            Severity
          </label>
          <Select
            value={formData.severity?.toString() ?? 'none'}
            onValueChange={(value) => updateField('severity', value === 'none' ? undefined : parseInt(value, 10))}
            options={severityOptions}
            disabled={isPending}
            data-testid="jenai-severity-select"
          />
        </div>
      )}
      justificationRows={3}
      justificationPlaceholder="e.g., 'This regulation uses unnecessarily complex cross-references that could be simplified into a single clear requirement.' or 'While the language is dense, this is a standard legal structure necessary for precision — not a real implementation burden.'"
      testIdPrefix="jenai"
    />
  );
}
