'use client';

import { Search, CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import type { RecentActivity } from '@deproceduralizer/database';

interface RecentActivityCardProps {
  activity: RecentActivity;
}

interface MetricItemProps {
  icon: React.ComponentType<{ className?: string }>;
  value: number;
  label: string;
  colorClass: string;
}

function MetricItem({ icon: Icon, value, label, colorClass }: MetricItemProps) {
  return (
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-[var(--radius-md)] ${colorClass}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-lg font-semibold text-[var(--color-text)]">
          {value.toLocaleString()}
        </p>
        <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
      </div>
    </div>
  );
}

export function RecentActivityCard({ activity }: RecentActivityCardProps) {
  const hasActivity =
    activity.newIssues > 0 ||
    activity.issuesReviewed > 0;

  return (
    <Card>
      <h3 className="text-base font-semibold text-[var(--color-text)] mb-4">
        Last {activity.windowDays} Days
      </h3>

      {hasActivity ? (
        <div className="grid grid-cols-2 gap-4">
          <MetricItem
            icon={Search}
            value={activity.newIssues}
            label="Issues discovered"
            colorClass="bg-[var(--color-info-bg)] text-[var(--color-info)]"
          />
          <MetricItem
            icon={CheckCircle}
            value={activity.issuesReviewed}
            label="Issues reviewed"
            colorClass="bg-[var(--color-success-bg)] text-[var(--color-success)]"
          />
        </div>
      ) : (
        <p className="text-sm text-[var(--color-text-muted)] py-4 text-center">
          No recent activity
        </p>
      )}
    </Card>
  );
}

export default RecentActivityCard;
