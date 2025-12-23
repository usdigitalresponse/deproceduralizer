'use client';

import Link from 'next/link';
import type { RegulationWithAnalysis } from '@deproceduralizer/database';
import { RedFlagCard, RedFlagReviewForm } from '@/components/flags';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalBody,
  ModalClose,
  Button,
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
  regulation: RegulationWithAnalysis | null;
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

export default function DetailModal({ regulation, onClose, onFlagUpdated }: DetailModalProps) {
  const pathState = useStateFromPath();
  // Use path state, fallback to regulation's state if available
  const state = pathState || (regulation?.state?.toLowerCase() as 'ny' | 'nj') || 'nj';

  if (!regulation) return null;

  const nycrrCitation = formatNycrrCitation(
    regulation.nycrrTitle,
    regulation.nycrrPart,
    regulation.nycrrSection
  );

  return (
    <Modal open={!!regulation} onOpenChange={(open) => !open && onClose()}>
      <ModalContent size="xl">
        {/* Header */}
        <ModalHeader>
          <div className="flex-1 pr-4">
            <ModalTitle>{regulation.title}</ModalTitle>
            {nycrrCitation && (
              <span className="text-sm text-[var(--color-text-muted)]">{nycrrCitation}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
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
            <ModalClose />
          </div>
        </ModalHeader>

        {/* Body */}
        <ModalBody>
          {/* Hierarchy Info */}
          {(regulation.hierarchyLevel || regulation.hierarchyPath) && (
            <div className="mb-6 bg-[var(--color-primary-weaker)] border-l-4 border-[var(--color-primary-mid)] p-4 rounded-[var(--radius-md)]">
              <h3 className="font-semibold text-[var(--color-primary)] mb-2">Hierarchy Information</h3>
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
                      <RedFlagReviewForm
                        flag={flag}
                        onUpdated={onFlagUpdated}
                      />
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
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
