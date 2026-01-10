import Link from 'next/link';
import { Link2 } from 'lucide-react';
import { CrossReferenceCard } from '@/components/cross-references';
import type { CrossReferencesSectionProps } from './types';

export function CrossReferencesSection({ refs, state, documentId, currentUrl }: CrossReferencesSectionProps) {
  if (refs.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2 flex items-center gap-2">
        <Link2 className="w-4 h-4 text-[var(--color-primary)]" />
        Cross-References ({refs.length})
      </h3>
      <div className="space-y-2">
        {refs.slice(0, 3).map((ref) => (
          <CrossReferenceCard
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
            View all {refs.length} cross-references...
          </Link>
        )}
      </div>
    </div>
  );
}
