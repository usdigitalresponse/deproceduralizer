import { Button } from '@/components/ui';
import type { ActionButtonsProps } from './types';

export function ActionButtons({
  isPending,
  hasChanges,
  reviewerName,
  onConfirm,
  onSaveCorrections,
  onMarkFalsePositive,
}: ActionButtonsProps) {
  const isDisabled = isPending || !reviewerName.trim();

  return (
    <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--color-neutral-200)] pt-4">
      <Button
        variant="danger"
        onClick={onMarkFalsePositive}
        disabled={isDisabled}
        data-testid="definition-false-positive-button"
      >
        Not a Definition
      </Button>

      <div className="flex gap-2">
        {hasChanges ? (
          <Button
            variant="primary"
            onClick={onSaveCorrections}
            disabled={isDisabled}
            data-testid="definition-save-corrections-button"
          >
            {isPending ? 'Saving...' : 'Save Corrections'}
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={onConfirm}
            disabled={isDisabled}
            data-testid="definition-confirm-button"
          >
            {isPending ? 'Confirming...' : 'Confirm'}
          </Button>
        )}
      </div>
    </div>
  );
}
