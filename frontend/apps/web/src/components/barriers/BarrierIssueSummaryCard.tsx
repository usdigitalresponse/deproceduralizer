import Link from 'next/link';
import { Badge, SeverityBadge, ReviewStatusBadge } from '@/components/ui';
import { BARRIER_CATEGORY_LABELS } from '@/lib/constants/barrier';
import type { BarrierIssue } from '@deproceduralizer/database';

interface BarrierIssueSummaryCardProps {
  issue: BarrierIssue;
  state: string;
}

export function BarrierIssueSummaryCard({ issue, state }: BarrierIssueSummaryCardProps) {
  const categoryLabel = BARRIER_CATEGORY_LABELS[issue.category] ?? issue.category;
  const firstExample = issue.textExamples?.[0];

  return (
    <div className="border rounded-[var(--radius-md)] p-3 border-[var(--color-neutral-200)] bg-white hover:border-[var(--color-neutral-300)] transition-colors">
      {/* Header: Category + severity + review status */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant="default" className="text-xs font-semibold">
            {categoryLabel}
          </Badge>
          <SeverityBadge severity={issue.severity} />
        </div>
        <ReviewStatusBadge
          status={issue.reviewStatus}
          className="text-xs flex-shrink-0"
        />
      </div>

      {/* Body: Text example or explanation excerpt */}
      <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2 mb-2">
        {firstExample ?? issue.explanation}
      </p>

      {/* Expandable: Explanation or implementation approach */}
      {firstExample && issue.explanation && (
        <details className="mb-2">
          <summary className="text-xs text-[var(--color-text-muted)] cursor-pointer hover:text-[var(--color-text-secondary)]">
            Explanation
          </summary>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1 line-clamp-4">
            {issue.explanation}
          </p>
        </details>
      )}
      {issue.implementationApproach && (
        <details className="mb-2">
          <summary className="text-xs text-[var(--color-text-muted)] cursor-pointer hover:text-[var(--color-text-secondary)]">
            Implementation approach
          </summary>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1 line-clamp-4">
            {issue.implementationApproach}
          </p>
        </details>
      )}

      {/* Footer: Link to review queue */}
      <Link
        href={`/${state}/review?type=barriers&category=${issue.category}`}
        className="text-xs text-[var(--color-link)] hover:text-[var(--color-link-hover)] hover:underline"
      >
        View in review queue &rarr;
      </Link>
    </div>
  );
}
