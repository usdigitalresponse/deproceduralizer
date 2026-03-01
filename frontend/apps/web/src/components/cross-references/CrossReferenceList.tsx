'use client';

import { EntityTypeIndicator } from '@/components/ui';
import { CrossReferenceCard, IncomingReferenceCard } from './CrossReferenceCard';
import type { CrossReferenceWithTarget, CrossReferenceWithSource } from '@deproceduralizer/database';
import { DEFAULT_JURISDICTION } from '@/types/state';

interface CrossReferenceListProps {
  /** Outgoing cross-references from this document */
  crossRefs: CrossReferenceWithTarget[];
  /** State for constructing links */
  state?: string;
  /** Whether to show in compact mode */
  compact?: boolean;
  /** Maximum items to show (0 = all) */
  limit?: number;
  /** Title override */
  title?: string;
}

/**
 * Displays a list of outgoing cross-references (citations from this document to others).
 */
export function CrossReferenceList({
  crossRefs,
  state = DEFAULT_JURISDICTION,
  compact = false,
  limit = 0,
  title = 'Cross-References',
}: CrossReferenceListProps) {
  const displayRefs = limit > 0 ? crossRefs.slice(0, limit) : crossRefs;
  const hasMore = limit > 0 && crossRefs.length > limit;

  if (crossRefs.length === 0) {
    return (
      <div className="text-sm text-[var(--color-text-muted)] py-4 text-center">
        No cross-references found in this document.
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <EntityTypeIndicator type="cross_reference" size="md" />
        <h3 className="text-sm font-semibold text-[var(--color-text)]">
          {title} ({crossRefs.length})
        </h3>
      </div>

      <div className="space-y-3">
        {displayRefs.map((ref) => (
          <CrossReferenceCard
            key={ref.id}
            crossRef={ref}
            state={state}
            compact={compact}
          />
        ))}
      </div>

      {hasMore && (
        <p className="text-xs text-[var(--color-text-muted)] mt-3 text-center">
          +{crossRefs.length - limit} more cross-references
        </p>
      )}
    </div>
  );
}

interface IncomingReferenceListProps {
  /** Incoming cross-references to this document */
  crossRefs: CrossReferenceWithSource[];
  /** State for constructing links */
  state?: string;
  /** Whether to show in compact mode */
  compact?: boolean;
  /** Maximum items to show (0 = all) */
  limit?: number;
  /** Title override */
  title?: string;
}

/**
 * Displays a list of incoming references (documents that cite this one).
 */
export function IncomingReferenceList({
  crossRefs,
  state = DEFAULT_JURISDICTION,
  compact = false,
  limit = 0,
  title = 'Cited By',
}: IncomingReferenceListProps) {
  const displayRefs = limit > 0 ? crossRefs.slice(0, limit) : crossRefs;
  const hasMore = limit > 0 && crossRefs.length > limit;

  if (crossRefs.length === 0) {
    return (
      <div className="text-sm text-[var(--color-text-muted)] py-4 text-center">
        No documents cite this section.
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <EntityTypeIndicator type="cross_reference" size="md" />
        <h3 className="text-sm font-semibold text-[var(--color-text)]">
          {title} ({crossRefs.length})
        </h3>
      </div>

      <div className="space-y-3">
        {displayRefs.map((ref) => (
          <IncomingReferenceCard
            key={ref.id}
            crossRef={ref}
            state={state}
            compact={compact}
          />
        ))}
      </div>

      {hasMore && (
        <p className="text-xs text-[var(--color-text-muted)] mt-3 text-center">
          +{crossRefs.length - limit} more citing documents
        </p>
      )}
    </div>
  );
}

export default CrossReferenceList;
