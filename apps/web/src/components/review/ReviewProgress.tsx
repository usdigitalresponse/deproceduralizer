'use client';

import type { ReviewStatusCounts } from '@deproceduralizer/database';

interface ReviewProgressProps {
  counts: ReviewStatusCounts;
  className?: string;
}

export function ReviewProgress({ counts, className = '' }: ReviewProgressProps) {
  const reviewed = counts.total - counts.unreviewed;
  const percentage = counts.total > 0 ? Math.round((reviewed / counts.total) * 100) : 0;

  return (
    <div className={`bg-[var(--color-surface)] border border-[var(--color-neutral-200)] rounded-[var(--radius-lg)] p-4 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-[var(--color-text)]">
          Review Progress
        </span>
        <span className="text-sm text-[var(--color-text-secondary)]">
          {reviewed} of {counts.total} reviewed ({percentage}%)
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-[var(--color-neutral-200)] rounded-full overflow-hidden mb-4">
        <div
          className="h-full bg-[var(--color-primary)] transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Status breakdown */}
      <div className="flex flex-wrap gap-4 text-xs">
        <StatusCount label="Unreviewed" count={counts.unreviewed} color="neutral" />
        <StatusCount label="Confirmed" count={counts.confirmed} color="success" />
        <StatusCount label="False Positive" count={counts.false_positive} color="muted" />
        <StatusCount label="Needs Context" count={counts.needs_context} color="warning" />
        <StatusCount label="Deferred" count={counts.deferred} color="info" />
      </div>
    </div>
  );
}

interface StatusCountProps {
  label: string;
  count: number;
  color: 'neutral' | 'success' | 'warning' | 'info' | 'muted';
}

function StatusCount({ label, count, color }: StatusCountProps) {
  const dotColors = {
    neutral: 'bg-[var(--color-neutral-400)]',
    success: 'bg-[var(--color-success)]',
    warning: 'bg-[var(--color-warning)]',
    info: 'bg-[var(--color-info)]',
    muted: 'bg-[var(--color-neutral-300)]',
  };

  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${dotColors[color]}`} />
      <span className="text-[var(--color-text-secondary)]">{label}:</span>
      <span className="font-medium text-[var(--color-text)]">{count}</span>
    </div>
  );
}

export default ReviewProgress;
