'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui';

export interface ConfirmDialogProps {
  title: string;
  description: string;
  warning?: string;
  /** Optional extra content between description and buttons */
  children?: React.ReactNode;
  confirmLabel?: string;
  confirmingLabel?: string;
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  description,
  warning = 'This action cannot be undone.',
  children,
  confirmLabel = 'Confirm',
  confirmingLabel = 'Processing...',
  isPending,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Trap focus and handle Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isPending) {
        onCancel();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    dialogRef.current?.focus();
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isPending, onCancel]);

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isPending) onCancel();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="bg-[var(--color-surface)] rounded-[var(--radius-lg)] shadow-lg max-w-md w-full p-6 outline-none"
      >
        <h3 id="confirm-dialog-title" className="text-lg font-semibold text-[var(--color-text)] mb-2">
          {title}
        </h3>
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          {description}
        </p>
        {children}
        {warning && (
          <p className="text-xs text-[var(--color-danger)] mb-4">
            {warning}
          </p>
        )}
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
            {isPending ? confirmingLabel : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
