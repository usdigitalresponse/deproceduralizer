'use client';

import { useState, useTransition, useEffect } from 'react';
import { updateComplianceIssueReview } from '@/lib/actions/compliance-issues';
import { REVIEW_STATUSES, IMPACT_TYPES, PRIORITY_OPTIONS, ISSUE_TYPE_LABELS } from '@/types/regulation';
import type { ComplianceIssue } from '@deproceduralizer/database';
import { useReviewerName } from '@/hooks/useReviewerName';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { ReviewStatusBadge } from '@/components/ui/Badge';

interface ComplianceIssueReviewFormProps {
  issue: ComplianceIssue;
  onUpdated: (updatedIssue: {
    id: number;
    reviewStatus?: string;
    reviewedBy?: string;
    reviewedAt?: string;
    reviewerNotes?: string;
    priority?: number;
    impactType?: string;
  }) => void;
}

export default function ComplianceIssueReviewForm({ issue, onUpdated }: ComplianceIssueReviewFormProps) {
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { reviewerName: storedName, saveReviewerName, isLoaded } = useReviewerName();

  const [formData, setFormData] = useState({
    reviewStatus: issue.reviewStatus || 'unreviewed',
    reviewedBy: issue.reviewedBy || '',
    reviewerNotes: issue.reviewerNotes || '',
    priority: issue.priority || undefined,
    impactType: issue.impactType || '',
  });

  // Pre-fill reviewer name from localStorage
  useEffect(() => {
    if (isLoaded && storedName && !formData.reviewedBy) {
      setFormData(prev => ({ ...prev, reviewedBy: storedName }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, storedName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!issue.id) {
      setError('Issue ID is missing');
      return;
    }

    if (!formData.reviewedBy.trim()) {
      setError('Reviewer name is required');
      return;
    }

    startTransition(async () => {
      try {
        const result = await updateComplianceIssueReview({
          id: issue.id,
          reviewStatus: formData.reviewStatus,
          reviewedBy: formData.reviewedBy,
          reviewerNotes: formData.reviewerNotes || undefined,
          priority: formData.priority,
          impactType: formData.impactType || undefined,
        });

        // Save reviewer name for next time
        saveReviewerName(formData.reviewedBy);

        onUpdated({
          id: issue.id,
          reviewStatus: result.reviewStatus ?? undefined,
          reviewedBy: result.reviewedBy ?? undefined,
          reviewedAt: result.reviewedAt?.toISOString(),
          reviewerNotes: result.reviewerNotes ?? undefined,
          priority: result.priority ?? undefined,
          impactType: result.impactType ?? undefined,
        });

        setIsEditing(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update review');
      }
    });
  };

  const issueTypeLabel = ISSUE_TYPE_LABELS[issue.issueType] || issue.issueType;

  if (!isEditing) {
    return (
      <div className="mt-3 pt-3 border-t border-[var(--color-warning)]/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm">
            <ReviewStatusBadge status={issue.reviewStatus || 'unreviewed'} />
            {issue.priority && (
              <span className="text-[var(--color-text-secondary)]">
                Priority: {PRIORITY_OPTIONS.find(p => p.value === String(issue.priority))?.label}
              </span>
            )}
            {issue.reviewedBy && (
              <span className="text-[var(--color-text-muted)]">
                Reviewed by {issue.reviewedBy}
              </span>
            )}
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsEditing(true)}
          >
            {issue.reviewStatus === 'unreviewed' || !issue.reviewStatus ? 'Review' : 'Edit Review'}
          </Button>
        </div>
        {issue.reviewerNotes && (
          <p className="mt-2 text-sm text-[var(--color-text-secondary)] italic">
            Notes: {issue.reviewerNotes}
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 pt-3 border-t border-[var(--color-warning)]/20 space-y-3">
      {error && (
        <div className="p-3 bg-[var(--color-danger-bg)] border border-[var(--color-danger)]/30 text-[var(--color-danger)] text-sm rounded-[var(--radius-md)]">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
            Review Status *
          </label>
          <Select
            value={formData.reviewStatus}
            onValueChange={(value) => setFormData(prev => ({ ...prev, reviewStatus: value }))}
            options={[...REVIEW_STATUSES]}
            disabled={isPending}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
            Reviewer Name *
          </label>
          <Input
            value={formData.reviewedBy}
            onChange={(e) => setFormData(prev => ({ ...prev, reviewedBy: e.target.value }))}
            placeholder="Your name"
            disabled={isPending}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
            Priority
          </label>
          <Select
            value={formData.priority?.toString() ?? 'none'}
            onValueChange={(value) => setFormData(prev => ({
              ...prev,
              priority: value === 'none' ? undefined : parseInt(value)
            }))}
            options={[{ value: 'none', label: 'No priority' }, ...PRIORITY_OPTIONS]}
            disabled={isPending}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
            Impact Type
          </label>
          <Select
            value={formData.impactType || 'none'}
            onValueChange={(value) =>
              setFormData(prev => ({ ...prev, impactType: value === 'none' ? '' : value }))
            }
            options={[{ value: 'none', label: 'No impact type' }, ...IMPACT_TYPES]}
            disabled={isPending}
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
          Reviewer Notes
        </label>
        <Textarea
          value={formData.reviewerNotes}
          onChange={(e) => setFormData(prev => ({ ...prev, reviewerNotes: e.target.value }))}
          rows={2}
          placeholder="Add any notes about this issue..."
          disabled={isPending}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setIsEditing(false)}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          size="sm"
          isLoading={isPending}
        >
          {isPending ? 'Saving...' : 'Save Review'}
        </Button>
      </div>
    </form>
  );
}
