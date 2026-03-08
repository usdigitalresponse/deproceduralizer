'use client';

import Link from 'next/link';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalBody,
  ModalClose,
  Button,
} from '@/components/ui';
import { RegulationSummary } from '@/components/regulations/RegulationSummary';
import { RegulationContent } from '@/components/regulations/RegulationContent';
import { formatStateCitation } from '@/lib/formatters/citations';
import { useJurisdictionFromPath, useRegulationById } from '@/hooks';
import { isValidJurisdiction, DEFAULT_JURISDICTION } from '@/types/state';

interface RegulationModalProps {
  regulationId: number | null;
  onClose: () => void;
}

export function RegulationModal({ regulationId, onClose }: RegulationModalProps) {
  const pathJurisdiction = useJurisdictionFromPath();
  const { regulation, isLoading, error } = useRegulationById(regulationId);

  // Use path jurisdiction, fallback to regulation's jurisdiction if available
  const regJurisdiction = regulation?.jurisdiction?.toLowerCase();
  const jurisdiction = pathJurisdiction || (regJurisdiction && isValidJurisdiction(regJurisdiction) ? regJurisdiction : DEFAULT_JURISDICTION);

  const citation = regulation
    ? formatStateCitation(jurisdiction, regulation)
    : null;

  return (
    <Modal open={regulationId !== null} onOpenChange={(open) => !open && onClose()}>
      <ModalContent size="xl">
        <ModalHeader>
          <div className="flex-1 pr-4">
            {isLoading ? (
              <ModalTitle>Loading...</ModalTitle>
            ) : error ? (
              <ModalTitle className="text-[var(--color-danger)]">Error</ModalTitle>
            ) : (
              <>
                <ModalTitle>{regulation?.title || 'Regulation Details'}</ModalTitle>
                {citation && (
                  <span className="text-sm text-[var(--color-text-muted)]">{citation}</span>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {regulation && (
              <Link href={`/${jurisdiction}/regulations/${regulation.id}`}>
                <Button variant="ghost" size="sm">
                  <svg
                    className="w-4 h-4 mr-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                  Full Page
                </Button>
              </Link>
            )}
            <ModalClose />
          </div>
        </ModalHeader>

        <ModalBody>
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)]" />
            </div>
          )}

          {error && (
            <div className="p-4 bg-[var(--color-danger-bg)] border border-[var(--color-danger)]/30 text-[var(--color-danger)] rounded-[var(--radius-md)]">
              {error}
            </div>
          )}

          {regulation && !isLoading && !error && (
            <>
              {/* Metadata */}
              <div className="border-b border-[var(--color-neutral-200)] pb-2 mb-6">
                <span className="font-semibold text-[var(--color-text-secondary)] text-sm">Source:</span>
                <a
                  href={regulation.url ?? ''}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 text-[var(--color-link)] hover:text-[var(--color-link-hover)] hover:underline text-sm"
                >
                  View Original
                </a>
              </div>

              {/* Summary */}
              {regulation.summary && (
                <RegulationSummary summary={regulation.summary} className="mb-6" />
              )}

              {/* Regulation Text */}
              <RegulationContent content={regulation.content} />
            </>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

export default RegulationModal;
