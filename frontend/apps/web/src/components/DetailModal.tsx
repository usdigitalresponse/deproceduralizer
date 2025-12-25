'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { RegulationWithAnalysis } from '@deproceduralizer/database';
import { getRegulationById } from '@/lib/actions/regulations';
import { RedFlagCard, RedFlagReviewForm } from '@/components/flags';
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
import { formatNycrrCitation } from '@/lib/formatters/nycrr';
import { useStateFromPath } from '@/hooks';

interface DetailModalProps {
  regulationId: number | null;
  onClose: () => void;
  onFlagUpdated?: (updatedFlag: {
    id: number;
    reviewStatus?: string;
    reviewedBy?: string;
    reviewedAt?: string;
    justificationNotes?: string;
    teamNotes?: string;
    priority?: number;
    impactType?: string;
  }) => void;
}

export default function DetailModal({ regulationId, onClose, onFlagUpdated }: DetailModalProps) {
  const pathState = useStateFromPath();
  const [regulation, setRegulation] = useState<RegulationWithAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use path state, fallback to regulation's state if available
  const state = pathState || (regulation?.state?.toLowerCase() as 'ny' | 'nj') || 'nj';

  // Fetch regulation when regulationId changes
  useEffect(() => {
    if (regulationId === null) {
      setRegulation(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    getRegulationById(regulationId)
      .then((result) => {
        if (!result.success) {
          setError(result.error);
          setRegulation(null);
        } else {
          setRegulation(result.data);
        }
      })
      .catch((err) => {
        setError(err.message || 'Failed to load regulation');
        setRegulation(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [regulationId]);

  // Handle flag updates - update local state and notify parent
  const handleFlagUpdated = (updatedFlag: {
    id: number;
    reviewStatus?: string;
    reviewedBy?: string;
    reviewedAt?: string;
    justificationNotes?: string;
    teamNotes?: string;
    priority?: number;
    impactType?: string;
  }) => {
    // Update local regulation state
    if (regulation) {
      const flagUpdate = {
        ...updatedFlag,
        reviewedAt: updatedFlag.reviewedAt ? new Date(updatedFlag.reviewedAt) : null,
      };
      setRegulation({
        ...regulation,
        redFlags: regulation.redFlags.map((flag) =>
          flag.id === updatedFlag.id ? { ...flag, ...flagUpdate } : flag
        ),
      });
    }

    // Notify parent to update table data
    onFlagUpdated?.(updatedFlag);
  };

  const nycrrCitation = regulation
    ? formatNycrrCitation(regulation.nycrrTitle, regulation.nycrrPart, regulation.nycrrSection)
    : null;

  return (
    <Modal open={regulationId !== null} onOpenChange={(open) => !open && onClose()}>
      <ModalContent size="xl">
        {/* Header */}
        <ModalHeader>
          <div className="flex-1 pr-4">
            <ModalTitle>{regulation?.title || 'Loading...'}</ModalTitle>
            {nycrrCitation && (
              <span className="text-sm text-[var(--color-text-muted)]">{nycrrCitation}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {regulation && (
              <Link href={`/${state}/regulations/${regulation.id}`}>
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

              {/* Red Flags Details */}
              {regulation.redFlags && regulation.redFlags.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-semibold text-[var(--color-text)] mb-3">Red Flags Details</h3>
                  <div className="space-y-3">
                    {regulation.redFlags.map((flag, idx) => (
                      <RedFlagCard key={idx} flag={flag} showReviewStatus={false}>
                        {flag.id && onFlagUpdated && (
                          <RedFlagReviewForm flag={flag} onUpdated={handleFlagUpdated} />
                        )}
                      </RedFlagCard>
                    ))}
                  </div>
                </div>
              )}

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
