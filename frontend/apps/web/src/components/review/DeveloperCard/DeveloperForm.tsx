import { ExternalLink, RotateCcw } from 'lucide-react';
import { Button, Textarea, Select } from '@/components/ui';
import { CornellLink } from '../shared';
import { DEVELOPER_STATUSES, RESOLUTION_TYPES, DEVELOPERS } from '@/types/regulation';
import type { DeveloperFormProps } from './types';

export function DeveloperForm({
  item,
  formData,
  setFormData,
  isPending,
  error,
  onSubmit,
  state,
  onShowClearConfirm,
}: DeveloperFormProps) {
  const developerOptions = [...DEVELOPERS];
  const statusOptions = [...DEVELOPER_STATUSES];
  const resolutionOptions = [...RESOLUTION_TYPES];

  return (
    <form onSubmit={onSubmit} className="pt-4 border-t border-[var(--color-neutral-200)]">
      {error && (
        <div className="mb-3 p-3 bg-[var(--color-danger-bg)] border border-[var(--color-danger)]/30 text-[var(--color-danger)] text-sm rounded-[var(--radius-md)]">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
        {/* Developer */}
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
            Developer *
          </label>
          <Select
            value={formData.developerAssigned || undefined}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, developerAssigned: value }))}
            options={developerOptions}
            placeholder="Select developer"
            disabled={isPending}
          />
        </div>

        {/* Status */}
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
            Status *
          </label>
          <Select
            value={formData.developerStatus}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, developerStatus: value }))}
            options={statusOptions}
            disabled={isPending}
          />
        </div>

        {/* Resolution Type (shown when resolved) */}
        {formData.developerStatus === 'resolved' && (
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              Resolution
            </label>
            <Select
              value={formData.resolutionType || undefined}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, resolutionType: value }))}
              options={resolutionOptions}
              placeholder="--"
              disabled={isPending}
            />
          </div>
        )}
      </div>

      {/* Resolution Comments (shown when resolved) */}
      {formData.developerStatus === 'resolved' && (
        <div className="mb-3">
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
            Resolution Comments
          </label>
          <Textarea
            value={formData.resolutionComments}
            onChange={(e) => setFormData((prev) => ({ ...prev, resolutionComments: e.target.value }))}
            rows={2}
            placeholder="Describe what was done or why not implemented..."
            disabled={isPending}
          />
        </div>
      )}

      {/* Question for Reviewer (shown when need_more_info) */}
      {formData.developerStatus === 'need_more_info' && (
        <div className="mb-3">
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
            Question for Reviewer
          </label>
          <Textarea
            value={formData.developerQuestion}
            onChange={(e) => setFormData((prev) => ({ ...prev, developerQuestion: e.target.value }))}
            rows={2}
            placeholder="What information do you need from the reviewer?"
            disabled={isPending}
          />
        </div>
      )}

      {/* Developer Notes */}
      <div className="mb-3">
        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
          Developer Notes
        </label>
        <Textarea
          value={formData.developerNotes}
          onChange={(e) => setFormData((prev) => ({ ...prev, developerNotes: e.target.value }))}
          rows={2}
          placeholder="Internal notes about this item..."
          disabled={isPending}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => window.open(`/${state.toLowerCase()}/regulations/${item.regulation.id}`, '_blank')}
          >
            View Full Regulation Page
            <ExternalLink className="w-3 h-3 ml-1" />
          </Button>
          <CornellLink url={item.regulation.url} />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onShowClearConfirm}
            className="text-[var(--color-danger)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)]"
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            Clear & Return
          </Button>
        </div>
        <Button type="submit" variant="primary" size="sm" isLoading={isPending}>
          {isPending ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </form>
  );
}
