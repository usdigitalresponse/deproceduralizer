'use client';

import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalBody,
  ModalClose,
} from '@/components/ui/Modal';
import type { KeyboardShortcut } from '@/hooks/useQueueNavigation';

interface KeyboardHelpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortcuts: KeyboardShortcut[];
}

/**
 * Modal displaying keyboard shortcuts for queue navigation.
 * Works with useQueueNavigation hook's showHelp state and shortcuts array.
 *
 * @example
 * const { showHelp, setShowHelp, shortcuts } = useQueueNavigation({...});
 * <KeyboardHelpModal open={showHelp} onOpenChange={setShowHelp} shortcuts={shortcuts} />
 */
export function KeyboardHelpModal({
  open,
  onOpenChange,
  shortcuts,
}: KeyboardHelpModalProps) {
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent size="sm">
        <ModalHeader>
          <ModalTitle>Keyboard Shortcuts</ModalTitle>
          <ModalClose />
        </ModalHeader>
        <ModalBody>
          <div className="space-y-3">
            {shortcuts.map((shortcut) => (
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

export default KeyboardHelpModal;
