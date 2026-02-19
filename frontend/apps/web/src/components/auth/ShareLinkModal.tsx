'use client';

import { useState } from 'react';
import { Copy, Check, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalBody,
  ModalFooter,
  ModalClose,
} from '@/components/ui/Modal';
import { Button } from '@/components/ui';

interface ShareLinkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareUrl: string;
}

/**
 * Modal for displaying and copying one-time share links.
 *
 * Shows the generated share URL with a one-click copy button and
 * explanatory text about link expiry behavior.
 */
export function ShareLinkModal({ open, onOpenChange, shareUrl }: ShareLinkModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Share link copied to clipboard!');

      // Reset copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      toast.error('Failed to copy link. Please copy manually.');
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent size="md">
        <ModalHeader>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 bg-[var(--color-primary-weaker)] rounded-[var(--radius-sm)]">
              <Share2 className="w-4 h-4 text-[var(--color-primary)]" />
            </div>
            <ModalTitle>Share Link Generated</ModalTitle>
          </div>
          <ModalClose />
        </ModalHeader>

        <ModalBody className="space-y-4">
          {/* Explanation */}
          <div className="space-y-2">
            <p className="text-sm text-[var(--color-text)]">
              Share this link with someone to grant them access to the site.
            </p>
            <p className="text-sm text-[var(--color-text-secondary)]">
              <strong className="font-medium text-[var(--color-text)]">Note:</strong>{' '}
              Once used, the link expires and they'll need to enter the password for future access.
            </p>
          </div>

          {/* Link Display with Copy Button */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-2">
              Share Link
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="
                  flex-1 px-3 py-2
                  text-sm text-[var(--color-text)]
                  bg-[var(--color-neutral-50)]
                  border border-[var(--color-neutral-300)]
                  rounded-[var(--radius-md)]
                  font-mono
                  select-all
                  focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] focus:ring-offset-2
                "
                onClick={(e) => e.currentTarget.select()}
              />
              <Button
                onClick={handleCopy}
                variant="secondary"
                className="flex items-center gap-2 shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Usage Instructions */}
          <div className="px-4 py-3 bg-[var(--color-info-bg)] border border-[var(--color-info)] rounded-[var(--radius-md)]">
            <p className="text-sm text-[var(--color-text)]">
              <strong className="font-medium">How it works:</strong> The recipient
              clicks the link, gets authenticated automatically, and gains access.
              The link can only be used once.
            </p>
          </div>
        </ModalBody>

        <ModalFooter>
          <ModalClose asChild>
            <Button variant="secondary">Close</Button>
          </ModalClose>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
