'use client';

import { memo } from 'react';
import { AlertCircle } from 'lucide-react';
import { SeverityBadge } from '@/components/ui';
import { formatLabel } from '@/types/regulation';
import type { BarrierIssueWithContext } from '@deproceduralizer/database';

interface BarrierReviewSummaryProps {
  issue: BarrierIssueWithContext;
}

export const BarrierReviewSummary = memo(function BarrierReviewSummary({ issue }: BarrierReviewSummaryProps) {
  const missingCritical: string[] = [];
  if (!issue.reviewedBy) missingCritical.push('Reviewer');
  if (!issue.justificationNotes) missingCritical.push('Justification');

  return (
    <div className="mb-4 p-3 bg-[var(--color-primary-weaker)] rounded-[var(--radius-md)]">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-medium text-[var(--color-text-secondary)]">Review Summary</div>
        {missingCritical.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-[var(--color-warning)]">
            <AlertCircle className="w-3 h-3" />
            Missing: {missingCritical.join(', ')}
          </div>
        )}
      </div>

      {/* Primary review info */}
      <div className="flex items-center gap-4 text-sm flex-wrap">
        <div>
          <span className="text-[var(--color-text-muted)]">Status: </span>
          <span className="text-[var(--color-text)]">{formatLabel(issue.reviewStatus || 'unreviewed')}</span>
        </div>
        {issue.reviewedBy ? (
          <div>
            <span className="text-[var(--color-text-muted)]">By: </span>
            <span className="text-[var(--color-text)]">{issue.reviewedBy}</span>
          </div>
        ) : (
          <div className="text-[var(--color-text-muted)] italic">No reviewer</div>
        )}
        {issue.reviewedAt && (
          <div>
            <span className="text-[var(--color-text-muted)]">Reviewed: </span>
            <span className="text-[var(--color-text)]">
              {new Date(issue.reviewedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </span>
          </div>
        )}
      </div>

      {/* Severity and impact */}
      <div className="flex items-center gap-4 text-sm flex-wrap mt-2">
        <div className="flex items-center gap-1">
          <span className="text-[var(--color-text-muted)]">Severity: </span>
          <SeverityBadge severity={issue.severity} />
        </div>
        {issue.impactType && (
          <div>
            <span className="text-[var(--color-text-muted)]">Impact: </span>
            <span className="text-[var(--color-text)]">{formatLabel(issue.impactType)}</span>
          </div>
        )}
      </div>

      {/* Justification */}
      <div className="mt-2 text-sm">
        <span className="text-[var(--color-text-muted)]">Justification: </span>
        {issue.justificationNotes ? (
          <span className="text-[var(--color-text)]">{issue.justificationNotes}</span>
        ) : (
          <span className="text-[var(--color-text-muted)] italic">Not provided</span>
        )}
      </div>

      {/* Team notes */}
      {(issue.teamNotes || !issue.justificationNotes) && (
        <div className="mt-1 text-sm">
          <span className="text-[var(--color-text-muted)]">Team Notes: </span>
          {issue.teamNotes ? (
            <span className="text-[var(--color-text)]">{issue.teamNotes}</span>
          ) : (
            <span className="text-[var(--color-text-muted)] italic">None</span>
          )}
        </div>
      )}
    </div>
  );
});
