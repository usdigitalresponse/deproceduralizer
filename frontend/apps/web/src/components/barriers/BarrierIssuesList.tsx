import { Card } from '@/components/ui/Card';
import { BarrierIssueSummaryCard } from './BarrierIssueSummaryCard';
import type { BarrierIssue } from '@deproceduralizer/database';

interface BarrierIssuesListProps {
  issues: BarrierIssue[];
  state: string;
}

export function BarrierIssuesList({ issues, state }: BarrierIssuesListProps) {
  if (issues.length === 0) return null;

  return (
    <Card>
      <h2 className="font-semibold text-[var(--color-text)] mb-3">
        Barrier Issues ({issues.length})
      </h2>
      <div className="space-y-3">
        {issues.map((issue) => (
          <BarrierIssueSummaryCard
            key={issue.id}
            issue={issue}
            state={state}
          />
        ))}
      </div>
    </Card>
  );
}
