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
      <ul className="space-y-0.5">
        {citations.map((citation) => (
          <li key={citation.citationText} className="text-xs">
            {citation.regulationId ? (
              <Link
                href={`/${state}/regulations/${citation.regulationId}`}
                className="text-[var(--color-link)] hover:text-[var(--color-link-hover)] hover:underline"
                title={citation.regulationTitle ?? undefined}
              >
                {citation.citationText}
              </Link>
            ) : (
              <span className="text-[var(--color-text)]">{citation.citationText}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
