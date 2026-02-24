import { Badge } from '@/components/ui';
import { DecisionRationale } from '@/components/issues/DecisionRationale';
import type { LLMAnalysisSectionProps } from './types';

export function LLMAnalysisSection({
  tier1Reasoning,
  tier2Reasoning,
  tier3Reasoning,
  verbatimSupportingText,
  isVerbatim,
  statuteCitation,
}: LLMAnalysisSectionProps) {
  const hasRationale = tier1Reasoning || tier2Reasoning || tier3Reasoning;
  const hasContent = hasRationale || (verbatimSupportingText && verbatimSupportingText.length > 0);

  if (!hasContent) {
    return null;
  }

  return (
    <div className="mb-4 p-4 bg-[var(--color-primary-bg)] rounded-[var(--radius-md)] border border-[var(--color-primary)]/20">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-semibold text-[var(--color-primary)]">LLM Analysis</span>
        {isVerbatim !== null && (
          <Badge
            variant={isVerbatim ? 'info' : 'default'}
            className="text-[10px] py-0 px-1.5"
          >
            {isVerbatim ? 'Verbatim Quote' : 'Paraphrased'}
          </Badge>
        )}
      </div>

      {/* Verbatim Supporting Text - the key finding(s) */}
      {verbatimSupportingText && verbatimSupportingText.length > 0 && (
        <div className="mb-3 space-y-2">
          {verbatimSupportingText.map((text, index) => (
            <p key={index} className="text-sm text-[var(--color-text)] whitespace-pre-wrap leading-relaxed">
              {isVerbatim && <span className="text-[var(--color-text-muted)]">&quot;</span>}
              {text}
              {isVerbatim && <span className="text-[var(--color-text-muted)]">&quot;</span>}
            </p>
          ))}
        </div>
      )}

      <DecisionRationale
        tier1Reasoning={tier1Reasoning}
        tier2Reasoning={tier2Reasoning}
        tier3Reasoning={tier3Reasoning}
      />

      {/* Statute Citation */}
      {statuteCitation && (
        <div className="pt-3 border-t border-[var(--color-primary)]/10">
          <span className="text-xs font-medium text-[var(--color-text-secondary)]">Statute Citation:</span>
          <p className="mt-1 text-sm font-mono text-[var(--color-text)]">{statuteCitation}</p>
        </div>
      )}
    </div>
  );
}
