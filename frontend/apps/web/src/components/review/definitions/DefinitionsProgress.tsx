'use client';

import { ProgressCard } from '@/components/ui';

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

  return (
    <ProgressCard
      title="Review Progress"
      completed={reviewed}
      total={counts.total}
      completedLabel="reviewed"
      barColor="primary"
      statuses={[
        { label: 'Unreviewed', count: counts.unreviewed, variant: 'neutral' },
        { label: 'Confirmed', count: counts.confirmed, variant: 'success' },
        { label: 'Corrected', count: counts.corrected, variant: 'warning' },
        { label: 'False Positive', count: counts.falsePositive, variant: 'muted' },
      ]}
      className={className}
    />
  );
}

export default DefinitionsProgress;
