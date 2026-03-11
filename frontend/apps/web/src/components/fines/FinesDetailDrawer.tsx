'use client';

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody, DrawerClose } from '@/components/ui/Drawer';
import { Button } from '@/components/ui/Button';
import { PENALTY_TYPE_LABELS, AGENCY_LEVEL_LABELS, AGENCY_LEVEL_COLORS } from '@/lib/constants/fines';
import type { FineWithContext } from '@/lib/actions/fines';

interface FinesDetailDrawerProps {
  fine: FineWithContext | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: string;
}

export function FinesDetailDrawer({ fine, open, onOpenChange, state }: FinesDetailDrawerProps) {
  if (!fine) return null;

  const sourceLink = fine.sourceDocument.type === 'regulation'
    ? `/${state}/regulations/${fine.documentId}`
    : `/${state}/guidance/${fine.guidanceDocumentId}`;

  const displayAgency = fine.agencyCanonicalName ?? fine.responsibleAgency;
  const rawAgency = fine.responsibleAgency;
  const showRawAgency = rawAgency && displayAgency && rawAgency !== displayAgency;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent side="right" size="lg">
        <div className="flex flex-col h-full">
          <DrawerHeader>
            <div className="flex-1 min-w-0">
              <DrawerTitle>
                {PENALTY_TYPE_LABELS[fine.penaltyType] || fine.penaltyType}: {fine.amount || 'Amount not specified'}
              </DrawerTitle>
              <div className="flex items-center gap-2 mt-1">
                {displayAgency && (
                  <span className="text-sm text-[var(--color-text-secondary)]">
                    {displayAgency}
                  </span>
                )}
                {fine.agencyLevel && (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${AGENCY_LEVEL_COLORS[fine.agencyLevel] || AGENCY_LEVEL_COLORS.generic}`}>
                    {AGENCY_LEVEL_LABELS[fine.agencyLevel] || fine.agencyLevel}
                  </span>
                )}
                {fine.perUnit && (
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {fine.perUnit}
                  </span>
                )}
              </div>
              {showRawAgency && (
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  AI-extracted: &ldquo;{rawAgency}&rdquo;
                </p>
              )}
            </div>
            <DrawerClose />
          </DrawerHeader>

          <DrawerBody className="p-4 space-y-6">
            {/* Violation Description */}
            {fine.violationDescription && (
              <div>
                <h4 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                  Violation / Trigger
                </h4>
                <p className="text-sm text-[var(--color-text)]">
                  {fine.violationDescription}
                </p>
              </div>
            )}

            {/* Who Pays */}
            {fine.whoPays && (
              <div>
                <h4 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                  Who Pays
                </h4>
                <p className="text-sm text-[var(--color-text)]">
                  {fine.whoPays}
                </p>
              </div>
            )}

            {/* Amount Details */}
            <div>
              <h4 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                Amount Details
              </h4>
              <div className="text-sm space-y-1">
                {fine.amount && <p><span className="text-[var(--color-text-muted)]">Stated:</span> {fine.amount}</p>}
                {fine.amountMin && <p><span className="text-[var(--color-text-muted)]">Min:</span> ${Number(fine.amountMin).toLocaleString()}</p>}
                {fine.amountMax && <p><span className="text-[var(--color-text-muted)]">Max:</span> ${Number(fine.amountMax).toLocaleString()}</p>}
                {fine.perUnit && <p><span className="text-[var(--color-text-muted)]">Per:</span> {fine.perUnit}</p>}
              </div>
            </div>

            {/* Requirement Quote */}
            {fine.requirementQuote && (
              <div>
                <h4 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                  Requirement Quote
                </h4>
                <blockquote className="text-sm text-[var(--color-text)] bg-[var(--color-neutral-50)] border-l-2 border-[var(--color-primary)] pl-3 py-2 rounded-r">
                  {fine.requirementQuote}
                </blockquote>
              </div>
            )}

            {/* Full Context */}
            <div>
              <h4 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                Context
              </h4>
              <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">
                {fine.context}
              </p>
            </div>

            {/* Pattern Matched */}
            {fine.termMatched && (
              <div>
                <h4 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                  Pattern Matched
                </h4>
                <code className="text-xs bg-[var(--color-neutral-100)] px-2 py-1 rounded font-mono">
                  {fine.termMatched}
                </code>
              </div>
            )}

            {/* Source Document */}
            <div>
              <h4 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                Source {fine.sourceDocument.type === 'guidance' ? 'Guidance' : 'Regulation'}
              </h4>
              <div className="text-sm space-y-2">
                <p className="text-[var(--color-text)]">{fine.sourceDocument.title}</p>
                {fine.sourceDocument.hierarchyPath && (
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {fine.sourceDocument.hierarchyPath}
                  </p>
                )}
                <div className="flex items-center gap-3">
                  <Link href={sourceLink}>
                    <Button variant="secondary" size="sm">
                      View {fine.sourceDocument.type === 'guidance' ? 'Guidance' : 'Regulation'}
                    </Button>
                  </Link>
                  {fine.url && (
                    <a
                      href={fine.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline"
                    >
                      Original source <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </DrawerBody>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
