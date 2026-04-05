'use client';

import Link from 'next/link';
import { ExternalLink, DollarSign, Receipt, AlertTriangle, Plus } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody, DrawerClose } from '@/components/ui/Drawer';
import { Button } from '@/components/ui/Button';
import { InfoTooltip, ReviewSummaryText } from '@/components/ui';
import { FineBookmarkProvider, FineDetailBookmark, FineDetailNotesCard } from './FineDetailBookmark';
import { ClassificationBadge } from '@/components/issues';
import { TierBadge } from '@/components/issues/TierProgressIndicator';
import { SeverityBadge } from '@/components/ui/Badge';
import { PENALTY_TYPE_LABELS, AGENCY_LEVEL_LABELS, AGENCY_LEVEL_COLORS, ACTIVITY_CATEGORY_LABELS, ESTIMATED_PAYERS_LABELS } from '@/lib/constants/fines';
import type { FineWithContext } from '@/lib/actions/fines';
import type { LucideIcon } from 'lucide-react';

const PENALTY_TYPE_ICONS: Record<string, LucideIcon> = {
  fine: DollarSign,
  fee: Receipt,
  penalty: AlertTriangle,
  surcharge: Plus,
};

const WHO_PAYS_TOOLTIPS: Record<string, string> = {
  licensee: 'The holder of the license, permit, or certification',
  applicant: 'The person or entity applying for a license or permit',
  owner: 'The property or business owner responsible',
  operator: 'The entity operating the regulated facility or activity',
};

function getWhoPaysTooltip(whoPays: string): string {
  const key = whoPays.toLowerCase().trim();
  return WHO_PAYS_TOOLTIPS[key] ?? 'The party responsible for the regulated activity';
}

interface FinesDetailDrawerProps {
  fine: FineWithContext | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: string;
  onBookmarkChange?: (fineId: number, bookmarked: boolean) => void;
}

