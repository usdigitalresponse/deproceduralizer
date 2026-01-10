import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { Badge, SeverityBadge } from '@/components/ui';
import type { RedFlagsSectionProps } from './types';

export function RedFlagsSection({ redFlags, state, documentId, currentUrl }: RedFlagsSectionProps) {
  if (!redFlags || redFlags.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-[var(--color-danger)]" />
        Red Flags ({redFlags.length})
      </h3>
      <div className="space-y-3">
        {redFlags.slice(0, 5).map((flag) => (
          <div
            key={flag.id}
            className="p-3 bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] border border-[var(--color-neutral-200)]"
          >
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="default" className="text-xs">{flag.category}</Badge>
              <SeverityBadge severity={flag.severity} className="text-xs" />
            </div>
            <p className="text-sm text-[var(--color-text)]">{flag.explanation}</p>
          </div>
        ))}
        {redFlags.length > 5 && (
          <Link
            href={`/${state}/regulations/${documentId}?from=${encodeURIComponent(currentUrl)}`}
            className="text-sm text-[var(--color-link)] hover:text-[var(--color-link-hover)]"
          >
            View all {redFlags.length} flags...
          </Link>
        )}
      </div>
    </div>
  );
}
