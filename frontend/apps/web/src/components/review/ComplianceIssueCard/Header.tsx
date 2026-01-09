import { ExternalLink } from 'lucide-react';
import { Badge, SeverityBadge } from '@/components/ui';
import { TierBadge } from '@/components/issues/TierProgressIndicator';
import type { HeaderProps } from './types';

export function Header({ issue, issueTypeLabel }: HeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 mb-4">
      <div className="flex items-center gap-3">
        <a
          href={`/prompts#prompt-${issue.issueType}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 group"
          title="View prompt definition (opens in new tab)"
        >
          <Badge variant="warning" className="font-semibold group-hover:ring-2 group-hover:ring-[var(--color-warning)]/30 transition-shadow">
            {issueTypeLabel}
          </Badge>
          <ExternalLink className="w-3.5 h-3.5 text-[var(--color-text-muted)] group-hover:text-[var(--color-warning)] transition-colors" />
        </a>
        {issue.requirementFound === true && (
          <Badge variant="success" className="text-xs">
            LLM Confirmed
          </Badge>
        )}
        {issue.requirementFound === false && (
          <Badge variant="danger" className="text-xs">
            LLM Rejected
          </Badge>
        )}
        {issue.requiredByStatute && (
          <Badge variant="info" className="text-xs">
            From Statute
          </Badge>
        )}
        {issue.severity !== null && (
          <SeverityBadge severity={issue.severity} />
        )}
        {issue.analysis && (
          <TierBadge highestTierCompleted={issue.analysis.highestTierCompleted} />
        )}
        {issue.analysis?.federalMandateFound && (
          <Badge variant="danger" className="text-xs">
            Federal Mandate
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Badge
          variant={
            issue.reviewStatus === 'confirmed'
              ? 'success'
              : issue.reviewStatus === 'false_positive'
              ? 'default'
              : issue.reviewStatus === 'needs_context'
              ? 'warning'
              : issue.reviewStatus === 'deferred'
              ? 'info'
              : 'default'
          }
        >
          {issue.reviewStatus || 'unreviewed'}
        </Badge>
      </div>
    </div>
  );
}
