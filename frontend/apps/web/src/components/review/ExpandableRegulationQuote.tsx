'use client';

import { useState, useCallback, ReactNode } from 'react';
import { getExpandedContext } from '@/lib/actions/compliance-issues';
import { Button } from '@/components/ui';
import { highlightTerm as highlightTermInText } from '@/lib/utils/highlight';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface ExpandableRegulationQuoteProps {
  /** The quote/snippet text to display */
  text: string;
  /** Label to display above the quote (e.g., "Regulation Text", "Explanation") */
  label: string;
  /** Document ID for fetching expanded context */
  documentId: number;
  /** Optional term to highlight in the text */
  highlightTerm?: string | null;
  /** Border color variant */
  variant?: 'default' | 'warning' | 'danger' | 'info';
  /** Number of characters to fetch before/after when expanding */
  expandChars?: number;
}

/**
 * Displays a regulation quote with optional expand/collapse functionality.
 * Used consistently across review cards for regulation text display.
 */
export function ExpandableRegulationQuote({
  text,
  label,
  documentId,
  highlightTerm,
  variant = 'default',
  expandChars = 800,
}: ExpandableRegulationQuoteProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedText, setExpandedText] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [canExpand, setCanExpand] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const borderColorClass = {
    default: 'border-[var(--color-neutral-300)]',
    warning: 'border-[var(--color-warning)]',
    danger: 'border-[var(--color-danger)]',
    info: 'border-[var(--color-info)]',
  }[variant];

  const handleToggleExpand = useCallback(async () => {
    if (isExpanded) {
      setIsExpanded(false);
      return;
    }

    // If we already have expanded text, just show it
    if (expandedText) {
      setIsExpanded(true);
      return;
    }

    // Fetch expanded context
    setIsLoading(true);
    setError(null);
    try {
      const result = await getExpandedContext(documentId, text, expandChars);
      if (!result.success) {
        setError('Failed to load more context');
        setCanExpand(false);
        return;
      }
      if (result.data.couldExpand) {
        setExpandedText(result.data.expandedText);
        setIsExpanded(true);
      } else {
        setCanExpand(false);
      }
    } catch (err) {
      setError('Could not connect to database');
      setCanExpand(false);
    } finally {
      setIsLoading(false);
    }
  }, [isExpanded, expandedText, documentId, text, expandChars]);

  // Highlight the original context within expanded text
  const renderExpandedWithHighlight = useCallback((expanded: string, original: string, term: string | null): ReactNode => {
    const normalizedOriginal = original.replace(/\s+/g, ' ').trim();
    const normalizedExpanded = expanded.replace(/\s+/g, ' ');
    const contextIndex = normalizedExpanded.indexOf(normalizedOriginal);

    if (contextIndex === -1) {
      return highlightTermInText(expanded, term);
    }

    const beforeContext = expanded.slice(0, contextIndex);
    const contextPortion = expanded.slice(contextIndex, contextIndex + normalizedOriginal.length);
    const afterContext = expanded.slice(contextIndex + normalizedOriginal.length);

    return (
      <>
        <span className="text-[var(--color-text-muted)]">{beforeContext}</span>
        <span className="bg-[var(--color-primary-weaker)] px-1 py-0.5 rounded border-l-2 border-[var(--color-primary)]">
          {highlightTermInText(contextPortion, term)}
        </span>
        <span className="text-[var(--color-text-muted)]">{afterContext}</span>
      </>
    );
  }, []);

  const termToHighlight = highlightTerm ?? null;
  const renderedContent = isExpanded && expandedText
    ? renderExpandedWithHighlight(expandedText, text, termToHighlight)
    : highlightInText(text, termToHighlight);

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-[var(--color-text-secondary)]">
          {label}
        </span>
        {canExpand && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleToggleExpand}
            disabled={isLoading}
            className="text-xs py-0.5 px-2 h-auto flex items-center gap-1"
          >
            {isLoading ? (
              'Loading...'
            ) : isExpanded ? (
              <>
                <ChevronUp className="w-3 h-3" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3" />
                Show more context
              </>
            )}
          </Button>
        )}
        {!canExpand && error && (
          <span className="text-[10px] text-[var(--color-danger)] font-medium uppercase tracking-tighter">
            {error}
          </span>
        )}
      </div>
      <div className={`p-3 bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] border-l-4 ${borderColorClass}`}>
        <p className="text-sm text-[var(--color-text)] whitespace-pre-wrap">
          {renderedContent}
        </p>
      </div>
    </div>
  );
}

export default ExpandableRegulationQuote;
