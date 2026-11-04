'use client';

import { REVIEW_STATUSES, IMPACT_TYPES } from '@/types/regulation';

const PRIORITY_OPTIONS = [
  { value: '1', label: '1 - Lowest' },
  { value: '2', label: '2 - Low' },
  { value: '3', label: '3 - Medium' },
  { value: '4', label: '4 - High' },
  { value: '5', label: '5 - Highest' },
];
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { ReviewStatusBadge } from '@/components/ui/Badge';
import { useReviewForm, type ReviewFormCallbackData } from '@/hooks/useReviewForm';

export type ReviewItemType = 'compliance_issue';

export interface ReviewableItem {
  id: number;
  reviewStatus?: string | null;
  reviewedBy?: string | null;
  justificationNotes?: string | null;
  teamNotes?: string | null;
  priority?: number | null;
  severity?: number | null;
  impactType?: string | null;
}

interface ReviewFormProps<T extends ReviewableItem> {
  /** Type of item being reviewed (affects styling) */
  itemType: ReviewItemType;
  /** The item being reviewed */
  item: T;
  /** Callback when review is successfully updated */
  onUpdated: (data: ReviewFormCallbackData) => void;
  /** API function to update the review */
  onSubmit: (data: { id: number; reviewStatus: string; reviewedBy: string; justificationNotes?: string; teamNotes?: string; priority?: number; severity?: number; impactType?: string }) => Promise<
    | { success: true; data: { reviewStatus?: string | null; reviewedBy?: string | null; reviewedAt?: Date | null; justificationNotes?: string | null; teamNotes?: string | null; priority?: number | null; severity?: number | null; impactType?: string | null } }
    | { success: false; error: string }
  >;
  /** Placeholder text for notes textarea */
  notesPlaceholder?: string;
}

/**
 * Generic review form for compliance issues.
 * Handles review status, reviewer name, priority, impact type, and notes.
 */
export function ReviewForm<T extends ReviewableItem>({
  itemType,
  item,
  onUpdated,
  onSubmit,
  notesPlaceholder,
}: ReviewFormProps<T>) {
  const {
    formData,
    updateField,
    isEditing,
    setIsEditing,
    isPending,
    error,
    handleSubmit,
  } = useReviewForm({
    initialData: item,
    onSubmit: async (data) => {
      return onSubmit({
        id: data.id,
        reviewStatus: data.reviewStatus,
        reviewedBy: data.reviewedBy,
        justificationNotes: data.justificationNotes,
        teamNotes: data.teamNotes,
        priority: data.priority,
        severity: data.severity,
        impactType: data.impactType,
      });
    },
    onUpdated,
  });

  const borderColor = 'border-[var(--color-warning)]/20';

  if (!isEditing) {
    return (
      <div className={`mt-3 pt-3 border-t ${borderColor}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm">
            <ReviewStatusBadge status={item.reviewStatus || 'unreviewed'} />
            {item.priority && (
              <span className="text-[var(--color-text-secondary)]">
                Priority: {PRIORITY_OPTIONS.find(p => p.value === String(item.priority))?.label}
              </span>
            )}
            {item.reviewedBy && (
              <span className="text-[var(--color-text-muted)]">
                Reviewed by {item.reviewedBy}
              </span>
            )}
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsEditing(true)}
          >
            {!item.reviewStatus || item.reviewStatus === 'unreviewed' ? 'Review' : 'Edit Review'}
          </Button>
        </div>
        {(item.justificationNotes || item.teamNotes) && (
          <div className="mt-2 space-y-1">
            {item.justificationNotes && (
              <p className="text-sm text-[var(--color-text-secondary)] italic">
                Justification: {item.justificationNotes}
              </p>
            )}
            {item.teamNotes && (
              <p className="text-sm text-[var(--color-text-muted)] italic">
                Team notes: {item.teamNotes}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={`mt-3 pt-3 border-t ${borderColor} space-y-3`}>
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
            onValueChange={(value) => updateField('reviewStatus', value)}
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
            onChange={(e) => updateField('reviewedBy', e.target.value)}
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
            onValueChange={(value) => updateField('priority', value === 'none' ? undefined : parseInt(value))}
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
            onValueChange={(value) => updateField('impactType', value === 'none' ? undefined : value)}
            options={[{ value: 'none', label: 'No impact type' }, ...IMPACT_TYPES]}
            disabled={isPending}
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
          Justification and analysis <strong>for the model</strong> (compliance issues and Barrier)
        </label>
        <Textarea
          value={formData.justificationNotes ?? ''}
          onChange={(e) => updateField('justificationNotes', e.target.value || undefined)}
          rows={2}
          placeholder="Explain your reasoning for this classification..."
          disabled={isPending}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
          Notes for Development Team
        </label>
        <Textarea
          value={formData.teamNotes ?? ''}
          onChange={(e) => updateField('teamNotes', e.target.value || undefined)}
          rows={2}
          placeholder={notesPlaceholder || "Process notes, research tasks, questions..."}
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

export default ReviewForm;
