'use client';

import { Card } from '@/components/ui/Card';
import type { DefinitionDeveloperStatusCounts } from '@deproceduralizer/database';

interface DefinitionsDeveloperProgressProps {
  counts: DefinitionDeveloperStatusCounts;
  className?: string;
}

export function DefinitionsDeveloperProgress({ counts, className = '' }: DefinitionsDeveloperProgressProps) {
  const resolved = counts.resolved;
  const percentage = counts.total > 0 ? Math.round((resolved / counts.total) * 100) : 0;

  return (
    <Card padding="md" className={className}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-[var(--color-text)]">
          Developer Progress
        </span>
        <span className="text-sm text-[var(--color-text-secondary)]">
          {resolved} of {counts.total} resolved ({percentage}%)
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-[var(--color-neutral-200)] rounded-full overflow-hidden mb-4">
        <div
          className="h-full bg-[var(--color-success)] transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Status breakdown */}
      <div className="flex flex-wrap gap-4 text-xs">
        <StatusCount label="Unresolved" count={counts.unresolved} color="danger" />
        <StatusCount label="Pending" count={counts.pending} color="warning" />
        <StatusCount label="Backlogged" count={counts.backlogged} color="neutral" />
        <StatusCount label="Need More Info" count={counts.need_more_info} color="info" />
        <StatusCount label="Resolved" count={counts.resolved} color="success" />
      </div>
    </Card>
  );
}

interface StatusCountProps {
  label: string;
  count: number;
  color: 'neutral' | 'success' | 'warning' | 'info' | 'danger';
}

function StatusCount({ label, count, color }: StatusCountProps) {
  const dotColors = {
    neutral: 'bg-[var(--color-neutral-400)]',
    success: 'bg-[var(--color-success)]',
    warning: 'bg-[var(--color-warning)]',
    info: 'bg-[var(--color-info)]',
    danger: 'bg-[var(--color-danger)]',
  };

  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${dotColors[color]}`} />
      <span className="text-[var(--color-text-secondary)]">{label}:</span>
      <span className="font-medium text-[var(--color-text)]">{count}</span>
    </div>
  );
}

export default DefinitionsDeveloperProgress;
