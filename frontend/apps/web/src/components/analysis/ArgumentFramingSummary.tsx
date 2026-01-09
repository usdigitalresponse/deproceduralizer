'use client';

import type { Tier1ArgumentFraming } from '@deproceduralizer/database';

interface ArgumentFramingSummaryProps {
  data: Tier1ArgumentFraming;
  /** Show compact one-line version vs expanded view */
  compact?: boolean;
}

const ARGUMENT_LABELS: Record<keyof Tier1ArgumentFraming, { label: string; color: string }> = {
  best_argument_burdensome: {
    label: 'Burdensome',
    color: 'var(--color-warning)',
  },
  best_argument_justified: {
    label: 'Justified',
    color: 'var(--color-success)',
  },
  best_argument_unrelated: {
    label: 'Unrelated',
    color: 'var(--color-neutral-500)',
  },
};

/**
 * ArgumentFramingSummary - Display Tier 1 argument framing from V5 pipeline
 *
 * Shows the best arguments for each classification (burdensome, justified, unrelated)
 * that Tier 1 identified during initial triage.
 */
export function ArgumentFramingSummary({ data, compact = false }: ArgumentFramingSummaryProps) {
  const hasAnyArgument = data.best_argument_burdensome || data.best_argument_justified || data.best_argument_unrelated;

  if (!hasAnyArgument) {
    return null;
  }

  if (compact) {
    // One-line summary version
    const bestArg = data.best_argument_burdensome
      ? { key: 'best_argument_burdensome' as const, value: data.best_argument_burdensome }
      : data.best_argument_justified
        ? { key: 'best_argument_justified' as const, value: data.best_argument_justified }
        : data.best_argument_unrelated
          ? { key: 'best_argument_unrelated' as const, value: data.best_argument_unrelated }
          : null;

    if (!bestArg) return null;

    const config = ARGUMENT_LABELS[bestArg.key];

    return (
      <div className="text-xs">
        <span className="text-[var(--color-text-muted)]">Initial framing: </span>
        <span style={{ color: config.color }} className="font-medium">
          {config.label}
        </span>
        <span className="text-[var(--color-text-secondary)]">
          {' '}&mdash; {bestArg.value.length > 80 ? `${bestArg.value.slice(0, 80)}...` : bestArg.value}
        </span>
      </div>
    );
  }

  // Full expanded view
  return (
    <div className="space-y-3">
      <h5 className="text-xs font-medium text-[var(--color-text-muted)]">
        Argument Framing (Tier 1)
      </h5>
      <div className="grid gap-2">
        {(Object.keys(ARGUMENT_LABELS) as Array<keyof Tier1ArgumentFraming>).map(key => {
          const value = data[key];
          if (!value) return null;

          const config = ARGUMENT_LABELS[key];

          return (
            <div
              key={key}
              className="bg-[var(--color-neutral-50)] border border-[var(--color-neutral-200)] rounded-[var(--radius-sm)] p-2"
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: config.color }}
                />
                <span
                  className="text-xs font-medium"
                  style={{ color: config.color }}
                >
                  {config.label}
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                {value}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ArgumentFramingSummary;
