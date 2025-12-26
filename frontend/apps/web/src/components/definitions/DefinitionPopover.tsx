'use client';

import { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { X, BookOpen, ExternalLink, ArrowDown } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import type { ApplicableDefinition } from '@deproceduralizer/database';
import { formatNycrrCitation } from '@/lib/formatters/nycrr';

interface DefinitionPopoverProps {
  /** The definition to display */
  definition: ApplicableDefinition;
  /** The matched term text as it appears in the content */
  term: string;
  /** The bounding rect of the clicked term for positioning */
  anchorRect: DOMRect;
  /** Callback when popover should close */
  onClose: () => void;
  /** State for constructing regulation links (e.g., 'ny') */
  state: string;
  /** Current document ID to determine if definition is local */
  currentDocumentId?: number;
}

/**
 * Capitalize the first letter of a string
 */
function capitalizeFirst(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Get the primary display definition text based on verbatim/rephrased logic.
 */
function getDisplayDefinitionText(definition: ApplicableDefinition): string {
  const text = definition.isVerbatimTextComplete
    ? definition.verbatimText
    : (definition.rephrasedDefinition ?? definition.verbatimText);
  return capitalizeFirst(text);
}

/**
 * Popover that displays a definition preview when a highlighted term is clicked.
 * Uses createPortal to render outside the normal DOM hierarchy.
 */
export function DefinitionPopover({
  definition,
  term,
  anchorRect,
  onClose,
  state,
  currentDocumentId,
}: DefinitionPopoverProps) {
  // Check if this is a local definition (defined in current document)
  const isLocalDefinition = currentDocumentId !== undefined &&
    definition.documentId === currentDocumentId;

  // Handle scroll to definition
  const handleScrollToDefinition = useCallback(() => {
    const definitionElement = document.getElementById(`definition-${definition.id}`);
    if (definitionElement) {
      onClose();
      definitionElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Brief highlight effect
      definitionElement.classList.add('ring-2', 'ring-[var(--color-info)]');
      setTimeout(() => {
        definitionElement.classList.remove('ring-2', 'ring-[var(--color-info)]');
      }, 2000);
    }
  }, [definition.id, onClose]);
  // Handle click outside to close
  const handleClickOutside = useCallback((e: MouseEvent) => {
    const target = e.target as Element;
    if (!target.closest('.definition-popover')) {
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

  // Calculate position - below the term, constrained to viewport
  const popoverWidth = 320;
  const popoverTop = anchorRect.bottom + 8;
  const popoverLeft = Math.max(
    8,
    Math.min(anchorRect.left, window.innerWidth - popoverWidth - 8)
  );

  // Get definition text (truncated for preview)
  const definitionText = getDisplayDefinitionText(definition);
  const maxLength = 200;
  const displayText = definitionText.length > maxLength
    ? definitionText.slice(0, maxLength) + '...'
    : definitionText;

  // Get regulation link
  const regulationLink = definition.regulation
    ? `/${state}/regulations/${definition.regulation.id}`
    : null;

  // Format citation
  const citation = definition.regulation
    ? formatNycrrCitation(
        definition.regulation.nycrrTitle,
        definition.regulation.nycrrPart,
        definition.regulation.nycrrSection
      )
    : null;

  // Render via portal
  if (typeof window === 'undefined') return null;

  return createPortal(
    <div
      className="definition-popover fixed z-50 bg-white rounded-[var(--radius-md)] shadow-lg border border-[var(--color-neutral-200)] p-3 w-80"
      style={{
        top: popoverTop,
        left: popoverLeft,
        maxWidth: `calc(100vw - 16px)`,
      }}
      role="dialog"
      aria-label={`Definition of ${term}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold text-[var(--color-text)] flex-1">
          {term}
        </h3>
        <button
          onClick={onClose}
          className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)] rounded-[var(--radius-sm)] hover:bg-[var(--color-neutral-100)] transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Badges */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        {definition.scopeLevel && (
          <Badge variant="info">{definition.scopeLevel}</Badge>
        )}
        {definition.definitionType && (
          <Badge variant="default">{definition.definitionType}</Badge>
        )}
        {definition.isCrossReference && (
          <Badge variant="warning">Cross-reference</Badge>
        )}
      </div>

      {/* Definition text */}
      <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
        {displayText}
      </p>

      {/* Source/navigation link */}
      {(isLocalDefinition || regulationLink) && (
        <div className="mt-3 pt-3 border-t border-[var(--color-neutral-100)]">
          <div className="flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5 text-[var(--color-text-muted)] flex-shrink-0" />
            <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
              {citation && (
                <span className="text-xs font-mono text-[var(--color-text-muted)]">
                  {citation}
                </span>
              )}
              {isLocalDefinition ? (
                <button
                  onClick={handleScrollToDefinition}
                  className="text-xs text-[var(--color-link)] hover:text-[var(--color-link-hover)] hover:underline inline-flex items-center gap-1"
                >
                  Go to definition
                  <ArrowDown className="w-3 h-3" />
                </button>
              ) : regulationLink && (
                <Link
                  href={regulationLink}
                  className="text-xs text-[var(--color-link)] hover:text-[var(--color-link-hover)] hover:underline inline-flex items-center gap-1"
                  onClick={onClose}
                >
                  View source
                  <ExternalLink className="w-3 h-3" />
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}

export default DefinitionPopover;
