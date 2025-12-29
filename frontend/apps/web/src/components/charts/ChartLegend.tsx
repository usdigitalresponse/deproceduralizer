'use client';

import type { LegendItem, LegendOrientation } from '@/lib/charts/types';

interface ChartLegendProps {
  /** Legend items to display */
  items: LegendItem[];
  /** Layout orientation. Default: 'horizontal' */
  orientation?: LegendOrientation;
  /** Additional class names */
  className?: string;
  /** Callback when a legend item is clicked (for interactive filtering) */
  onItemClick?: (item: LegendItem, index: number) => void;
  /** Set of disabled/inactive item labels */
  disabledItems?: Set<string>;
}

/**
 * Chart legend component displaying color-coded labels.
 * Supports both horizontal and vertical layouts.
 *
 * @example
 * ```tsx
 * <ChartLegend
 *   items={[
 *     { label: 'High', color: '#b52c2c', value: 42 },
 *     { label: 'Medium', color: '#b45309', value: 87 },
 *     { label: 'Low', color: '#1e752e', value: 156 },
 *   ]}
 *   orientation="horizontal"
 * />
 * ```
 */
export function ChartLegend({
  items,
  orientation = 'horizontal',
  className = '',
  onItemClick,
  disabledItems,
}: ChartLegendProps) {
  const isInteractive = !!onItemClick;

  return (
    <div
      className={`
        flex flex-wrap gap-4
        ${orientation === 'vertical' ? 'flex-col' : 'flex-row items-center justify-center'}
        ${className}
      `
        .trim()
        .replace(/\s+/g, ' ')}
      role="list"
      aria-label="Chart legend"
    >
      {items.map((item, index) => {
        const isDisabled = disabledItems?.has(item.label);

        return (
          <button
            key={item.label}
            type="button"
            className={`
              flex items-center gap-2
              text-sm
              ${isInteractive ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}
              ${isDisabled ? 'opacity-40' : ''}
              transition-opacity duration-[var(--duration-fast)]
            `
              .trim()
              .replace(/\s+/g, ' ')}
            onClick={() => onItemClick?.(item, index)}
            disabled={!isInteractive}
            role="listitem"
            aria-label={`${item.label}${item.value != null ? `: ${item.value}` : ''}`}
          >
            <span
              className="w-3 h-3 rounded-sm flex-shrink-0"
              style={{ backgroundColor: item.color }}
              aria-hidden="true"
            />
            <span className="text-[var(--color-text-secondary)]">{item.label}</span>
            {item.value != null && (
              <span className="text-[var(--color-text-muted)] font-medium">
                {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Compact inline legend for small charts or constrained spaces.
 */
export function ChartLegendCompact({
  items,
  className = '',
}: {
  items: LegendItem[];
  className?: string;
}) {
  return (
    <div
      className={`flex flex-wrap gap-x-3 gap-y-1 text-xs ${className}`}
      role="list"
      aria-label="Chart legend"
    >
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1" role="listitem">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: item.color }}
            aria-hidden="true"
          />
          <span className="text-[var(--color-text-muted)]">{item.label}</span>
        </span>
      ))}
    </div>
  );
}

/**
 * Gradient legend for continuous color scales (e.g., heatmaps).
 */
export function ChartLegendGradient({
  minLabel,
  maxLabel,
  colors,
  className = '',
}: {
  minLabel: string;
  maxLabel: string;
  colors: string[];
  className?: string;
}) {
  const gradient = `linear-gradient(to right, ${colors.join(', ')})`;

  return (
    <div className={`flex flex-col gap-1 ${className}`} aria-label="Color scale legend">
      <div
        className="h-3 w-full rounded-sm"
        style={{ background: gradient }}
        aria-hidden="true"
      />
      <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}
