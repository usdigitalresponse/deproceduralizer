'use client';

import { Card } from './Card';

export type StatusVariant = 'neutral' | 'success' | 'warning' | 'info' | 'danger' | 'muted';

export interface StatusItem {
  /** Label for this status */
  label: string;
  /** Count for this status */
  count: number;
  /** Color variant for the dot */
  variant: StatusVariant;
}

export interface ProgressCardProps {
  /** Title displayed in the header */
  title: string;
  /** Number of completed items */
  completed: number;
  /** Total number of items */
  total: number;
  /** Label for completed items (e.g., "reviewed", "resolved") */
  completedLabel?: string;
  /** Color of the progress bar */
  barColor?: 'primary' | 'success';
  /** Status items to display below the progress bar */
  statuses: StatusItem[];
  /** Additional CSS classes */
  className?: string;
}

const dotColors: Record<StatusVariant, string> = {
  neutral: 'bg-[var(--color-neutral-400)]',
  success: 'bg-[var(--color-success)]',
  warning: 'bg-[var(--color-warning)]',
  info: 'bg-[var(--color-info)]',
  danger: 'bg-[var(--color-danger)]',
  muted: 'bg-[var(--color-neutral-300)]',
};

const barColors = {
  primary: 'bg-[var(--color-primary)]',
  success: 'bg-[var(--color-success)]',
};

/**
 * A card displaying progress with a bar and status breakdown.
 *
 * @example
 * ```tsx
 * <ProgressCard
 *   title="Review Progress"
 *   completed={reviewed}
 *   total={total}
 *   completedLabel="reviewed"
 *   barColor="primary"
 *   statuses={[
 *     { label: 'Unreviewed', count: 10, variant: 'neutral' },
 *     { label: 'Confirmed', count: 5, variant: 'success' },
 *     { label: 'Rejected', count: 2, variant: 'muted' },
 *   ]}
 * />
 * ```
 */
export function ProgressCard({
  title,
  completed,
  total,
  completedLabel = 'completed',
  barColor = 'primary',
  statuses,
  className = '',
}: ProgressCardProps) {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <Card padding="md" className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-[var(--color-text)]">
          {title}
        </span>
        <span className="text-sm text-[var(--color-text-secondary)]">
          {completed} of {total} {completedLabel} ({percentage}%)
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-[var(--color-neutral-200)] rounded-full overflow-hidden mb-4">
        <div
          className={`h-full ${barColors[barColor]} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${title}: ${percentage}% ${completedLabel}`}
        />
      </div>

      {/* Status breakdown */}
      <div className="flex flex-wrap gap-4 text-xs">
        {statuses.map((status) => (
          <div key={status.label} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${dotColors[status.variant]}`} />
            <span className="text-[var(--color-text-secondary)]">{status.label}:</span>
            <span className="font-medium text-[var(--color-text)]">{status.count}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
