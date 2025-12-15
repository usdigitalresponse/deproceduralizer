'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getRegulationById } from '@/lib/actions/regulations';
import type { RegulationWithAnalysis } from '@deproceduralizer/database';
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

interface RegulationModalProps {
  regulationId: number | null;
  onClose: () => void;
}

export function RegulationModal({ regulationId, onClose }: RegulationModalProps) {
  const pathname = usePathname();
  const [regulation, setRegulation] = useState<RegulationWithAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Extract state from URL or regulation, default to nj
  const state = pathname.match(/^\/(ny|nj)/)?.[1] || regulation?.state?.toLowerCase() || 'nj';

  useEffect(() => {
    if (regulationId === null) {
      setRegulation(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    getRegulationById(regulationId)
      .then((data) => {
        setRegulation(data);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load regulation');
        setIsLoading(false);
      });
  }, [regulationId]);

  const nycrrCitation = regulation
    ? formatNycrrCitation(
        regulation.nycrrTitle,
        regulation.nycrrPart,
        regulation.nycrrSection
      )
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
                {nycrrCitation && (
                  <span className="text-sm text-[var(--color-text-muted)]">{nycrrCitation}</span>
                )}
              </>
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
              </div>

              {/* Summary */}
              {regulation.summary && (
                <div className="mb-6">
                  <h3 className="font-semibold text-[var(--color-text)] mb-3">Summary</h3>
                  <div className="bg-[var(--color-info-bg)] border-l-4 border-[var(--color-info)] p-4 rounded-[var(--radius-md)] text-sm">
                    {regulation.summary}
                  </div>
                </div>
              )}

              {/* Regulation Text */}
              <div>
                <h3 className="font-semibold text-[var(--color-text)] mb-3">Regulation Text</h3>
                <div className="bg-[var(--color-neutral-50)] border-l-4 border-[var(--color-neutral-400)] p-4 rounded-[var(--radius-md)] text-sm font-mono whitespace-pre-wrap max-h-64 overflow-y-auto">
                  {regulation.content || 'No content available'}
                </div>
              </div>
            </>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

export default RegulationModal;
