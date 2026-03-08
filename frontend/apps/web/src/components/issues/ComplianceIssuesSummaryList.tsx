'use client';

import { Card } from '@/components/ui/Card';
import { ComplianceIssueSummaryCard } from './ComplianceIssueSummaryCard';
import type { ComplianceIssueWithAnalysisFields } from '@deproceduralizer/database';

interface ComplianceIssuesSummaryListProps {
  issues: ComplianceIssueWithAnalysisFields[];
  state: string;
  focusedIssueId?: number | null;
}

export function ComplianceIssuesSummaryList({
  issues,
  state,
  focusedIssueId,
}: ComplianceIssuesSummaryListProps) {
  if (issues.length === 0) return null;

  return (
    <Card>
      <h2 className="font-semibold text-[var(--color-text)] mb-3">
        Compliance Issues ({issues.length})
      </h2>
      <div className="space-y-3">
        {issues.map((issue) => (
          <ComplianceIssueSummaryCard
            key={issue.id}
            issue={issue}
            state={state}
            isFocused={focusedIssueId === issue.id}
          />
        ))}
      </div>
    </Card>
  );
}
