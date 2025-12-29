'use client';

import Link from 'next/link';
import { ExternalLink, Link2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { CrossReferenceWithTarget, CrossReferenceWithSource } from '@deproceduralizer/database';
import { DEFAULT_STATE } from '@/types/state';

// Badge variant mapping for ref types
const REF_TYPE_LABELS: Record<string, { label: string; variant: 'default' | 'info' | 'warning' | 'success' }> = {
  nycrr: { label: 'NYCRR', variant: 'info' },
  njac: { label: 'NJAC', variant: 'info' },
  ny_short_form: { label: 'Short-form', variant: 'default' },
  same_section: { label: 'Internal', variant: 'default' },
};

interface CrossReferenceCardProps {
  /** Cross-reference with target document info (outgoing) */
  crossRef: CrossReferenceWithTarget;
  /** State for constructing links */
  state?: string;
  /** Whether to show in compact mode */
  compact?: boolean;
}

/**
 * Displays a single cross-reference with context and target link.
 */
export function CrossReferenceCard({
  crossRef,
  state = DEFAULT_STATE,
  compact = false,
}: CrossReferenceCardProps) {
  const refTypeInfo = REF_TYPE_LABELS[crossRef.refType] || { label: crossRef.refType, variant: 'default' as const };

  // Build target link if resolved
  const targetLink = crossRef.targetDocumentId
    ? `/${state}/regulations/${crossRef.targetDocumentId}`
    : null;

  // Truncate context if too long
  const contextBefore = crossRef.contextBefore
    ? (crossRef.contextBefore.length > 50 ? '...' + crossRef.contextBefore.slice(-50) : crossRef.contextBefore)
    : '';
  const contextAfter = crossRef.contextAfter
    ? (crossRef.contextAfter.length > 50 ? crossRef.contextAfter.slice(0, 50) + '...' : crossRef.contextAfter)
    : '';

  return (
    <Card padding={compact ? 'sm' : 'md'} className="hover:border-[var(--color-primary-weak)] transition-colors">
      <div className="flex items-start gap-3">
        <Link2 className="w-4 h-4 text-[var(--color-primary)] shrink-0 mt-0.5" />

        <div className="flex-1 min-w-0">
          {/* Citation text with context */}
          <div className="text-sm mb-2">
            <span className="text-[var(--color-text-muted)]">{contextBefore}</span>
            <span className="font-medium text-[var(--color-primary)] bg-[var(--color-primary-weaker)] px-1 rounded">
              {crossRef.rawText}
            </span>
            <span className="text-[var(--color-text-muted)]">{contextAfter}</span>
          </div>

          {/* Metadata row */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={refTypeInfo.variant}>{refTypeInfo.label}</Badge>

            {crossRef.isResolved ? (
              <Badge variant="success">Resolved</Badge>
            ) : (
              <Badge variant="warning">Unresolved</Badge>
            )}
          </div>

          {/* Target document info */}
          {crossRef.targetDocument && targetLink && (
            <div className="mt-3 pt-3 border-t border-[var(--color-neutral-100)]">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--color-text-muted)]">Links to:</span>
                <Link
                  href={targetLink}
                  className="text-sm text-[var(--color-link)] hover:text-[var(--color-link-hover)] hover:underline inline-flex items-center gap-1"
                >
                  {crossRef.targetDocument.citation || crossRef.targetDocument.shortTitle || 'View section'}
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
              {crossRef.targetDocument.title && !compact && (
                <p className="text-xs text-[var(--color-text-muted)] mt-1 truncate" title={crossRef.targetDocument.title}>
                  {crossRef.targetDocument.title}
                </p>
              )}
            </div>
          )}

          {/* Unresolved note */}
          {!crossRef.isResolved && crossRef.resolutionNotes && (
            <p className="text-xs text-[var(--color-text-muted)] mt-2 italic">
              {crossRef.resolutionNotes}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

interface IncomingReferenceCardProps {
  /** Cross-reference with source document info (incoming) */
  crossRef: CrossReferenceWithSource;
  /** State for constructing links */
  state?: string;
  /** Whether to show in compact mode */
  compact?: boolean;
}

/**
 * Displays an incoming reference (who cites this document).
 */
export function IncomingReferenceCard({
  crossRef,
  state = DEFAULT_STATE,
  compact = false,
}: IncomingReferenceCardProps) {
  const refTypeInfo = REF_TYPE_LABELS[crossRef.refType] || { label: crossRef.refType, variant: 'default' as const };

  // Build source link
  const sourceLink = `/${state}/regulations/${crossRef.sourceDocumentId}`;

  return (
    <Card padding={compact ? 'sm' : 'md'} className="hover:border-[var(--color-primary-weak)] transition-colors">
      <div className="flex items-start gap-3">
        <Link2 className="w-4 h-4 text-[var(--color-success)] shrink-0 mt-0.5" />

        <div className="flex-1 min-w-0">
          {/* Source document link */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-[var(--color-text-muted)]">Cited by:</span>
            <Link
              href={sourceLink}
              className="text-sm text-[var(--color-link)] hover:text-[var(--color-link-hover)] hover:underline inline-flex items-center gap-1"
            >
              {crossRef.sourceDocument.citation || crossRef.sourceDocument.shortTitle || 'View section'}
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>

          {/* Citation text */}
          <p className="text-sm text-[var(--color-text-secondary)] mb-2">
            <span className="font-medium">&ldquo;{crossRef.rawText}&rdquo;</span>
          </p>

          {/* Metadata */}
          <div className="flex items-center gap-2">
            <Badge variant={refTypeInfo.variant}>{refTypeInfo.label}</Badge>
          </div>

          {/* Full title */}
          {crossRef.sourceDocument.title && !compact && (
            <p className="text-xs text-[var(--color-text-muted)] mt-2 truncate" title={crossRef.sourceDocument.title}>
              {crossRef.sourceDocument.title}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

export default CrossReferenceCard;
