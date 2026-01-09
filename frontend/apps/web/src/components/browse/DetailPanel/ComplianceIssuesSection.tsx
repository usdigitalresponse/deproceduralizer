import Link from 'next/link';
import { ClipboardList } from 'lucide-react';
import { Badge, Tag } from '@/components/ui';
import { ISSUE_TYPE_LABELS } from '@/types/regulation';
import type { ComplianceIssuesSectionProps } from './types';

export function ComplianceIssuesSection({ issues, state, documentId, currentUrl }: ComplianceIssuesSectionProps) {
  if (issues.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2 flex items-center gap-2">
        <ClipboardList className="w-4 h-4 text-[var(--color-warning)]" />
        Compliance Issues ({issues.length})
      </h3>
      <div className="space-y-3">
        {issues.slice(0, 3).map((issue) => (
          <div
            key={issue.id}
            className="p-3 bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] border border-[var(--color-neutral-200)]"
          >
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="warning" className="text-xs">
                {ISSUE_TYPE_LABELS[issue.issueType] || issue.issueType}
              </Badge>
              {issue.requirementFound && (
                <Badge variant="success" className="text-xs">LLM Confirmed</Badge>
              )}
            </div>
            {(issue.regexMatchPattern ?? issue.matchedPattern) && (
              <div className="mb-1">
                <Tag variant="warning" size="sm">{issue.regexMatchPattern ?? issue.matchedPattern}</Tag>
              </div>
            )}
            <p className="text-sm text-[var(--color-text)] line-clamp-2">{issue.regexMatchContext ?? issue.matchedContext}</p>
          </div>
        ))}
        {issues.length > 3 && (
          <Link
            href={`/${state}/regulations/${documentId}?from=${encodeURIComponent(currentUrl)}`}
            className="text-sm text-[var(--color-link)] hover:text-[var(--color-link-hover)]"
          >
            View all {issues.length} compliance issues...
          </Link>
        )}
      </div>
    </div>
  );
}
