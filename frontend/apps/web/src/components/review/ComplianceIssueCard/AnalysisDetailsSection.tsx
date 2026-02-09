import { Badge } from '@/components/ui';
import { TierProgressIndicator } from '@/components/issues/TierProgressIndicator';
import type { AnalysisDetailsSectionProps } from './types';

export function AnalysisDetailsSection({ analysis }: AnalysisDetailsSectionProps) {
  const hasContent = analysis.argumentForRegulation || analysis.argumentAgainstRegulation;

  if (!hasContent) {
    return null;
  }

  return (
    <details className="mb-4 p-4 bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] border border-[var(--color-neutral-200)] group">
      <summary className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-secondary)] cursor-pointer hover:text-[var(--color-text)] transition-colors list-none [&::-webkit-details-marker]:hidden">
        <svg className="w-4 h-4 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        Analysis Details
        <TierProgressIndicator
          highestTierCompleted={analysis.highestTierCompleted}
          tier1Classification={analysis.tier1Classification}
          tier2Classification={analysis.tier2Classification}
          tier3Classification={analysis.tier3Classification}
          compact
          className="ml-2"
        />
      </summary>
      <div className="mt-3 space-y-4">
        {/* Argument For Regulation */}
        {analysis.argumentForRegulation && (
          <div className="bg-[var(--color-success-bg)] border border-[var(--color-success)]/20 rounded-[var(--radius-sm)] p-3">
            <h5 className="text-xs font-semibold text-[var(--color-success)] mb-2 flex items-center gap-1.5">
              <span>Argument For Regulation</span>
              <span className="text-[10px] font-normal text-[var(--color-text-muted)]">(steelman)</span>
            </h5>
            <p className="text-sm text-[var(--color-text-secondary)]">{analysis.argumentForRegulation}</p>
          </div>
        )}

        {/* Argument Against Regulation */}
        {analysis.argumentAgainstRegulation && (
          <div className="bg-[var(--color-danger-bg)] border border-[var(--color-danger)]/20 rounded-[var(--radius-sm)] p-3">
            <h5 className="text-xs font-semibold text-[var(--color-danger)] mb-2 flex items-center gap-1.5">
              <span>Argument Against Regulation</span>
              <span className="text-[10px] font-normal text-[var(--color-text-muted)]">(steelman)</span>
            </h5>
            <p className="text-sm text-[var(--color-text-secondary)]">{analysis.argumentAgainstRegulation}</p>
          </div>
        )}

        {/* Web Search Summary */}
        {analysis.webSearchSummary && (
          <div className="bg-[var(--color-info-bg)] border border-[var(--color-info)]/20 rounded-[var(--radius-sm)] p-3">
            <h5 className="text-xs font-semibold text-[var(--color-info)] mb-2">Web Research Summary</h5>
            <p className="text-sm text-[var(--color-text-secondary)]">{analysis.webSearchSummary}</p>
          </div>
        )}

        {/* Analysis metadata */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--color-neutral-200)]">
          {analysis.stateHasDiscretion && (
            <Badge variant="info" className="text-xs">State Has Discretion</Badge>
          )}
          {analysis.isJustified && (
            <Badge variant="success" className="text-xs">Marked Justified</Badge>
          )}
          {analysis.finalSeverity !== null && (
            <span className="text-xs text-[var(--color-text-muted)]">
              Pipeline Severity: {analysis.finalSeverity}
            </span>
          )}
          {analysis.pipelineVersion && (
            <span className="text-xs text-[var(--color-text-muted)]">
              {analysis.pipelineVersion}
            </span>
          )}
        </div>
      </div>
    </details>
  );
}