export function FinesDetailDrawer({ fine, open, onOpenChange, state, onBookmarkChange }: FinesDetailDrawerProps) {
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
        <FineBookmarkProvider fineId={fine.id} jurisdiction={state} onBookmarkChange={onBookmarkChange}>
          <div className="flex flex-col h-full">
            <DrawerHeader>
              <div className="flex-1 min-w-0">
                <DrawerTitle>
                  {(() => {
                    const Icon = PENALTY_TYPE_ICONS[fine.penaltyType] ?? DollarSign;
                    return <Icon className="w-4 h-4 inline-block mr-1.5 align-text-bottom text-[var(--color-text-secondary)]" />;
                  })()}
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
              <div className="flex items-center gap-2">
                <FineDetailBookmark fineId={fine.id} jurisdiction={state} size="sm" showLabel={false} />
                <DrawerClose />
              </div>
            </DrawerHeader>

            <div className="px-4 py-2 border-b border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)]">
              <Link
                href={`/${state}/fines/${fine.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-[var(--color-primary)] hover:underline font-medium"
              >
                View full fine details <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>

            <DrawerBody className="p-4 space-y-6">
              {/* Bookmark Notes */}
              <FineDetailNotesCard />

              {/* --- Core Details --- */}
              <div className="border-t border-[var(--color-neutral-200)] pt-4 mt-4 space-y-6">
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
                    <p className="text-sm text-[var(--color-text)] flex items-center gap-1.5">
                      {fine.whoPays}
                      <InfoTooltip content={getWhoPaysTooltip(fine.whoPays)} size={13} />
                    </p>
                  </div>
                )}

                {/* Activity Category */}
                {fine.activityCategory && (
                  <div>
                    <h4 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                      Activity Category
                    </h4>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--color-neutral-100)] text-[var(--color-text-secondary)]">
                      {ACTIVITY_CATEGORY_LABELS[fine.activityCategory] || fine.activityCategory}
                    </span>
                  </div>
                )}

                {/* Estimated Impact */}
                {fine.estimatedAnnualPayers && (
                  <div>
                    <h4 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-1">
                      Estimated Impact
                    </h4>
                    <p className="text-[10px] text-[var(--color-text-muted)] italic mb-1">Order of magnitude estimate — may contain significant discrepancies</p>
                    <p className="text-sm text-[var(--color-text)]">
                      {ESTIMATED_PAYERS_LABELS[fine.estimatedAnnualPayers] || fine.estimatedAnnualPayers}
                    </p>
                  </div>
                )}

                {/* Justification */}
                {fine.justification && (
                  <div>
                    <h4 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                      Justification
                    </h4>
                    <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">
                      {fine.justification}
                    </p>
                  </div>
                )}
              </div>

              {/* --- Amount Details --- */}
              <div className="border-t border-[var(--color-neutral-200)] pt-4 mt-4">
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

              {/* --- Evidence --- */}
              <div className="border-t border-[var(--color-neutral-200)] pt-4 mt-4 space-y-6">
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
              </div>

              {/* --- Source Document --- */}
              <div className="border-t border-[var(--color-neutral-200)] pt-4 mt-4">
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

              {/* Research Pipeline Analysis */}
              {fine.analysis && (
                <div className="border-t border-[var(--color-neutral-200)] pt-4">
                  <h4 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
                    Research Pipeline Analysis
                  </h4>
                  <p className="text-xs text-[var(--color-text-muted)] mb-3">
                    Document-level analysis shared by all fines from this source
                  </p>

                  <ReviewSummaryText summary={fine.analysis.reviewSummary} variant="inline" className="mb-3" />

                  {/* Classification + Tier + Severity badges */}
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    <ClassificationBadge
                      classification={fine.analysis.tier3Classification ?? fine.analysis.tier2Classification ?? fine.analysis.tier1Classification}
                    />
                    <TierBadge highestTierCompleted={fine.analysis.highestTierCompleted} />
                    {fine.analysis.finalSeverity !== null && (
                      <SeverityBadge severity={fine.analysis.finalSeverity} />
                    )}
                  </div>

                  {/* Federal Mandate + Easy Cleanup flags */}
                  {(fine.analysis.federalMandateFound || fine.analysis.easyCleanupCandidate) && (
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                      {fine.analysis.federalMandateFound && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                          Federal Mandate
                        </span>
                      )}
                      {fine.analysis.easyCleanupCandidate && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                          Easy Cleanup{fine.analysis.cleanupEffort ? ` (${fine.analysis.cleanupEffort})` : ''}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Arguments */}
                  {fine.analysis.argumentForRegulation && (
                    <div className="mb-3">
                      <h5 className="text-xs font-medium text-green-700 mb-1">Argument For Regulation</h5>
                      <p className="text-xs text-[var(--color-text-secondary)] whitespace-pre-wrap">
                        {fine.analysis.argumentForRegulation}
                      </p>
                    </div>
                  )}
                  {fine.analysis.argumentAgainstRegulation && (
                    <div className="mb-3">
                      <h5 className="text-xs font-medium text-orange-700 mb-1">Argument Against Regulation</h5>
                      <p className="text-xs text-[var(--color-text-secondary)] whitespace-pre-wrap">
                        {fine.analysis.argumentAgainstRegulation}
                      </p>
                    </div>
                  )}

                  {/* Web Search Summary */}
                  {fine.analysis.webSearchSummary && (
                    <div className="bg-blue-50 border border-blue-100 rounded-[var(--radius-md)] p-3">
                      <h5 className="text-xs font-medium text-blue-700 mb-1">Web Search Findings</h5>
                      <p className="text-xs text-blue-900 whitespace-pre-wrap">
                        {fine.analysis.webSearchSummary}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </DrawerBody>
          </div>
        </FineBookmarkProvider>
      </DrawerContent>
    </Drawer>
  );
}
