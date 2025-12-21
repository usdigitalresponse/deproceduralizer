'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalBody,
  ModalClose,
} from '@/components/ui/Modal';

interface ReviewKeyboardNavProps {
  onNavigate: (direction: 'up' | 'down') => void;
  onNextUnreviewed: () => void;
  onViewRegulation: () => void;
}

const SHORTCUTS = [
  { key: 'j / ↓', description: 'Next flag' },
  { key: 'k / ↑', description: 'Previous flag' },
  { key: 'n', description: 'Next unreviewed flag' },
  { key: 'v', description: 'View regulation' },
  { key: '?', description: 'Show this help' },
];

export function ReviewKeyboardNav({
  onNavigate,
  onNextUnreviewed,
  onViewRegulation,
}: ReviewKeyboardNavProps) {
  const [showHelp, setShowHelp] = useState(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ignore if typing in an input/textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      // Ignore if interacting with a dropdown/combobox (Radix UI Select)
      // Check for role attributes that indicate dropdown interaction
      const target = e.target as HTMLElement;
      const role = target.getAttribute('role');
      if (role === 'combobox' || role === 'listbox' || role === 'option') {
        return;
      }

      // Also check if inside an open Radix Select portal
      if (target.closest('[data-radix-select-viewport]') ||
          target.closest('[role="listbox"]')) {
        return;
      }

      switch (e.key) {
        case 'j':
        case 'ArrowDown':
          e.preventDefault();
          onNavigate('down');
          break;
        case 'k':
        case 'ArrowUp':
          e.preventDefault();
          onNavigate('up');
          break;
        case 'n':
          e.preventDefault();
          onNextUnreviewed();
          break;
        case 'v':
          e.preventDefault();
          onViewRegulation();
          break;
        case '?':
          e.preventDefault();
          setShowHelp(true);
          break;
        case 'Escape':
          if (showHelp) {
            e.preventDefault();
            setShowHelp(false);
          }
          break;
      }
    },
    [onNavigate, onNextUnreviewed, onViewRegulation, showHelp]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <Modal open={showHelp} onOpenChange={setShowHelp}>
      <ModalContent size="sm">
        <ModalHeader>
          <ModalTitle>Keyboard Shortcuts</ModalTitle>
          <ModalClose />
        </ModalHeader>
        <ModalBody>
          <div className="space-y-3">
            {SHORTCUTS.map((shortcut) => (
              <div
                key={shortcut.key}
                className="flex items-center justify-between py-2 border-b border-[var(--color-neutral-200)] last:border-0"
              >
                <span className="text-[var(--color-text-secondary)]">
                  {shortcut.description}
                </span>
                <kbd className="px-2 py-1 bg-[var(--color-neutral-100)] border border-[var(--color-neutral-300)] rounded text-sm font-mono text-[var(--color-text)]">
                  {shortcut.key}
                </kbd>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-[var(--color-text-muted)]">
            Press <kbd className="px-1 bg-[var(--color-neutral-100)] rounded font-mono">Esc</kbd> to close this dialog
          </p>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

export default ReviewKeyboardNav;
