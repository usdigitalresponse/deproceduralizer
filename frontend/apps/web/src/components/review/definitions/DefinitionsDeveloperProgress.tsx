'use client';

import { ProgressCard } from '@/components/ui';
import type { DefinitionDeveloperStatusCounts } from '@deproceduralizer/database';

interface DefinitionsDeveloperProgressProps {
  counts: DefinitionDeveloperStatusCounts;
  className?: string;
}

export function DefinitionsDeveloperProgress({ counts, className = '' }: DefinitionsDeveloperProgressProps) {
  return (
    <ProgressCard
      title="Developer Progress"
      completed={counts.resolved}
      total={counts.total}
      completedLabel="resolved"
      barColor="success"
      statuses={[
        { label: 'Unresolved', count: counts.unresolved, variant: 'danger' },
        { label: 'Pending', count: counts.pending, variant: 'warning' },
        { label: 'Backlogged', count: counts.backlogged, variant: 'neutral' },
        { label: 'Need More Info', count: counts.need_more_info, variant: 'info' },
        { label: 'Resolved', count: counts.resolved, variant: 'success' },
      ]}
      className={className}
    />
  );
}

export default DefinitionsDeveloperProgress;
