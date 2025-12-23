'use client';

import { useState, useTransition } from 'react';
import { bulkUpdateDefinitionReviewStatus } from '@/lib/actions/definitions';
import { useReviewerName } from '@/hooks/useReviewerName';
import { Button, Input } from '@/components/ui';

interface BulkActionsBarProps {
  selectedIds: number[];
  totalItems: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onBulkComplete: () => void;
}

export function BulkActionsBar({
  selectedIds,
  totalItems,
  onSelectAll,
  onClearSelection,
  onBulkComplete,
}: BulkActionsBarProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState<'confirmed' | 'false_positive' | null>(null);
  const [reason, setReason] = useState('');
  const { reviewerName, saveReviewerName, isLoaded } = useReviewerName();
  const [reviewerInput, setReviewerInput] = useState('');

  // Pre-fill reviewer name
  if (isLoaded && reviewerName && !reviewerInput) {
    setReviewerInput(reviewerName);
  }

  const handleBulkAction = async (action: 'confirmed' | 'false_positive') => {
    if (!reviewerInput.trim()) {
      setError('Reviewer name is required');
      return;
    }

    if (action === 'false_positive' && !reason.trim()) {
      setError('Please provide a reason for marking as false positive');
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const result = await bulkUpdateDefinitionReviewStatus(
          selectedIds,
          action,
          reviewerInput,
          action === 'false_positive' ? reason : undefined
        );

        if (!result.success) {
          setError(result.error);
          return;
        }

        saveReviewerName(reviewerInput);
        setShowConfirmDialog(null);
        setReason('');
        onBulkComplete();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Bulk update failed');
      }
    });
  };

  if (selectedIds.length === 0) {
    return null;
  }

  return (
    <>
      {/* Floating Action Bar */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-white border border-[var(--color-neutral-200)] rounded-lg shadow-lg px-4 py-3 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={selectedIds.length === totalItems}
            onChange={() => {
              if (selectedIds.length === totalItems) {
                onClearSelection();
              } else {
                onSelectAll();
              }
            }}
            className="w-4 h-4 rounded border-[var(--color-neutral-300)] text-[var(--color-primary)]"
          />
          <span className="text-sm font-medium text-[var(--color-text)]">
            {selectedIds.length} selected
          </span>
        </div>

        <div className="h-6 w-px bg-[var(--color-neutral-200)]" />

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowConfirmDialog('confirmed')}
            disabled={isPending}
          >
            Confirm Selected
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => setShowConfirmDialog('false_positive')}
            disabled={isPending}
          >
            Mark as False Positive
          </Button>
        </div>

        <button
          onClick={onClearSelection}
          className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
        >
          Clear
        </button>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-[var(--color-text)] mb-4">
              {showConfirmDialog === 'confirmed'
                ? `Confirm ${selectedIds.length} Definition${selectedIds.length > 1 ? 's' : ''}?`
                : `Mark ${selectedIds.length} Definition${selectedIds.length > 1 ? 's' : ''} as False Positive?`
              }
            </h3>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-[var(--color-text)]">
                  Reviewer Name <span className="text-[var(--color-danger)]">*</span>
                </label>
                <Input
                  value={reviewerInput}
                  onChange={(e) => setReviewerInput(e.target.value)}
                  placeholder="Your name"
                />
              </div>

              {showConfirmDialog === 'false_positive' && (
                <div>
                  <label className="text-sm font-medium text-[var(--color-text)]">
                    Reason <span className="text-[var(--color-danger)]">*</span>
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Why are these not definitions?"
                    className="w-full px-3 py-2 border border-[var(--color-neutral-200)] rounded-md text-sm"
                    rows={3}
                  />
                </div>
              )}

              {error && (
                <div className="p-3 bg-[var(--color-danger-bg)] text-[var(--color-danger)] rounded text-sm">
                  {error}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowConfirmDialog(null);
                  setError(null);
                  setReason('');
                }}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                variant={showConfirmDialog === 'confirmed' ? 'primary' : 'danger'}
                onClick={() => handleBulkAction(showConfirmDialog)}
                disabled={isPending}
              >
                {isPending ? 'Processing...' : showConfirmDialog === 'confirmed' ? 'Confirm All' : 'Mark All'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default BulkActionsBar;
