import type { FullAnalysisRecord } from '@deproceduralizer/database';
import { Badge } from '@/components/ui';

interface ExecutiveSummaryProps {
  analysis: FullAnalysisRecord;
}

export function ExecutiveSummary({ analysis }: ExecutiveSummaryProps) {
  const { tier1, tier2, tier3, highestTierCompleted } = analysis;

  // Determine final classification label
  const finalClassification: string | null =
    tier3?.classification ?? tier2?.classification ?? tier1?.classification ?? null;

  if (highestTierCompleted >= 3 && tier3) {
    return <Tier3Summary analysis={analysis} finalClassification={finalClassification} />;
  }

  if (highestTierCompleted >= 2 && tier2) {
    return <Tier2Summary analysis={analysis} finalClassification={finalClassification} />;
  }

  // Tier 1 or Tier 0
  const relevantCount = tier1?.relevantMatchIds?.length || 0;
  const totalMatches = analysis.groupedMatchCount;

  return (
    <div className="bg-white border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] p-6 mb-6">
      <h2 className="text-sm font-semibold text-[var(--color-text-muted)] mb-2">
        Key Findings
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

interface TierSummaryProps {
  analysis: FullAnalysisRecord;
  finalClassification: string | null;
}

function Tier3Summary({ analysis, finalClassification }: TierSummaryProps) {
  const { tier2, tier3 } = analysis;
  const baseSeverity = tier2?.severity ?? null;
  const finalSeverity = analysis.finalSeverity;

  // Calculate actual severity change
  const severityChanged = baseSeverity !== null && finalSeverity !== null && baseSeverity !== finalSeverity;
  const severityDelta = severityChanged ? finalSeverity - baseSeverity : 0;

  return (
    <div className="bg-white border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] p-6 mb-6">
      <h2 className="text-sm font-semibold text-[var(--color-text-muted)] mb-3">
        Key Findings
      </h2>

      {/* One-line verdict */}
      <p className="text-sm text-[var(--color-text)]">
        Classified as{' '}
        <span className="font-semibold">{finalClassification}</span>
        {finalSeverity !== null && (
          <> with severity <span className="font-semibold">{finalSeverity}</span>/10</>
        )}{' '}
        after web search verification
      </p>

      {/* Review Summary — plain-language distillation of the analysis */}
      {analysis.reviewSummary && (
        <p className="mt-2 text-sm text-[var(--color-text-secondary)] leading-relaxed">
          {analysis.reviewSummary}
        </p>
      )}

      {/* Web Search Summary */}
      {tier3?.webSearchSummary && (
        <div className="mt-3 p-3 bg-[var(--color-info-bg)] border border-[var(--color-info)]/20 rounded-[var(--radius-sm)]">
          <p className="text-sm text-[var(--color-text-secondary)]">
            {tier3.webSearchSummary}
          </p>
        </div>
      )}

      {/* Key flags row */}
      <div className="mt-3 flex flex-wrap gap-2">
        {tier3?.federalMandateFound && (
          <Badge variant="danger">Federal Mandate Found</Badge>
        )}
        {tier3?.stateHasDiscretion && (
          <Badge variant="success">State Has Discretion</Badge>
        )}
        {tier3?.flags?.modernized_alternative_found?.value && (
          <Badge variant="info">Modernized Alternative</Badge>
        )}
        {tier3?.flags?.superseded_by_law?.value && (
          <Badge variant="warning">Superseded by Law</Badge>
        )}
      </div>

      {/* Severity adjustment note */}
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

function Tier2Summary({ analysis, finalClassification }: TierSummaryProps) {
  const finalSeverity = analysis.finalSeverity;

  return (
    <div className="bg-white border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] p-6 mb-6">
      <h2 className="text-sm font-semibold text-[var(--color-text-muted)] mb-3">
        Key Findings
      </h2>

      <p className="text-sm text-[var(--color-text)]">
        Classified as{' '}
        <span className="font-semibold">{finalClassification}</span>
        {finalSeverity !== null && (
          <> with severity <span className="font-semibold">{finalSeverity}</span>/10</>
        )}{' '}
        (no web verification performed)
      </p>

      {/* Review Summary — plain-language distillation of the analysis */}
      {analysis.reviewSummary ? (
        <p className="mt-2 text-sm text-[var(--color-text-secondary)] leading-relaxed">
          {analysis.reviewSummary}
        </p>
      ) : (
        <p className="mt-2 text-xs text-[var(--color-text-muted)]">
          This analysis completed at Tier 2. Web search verification was not triggered for this item.
        </p>
      )}
    </div>
  );
}
