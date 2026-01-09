'use client';

interface SeverityProgressionProps {
  baseSeverity: number | null;
  tier3Adjustment: number | null;
  tier4Adjustment: number | null;
  finalSeverity: number | null;
}

export function SeverityProgression({
  baseSeverity,
  tier3Adjustment,
  tier4Adjustment,
  finalSeverity,
}: SeverityProgressionProps) {
  if (baseSeverity === null && finalSeverity === null) {
    return null;
  }

  const steps: { label: string; value: number | string; delta?: number }[] = [];

  if (baseSeverity !== null) {
    steps.push({ label: 'Base (T2)', value: baseSeverity });
  }

  // V5: T3 is web search adjustment. V4 legacy: T4 was web search.
  if (tier3Adjustment !== null && tier3Adjustment !== 0) {
    steps.push({
      label: 'Web Search',
      value: tier3Adjustment > 0 ? `+${tier3Adjustment}` : String(tier3Adjustment),
      delta: tier3Adjustment,
    });
  }

  // V4 legacy: if tier4Adjustment provided and different from tier3
  if (tier4Adjustment !== null && tier4Adjustment !== 0 && tier4Adjustment !== tier3Adjustment) {
    steps.push({
      label: 'T4 (Legacy)',
      value: tier4Adjustment > 0 ? `+${tier4Adjustment}` : String(tier4Adjustment),
      delta: tier4Adjustment,
    });
  }

  if (finalSeverity !== null) {
    steps.push({ label: 'Final', value: finalSeverity });
  }

  return (
    <div className="bg-[var(--color-neutral-50)] border border-[var(--color-neutral-200)] rounded-[var(--radius-sm)] p-3">
      <h5 className="text-xs font-semibold text-[var(--color-text-secondary)] mb-3">
        Severity Progression
      </h5>
      <div className="flex items-center gap-2 flex-wrap">
        {steps.map((step, index) => (
          <div key={index} className="flex items-center gap-2">
            {index > 0 && (
              <span className="text-[var(--color-text-muted)]">→</span>
            )}
            <div className="flex flex-col items-center">
              <span
                className={`
                  text-lg font-bold
                  ${step.delta !== undefined
                    ? step.delta > 0
                      ? 'text-[var(--color-danger)]'
                      : 'text-[var(--color-success)]'
                    : step.label === 'Final'
                      ? 'text-[var(--color-warning)]'
                      : 'text-[var(--color-text)]'
                  }
                `}
              >
                {step.value}
              </span>
              <span className="text-[10px] text-[var(--color-text-muted)]">
                {step.label}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default SeverityProgression;
