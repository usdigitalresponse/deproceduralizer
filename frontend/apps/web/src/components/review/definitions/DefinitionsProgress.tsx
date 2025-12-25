'use client';

import { Card } from '@/components/ui/Card';

interface DefinitionsProgressProps {
  counts: {
    unreviewed: number;
    confirmed: number;
    corrected: number;
    falsePositive: number;
    total: number;
  };
  className?: string;
}

export function DefinitionsProgress({ counts, className = '' }: DefinitionsProgressProps) {
  const reviewed = counts.confirmed + counts.corrected + counts.falsePositive;
  const percentage = counts.total > 0 ? Math.round((reviewed / counts.total) * 100) : 0;

  return (
    <Card padding="md" className={className}>
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
        <StatusCount label="Corrected" count={counts.corrected} color="warning" />
        <StatusCount label="False Positive" count={counts.falsePositive} color="muted" />
      </div>
    </Card>
  );
}

interface StatusCountProps {
  label: string;
  count: number;
  color: 'neutral' | 'success' | 'warning' | 'muted';
}

function StatusCount({ label, count, color }: StatusCountProps) {
  const dotColors = {
    neutral: 'bg-[var(--color-neutral-400)]',
    success: 'bg-[var(--color-success)]',
    warning: 'bg-[var(--color-warning)]',
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

export default DefinitionsProgress;
