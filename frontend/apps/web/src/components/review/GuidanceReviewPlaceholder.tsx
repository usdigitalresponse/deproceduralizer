import Link from 'next/link';
import { ArrowRight, ScrollText } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';

interface GuidanceReviewPlaceholderProps {
  jurisdiction: string;
  count: number;
  mode: 'review' | 'developer';
}

export function GuidanceReviewPlaceholder({ jurisdiction, count, mode }: GuidanceReviewPlaceholderProps) {
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
              {count} compliance {count === 1 ? 'issue' : 'issues'}
            </p>
            <p className="text-sm text-[var(--color-text-muted)]">
              Found in guidance documents for this jurisdiction
            </p>
          </div>
        </div>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Guidance compliance issues are {mode === 'review' ? 'reviewed' : 'managed'} through the Pipeline page
          with the Guidance source tab selected.
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
