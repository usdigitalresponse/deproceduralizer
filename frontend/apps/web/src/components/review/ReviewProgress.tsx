'use client';

import { ProgressCard } from '@/components/ui';
import type { ReviewStatusCounts } from '@deproceduralizer/database';

interface ReviewProgressProps {
  counts: ReviewStatusCounts;
  className?: string;
}

export function ReviewProgress({ counts, className = '' }: ReviewProgressProps) {
  const reviewed = counts.total - counts.unreviewed;

  return (
    <ProgressCard
      title="Human Review Progress"
      completed={reviewed}
      total={counts.total}
      completedLabel="reviewed"
      barColor="primary"
      statuses={[
        { label: 'Unreviewed', count: counts.unreviewed, variant: 'neutral' },
        { label: 'Confirmed', count: counts.confirmed, variant: 'success' },
        { label: 'Rejected (Clear FP)', count: counts.rejected_clear_fp, variant: 'muted' },
        { label: 'Rejected (Not Obvious)', count: counts.rejected_not_obvious_bad, variant: 'muted' },
        { label: 'Needs Context', count: counts.needs_context, variant: 'warning' },
        { label: 'Deferred', count: counts.deferred, variant: 'info' },
      ]}
      className={className}
    />
  );
}

export default ReviewProgress;
