import { Button } from '@/components/ui';
import type { ClearConfirmDialogProps } from './types';

export function ClearConfirmDialog({ item, isPending, onConfirm, onCancel }: ClearConfirmDialogProps) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--color-surface)] rounded-[var(--radius-lg)] shadow-lg max-w-md w-full p-6">
        <h3 className="text-lg font-semibold text-[var(--color-text)] mb-2">
          Clear Entry and Return to Review?
        </h3>
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          This will clear all review data and developer notes. The item will return to the unreviewed queue.
          {item.type === 'compliance_issue' && item.complianceIssueData?.originalSeverity && (
            <span className="block mt-2 text-[var(--color-warning)]">
              Severity will be restored from {item.complianceIssueData.severity} to {item.complianceIssueData.originalSeverity}.
            </span>
          )}
        </p>
        <p className="text-xs text-[var(--color-danger)] mb-4">
          This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={onConfirm}
            isLoading={isPending}
          >
            {isPending ? 'Clearing...' : 'Clear Entry'}
          </Button>
        </div>
      </div>
    </div>
  );
}
