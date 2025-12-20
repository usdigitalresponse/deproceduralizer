'use client';

import Link from 'next/link';
import type { RegulationWithAnalysis } from '@deproceduralizer/database';
import RedFlagReviewForm from './RedFlagReviewForm';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalBody,
  ModalClose,
  Badge,
  SeverityBadge,
  Button,
  Tag,
} from '@/components/ui';
import {
  RegulationHierarchyDetails,
  RegulationMetadata,
  RegulationSummary,
  RegulationContent,
} from '@/components/regulations';
import { formatNycrrCitation } from '@/lib/formatters/nycrr';
import { useStateFromPath } from '@/hooks';
import { getComplexityVariant } from '@/types/regulation';

interface DetailModalProps {
  regulation: RegulationWithAnalysis | null;
  onClose: () => void;
  onFlagUpdated?: (updatedFlag: {
    id: number;
    reviewStatus?: string;
    reviewedBy?: string;
    reviewedAt?: string;
    reviewerNotes?: string;
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
                  <div
                    key={idx}
                    className="bg-[var(--color-danger-bg)] border-l-4 border-[var(--color-danger)] p-4 rounded-[var(--radius-md)]"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-[var(--color-danger)]">{flag.category}</span>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-[var(--color-text-muted)]">Severity:</span>
                          <SeverityBadge severity={flag.severity} />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-[var(--color-text-muted)]">Complexity:</span>
                          <Badge variant={getComplexityVariant(flag.complexity)}>
                            {flag.complexity}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-[var(--color-text-secondary)] mb-2">{flag.explanation}</p>
                    {flag.implementationApproach && (
                      <div className="mt-2 text-sm">
                        <span className="font-medium text-[var(--color-text-secondary)]">Implementation:</span>
                        <span className="ml-2">{flag.implementationApproach}</span>
                      </div>
                    )}
                    {flag.effortEstimate && (
                      <div className="mt-1 text-sm">
                        <span className="font-medium text-[var(--color-text-secondary)]">Effort:</span>
                        <span className="ml-2">{flag.effortEstimate}</span>
                      </div>
                    )}
                    {flag.matchedPhrases && flag.matchedPhrases.length > 0 && (
                      <div className="mt-2">
                        <span className="text-xs font-medium text-[var(--color-text-secondary)]">Matched phrases:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {flag.matchedPhrases.map((phrase, i) => (
                            <Tag key={i} variant="danger" size="sm">
                              {phrase}
                            </Tag>
                          ))}
                        </div>
                      </div>
                    )}
                    {flag.textExamples && flag.textExamples.length > 0 && (
                      <div className="mt-2">
                        <span className="text-xs font-medium text-[var(--color-text-secondary)]">Examples from text:</span>
                        <ul className="mt-1 text-xs text-[var(--color-text-muted)] list-disc list-inside">
                          {flag.textExamples.map((ex, i) => (
                            <li key={i} className="italic">&quot;{ex}&quot;</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {flag.id && onFlagUpdated && (
                      <RedFlagReviewForm
                        flag={flag}
                        onUpdated={onFlagUpdated}
                      />
                    )}
                  </div>
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
