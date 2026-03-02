'use client';

import Link from 'next/link';
import { ArrowDown } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { GuidanceStatusBadge } from './GuidanceStatusBadge';
import type { SupersedureLink } from '@/lib/actions/guidance-documents';

interface SupersedureChainProps {
  links: SupersedureLink[];
  state: string;
}

const RELATIONSHIP_LABELS: Record<string, string> = {
  supersedes: 'Supersedes',
  superseded_by: 'Superseded by',
  revision_of: 'Revision of',
};

export function SupersedureChain({ links, state }: SupersedureChainProps) {
  if (links.length === 0) return null;

  // Sort: supersedes first (older docs), then revision_of, then superseded_by (newer docs)
  const order: Record<string, number> = { supersedes: 0, revision_of: 1, superseded_by: 2 };
  const sorted = [...links].sort((a, b) => (order[a.relationship] ?? 1) - (order[b.relationship] ?? 1));

  return (
    <Card padding="lg">
      <CardHeader>
        <CardTitle>Document Lineage</CardTitle>
      </CardHeader>
      <div className="pt-4 space-y-3">
        {sorted.map((link, i) => (
          <div key={`${link.canonicalRef}-${i}`}>
            <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] mb-1">
              <ArrowDown className="h-3 w-3" />
              <span>{RELATIONSHIP_LABELS[link.relationship] ?? link.relationship}</span>
            </div>
            <div className="ml-5 flex items-center gap-2">
              {link.id ? (
                <Link
                  href={`/${state}/guidance/${link.id}`}
                  className="text-sm text-[var(--color-primary)] hover:underline"
                >
                  {link.title ?? link.canonicalRef}
                </Link>
              ) : (
                <span className="text-sm text-[var(--color-text-secondary)]">
                  {link.title ?? link.canonicalRef}
                </span>
              )}
              {link.status && <GuidanceStatusBadge status={link.status} />}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
