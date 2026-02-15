import { Badge, SeverityBadge, CopyLinkButton } from '@/components/ui';
import { getComplexityVariant, formatLabel } from '@/types/regulation';
import type { HeaderProps } from './types';

export function Header({ flag }: HeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 mb-4">
      <div className="flex items-center gap-3">
        <CopyLinkButton anchor={`flag-${flag.id}`} />
        <span className="font-semibold text-[var(--color-text)]">{formatLabel(flag.category)}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <span className="text-xs text-[var(--color-text-muted)]">Severity:</span>
          <SeverityBadge severity={flag.severity} />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-[var(--color-text-muted)]">Complexity:</span>
          <Badge variant={getComplexityVariant(flag.complexity)}>
            {flag.complexity}
          </Badge>
        </div>
        {flag.effortEstimate && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-[var(--color-text-muted)]">Effort:</span>
            <Badge variant="info">{flag.effortEstimate}</Badge>
          </div>
        )}
        {flag.reviewStatus && flag.reviewStatus !== 'unreviewed' && (
          <Badge
            variant={
              flag.reviewStatus === 'confirmed'
                ? 'success'
                : flag.reviewStatus === 'false_positive'
                ? 'default'
                : flag.reviewStatus === 'needs_context'
                ? 'warning'
                : flag.reviewStatus === 'deferred'
                ? 'info'
                : 'default'
            }
          >
            {flag.reviewStatus}
          </Badge>
        )}
      </div>
    </div>
  );
}
