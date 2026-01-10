'use client';

import { useState } from 'react';

interface SeverityProgressionProps {
  baseSeverity: number | null;
  tier3Adjustment: number | null;
  tier4Adjustment: number | null;
  finalSeverity: number | null;
  tier2Calculation?: string | null;
  tier3Reasoning?: string | null;
}

export function SeverityProgression({
  baseSeverity,
  tier3Adjustment,
  tier4Adjustment,
  finalSeverity,
  tier2Calculation,
  tier3Reasoning,
}: SeverityProgressionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  if (baseSeverity === null && finalSeverity === null) {
    return null;
  }

  const steps: { label: string; value: number | string; delta?: number }[] = [];

  if (baseSeverity !== null) {
    steps.push({ label: 'Base (T2)', value: baseSeverity });
  }

  // Calculate actual adjustment from the difference between final and base
  // This ensures the display is always mathematically consistent, even if
  // the LLM returned inconsistent severity_adjustment and final_severity values
  const actualT3Adjustment = (baseSeverity !== null && finalSeverity !== null)
    ? finalSeverity - baseSeverity
    : tier3Adjustment;

  // V5: T3 is web search adjustment. V4 legacy: T4 was web search.
  // Use calculated adjustment for V5 (when we have both base and final)
  // Fall back to raw tier3Adjustment for legacy cases
  if (actualT3Adjustment !== null && actualT3Adjustment !== 0) {
    steps.push({
      label: 'Web Search',
      value: actualT3Adjustment > 0 ? `+${actualT3Adjustment}` : String(actualT3Adjustment),
      delta: actualT3Adjustment,
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

      {(tier2Calculation || tier3Reasoning) && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] mt-2 flex items-center gap-1"
        >
          <span>{isExpanded ? '▼' : '▶'}</span>
          <span>Show calculation details</span>
        </button>
      )}

      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-[var(--color-neutral-200)] space-y-2">
          {tier2Calculation && (
            <div>
              <span className="text-[10px] font-medium text-[var(--color-text-muted)] block mb-1">
                Tier 2 Calculation:
              </span>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {tier2Calculation}
              </p>
            </div>
          )}
          {tier3Reasoning && (
            <div>
              <span className="text-[10px] font-medium text-[var(--color-text-muted)] block mb-1">
                Web Search Adjustment:
              </span>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {tier3Reasoning}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SeverityProgression;
