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
  Alert,
} from '@/components/ui';
import {
  RegulationHierarchyDetails,
  RegulationMetadata,
  RegulationSummary,
  RegulationContent,
} from '@/components/regulations';
import { formatStateCitation } from '@/lib/formatters/citations';
import { useJurisdictionFromPath, useRegulationById } from '@/hooks';
import { isValidJurisdiction, DEFAULT_JURISDICTION } from '@/types/state';

interface DetailModalProps {
  regulationId: number | null;
  onClose: () => void;
}

export default function DetailModal({ regulationId, onClose }: DetailModalProps) {
  const pathJurisdiction = useJurisdictionFromPath();
  const { regulation, setRegulation, isLoading, error } = useRegulationById(regulationId);

  // Use path jurisdiction, fallback to regulation's jurisdiction if available
  const regJurisdiction = regulation?.jurisdiction?.toLowerCase();
  const jurisdiction = pathJurisdiction || (regJurisdiction && isValidJurisdiction(regJurisdiction) ? regJurisdiction : DEFAULT_JURISDICTION);

  const citation = regulation
    ? formatStateCitation(jurisdiction, regulation)
    : null;

  return (
    <Modal open={regulationId !== null} onOpenChange={(open) => !open && onClose()}>
      <ModalContent size="xl">
        {/* Header */}
        <ModalHeader>
          <div className="flex-1 pr-4">
            <ModalTitle>{regulation?.title || 'Loading...'}</ModalTitle>
            {citation && (
              <span className="text-sm text-[var(--color-text-muted)]">{citation}</span>
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

        {/* Body */}
        <ModalBody>
          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <svg
                className="animate-spin h-8 w-8 text-[var(--color-primary)]"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
          )}

          {/* Error State */}
          {error && (
            <Alert variant="error" className="mb-4">
              {error}
            </Alert>
          )}

          {/* Content */}
          {regulation && !isLoading && (
            <>
              {/* Hierarchy Info */}
              {(regulation.hierarchyLevel || regulation.hierarchyPath) && (
                <div className="mb-6 bg-[var(--color-primary-weaker)] border-l-4 border-[var(--color-primary-mid)] p-4 rounded-[var(--radius-md)]">
                  <h3 className="font-semibold text-[var(--color-primary)] mb-2">
                    Hierarchy Information
                  </h3>
                  <RegulationHierarchyDetails regulation={regulation} showAllFields />
                </div>
              )}

              {/* Metadata Grid */}
              <RegulationMetadata regulation={regulation} layout="compact" className="mb-6" />

              {/* Summary */}
              <RegulationSummary summary={regulation.summary} className="mb-6" />

              {/* Regulation Text */}
              <RegulationContent content={regulation.content} />
            </>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
