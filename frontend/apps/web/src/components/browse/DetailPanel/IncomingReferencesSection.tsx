import Link from 'next/link';
import { IncomingReferenceCard } from '@/components/cross-references';
import { EntityTypeIndicator } from '@/components/ui';
import type { IncomingReferencesSectionProps } from './types';

export function IncomingReferencesSection({ refs, state, documentId, currentUrl }: IncomingReferencesSectionProps) {
  if (refs.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2 flex items-center gap-2">
        <EntityTypeIndicator type="cross_reference" size="sm" />
        Cited By ({refs.length})
      </h3>
      <div className="space-y-2">
        {refs.slice(0, 3).map((ref) => (
          <IncomingReferenceCard
            key={ref.id}
            crossRef={ref}
            state={state}
            compact
          />
        ))}
        {refs.length > 3 && (
          <Link
            href={`/${state}/regulations/${documentId}?from=${encodeURIComponent(currentUrl)}`}
            className="text-sm text-[var(--color-link)] hover:text-[var(--color-link-hover)]"
          >
            View all {refs.length} citing documents...
          </Link>
        )}
      </div>
    </div>
  );
}
