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

    // Nothing to show if no web search details or flags
    if (!hasWebSearch && !hasFlags && !severityChanged) return null;

    return (
      <div className="bg-white border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] p-6 mb-6">
        <h2 className="text-sm font-semibold text-[var(--color-text-muted)] mb-3">
          Web Search Verification (Tier 3)
        </h2>

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

  // Tier 2 only: no separate section needed (summary is in top card, no web search details)
  return null;
}
