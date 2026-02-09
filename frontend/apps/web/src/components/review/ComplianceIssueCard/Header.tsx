import { ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui';
import { OutcomeBadges } from '@/components/issues/OutcomeBadges';
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
        <OutcomeBadges
          analysis={issue.analysis}
          requirementFound={issue.requirementFound}
          requiredByStatute={issue.requiredByStatute}
          severity={issue.severity}
          originalSeverity={issue.originalSeverity}
          showTierBadge
          showFinalClassification
          showFederalMandate
          showEasyCleanup
          showSeverity
        />
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
