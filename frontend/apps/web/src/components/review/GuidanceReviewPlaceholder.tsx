import Link from 'next/link';
import { ArrowRight, ScrollText, CheckCircle, Eye, XCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import type { GuidanceStatusCounts } from '@/lib/actions/compliance-issues';

interface GuidanceReviewPlaceholderProps {
  jurisdiction: string;
  count: number;
  mode: 'review' | 'developer';
  statusCounts?: GuidanceStatusCounts;
}

export function GuidanceReviewPlaceholder({ jurisdiction, count, mode, statusCounts }: GuidanceReviewPlaceholderProps) {
  const hasStatusBreakdown = statusCounts && statusCounts.total > 0;

  return (
    <Card padding="lg">
      <CardHeader>
        <CardTitle>Guidance Compliance Issues</CardTitle>
      </CardHeader>
      <div className="pt-4 space-y-4">
        <div className="flex items-center gap-3 p-4 rounded-[var(--radius-lg)] bg-[var(--color-neutral-50)]">
          <div className="p-3 rounded-[var(--radius-lg)] bg-[var(--color-info-bg)]">
            <ScrollText className="w-6 h-6 text-[var(--color-info)]" />
          </div>
          <div>
            <p className="text-lg font-semibold text-[var(--color-text)]">
              {count} compliance {count === 1 ? 'analysis' : 'analyses'}
            </p>
            <p className="text-sm text-[var(--color-text-muted)]">
              Pipeline analyses from guidance documents in this jurisdiction
            </p>
          </div>
        </div>

        {/* Status breakdown */}
        {hasStatusBreakdown && (
          <div className="grid grid-cols-3 gap-3">
            <div className="flex items-center gap-2 p-3 rounded-[var(--radius-md)] bg-[var(--color-neutral-50)]">
              <Eye className="w-4 h-4 text-[var(--color-warning)]" />
              <div>
                <p className="text-sm font-semibold text-[var(--color-text)]">{statusCounts.unreviewed}</p>
                <p className="text-xs text-[var(--color-text-muted)]">Unreviewed</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-[var(--radius-md)] bg-[var(--color-neutral-50)]">
              <CheckCircle className="w-4 h-4 text-[var(--color-success)]" />
              <div>
                <p className="text-sm font-semibold text-[var(--color-text)]">{statusCounts.reviewed}</p>
                <p className="text-xs text-[var(--color-text-muted)]">Reviewed</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-[var(--radius-md)] bg-[var(--color-neutral-50)]">
              <XCircle className="w-4 h-4 text-[var(--color-text-muted)]" />
              <div>
                <p className="text-sm font-semibold text-[var(--color-text)]">{statusCounts.dismissed}</p>
                <p className="text-xs text-[var(--color-text-muted)]">Dismissed</p>
              </div>
            </div>
          </div>
        )}

        <p className="text-sm text-[var(--color-text-secondary)]">
          Guidance compliance issues are {mode === 'review' ? 'reviewed' : 'managed'} through the Pipeline page
          with the Guidance source tab selected. Each pipeline detail page shows the full analysis breakdown.
        </p>
        <Link
          href={`/${jurisdiction}/pipeline?source=guidance`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-strong)] hover:underline"
        >
          Go to Pipeline (Guidance)
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </Card>
  );
}
