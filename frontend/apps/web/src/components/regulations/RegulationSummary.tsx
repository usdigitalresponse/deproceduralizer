'use client';

interface RegulationSummaryProps {
  summary: string | null | undefined;
  /** Whether to show the heading (default: true) */
  showHeading?: boolean;
  className?: string;
}

/**
 * Displays the summary section for a regulation.
 * Used in DetailModal, DetailPanel, and regulation detail page.
 *
 * @example
 * <RegulationSummary summary={regulation.summary} />
 *
 * @example
 * // Without heading (inline usage)
 * <RegulationSummary summary={regulation.summary} showHeading={false} />
 */
export function RegulationSummary({
  summary,
  showHeading = true,
  className = '',
}: RegulationSummaryProps) {
  return (
    <div className={className}>
      {showHeading && (
        <h3 className="font-semibold text-[var(--color-text)] mb-3">Summary</h3>
      )}
      <div className="bg-[var(--color-info-bg)] border-l-4 border-[var(--color-info)] p-4 rounded-[var(--radius-md)] text-sm">
        {summary || 'No summary available'}
      </div>
    </div>
  );
}

export default RegulationSummary;
