'use client';

import { Card } from '@/components/ui/Card';
import { GitBranch, Users, BookOpen, Link2, Loader2 } from 'lucide-react';
import type { BarrierContextMetadata } from './types';

interface DocumentContextPanelProps {
  context: BarrierContextMetadata | null;
  isLoading?: boolean;
}

export function DocumentContextPanel({
  context,
  isLoading = false,
}: DocumentContextPanelProps) {
  if (isLoading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary)]" />
        </div>
      </Card>
    );
  }

  if (!context) {
    return (
      <Card>
        <div className="text-center py-12 text-[var(--color-text-muted)] text-sm">
          Context metadata will appear here
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <h3 className="font-semibold text-[var(--color-text)] mb-4">
        Document Context
      </h3>

      {/* Document info */}
      <div className="mb-4 pb-4 border-b border-[var(--color-neutral-100)]">
        <p className="text-sm font-medium text-[var(--color-text)]">
          {context.documentCitation || context.documentTitle}
        </p>
        {context.documentCitation && (
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            {context.documentTitle}
          </p>
        )}
        <div className="flex gap-2 mt-2">
          <span className="text-xs px-2 py-0.5 bg-[var(--color-neutral-100)] text-[var(--color-text-secondary)] rounded">
            {context.documentHierarchyLevel}
          </span>
          <span className="text-xs px-2 py-0.5 bg-[var(--color-neutral-100)] text-[var(--color-text-secondary)] rounded uppercase">
            {context.jurisdiction}
          </span>
        </div>
      </div>

      {/* Context stats */}
      <div className="space-y-3">
        <ContextStat
          icon={<GitBranch className="w-4 h-4 text-[var(--color-primary)]" />}
          label="Ancestor Chain"
          value={context.ancestorChain.length}
          detail={
            context.ancestorChain.length > 0
              ? context.ancestorChain.map((a) => `${a.level}: ${a.citation || a.title}`).join(' > ')
              : undefined
          }
        />

        <ContextStat
          icon={<Users className="w-4 h-4 text-[var(--color-success)]" />}
          label="Sibling Sections"
          value={context.siblingCount}
        />

        <ContextStat
          icon={<BookOpen className="w-4 h-4 text-[var(--color-warning)]" />}
          label="Definitions"
          value={context.definitionCount}
        />

        <ContextStat
          icon={<Link2 className="w-4 h-4 text-[var(--color-info)]" />}
          label="Cross-References"
          value={context.crossRefCount}
        />
      </div>

      {/* Ancestor chain detail */}
      {context.ancestorChain.length > 0 && (
        <div className="mt-4 pt-4 border-t border-[var(--color-neutral-100)]">
          <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-2 uppercase tracking-wide">
            Hierarchy Path
          </p>
          <div className="space-y-1">
            {context.ancestorChain.map((ancestor, i) => (
              <div
                key={i}
                className="flex items-baseline gap-2 text-xs"
                style={{ paddingLeft: `${i * 12}px` }}
              >
                <span className="text-[var(--color-text-muted)]">
                  {ancestor.level}:
                </span>
                <span className="text-[var(--color-text)]">
                  {ancestor.citation || ancestor.title}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function ContextStat({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  detail?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className="text-sm text-[var(--color-text)]">{label}</span>
          <span className="text-sm font-medium text-[var(--color-text)]">{value}</span>
        </div>
        {detail && (
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate" title={detail}>
            {detail}
          </p>
        )}
      </div>
    </div>
  );
}
