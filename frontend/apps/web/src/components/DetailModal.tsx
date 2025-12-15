'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { RegulationWithAnalysis } from '@deproceduralizer/database';
import RedFlagReviewForm from './RedFlagReviewForm';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalBody,
  ModalClose,
} from '@/components/ui/Modal';
import { Badge, SeverityBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatNycrrCitation } from '@/lib/formatters/nycrr';

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
  const pathname = usePathname();
  const state = pathname.match(/^\/(ny|nj)/)?.[1] || regulation?.state?.toLowerCase() || 'nj';

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
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                {regulation.hierarchyLevel && (
                  <div>
                    <span className="font-medium text-[var(--color-text-secondary)]">Level:</span>
                    <span className="ml-2 capitalize">{regulation.hierarchyLevel}</span>
                  </div>
                )}
                {regulation.nycrrTitle && (
                  <div>
                    <span className="font-medium text-[var(--color-text-secondary)]">Title:</span>
                    <span className="ml-2">{regulation.nycrrTitle}</span>
                  </div>
                )}
                {regulation.nycrrPart && (
                  <div>
                    <span className="font-medium text-[var(--color-text-secondary)]">Part:</span>
                    <span className="ml-2">{regulation.nycrrPart}</span>
                  </div>
                )}
                {regulation.nycrrSection && (
                  <div>
                    <span className="font-medium text-[var(--color-text-secondary)]">Section:</span>
                    <span className="ml-2">{regulation.nycrrSection}</span>
                  </div>
                )}
                {regulation.parentId && (
                  <div>
                    <span className="font-medium text-[var(--color-text-secondary)]">Parent ID:</span>
                    <span className="ml-2">{regulation.parentId}</span>
                  </div>
                )}
                {regulation.hierarchyPath && (
                  <div className="col-span-2 md:col-span-3">
                    <span className="font-medium text-[var(--color-text-secondary)]">Path:</span>
                    <span className="ml-2 font-mono text-xs">{regulation.hierarchyPath}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="border-b border-[var(--color-neutral-200)] pb-2">
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
            <div className="border-b border-[var(--color-neutral-200)] pb-2">
              <span className="font-semibold text-[var(--color-text-secondary)] text-sm">URL Type:</span>
              <span className="ml-2 text-sm">{regulation.urlType || '–'}</span>
            </div>
            <div className="border-b border-[var(--color-neutral-200)] pb-2">
              <span className="font-semibold text-[var(--color-text-secondary)] text-sm">Source Index:</span>
              <span className="ml-2 text-sm font-mono">{regulation.sourceIndex || '–'}</span>
            </div>
            <div className="border-b border-[var(--color-neutral-200)] pb-2">
              <span className="font-semibold text-[var(--color-text-secondary)] text-sm">Red Flags:</span>
              <Badge variant={(regulation.numFlags ?? 0) > 0 ? 'danger' : 'default'} className="ml-2">
                {regulation.numFlags || 0} flags
              </Badge>
            </div>
            <div className="border-b border-[var(--color-neutral-200)] pb-2">
              <span className="font-semibold text-[var(--color-text-secondary)] text-sm">Severity:</span>
              {regulation.maxSeverity ? (
                <SeverityBadge severity={regulation.maxSeverity} className="ml-2" />
              ) : (
                <span className="ml-2 text-[var(--color-text-muted)]">–</span>
              )}
            </div>
            <div className="border-b border-[var(--color-neutral-200)] pb-2">
              <span className="font-semibold text-[var(--color-text-secondary)] text-sm">Complexity:</span>
              {regulation.overallComplexity ? (
                <Badge
                  variant={
                    regulation.overallComplexity === 'HIGH' ? 'danger' :
                    regulation.overallComplexity === 'MEDIUM' || regulation.overallComplexity === 'MEDIUM-HIGH' ? 'warning' :
                    'success'
                  }
                  className="ml-2"
                >
                  {regulation.overallComplexity}
                </Badge>
              ) : (
                <span className="ml-2 text-[var(--color-text-muted)]">–</span>
              )}
            </div>
            <div className="border-b border-[var(--color-neutral-200)] pb-2">
              <span className="font-semibold text-[var(--color-text-secondary)] text-sm">Impl Issues:</span>
              <span className="ml-2 text-sm">
                {regulation.hasImplementationIssues ? (
                  <span className="text-[var(--color-danger)]">● Yes</span>
                ) : (
                  <span className="text-[var(--color-text-muted)]">– No</span>
                )}
              </span>
            </div>
            <div className="border-b border-[var(--color-neutral-200)] pb-2">
              <span className="font-semibold text-[var(--color-text-secondary)] text-sm">Tech Review:</span>
              <span className="ml-2 text-sm">
                {regulation.requiresTechnicalReview ? (
                  <span className="text-[var(--color-info)]">● Yes</span>
                ) : (
                  <span className="text-[var(--color-text-muted)]">– No</span>
                )}
              </span>
            </div>
            <div className="border-b border-[var(--color-neutral-200)] pb-2 col-span-2">
              <span className="font-semibold text-[var(--color-text-secondary)] text-sm">Reporting Req:</span>
              <span className="ml-2 text-sm">
                {regulation.hasReportingRequirement ? (
                  <span className="text-[var(--color-warning)]">● Yes</span>
                ) : (
                  <span className="text-[var(--color-text-muted)]">– No</span>
                )}
              </span>
            </div>
          </div>

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
                          <Badge
                            variant={
                              flag.complexity === 'HIGH'
                                ? 'danger'
                                : flag.complexity === 'MEDIUM' || flag.complexity === 'MEDIUM-HIGH'
                                ? 'warning'
                                : 'success'
                            }
                          >
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
                            <span
                              key={i}
                              className="text-xs bg-[var(--color-danger-bg)] text-[var(--color-danger)] px-2 py-0.5 rounded-[var(--radius-sm)] border border-[var(--color-danger)]/20"
                            >
                              {phrase}
                            </span>
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
          <div className="mb-6">
            <h3 className="font-semibold text-[var(--color-text)] mb-3">Summary</h3>
            <div className="bg-[var(--color-info-bg)] border-l-4 border-[var(--color-info)] p-4 rounded-[var(--radius-md)] text-sm">
              {regulation.summary || 'No summary available'}
            </div>
          </div>

          {/* Regulation Text */}
          <div>
            <h3 className="font-semibold text-[var(--color-text)] mb-3">Regulation Text</h3>
            <div className="bg-[var(--color-neutral-50)] border-l-4 border-[var(--color-neutral-400)] p-4 rounded-[var(--radius-md)] text-sm font-mono whitespace-pre-wrap max-h-64 overflow-y-auto">
              {regulation.content || 'No content available'}
            </div>
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
