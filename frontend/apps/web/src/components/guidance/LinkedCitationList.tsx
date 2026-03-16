'use client';

import Link from 'next/link';
import type { ResolvedRegulationCitation } from '@/lib/actions/guidance-documents';

interface LinkedCitationListProps {
  citations: ResolvedRegulationCitation[];
  state: string;
}

export function LinkedCitationList({ citations, state }: LinkedCitationListProps) {
  if (citations.length === 0) return null;

  return (
    <div className="py-2 border-b border-[var(--color-neutral-100)] last:border-b-0">
      <span className="text-xs font-medium text-[var(--color-text-muted)] block mb-1">Cited Regulations</span>
      <div className="flex flex-wrap gap-1.5">
        {citations.map((citation) => (
          citation.regulationId ? (
            <Link
              key={citation.citationText}
              href={`/${state}/regulations/${citation.regulationId}`}
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono bg-[var(--color-primary-weaker)] text-[var(--color-primary)] hover:bg-[var(--color-primary-weak)] transition-colors"
              title={citation.regulationTitle ?? undefined}
            >
              {citation.citationText}
            </Link>
          ) : (
            <span
              key={citation.citationText}
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono bg-[var(--color-neutral-100)] text-[var(--color-text-muted)]"
            >
              {citation.citationText}
            </span>
          )
        ))}
      </div>
    </div>
  );
}
