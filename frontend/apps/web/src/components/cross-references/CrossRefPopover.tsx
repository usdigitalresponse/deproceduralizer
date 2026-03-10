'use client';

import { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { X, ExternalLink, Link2, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import type { CrossRefMatch } from '@/hooks/useCrossRefHighlighting';
import { getCrossRefTargetUrl, getCrossRefLinkText } from '@/lib/cross-ref-url';
import { CROSSREF_REF_TYPE_LABELS } from '@/lib/constants/values';

interface CrossRefPopoverProps {
  /** The cross-reference match to display */
  crossRef: CrossRefMatch;
  /** The bounding rect of the clicked citation for positioning */
  anchorRect: DOMRect;
  /** Callback when popover should close */
  onClose: () => void;
  /** State for constructing regulation links (e.g., 'ny', 'nj') */
  state: string;
}

/**
 * Popover that displays a cross-reference preview when a highlighted citation is clicked.
 * Uses createPortal to render outside the normal DOM hierarchy.
 */
export function CrossRefPopover({
  crossRef,
  anchorRect,
  onClose,
  state,
}: CrossRefPopoverProps) {
  // Handle click outside to close
  const handleClickOutside = useCallback((e: MouseEvent) => {
    const target = e.target as Element;
    if (!target.closest('.crossref-popover')) {
      onClose();
    }
  }, [onClose]);

  // Handle escape key to close
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  // Set up event listeners
  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleClickOutside, handleKeyDown]);

  // Calculate position - below the citation, constrained to viewport
  const popoverWidth = 320;
  const popoverTop = anchorRect.bottom + 8;
  const popoverLeft = Math.max(
    8,
    Math.min(anchorRect.left, window.innerWidth - popoverWidth - 8)
  );

  // Render via portal
  if (typeof window === 'undefined') return null;

  return createPortal(
    <div
      className="crossref-popover fixed z-50 bg-white rounded-[var(--radius-md)] shadow-lg border border-[var(--color-neutral-200)] p-3 w-80"
      style={{
        top: popoverTop,
        left: popoverLeft,
        maxWidth: `calc(100vw - 16px)`,
      }}
      role="dialog"
      aria-label={`Cross-reference: ${crossRef.rawText}`}
    >
      {/* Header - show full citation if available, otherwise show matched text */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1">
          <code className="text-sm font-mono text-[var(--color-text)] bg-[var(--color-neutral-100)] px-1.5 py-0.5 rounded">
            {crossRef.targetCitation || crossRef.rawText}
          </code>
          {/* Show what was matched if different from target citation (for abbreviated refs) */}
          {crossRef.targetCitation && crossRef.rawText !== crossRef.targetCitation && (
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              Matched: <code className="font-mono">{crossRef.rawText}</code>
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)] rounded-[var(--radius-sm)] hover:bg-[var(--color-neutral-100)] transition-colors flex-shrink-0"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Status badge */}
      <div className="flex items-center gap-2 mb-2">
        {crossRef.isResolved ? (
          <Badge variant="success">Resolved</Badge>
        ) : (
          <Badge variant="warning">Unresolved</Badge>
        )}
        <Badge variant="default">
          {CROSSREF_REF_TYPE_LABELS[crossRef.refType] ?? crossRef.refType}
        </Badge>
      </div>

      {/* Target document info */}
      {crossRef.isResolved && (crossRef.targetDocumentId || crossRef.targetGuidanceId) ? (
        <div className="space-y-2">
          {/* Target title */}
          <div className="flex items-start gap-2">
            <Link2 className="w-4 h-4 text-[var(--color-text-muted)] mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--color-text)] line-clamp-2">
                {crossRef.targetTitle || 'Referenced Document'}
              </p>
              {crossRef.targetCitation && (
                <p className="text-xs font-mono text-[var(--color-text-muted)] mt-0.5">
                  {crossRef.targetCitation}
                </p>
              )}
            </div>
          </div>

          {/* Link to target document - opens in new tab */}
          <div className="pt-2 border-t border-[var(--color-neutral-100)]">
            <Link
              href={getCrossRefTargetUrl(state, crossRef)!}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-[var(--color-link)] hover:text-[var(--color-link-hover)] hover:underline"
              onClick={onClose}
            >
              {getCrossRefLinkText(crossRef)}
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2 text-[var(--color-text-muted)]">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <p className="text-sm italic">
            This reference could not be resolved to a document in the database.
          </p>
        </div>
      )}
    </div>,
    document.body
  );
}

export default CrossRefPopover;
