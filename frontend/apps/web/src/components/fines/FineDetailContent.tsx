'use client';

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  PENALTY_TYPE_LABELS,
  PENALTY_TYPE_COLORS,
  AGENCY_LEVEL_LABELS,
  AGENCY_LEVEL_COLORS,
  ACTIVITY_CATEGORY_LABELS,
  ESTIMATED_PAYERS_LABELS,
} from '@/lib/constants/fines';
import type { FineWithContext } from '@/lib/actions/fines';

interface FineDetailContentProps {
  fine: FineWithContext;
  state: string;
}

export function FineDetailContent({ fine, state }: FineDetailContentProps) {
  const sourceLink = fine.sourceDocument.type === 'regulation'
    ? `/${state}/regulations/${fine.documentId}`
    : `/${state}/guidance/${fine.guidanceDocumentId}`;

  const displayAgency = fine.agencyCanonicalName ?? fine.responsibleAgency;
  const rawAgency = fine.responsibleAgency;
  const showRawAgency = rawAgency && displayAgency && rawAgency !== displayAgency;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main Content */}
      <div className="order-2 lg:order-1 lg:col-span-2 space-y-6">
        {/* Card 1: Summary — Violation + Who Pays */}
        {(fine.violationDescription || fine.whoPays) && (
          <Card>
            <div className="space-y-4">
              {fine.violationDescription && (
                <div>
                  <h3 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
                    Violation / Trigger
                  </h3>
                  <p className="text-sm text-[var(--color-text)]">
                    {fine.violationDescription}
                  </p>
                </div>
              )}
              {fine.whoPays && (
                <div>
                  <h3 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
                    Who Pays
                  </h3>
                  <p className="text-sm text-[var(--color-text)]">{fine.whoPays}</p>
                  {fine.whoPaysNormalized && fine.whoPaysNormalized !== fine.whoPays && (
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">
                      Normalized: {fine.whoPaysNormalized}
                    </p>
                  )}
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Card 2: Amount Details */}
        <Card>
          <h3 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
            Amount Details
          </h3>
          <div className="text-sm space-y-2">
            {fine.amount && <p><span className="text-[var(--color-text-muted)]">Stated:</span> {fine.amount}</p>}
            {fine.amountMin && <p><span className="text-[var(--color-text-muted)]">Min:</span> ${Number(fine.amountMin).toLocaleString()}</p>}
            {fine.amountMax && <p><span className="text-[var(--color-text-muted)]">Max:</span> ${Number(fine.amountMax).toLocaleString()}</p>}
            {fine.perUnit && <p><span className="text-[var(--color-text-muted)]">Per:</span> {fine.perUnit}</p>}
          </div>
        </Card>

        {/* Card 3: Analysis — Activity Category + Estimated Impact + Justification */}
        {(fine.activityCategory || fine.estimatedAnnualPayers || fine.justification) && (
          <Card>
            <div className="space-y-4">
              {(fine.activityCategory || fine.estimatedAnnualPayers) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {fine.activityCategory && (
                    <div>
                      <h3 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
                        Activity Category
                      </h3>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--color-neutral-100)] text-[var(--color-text-secondary)]">
                        {ACTIVITY_CATEGORY_LABELS[fine.activityCategory] || fine.activityCategory}
                      </span>
                    </div>
                  )}
                  {fine.estimatedAnnualPayers && (
                    <div>
                      <h3 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
                        Estimated Impact
                      </h3>
                      <p className="text-sm text-[var(--color-text)]">
                        {ESTIMATED_PAYERS_LABELS[fine.estimatedAnnualPayers] || fine.estimatedAnnualPayers}
                      </p>
                    </div>
                  )}
                </div>
              )}
              {fine.justification && (
                <div>
                  <h3 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
                    Justification
                  </h3>
                  <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">
                    {fine.justification}
                  </p>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Card 4: Source Text — Requirement Quote + Full Context + Pattern Matched */}
        <Card>
          <div className="space-y-4">
            {fine.requirementQuote && (
              <div>
                <h3 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
                  Requirement Quote
                </h3>
                <blockquote className="text-sm text-[var(--color-text)] bg-[var(--color-neutral-50)] border-l-2 border-[var(--color-primary)] pl-3 py-2 rounded-r">
                  {fine.requirementQuote}
                </blockquote>
              </div>
            )}
            <div>
              <h3 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
                Full Context
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">
                {fine.context}
              </p>
            </div>
            {fine.termMatched && (
              <div>
                <h3 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
                  Pattern Matched
                </h3>
                <code className="text-xs bg-[var(--color-neutral-100)] px-2 py-1 rounded font-mono">
                  {fine.termMatched}
                </code>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Sidebar */}
      <div className="order-1 lg:order-2 space-y-4">
        {/* Type & Level Badge */}
        <Card>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${PENALTY_TYPE_COLORS[fine.penaltyType] || PENALTY_TYPE_COLORS.other}`}>
              {PENALTY_TYPE_LABELS[fine.penaltyType] || fine.penaltyType}
            </span>
            {fine.agencyLevel && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${AGENCY_LEVEL_COLORS[fine.agencyLevel] || AGENCY_LEVEL_COLORS.generic}`}>
                {AGENCY_LEVEL_LABELS[fine.agencyLevel] || fine.agencyLevel}
              </span>
            )}
          </div>

          {/* Agency */}
          {displayAgency && (
            <div className="mb-3">
              <h4 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Agency</h4>
              <p className="text-sm text-[var(--color-text)]">{displayAgency}</p>
              {showRawAgency && (
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  AI-extracted: &ldquo;{rawAgency}&rdquo;
                </p>
              )}
            </div>
          )}

          {/* Jurisdiction */}
          <div>
            <h4 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Jurisdiction</h4>
            <p className="text-sm text-[var(--color-text)]">{fine.jurisdiction}</p>
          </div>
        </Card>

        {/* Source Document */}
        <Card>
          <h4 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
            Source {fine.sourceDocument.type === 'guidance' ? 'Guidance' : 'Regulation'}
          </h4>
          <p className="text-sm text-[var(--color-text)] mb-2">
            {fine.sourceDocument.title}
          </p>
          {fine.sourceDocument.hierarchyPath && (
            <p className="text-xs text-[var(--color-text-muted)] mb-3">
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
        </Card>
      </div>
    </div>
  );
}
