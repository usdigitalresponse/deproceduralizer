'use client';

import { updateComplianceIssueReview } from '@/lib/actions/compliance-issues';
import { Select } from '@/components/ui';
import { UPDATED_SEVERITY_OPTIONS } from '@/types/regulation';
import { QueueReviewFormBase } from '../QueueReviewFormBase';
import type { ReviewFormProps } from './types';

export function ReviewForm({ issue, onUpdated }: ReviewFormProps) {
  const severityOptions = [{ value: 'none', label: '--' }, ...UPDATED_SEVERITY_OPTIONS];

  return (
    <QueueReviewFormBase
      initialData={issue}
      onSubmit={async (data) => updateComplianceIssueReview({
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
      )}
      justificationRows={3}
      justificationPlaceholder="e.g., 'This should not be flagged as severe - while it mentions in-person work, cardiovascular surgery must always be performed in person.' or 'Excellent example of outdated technology - requires CD-ROM submission with no alternative for a mandatory process.'"
      testIdPrefix="compliance"
    />
  );
}
