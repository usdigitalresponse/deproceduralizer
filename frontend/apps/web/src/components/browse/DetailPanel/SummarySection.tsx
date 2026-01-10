import type { SummarySectionProps } from './types';

export function SummarySection({ summary }: SummarySectionProps) {
  if (!summary) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2">
        Summary
      </h3>
      <p className="text-sm text-[var(--color-text)]">{summary}</p>
    </div>
  );
}
