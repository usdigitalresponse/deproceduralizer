import { Card } from '@/components/ui/Card';
import { JenAIIssueSummaryCard } from './JenAIIssueSummaryCard';
import type { JenAIIssue } from '@deproceduralizer/database';

interface JenAIIssuesListProps {
  issues: JenAIIssue[];
  state: string;
}

export function JenAIIssuesList({ issues, state }: JenAIIssuesListProps) {
  if (issues.length === 0) return null;

  return (
    <Card>
      <h2 className="font-semibold text-[var(--color-text)] mb-3">
        JenAI Issues ({issues.length})
      </h2>
      <div className="space-y-3">
        {issues.map((issue) => (
          <JenAIIssueSummaryCard
            key={issue.id}
            issue={issue}
            state={state}
          />
        ))}
      </div>
    </Card>
  );
}
