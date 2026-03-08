'use client';

import { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { X, ExternalLink, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { ISSUE_TYPE_LABELS } from '@/types/regulation';
import type { ComplianceHighlightMatch } from '@/lib/utils/complianceHighlights';

interface ComplianceIssuePopoverProps {
  highlight: ComplianceHighlightMatch;
  /** Additional data for display - verbatim text from the issue */
  verbatimText?: string | null;
  anchorRect: DOMRect;
  onClose: () => void;
  state: string;
  onShowInSidebar?: (issueId: number) => void;
}

/**
 * Popover that displays a compliance issue preview when a highlighted match is clicked.
 * Uses createPortal to render outside the normal DOM hierarchy.
 * Follows the same pattern as CrossRefPopover.
 */
export function ComplianceIssuePopover({
  highlight,
  verbatimText,
  anchorRect,
  onClose,
  state,
  onShowInSidebar,
}: ComplianceIssuePopoverProps) {
  // Handle click outside to close
  const handleClickOutside = useCallback((e: MouseEvent) => {
    const target = e.target as Element;
    if (!target.closest('.compliance-popover')) {
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

  // Calculate position - below the highlight, constrained to viewport
  const popoverWidth = 320;
  const popoverTop = anchorRect.bottom + 8;
  const popoverLeft = Math.max(
    8,
    Math.min(anchorRect.left, window.innerWidth - popoverWidth - 8)
  );

  // Render via portal
  if (typeof window === 'undefined') return null;

  const issueTypeLabel = ISSUE_TYPE_LABELS[highlight.issueType] || highlight.issueType;

  return createPortal(
    <div
      className="compliance-popover fixed z-50 bg-white rounded-[var(--radius-md)] shadow-lg border border-[var(--color-neutral-200)] p-3 w-80"
      style={{
        top: popoverTop,
        left: popoverLeft,
        maxWidth: 'calc(100vw - 16px)',
      }}
      role="dialog"
      aria-label={`Compliance issue: ${issueTypeLabel}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="warning" className="text-xs font-semibold">
            {issueTypeLabel}
          </Badge>
          {highlight.reviewStatus && (
            <Badge
              variant={
                highlight.reviewStatus === 'confirmed'
                  ? 'success'
                  : highlight.reviewStatus === 'needs_context'
                  ? 'warning'
                  : highlight.reviewStatus === 'deferred'
                  ? 'info'
                  : 'default'
              }
              className="text-xs"
            >
              {highlight.reviewStatus}
            </Badge>
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

      {/* Verbatim text snippet */}
      {verbatimText && (
        <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2 mb-3">
          {verbatimText}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2 border-t border-[var(--color-neutral-100)]">
        <Link
          href={
            highlight.guidanceDocumentId
              ? `/${state}/pipeline/guidance/${highlight.guidanceDocumentId}/${highlight.issueType}`
              : `/${state}/pipeline/${highlight.documentId}/${highlight.issueType}`
          }
          className="inline-flex items-center gap-1.5 text-sm text-[var(--color-link)] hover:text-[var(--color-link-hover)] hover:underline"
          onClick={onClose}
        >
          View full analysis
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
        <Link
          href={`/${state}/review/compliance/${highlight.issueId}`}
          className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:underline"
          onClick={onClose}
        >
          Review
        </Link>
        {onShowInSidebar && (
          <button
            onClick={() => {
              onShowInSidebar(highlight.issueId);
              onClose();
            }}
            className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
          >
            Show in sidebar
            <Eye className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>,
    document.body
  );
}

export default ComplianceIssuePopover;
