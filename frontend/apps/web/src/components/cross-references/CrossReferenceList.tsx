'use client';

import type { CrossReferenceWithTarget, CrossReferenceWithSource } from '@deproceduralizer/database';
import { CrossReferenceCard, IncomingReferenceCard } from './CrossReferenceCard';
import { Link2 } from 'lucide-react';
import type { StateCode } from '@/types/state';

interface CrossReferenceListProps {
  crossRefs: CrossReferenceWithTarget[];
  state: StateCode;
  title?: string;
  compact?: boolean;
}

export function CrossReferenceList({
  crossRefs,
  state,
  title = 'Cross-References',
  compact = false
}: CrossReferenceListProps) {
  if (crossRefs.length === 0) {
    return null;
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2 flex items-center gap-2">
        <Link2 className="w-4 h-4 text-[var(--color-primary)]" />
        {title} ({crossRefs.length})
      </h3>
      <div className="space-y-2">
        {crossRefs.map((ref) => (
          <CrossReferenceCard
            key={ref.id}
            crossRef={ref}
            state={state}
            compact={compact}
          />
        ))}
      </div>
    </div>
  );
}

interface IncomingReferenceListProps {
  incomingRefs: CrossReferenceWithSource[];
  state: StateCode;
  title?: string;
  compact?: boolean;
}

export function IncomingReferenceList({
  incomingRefs,
  state,
  title = 'Cited By',
  compact = false
}: IncomingReferenceListProps) {
  if (incomingRefs.length === 0) {
    return null;
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2 flex items-center gap-2">
        <Link2 className="w-4 h-4 text-[var(--color-success)]" />
        {title} ({incomingRefs.length})
      </h3>
      <div className="space-y-2">
        {incomingRefs.map((ref) => (
          <IncomingReferenceCard
            key={ref.id}
            crossRef={ref}
            state={state}
            compact={compact}
          />
        ))}
      </div>
    </div>
  );
}
