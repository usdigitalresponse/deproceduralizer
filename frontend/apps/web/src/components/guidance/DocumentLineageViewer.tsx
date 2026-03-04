'use client';

import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { GuidanceStatusBadge } from './GuidanceStatusBadge';
import { truncateTitle } from '@/lib/format';
import type { DocumentLineage, LineageNode } from '@deproceduralizer/database';

interface DocumentLineageViewerProps {
  lineage: DocumentLineage;
  state: string;
}

function TimelineNode({
  node,
  isCurrent,
  isLast,
  state,
}: {
  node: LineageNode;
  isCurrent: boolean;
  isLast: boolean;
  state: string;
}) {
  const refLabel = `${node.canonicalRef}${node.year ? ` (${node.year})` : ''}`;

  const content = (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold text-[var(--color-text)]">
          {refLabel}
        </span>
        {isCurrent && (
          <span className="text-xs text-[var(--color-primary)] font-medium">
            Current document
          </span>
        )}
      </div>
      <span className="text-sm text-[var(--color-text-secondary)]">
        {truncateTitle(node.title, 60)}
      </span>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-[var(--color-text-muted)]">
          {node.agency}
        </span>
        <GuidanceStatusBadge status={node.status} />
      </div>
    </div>
  );

  return (
    <div
      className={`relative pl-8 ${!isLast ? 'pb-6 border-l-2 border-[var(--color-neutral-200)]' : ''} ml-1.5`}
    >
      {/* Timeline circle */}
      <div
        className={`absolute left-0 top-1 w-3 h-3 rounded-full border-2 -translate-x-1/2 ${
          isCurrent
            ? 'bg-[var(--color-primary)] border-[var(--color-primary)]'
            : 'bg-[var(--color-surface)] border-[var(--color-neutral-300)]'
        }`}
      />

      {isCurrent ? (
        <div className="bg-[var(--color-primary-weaker)] rounded-[var(--radius-md)] p-2 -ml-2">
          {content}
        </div>
      ) : (
        <Link
          href={`/${state}/guidance/${node.id}`}
          className="block hover:bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] p-2 -ml-2 transition-colors"
        >
          {content}
        </Link>
      )}
    </div>
  );
}

export function DocumentLineageViewer({ lineage, state }: DocumentLineageViewerProps) {
  if (lineage.chain.length <= 1) return null;

  return (
    <Card padding="lg">
      <CardHeader>
        <CardTitle>Document Lineage</CardTitle>
        <CardDescription>
          {lineage.chain.length} documents in chain
        </CardDescription>
      </CardHeader>
      <div className="pt-4">
        {lineage.chain.map((node, i) => (
          <TimelineNode
            key={node.id}
            node={node}
            isCurrent={i === lineage.currentIndex}
            isLast={i === lineage.chain.length - 1}
            state={state}
          />
        ))}
      </div>
    </Card>
  );
}
