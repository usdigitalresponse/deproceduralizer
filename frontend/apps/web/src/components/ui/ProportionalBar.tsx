export interface ColorStop {
  /** Percentage threshold (0-100) */
  threshold: number;
  /** CSS color value */
  color: string;
}

export interface ProportionalBarProps {
  /** Current value */
  value: number;
  /** Maximum value (determines bar width) */
  max: number;
  /** Custom color stops (default: green/yellow/red at 33/66/100) */
  colorStops?: ColorStop[];
  /** Bar height in pixels (default 6) */
  height?: number;
  /** Additional CSS classes */
  className?: string;
}

const DEFAULT_COLOR_STOPS: ColorStop[] = [
  { threshold: 33, color: 'var(--color-success)' },
  { threshold: 66, color: 'var(--color-warning)' },
  { threshold: 100, color: 'var(--color-danger)' },
];

function getBarColor(percentage: number, stops: ColorStop[]): string {
  for (const stop of stops) {
    if (percentage <= stop.threshold) {
      return stop.color;
    }
  }
  return stops[stops.length - 1]?.color ?? 'var(--color-success)';
}

/**
 * Small inline horizontal bar for visualizing proportional values.
 *
 * @example
 * ```tsx
 * <ProportionalBar value={42} max={100} />
 * <ProportionalBar value={8} max={10} height={4} />
 * ```
 */
export function ProportionalBar({
  value,
  max,
  colorStops = DEFAULT_COLOR_STOPS,
  height = 6,
  className = '',
}: ProportionalBarProps) {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const barColor = getBarColor(percentage, colorStops);

  return (
    <div
      className={`w-full rounded-full bg-[var(--color-neutral-100)] ${className}`}
      style={{ height }}
      role="meter"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{
          width: `${percentage}%`,
          backgroundColor: barColor,
        }}
      />
    </div>
  );
}

export default ProportionalBar;
