'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { setDocumentExclusion } from '@/lib/actions/regulations';

interface ExclusionToggleProps {
  documentId: number;
  isExcluded: boolean;
  excludedBy?: string | null;
  excludedAt?: Date | null;
  excludedReason?: string | null;
}

export function ExclusionToggle({
  documentId,
  isExcluded,
  excludedBy,
  excludedAt,
  excludedReason,
}: ExclusionToggleProps) {
  const [isPending, startTransition] = useTransition();
  const [showReasonInput, setShowReasonInput] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleToggle = () => {
    if (isExcluded) {
      // Remove exclusion directly
      setError(null);
      startTransition(async () => {
        const result = await setDocumentExclusion({
          documentId,
          exclude: false,
          excludedBy: '',
        });
        if (!result.success) {
          setError(result.error);
        }
      });
    } else {
      // Show reason input first
      setShowReasonInput(true);
    }
  };

  const handleConfirmExclusion = () => {
    setError(null);
    startTransition(async () => {
      const result = await setDocumentExclusion({
        documentId,
        exclude: true,
        excludedBy: 'user', // In production, use actual user identity
        reason: reason || undefined,
      });
      if (!result.success) {
        setError(result.error);
      } else {
        setShowReasonInput(false);
        setReason('');
      }
    });
  };

  const handleCancel = () => {
    setShowReasonInput(false);
    setReason('');
  };

  // Format date for display
  const formatDate = (date: Date | null | undefined) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-medium text-[var(--color-text)]">
            Exclude from Analysis
          </h3>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            Excludes this document from red flag, definition, and compliance issue analysis runs
          </p>
        </div>

        {!showReasonInput && (
          <Button
            variant={isExcluded ? 'secondary' : 'danger'}
            size="sm"
            onClick={handleToggle}
            disabled={isPending}
            isLoading={isPending}
          >
            {isExcluded ? 'Remove Exclusion' : 'Exclude'}
          </Button>
        )}
      </div>

      {/* Show reason input when excluding */}
      {showReasonInput && !isExcluded && (
        <div className="space-y-3 p-3 bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] border border-[var(--color-neutral-200)]">
          <textarea
            className="w-full p-2 text-sm border border-[var(--color-neutral-300)] rounded-[var(--radius-md)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
            placeholder="Reason for exclusion (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="danger"
              onClick={handleConfirmExclusion}
              disabled={isPending}
              isLoading={isPending}
            >
              Confirm Exclusion
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCancel}
              disabled={isPending}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Show exclusion details when excluded */}
      {isExcluded && excludedBy && (
        <div className="text-xs text-[var(--color-text-muted)] p-3 bg-[var(--color-warning-50)] border border-[var(--color-warning-200)] rounded-[var(--radius-md)]">
          <div className="flex items-center gap-1.5 mb-1">
            <svg className="w-4 h-4 text-[var(--color-warning-600)]" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="font-medium text-[var(--color-warning-700)]">
              Excluded from analysis
            </span>
          </div>
          <p>
            Excluded by {excludedBy} on {formatDate(excludedAt)}
          </p>
          {excludedReason && (
            <p className="mt-1">
              <span className="font-medium">Reason:</span> {excludedReason}
            </p>
          )}
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="text-xs text-[var(--color-danger)] p-2 bg-[var(--color-danger-50)] rounded-[var(--radius-md)]">
          {error}
        </div>
      )}
    </div>
  );
}

export default ExclusionToggle;
