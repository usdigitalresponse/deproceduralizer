import { Badge } from '@/components/ui';
import type { LLMAnalysisSectionProps } from './types';

export function LLMAnalysisSection({
  explanation,
  textExamples,
  implementationApproach,
  effortEstimate,
}: LLMAnalysisSectionProps) {
  return (
    <div className="mb-4 p-4 bg-[var(--color-primary-bg)] rounded-[var(--radius-md)] border border-[var(--color-primary)]/20">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-semibold text-[var(--color-primary)]">LLM Analysis</span>
        {effortEstimate && (
          <Badge variant="info" className="text-[10px] py-0 px-1.5">
            Effort: {effortEstimate}
          </Badge>
        )}
      </div>

      {/* Why Flagged */}
      <div className="mb-3">
        <span className="text-xs font-medium text-[var(--color-text-secondary)]">Why Flagged:</span>
        <p className="mt-1 text-sm text-[var(--color-text)]">{explanation}</p>
      </div>

      {/* Evidence from Text - text examples shown as quoted blocks */}
      {textExamples && textExamples.length > 0 && (
        <div className="mb-3 pt-3 border-t border-[var(--color-primary)]/10">
          <span className="text-xs font-medium text-[var(--color-text-secondary)]">Evidence from Text:</span>
          <div className="mt-1 space-y-2">
            {textExamples.map((example, index) => (
              <p key={index} className="text-sm text-[var(--color-text)] whitespace-pre-wrap leading-relaxed">
                <span className="text-[var(--color-text-muted)]">&quot;</span>
                {example}
                <span className="text-[var(--color-text-muted)]">&quot;</span>
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Implementation Approach */}
      {implementationApproach && (
        <div className="pt-3 border-t border-[var(--color-primary)]/10">
          <span className="text-xs font-medium text-[var(--color-text-secondary)]">Implementation Approach:</span>
          <p className="mt-1 text-sm text-[var(--color-text)]">{implementationApproach}</p>
        </div>
      )}
    </div>
  );
}
