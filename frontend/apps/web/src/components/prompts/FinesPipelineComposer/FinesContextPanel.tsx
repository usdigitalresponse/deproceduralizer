'use client';

import { Card } from '@/components/ui/Card';
import { Building2, FileText, Ruler, Hash, Loader2 } from 'lucide-react';
import type { FinesContextMetadata } from './types';

interface FinesContextPanelProps {
  context: FinesContextMetadata | null;
  isLoading?: boolean;
}

export function FinesContextPanel({
  context,
  isLoading = false,
}: FinesContextPanelProps) {
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
            {context.sourceType}
          </span>
          <span className="text-xs px-2 py-0.5 bg-[var(--color-neutral-100)] text-[var(--color-text-secondary)] rounded uppercase">
            {context.jurisdiction}
          </span>
        </div>
      </div>

      {/* Context stats */}
      <div className="space-y-3">
        <ContextStat
          icon={<Building2 className="w-4 h-4 text-[var(--color-primary)]" />}
          label="Responsible Agency"
          value={context.responsibleAgency || 'Unknown'}
        />

        {context.nycrTitle && (
          <ContextStat
            icon={<Hash className="w-4 h-4 text-[var(--color-success)]" />}
            label="NYCRR Title"
            value={String(context.nycrTitle)}
          />
        )}

        <ContextStat
          icon={<FileText className="w-4 h-4 text-[var(--color-info)]" />}
          label="Content"
          value={`${context.contentLength.toLocaleString()} chars${context.wasWindowed ? ' (windowed)' : ''}`}
        />

        <ContextStat
          icon={<Ruler className="w-4 h-4 text-[var(--color-warning)]" />}
          label="Matched Patterns"
          value={String(context.matchedPatterns.length)}
        />
      </div>

      {/* Matched patterns detail */}
      {context.matchedPatterns.length > 0 && (
        <div className="mt-4 pt-4 border-t border-[var(--color-neutral-100)]">
          <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-2 uppercase tracking-wide">
            Regex Patterns Matched
          </p>
          <div className="space-y-1">
            {context.matchedPatterns.map((pattern, i) => (
              <div
                key={i}
                className="text-xs font-mono px-2 py-1 bg-[var(--color-neutral-50)] text-[var(--color-text-secondary)] rounded"
              >
                {pattern}
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
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className="text-sm text-[var(--color-text)]">{label}</span>
          <span className="text-sm font-medium text-[var(--color-text)] text-right max-w-[60%] truncate" title={value}>
            {value}
          </span>
        </div>
      </div>
    </div>
  );
}
