'use client';

import Link from 'next/link';
import type { CrossReferenceWithTarget, CrossReferenceWithSource } from '@deproceduralizer/database';
import { Badge } from '@/components/ui';
import { ExternalLink, Link2 } from 'lucide-react';
import type { StateCode } from '@/types/state';

interface CrossReferenceCardProps {
  crossRef: CrossReferenceWithTarget;
  state: StateCode;
  compact?: boolean;
}

const REF_TYPE_LABELS: Record<string, string> = {
  nycrr: 'NYCRR',
  njac: 'NJAC',
  ny_short_form: 'Short Form',
  same_section: 'Internal',
};

export function CrossReferenceCard({ crossRef, state, compact = false }: CrossReferenceCardProps) {
  const targetDoc = crossRef.targetDocument;
  const refTypeLabel = REF_TYPE_LABELS[crossRef.refType] || crossRef.refType;

  if (compact) {
    return (
      <div className="p-2 bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] border border-[var(--color-neutral-200)]">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <code className="text-xs text-[var(--color-text-secondary)] bg-[var(--color-neutral-100)] px-1 py-0.5 rounded">
              {crossRef.rawText}
            </code>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="default" className="text-xs">
              {refTypeLabel}
            </Badge>
            {targetDoc && crossRef.isResolved && (
              <Link
                href={`/${state}/regulations/${targetDoc.id}`}
                className="text-[var(--color-link)] hover:text-[var(--color-link-hover)]"
                title={targetDoc.title || targetDoc.shortTitle || undefined}
              >
                <ExternalLink className="w-3 h-3" />
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] border border-[var(--color-neutral-200)]">
      <div className="flex items-start justify-between gap-2 mb-2">
        <code className="text-sm text-[var(--color-text-secondary)] bg-[var(--color-neutral-100)] px-1.5 py-0.5 rounded">
          {crossRef.rawText}
        </code>
        <Badge variant="default" className="text-xs shrink-0">
          {refTypeLabel}
        </Badge>
      </div>
      {targetDoc && crossRef.isResolved ? (
        <Link
          href={`/${state}/regulations/${targetDoc.id}`}
          className="text-sm text-[var(--color-link)] hover:text-[var(--color-link-hover)] flex items-center gap-1"
        >
          <Link2 className="w-3 h-3" />
          {targetDoc.shortTitle || targetDoc.title}
        </Link>
      ) : (
        <p className="text-sm text-[var(--color-text-muted)] italic">
          {crossRef.resolutionNotes || 'Unresolved reference'}
        </p>
      )}
      {crossRef.contextBefore && (
        <p className="text-xs text-[var(--color-text-muted)] mt-1 line-clamp-1">
          ...{crossRef.contextBefore}
        </p>
      )}
    </div>
  );
}

interface IncomingReferenceCardProps {
  crossRef: CrossReferenceWithSource;
  state: StateCode;
  compact?: boolean;
}

export function IncomingReferenceCard({ crossRef, state, compact = false }: IncomingReferenceCardProps) {
  const sourceDoc = crossRef.sourceDocument;
  const refTypeLabel = REF_TYPE_LABELS[crossRef.refType] || crossRef.refType;

  if (compact) {
    return (
      <div className="p-2 bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] border border-[var(--color-neutral-200)]">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <Link
              href={`/${state}/regulations/${sourceDoc.id}`}
              className="text-sm text-[var(--color-link)] hover:text-[var(--color-link-hover)] truncate block"
              title={sourceDoc.title || sourceDoc.shortTitle || undefined}
            >
              {sourceDoc.shortTitle || sourceDoc.title}
            </Link>
          </div>
          <Badge variant="default" className="text-xs shrink-0">
            {refTypeLabel}
          </Badge>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] border border-[var(--color-neutral-200)]">
      <div className="flex items-start justify-between gap-2 mb-2">
        <Link
          href={`/${state}/regulations/${sourceDoc.id}`}
          className="text-sm text-[var(--color-link)] hover:text-[var(--color-link-hover)] flex items-center gap-1"
        >
          <Link2 className="w-3 h-3" />
          {sourceDoc.shortTitle || sourceDoc.title}
        </Link>
        <Badge variant="default" className="text-xs shrink-0">
          {refTypeLabel}
        </Badge>
      </div>
      <code className="text-xs text-[var(--color-text-muted)] bg-[var(--color-neutral-100)] px-1 py-0.5 rounded">
        {crossRef.rawText}
      </code>
      {crossRef.contextBefore && (
        <p className="text-xs text-[var(--color-text-muted)] mt-1 line-clamp-1">
          ...{crossRef.contextBefore}
        </p>
      )}
    </div>
  );
}
