import type { FullAnalysisRecord } from '@deproceduralizer/database';
import { Badge } from '@/components/ui';

interface ExecutiveSummaryProps {
  analysis: FullAnalysisRecord;
}

export function ExecutiveSummary({ analysis }: ExecutiveSummaryProps) {
  const { tier1, tier2, tier3, highestTierCompleted } = analysis;

  const finalClassification: string | null =
    tier3?.classification ?? tier2?.classification ?? tier1?.classification ?? null;
  const finalSeverity = analysis.finalSeverity;

  // Tier 0/1: analysis still in progress
  if (highestTierCompleted < 2) {
    const relevantCount = tier1?.relevantMatchIds?.length || 0;
    const totalMatches = analysis.groupedMatchCount;

    return (
      <div className="bg-white border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] p-6 mb-6">
        <h2 className="text-sm font-semibold text-[var(--color-text-muted)] mb-2">
          Analysis Status
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Analysis in progress &mdash; {relevantCount > 0
            ? `${relevantCount} relevant matches identified out of ${totalMatches}, awaiting classification`
            : `${totalMatches} match${totalMatches !== 1 ? 'es' : ''} identified, awaiting filtering`
          }
        </p>
      </div>
    );
  }

  // Tier 3: show web search details and flags
  if (highestTierCompleted >= 3 && tier3) {
    const baseSeverity = tier2?.severity ?? null;
    const severityChanged = baseSeverity !== null && finalSeverity !== null && baseSeverity !== finalSeverity;
    const severityDelta = severityChanged ? finalSeverity - baseSeverity : 0;

    const hasWebSearch = !!tier3.webSearchSummary;
    const hasFlags = tier3.federalMandateFound || tier3.stateHasDiscretion ||
      tier3.flags?.modernized_alternative_found?.value || tier3.flags?.superseded_by_law?.value;

    return (
      <div className="bg-white border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] p-6 mb-6">
        <h2 className="text-sm font-semibold text-[var(--color-text-muted)] mb-3">
          {hasWebSearch || hasFlags ? 'Web Search Verification (Tier 3)' : 'Key Findings'}
        </h2>

        {/* Fallback classification line when no review summary exists in top card */}
        {!analysis.reviewSummary && (
          <p className="text-sm text-[var(--color-text)] mb-3">
            Classified as{' '}
            <span className="font-semibold">{finalClassification}</span>
            {finalSeverity !== null && (
              <> with severity <span className="font-semibold">{finalSeverity}</span>/10</>
            )}{' '}
            after web search verification
          </p>
        )}

        {tier3.webSearchSummary && (
          <div className="p-3 bg-[var(--color-info-bg)] border border-[var(--color-info)]/20 rounded-[var(--radius-sm)]">
            <p className="text-sm text-[var(--color-text-secondary)]">
              {tier3.webSearchSummary}
            </p>
          </div>
        )}

        {hasFlags && (
          <div className="mt-3 flex flex-wrap gap-2">
            {tier3.federalMandateFound && (
              <Badge variant="danger">Federal Mandate Found</Badge>
            )}
            {tier3.stateHasDiscretion && (
              <Badge variant="success">State Has Discretion</Badge>
            )}
            {tier3.flags?.modernized_alternative_found?.value && (
              <Badge variant="info">Modernized Alternative</Badge>
            )}
            {tier3.flags?.superseded_by_law?.value && (
              <Badge variant="warning">Superseded by Law</Badge>
            )}
          </div>
        )}

        {severityChanged && (
          <p className="mt-3 text-xs text-[var(--color-text-muted)]">
            Severity adjusted from {baseSeverity} to {finalSeverity} (
            <span className={severityDelta > 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]'}>
              {severityDelta > 0 ? '+' : ''}{severityDelta}
            </span>
            ) based on web research
          </p>
        )}
      </div>
    );
  }

  // Tier 2: show classification fallback (important for pre-backfill and guidance pages)
  return (
    <div className="bg-white border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] p-6 mb-6">
      <h2 className="text-sm font-semibold text-[var(--color-text-muted)] mb-3">
        Key Findings
      </h2>

      {analysis.reviewSummary ? (
        <div className="bg-[var(--color-primary-weaker)] border border-[var(--color-primary-weak)] rounded-[var(--radius-md)] px-4 py-3">
          <p className="text-sm text-[var(--color-text)] leading-relaxed">
            {analysis.reviewSummary}
          </p>
        </div>
      ) : (
        <p className="text-sm text-[var(--color-text)]">
          Classified as{' '}
          <span className="font-semibold">{finalClassification}</span>
          {finalSeverity !== null && (
            <> with severity <span className="font-semibold">{finalSeverity}</span>/10</>
          )}
        </p>
      )}
    </div>
  );
}
