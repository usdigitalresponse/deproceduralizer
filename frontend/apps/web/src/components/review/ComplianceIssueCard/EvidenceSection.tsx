import { EvidenceDisplay } from '@/components/issues/EvidenceDisplay';
import type { EvidenceSectionProps } from './types';

export function EvidenceSection({ contextUsed, verbatimRequirements }: EvidenceSectionProps) {
  return (
    <details className="mb-4 p-4 bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] border border-[var(--color-neutral-200)] group">
      <summary className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-secondary)] cursor-pointer hover:text-[var(--color-text)] transition-colors list-none [&::-webkit-details-marker]:hidden">
        <svg className="w-4 h-4 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        Research Evidence
        <span className="text-xs text-[var(--color-text-muted)] bg-[var(--color-neutral-200)] px-1.5 py-0.5 rounded ml-2">
          {contextUsed.length} sources
        </span>
      </summary>
      <div className="mt-3">
        <EvidenceDisplay
          contextUsed={contextUsed}
          verbatimRequirements={verbatimRequirements}
        />
      </div>
    </details>
  );
}
